// API Cache management functions
// Handles caching and retrieval of external API data

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface CacheResult<T> {
  success: boolean;
  data?: T;
  fromCache: boolean;
  cacheId?: string;
  error?: string;
}

export interface GoogleSolarCacheData {
  id: string;
  building_insights?: any;
  data_layers?: any;
  imagery_date?: string;
  imagery_processed_date?: string;
  imagery_quality?: string;
  pixel_size_meters?: number;
  region_code?: string;
  full_response: any;
  api_response_time_ms?: number;
}

export interface PVGISCacheData {
  id: string;
  annual_irradiation?: number;
  monthly_data?: any;
  totals_data?: any;
  location_elevation?: number;
  full_response: any;
  api_response_time_ms?: number;
}

export interface NASAPowerCacheData {
  id: string;
  annual_ghi?: number;
  daily_values?: any;
  location_elevation?: number;
  full_response: any;
  api_response_time_ms?: number;
}

/**
 * Get or fetch Google Solar API data with caching
 */
export async function getGoogleSolarData(
  supabase: SupabaseClient,
  lat: number,
  lng: number,
  radiusMeters: number = 100
): Promise<CacheResult<GoogleSolarCacheData>> {
  try {
    // Round coordinates to avoid cache misses from tiny differences
    const roundedLat = Number(lat.toFixed(6));
    const roundedLng = Number(lng.toFixed(6));
    
    // Check cache first
    const { data: cached, error: cacheError } = await supabase
      .from('google_solar_cache')
      .select('*')
      .eq('lat', roundedLat)
      .eq('lng', roundedLng)
      .eq('radius_meters', radiusMeters)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (cached && !cacheError) {
      console.log('🎯 Google Solar cache hit');
      return {
        success: true,
        data: cached,
        fromCache: true,
        cacheId: cached.id
      };
    }
    
    console.log('🌐 Fetching fresh Google Solar data');
    
    // Fetch from Google Solar API
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      throw new Error('Google Maps API key not configured');
    }
    
    const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=LOW&key=${apiKey}`;
    
    const startTime = Date.now();
    const response = await fetch(url);
    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Solar API error:', response.status, errorText);
      
      // Provide more specific error message for 404 (no coverage)
      let errorMessage = `Google Solar API error: ${response.status}`;
      if (response.status === 404) {
        errorMessage = `Google Solar não tem cobertura disponível para esta localização`;
        console.log(`ℹ️ Google Solar coverage not available for: ${lat}, ${lng}`);
      }
      
      // Cache the error to avoid repeated failed calls
      await supabase.from('google_solar_cache').insert({
        lat: roundedLat,
        lng: roundedLng,
        radius_meters: radiusMeters,
        full_response: { error: errorText, status: response.status },
        api_error: errorText,
        api_response_time_ms: responseTime,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 1 day for errors
      });
      
      return {
        success: false,
        error: errorMessage,
        fromCache: false
      };
    }
    
    const fullResponse = await response.json();
    
    // Extract relevant data
    const buildingInsights = fullResponse.solarPotential;
    const dataLayersInfo = fullResponse.solarPotential?.dataLayers;
    const imageryDate = fullResponse.solarPotential?.imageryDate;
    const imageryProcessedDate = fullResponse.solarPotential?.imageryProcessedDate;
    const imageryQuality = fullResponse.solarPotential?.imageryQuality;
    const pixelSizeMeters = fullResponse.solarPotential?.pixelSizeMeters;
    const regionCode = fullResponse.regionCode;
    
    // Cache the successful response
    const { data: inserted, error: insertError } = await supabase
      .from('google_solar_cache')
      .insert({
        lat: roundedLat,
        lng: roundedLng,
        radius_meters: radiusMeters,
        building_insights: buildingInsights,
        data_layers: dataLayersInfo,
        imagery_date: imageryDate,
        imagery_processed_date: imageryProcessedDate,
        imagery_quality: imageryQuality,
        pixel_size_meters: pixelSizeMeters,
        region_code: regionCode,
        full_response: fullResponse,
        api_response_time_ms: responseTime
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('Failed to cache Google Solar data:', insertError);
    }
    
    console.log(`✅ Google Solar data fetched in ${responseTime}ms`);
    
    return {
      success: true,
      data: inserted || {
        id: 'uncached',
        building_insights: buildingInsights,
        data_layers: dataLayersInfo,
        imagery_date: imageryDate,
        imagery_processed_date: imageryProcessedDate,
        imagery_quality: imageryQuality,
        pixel_size_meters: pixelSizeMeters,
        region_code: regionCode,
        full_response: fullResponse,
        api_response_time_ms: responseTime
      },
      fromCache: false,
      cacheId: inserted?.id
    };
    
  } catch (error) {
    console.error('Google Solar API error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      fromCache: false
    };
  }
}

/**
 * Get or fetch PVGIS API data with caching
 */
export async function getPVGISData(
  supabase: SupabaseClient,
  lat: number,
  lng: number,
  slope: number = 35,
  azimuth: number = 0,
  peakPower: number = 1
): Promise<CacheResult<PVGISCacheData>> {
  try {
    const roundedLat = Number(lat.toFixed(6));
    const roundedLng = Number(lng.toFixed(6));
    
    // Check cache first
    const { data: cached, error: cacheError } = await supabase
      .from('pvgis_cache')
      .select('*')
      .eq('lat', roundedLat)
      .eq('lng', roundedLng)
      .eq('slope', slope)
      .eq('azimuth', azimuth)
      .eq('peak_power', peakPower)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (cached && !cacheError) {
      console.log('🎯 PVGIS cache hit');
      return {
        success: true,
        data: cached,
        fromCache: true,
        cacheId: cached.id
      };
    }
    
    console.log('🌐 Fetching fresh PVGIS data');
    
    // Fetch from PVGIS API
    const url = `https://re.jrc.ec.europa.eu/api/v5_2/PVcalc` +
      `?lat=${lat}&lon=${lng}&raddatabase=PVGIS-SARAH2&browser=1` +
      `&usehorizon=1&userhorizon=&outputformat=json&js=1&select_database_grid=PVGIS-SARAH2` +
      `&pvtechchoice=crystSi&peakpower=${peakPower}&loss=14&mountingplace=free` +
      `&angle=${slope}&aspect=${azimuth}`;
    
    const startTime = Date.now();
    const response = await fetch(url);
    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('PVGIS API error:', response.status, errorText);
      
      // Cache the error
      await supabase.from('pvgis_cache').insert({
        lat: roundedLat,
        lng: roundedLng,
        slope,
        azimuth,
        peak_power: peakPower,
        full_response: { error: errorText, status: response.status },
        api_error: errorText,
        api_response_time_ms: responseTime,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });
      
      return {
        success: false,
        error: `PVGIS API error: ${response.status}`,
        fromCache: false
      };
    }
    
    const fullResponse = await response.json();
    
    // Extract relevant data
    const totalsData = fullResponse.outputs?.totals?.fixed;
    const monthlyData = fullResponse.outputs?.monthly?.fixed;
    const annualIrradiation = totalsData?.['H(i)_y'];
    const locationElevation = fullResponse.inputs?.location?.elevation;
    
    // Cache the successful response
    const { data: inserted, error: insertError } = await supabase
      .from('pvgis_cache')
      .insert({
        lat: roundedLat,
        lng: roundedLng,
        slope,
        azimuth,
        peak_power: peakPower,
        annual_irradiation: annualIrradiation,
        monthly_data: monthlyData,
        totals_data: totalsData,
        location_elevation: locationElevation,
        full_response: fullResponse,
        api_response_time_ms: responseTime
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('Failed to cache PVGIS data:', insertError);
    }
    
    console.log(`✅ PVGIS data fetched in ${responseTime}ms`);
    
    return {
      success: true,
      data: inserted || {
        id: 'uncached',
        annual_irradiation: annualIrradiation,
        monthly_data: monthlyData,
        totals_data: totalsData,
        location_elevation: locationElevation,
        full_response: fullResponse,
        api_response_time_ms: responseTime
      },
      fromCache: false,
      cacheId: inserted?.id
    };
    
  } catch (error) {
    console.error('PVGIS API error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      fromCache: false
    };
  }
}

