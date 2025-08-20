#!/usr/bin/env node

/**
 * Script to import Microsoft Building Footprints data from Brazil.geojsonl
 * into the Supabase database.
 * 
 * Usage: node scripts/import-footprints.js [options]
 * 
 * Options:
 *   --batch-size <number>    Number of records to insert per batch (default: 1000)
 *   --max-records <number>   Maximum number of records to import (default: all)
 *   --start-line <number>    Line number to start from (default: 1)
 *   --dry-run               Run without actually inserting data
 */

const fs = require('fs');
const readline = require('readline');
const path = require('path');

// Load environment variables from .env file
try {
  require('dotenv').config();
} catch (error) {
  console.error('❌ Missing dependency: dotenv');
  console.error('Please install it with: npm install dotenv');
  process.exit(1);
}

// Check if @supabase/supabase-js is installed
try {
  var { createClient } = require('@supabase/supabase-js');
} catch (error) {
  console.error('❌ Missing dependency: @supabase/supabase-js');
  console.error('Please install it with: npm install @supabase/supabase-js');
  process.exit(1);
}

// Configuration
const GEOJSONL_FILE = './microsoft-build/Brazil.geojsonl';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 1000;
const MAX_RECORDS = parseInt(process.env.MAX_RECORDS) || null;
const START_LINE = parseInt(process.env.START_LINE) || 1;
const DRY_RUN = process.env.DRY_RUN === 'true';

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key for admin operations

// Validate environment variables
if (!supabaseUrl) {
  console.error('❌ Missing SUPABASE_URL environment variable');
  console.error('Please add SUPABASE_URL to your .env file');
  process.exit(1);
}

if (!supabaseKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  console.error('Please add SUPABASE_SERVICE_ROLE_KEY to your .env file');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function importFootprints() {
  console.log('🏗️  Starting Microsoft Building Footprints import...');
  console.log(`📁 File: ${GEOJSONL_FILE}`);
  console.log(`📦 Batch size: ${BATCH_SIZE}`);
  console.log(`🎯 Max records: ${MAX_RECORDS || 'ALL'}`);
  console.log(`🚀 Start line: ${START_LINE}`);
  console.log(`🧪 Dry run: ${DRY_RUN}`);
  console.log('');

  if (!fs.existsSync(GEOJSONL_FILE)) {
    console.error(`❌ File not found: ${GEOJSONL_FILE}`);
    process.exit(1);
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    process.exit(1);
  }

  const fileStream = fs.createReadStream(GEOJSONL_FILE);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity // Handle \r\n properly
  });

  let lineNumber = 0;
  let processedCount = 0;
  let insertedCount = 0;
  let errorCount = 0;
  let batch = [];
  const startTime = Date.now();

  console.log('📊 Processing lines...\n');

  for await (const line of rl) {
    lineNumber++;

    // Skip lines before start line
    if (lineNumber < START_LINE) {
      continue;
    }

    // Check max records limit
    if (MAX_RECORDS && processedCount >= MAX_RECORDS) {
      break;
    }

    try {
      // Parse GeoJSON
      const geojson = JSON.parse(line.trim());
      
      if (geojson.type !== 'Polygon' || !geojson.coordinates || !geojson.coordinates[0]) {
        console.warn(`⚠️  Line ${lineNumber}: Invalid polygon structure, skipping`);
        continue;
      }

      // Validate coordinates
      const coordinates = geojson.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length === 0) {
        console.warn(`⚠️  Line ${lineNumber}: Empty coordinates, skipping`);
        continue;
      }

      // Convert coordinates to WKT format for PostGIS
      const rings = coordinates.map(ring => {
        if (!Array.isArray(ring) || ring.length < 3) {
          throw new Error('Invalid ring: must have at least 3 coordinates');
        }
        return ring.map(coord => {
          if (!Array.isArray(coord) || coord.length < 2) {
            throw new Error('Invalid coordinate: must be [lng, lat]');
          }
          return `${coord[0]} ${coord[1]}`;
        }).join(',');
      });
      const ringsWkt = rings.join('),(');
      const wkt = `POLYGON((${ringsWkt}))`;

      // Add to batch
      batch.push({
        geometry: `SRID=4326;${wkt}`
      });

      processedCount++;

      // Process batch when it reaches the batch size
      if (batch.length >= BATCH_SIZE) {
        const result = await processBatch(batch, insertedCount, errorCount, DRY_RUN);
        insertedCount += result.insertedCount;
        errorCount += result.errorCount;
        batch = [];

        // Progress update
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = processedCount / elapsed;
        console.log(`📈 Processed: ${processedCount.toLocaleString()} | Rate: ${rate.toFixed(1)}/sec | Line: ${lineNumber}`);
      }

    } catch (error) {
      console.error(`❌ Line ${lineNumber}: Parse error - ${error.message}`);
      errorCount++;
    }
  }

  // Process remaining batch
  if (batch.length > 0) {
    const result = await processBatch(batch, insertedCount, errorCount, DRY_RUN);
    insertedCount += result.insertedCount;
    errorCount += result.errorCount;
  }

  // Final summary
  const totalTime = (Date.now() - startTime) / 1000;
  console.log('\n🎉 Import completed!');
  console.log(`📊 Total processed: ${processedCount.toLocaleString()}`);
  console.log(`✅ Successfully inserted: ${insertedCount.toLocaleString()}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`⏱️  Total time: ${totalTime.toFixed(2)}s`);
  console.log(`📈 Average rate: ${(processedCount / totalTime).toFixed(1)} records/sec`);
}

async function processBatch(batch, insertedCount, errorCount, dryRun) {
  if (dryRun) {
    console.log(`🧪 DRY RUN: Would insert batch of ${batch.length} records`);
    return { insertedCount: batch.length, errorCount: 0 };
  }

  try {
    const { data, error } = await supabase
      .from('building_footprints')
      .insert(batch)
      .select('id');

    if (error) {
      console.error(`❌ Batch insert error:`, error);
      return { insertedCount: 0, errorCount: batch.length };
    }

    console.log(`✅ Batch inserted: ${batch.length} records (Total: ${insertedCount + batch.length})`);
    return { insertedCount: batch.length, errorCount: 0 };
  } catch (error) {
    console.error(`❌ Failed to insert batch:`, error.message);
    return { insertedCount: 0, errorCount: batch.length };
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n⏹️  Import interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⏹️  Import terminated');
  process.exit(0);
});

// Run the import
importFootprints().catch(error => {
  console.error('💥 Import failed:', error);
  process.exit(1);
});