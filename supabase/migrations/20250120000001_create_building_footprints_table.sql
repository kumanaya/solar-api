-- Create extension for PostGIS if not exists
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create table for Microsoft Building Footprints
CREATE TABLE IF NOT EXISTS building_footprints (
    id BIGSERIAL PRIMARY KEY,
    geometry GEOMETRY(Polygon, 4326) NOT NULL,
    area_m2 REAL GENERATED ALWAYS AS (ST_Area(geometry::geography)) STORED,
    bounds GEOMETRY(Polygon, 4326) GENERATED ALWAYS AS (ST_Envelope(geometry)) STORED,
    centroid GEOMETRY(Point, 4326) GENERATED ALWAYS AS (ST_Centroid(geometry)) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create spatial index on geometry
CREATE INDEX IF NOT EXISTS idx_building_footprints_geometry 
ON building_footprints USING GIST (geometry);

-- Create spatial index on centroid for faster point-in-polygon queries
CREATE INDEX IF NOT EXISTS idx_building_footprints_centroid 
ON building_footprints USING GIST (centroid);

-- Create index on bounds for envelope queries
CREATE INDEX IF NOT EXISTS idx_building_footprints_bounds 
ON building_footprints USING GIST (bounds);

-- Create index on area for filtering by size
CREATE INDEX IF NOT EXISTS idx_building_footprints_area 
ON building_footprints (area_m2);

-- Add comment to table
COMMENT ON TABLE building_footprints IS 'Microsoft Building Footprints dataset for Brazil - contains polygon geometries of building footprints';
COMMENT ON COLUMN building_footprints.geometry IS 'Building footprint polygon in WGS84 (SRID 4326)';
COMMENT ON COLUMN building_footprints.area_m2 IS 'Calculated area of the building footprint in square meters';
COMMENT ON COLUMN building_footprints.bounds IS 'Bounding box envelope of the building footprint';
COMMENT ON COLUMN building_footprints.centroid IS 'Centroid point of the building footprint';

-- Create function to find nearby building footprints
CREATE OR REPLACE FUNCTION find_nearby_buildings(
    target_lat REAL,
    target_lng REAL,
    search_radius_meters INTEGER DEFAULT 50,
    max_results INTEGER DEFAULT 10
) 
RETURNS TABLE (
    id BIGINT,
    geometry_geojson JSONB,
    area_m2 REAL,
    distance_meters REAL
) 
LANGUAGE SQL STABLE
AS $$
    SELECT 
        bf.id,
        ST_AsGeoJSON(bf.geometry)::JSONB as geometry_geojson,
        bf.area_m2,
        ST_Distance(bf.centroid::geography, ST_Point(target_lng, target_lat)::geography) as distance_meters
    FROM building_footprints bf
    WHERE ST_DWithin(
        bf.centroid::geography, 
        ST_Point(target_lng, target_lat)::geography, 
        search_radius_meters
    )
    ORDER BY ST_Distance(bf.centroid::geography, ST_Point(target_lng, target_lat)::geography)
    LIMIT max_results;
$$;

-- Create function to find the closest building footprint
CREATE OR REPLACE FUNCTION find_closest_building(
    target_lat REAL,
    target_lng REAL,
    max_distance_meters INTEGER DEFAULT 100
) 
RETURNS TABLE (
    id BIGINT,
    geometry_geojson JSONB,
    area_m2 REAL,
    distance_meters REAL
) 
LANGUAGE SQL STABLE
AS $$
    SELECT 
        bf.id,
        ST_AsGeoJSON(bf.geometry)::JSONB as geometry_geojson,
        bf.area_m2,
        ST_Distance(bf.centroid::geography, ST_Point(target_lng, target_lat)::geography) as distance_meters
    FROM building_footprints bf
    WHERE ST_DWithin(
        bf.centroid::geography, 
        ST_Point(target_lng, target_lat)::geography, 
        max_distance_meters
    )
    ORDER BY ST_Distance(bf.centroid::geography, ST_Point(target_lng, target_lat)::geography)
    LIMIT 1;
$$;