/**
 * Get or fetch NASA POWER API data with caching
 */
export async function getNASAPowerData(
  supabase: SupabaseClient,
  lat: number,
  lng: number,
  year: number = 2024
): Promise<CacheResult<NASAPowerCacheData>> {
  try {
    const roundedLat = Number(lat.toFixed(6));
    const roundedLng = Number(lng.toFixed(6));
    
    // Check cache first
    const { data: cached, error: cacheError } = await supabase
      .from('nasa_power_cache')
      .select('*')
      .eq('lat', roundedLat)
      .eq('lng', roundedLng)
      .eq('year', year)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (cached && !cacheError) {
      console.log('🎯 NASA POWER cache hit');
      return {
        success: true,
        data: cached,
        fromCache: true,
        cacheId: cached.id
      };
    }
    
    console.log('🌐 Fetching fresh NASA POWER data');
    
    // Fetch from NASA POWER API
    const url = `https://power.larc.nasa.gov/api/temporal/daily/point` +
      `?parameters=ALLSKY_SFC_SW_DWN&community=SB&longitude=${lng}&latitude=${lat}` +
      `&start=${year}0101&end=${year}1231&format=JSON`;
    
    const startTime = Date.now();
    const response = await fetch(url);
    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('NASA POWER API error:', response.status, errorText);
      
      // Cache the error
      await supabase.from('nasa_power_cache').insert({
        lat: roundedLat,
        lng: roundedLng,
        year,
        full_response: { error: errorText, status: response.status },
        api_error: errorText,
        api_response_time_ms: responseTime,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });
      
      return {
        success: false,
        error: `NASA POWER API error: ${response.status}`,
        fromCache: false
      };
    }
    
    const fullResponse = await response.json();
    
    // Calculate annual GHI from daily values
    // NASA POWER returns values in MJ/m²/day, need to convert to kWh/m²/year
    const dailyValues = fullResponse.properties?.parameter?.ALLSKY_SFC_SW_DWN;
    let annualGHI = 0;
    
    if (dailyValues) {
      const values = Object.values(dailyValues) as number[];
      // Filter out invalid values and sum daily values
      const validValues = values.filter(val => val > 0 && val < 50); // Daily GHI typically 2-35 MJ/m²/day
      const totalMJ = validValues.reduce((sum, val) => sum + val, 0);
      // Convert MJ to kWh: 1 MJ = 0.278 kWh
      annualGHI = Math.round(totalMJ * 0.278);
      
      console.log(`NASA POWER conversion: ${validValues.length} valid days, total ${totalMJ.toFixed(1)} MJ/m²/year → ${annualGHI} kWh/m²/year`);
      console.log(`Daily average: ${(totalMJ / validValues.length).toFixed(2)} MJ/m²/day`);
      
      // Sanity check: annual GHI should be 1000-2500 kWh/m²/year in Brazil
      if (annualGHI > 3000 || annualGHI < 500) {
        console.warn(`⚠️ NASA POWER GHI seems invalid: ${annualGHI} kWh/m²/year`);
        // Use average Brazilian GHI as fallback
        annualGHI = 1800;
      }
    }
    
    const locationElevation = fullResponse.geometry?.coordinates?.[2];
    
    // Cache the successful response
    const { data: inserted, error: insertError } = await supabase
      .from('nasa_power_cache')
      .insert({
        lat: roundedLat,
        lng: roundedLng,
        year,
        annual_ghi: annualGHI,
        daily_values: dailyValues,
        location_elevation: locationElevation,
        full_response: fullResponse,
        api_response_time_ms: responseTime
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('Failed to cache NASA POWER data:', insertError);
    }
    
    console.log(`✅ NASA POWER data fetched in ${responseTime}ms`);
    
    return {
      success: true,
      data: inserted || {
        id: 'uncached',
        annual_ghi: annualGHI,
        daily_values: dailyValues,
        location_elevation: locationElevation,
        full_response: fullResponse,
        api_response_time_ms: responseTime
      },
      fromCache: false,
      cacheId: inserted?.id
    };
    
  } catch (error) {
    console.error('NASA POWER API error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      fromCache: false
    };
  }
}

/**
 * Clean expired cache entries (should be called periodically)
 */
export async function cleanExpiredCache(supabase: SupabaseClient): Promise<void> {
  const now = new Date().toISOString();
  
  try {
    // Clean Google Solar cache
    const { error: googleError } = await supabase
      .from('google_solar_cache')
      .delete()
      .lt('expires_at', now);
    
    if (googleError) {
      console.error('Failed to clean Google Solar cache:', googleError);
    }
    
    // Clean PVGIS cache
    const { error: pvgisError } = await supabase
      .from('pvgis_cache')
      .delete()
      .lt('expires_at', now);
    
    if (pvgisError) {
      console.error('Failed to clean PVGIS cache:', pvgisError);
    }
    
    // Clean NASA POWER cache
    const { error: nasaError } = await supabase
      .from('nasa_power_cache')
      .delete()
      .lt('expires_at', now);
    
    if (nasaError) {
      console.error('Failed to clean NASA POWER cache:', nasaError);
    }
    
    console.log('🧹 Cache cleanup completed');
  } catch (error) {
    console.error('Cache cleanup error:', error);
  }
}