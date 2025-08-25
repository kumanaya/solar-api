// Edge Function – Análise Solar Simplificada (v4.0 - Cache System)
// Refatorada para usar sistema de cache e funções compartilhadas

// @ts-expect-error Import from URL
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.5";
// @ts-expect-error Import from URL
import { z } from "https://esm.sh/zod@3.23.8";

// Import shared functions
import { 
  calculateSolarProduction, 
  classifyVerdict, 
  calculatePolygonArea,
  SOLAR_CONSTANTS,
  estimateShading,
  getBrazilRegionalTemp
} from "../shared/solar-calculations.ts";
import {
  getGoogleSolarData,
  getPVGISData, 
  getNASAPowerData,
  cleanExpiredCache
} from "../shared/api-cache.ts";

declare const Deno: {
  env: { get(k: string): string | undefined };
  serve(h: (r: Request) => Response | Promise<Response>): void;
};

/* ========= ENV ========= */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

/* ========= CONSTANTES SIMPLIFICADAS ========= */
const BRAZIL_BOUNDS = {
  north: 5.27,
  south: -33.75,
  east: -34.79,
  west: -73.98,
};

/* ========= SCHEMAS SIMPLIFICADOS ========= */
const AnalyzeRequestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  polygon: z
    .object({
      type: z.literal("Polygon"),
      coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
    })
    .optional(),
});





/* ========= HELPERS SIMPLES ========= */
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, apikey, x-client-info",
    "Access-Control-Max-Age": "86400",
  };
}

function isBrazilianCoordinate(lat: number, lng: number): boolean {
  return (
    lat >= BRAZIL_BOUNDS.south &&
    lat <= BRAZIL_BOUNDS.north &&
    lng >= BRAZIL_BOUNDS.west &&
    lng <= BRAZIL_BOUNDS.east
  );
}











/* ========= AUTH ========= */
async function verifyAuth(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return {
      ok: false as const,
      error: "Missing or invalid Authorization header",
    };
  }
  const token = auth.replace("Bearer ", "").trim();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { ok: false as const, error: "Supabase env not configured" };
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { ok: false as const, error: "Invalid or expired token" };
  }
  return {
    ok: true as const,
    user: { id: data.user.id, email: data.user.email ?? undefined },
  };
}

/* ========= HANDLER PRINCIPAL SIMPLIFICADO ========= */
Deno.serve(async (req: Request) => {
  const headers = corsHeaders();
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    // Auth
    const auth = await verifyAuth(req);
    if (!auth.ok) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error }),
        {
          status: 401,
          headers: { ...headers, "Content-Type": "application/json" },
        }
      );
    }

    // Parse simplified body
    const json = await req.json();
    const input = AnalyzeRequestSchema.parse(json);
    const { lat, lng, polygon } = input;

    const isBrazil = isBrazilianCoordinate(lat, lng);
    console.log(`Análise solar simplificada: lat=${lat}, lng=${lng}, Brasil=${isBrazil}`);

    // Initialize Supabase client with user's JWT token
    const authToken = req.headers.get("Authorization")?.replace("Bearer ", "").trim();
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }
    });

    // Clean expired cache entries (periodic cleanup)
    await cleanExpiredCache(supabase);

    // Call APIs with cache first approach
    const [googleResult, pvgisResult, nasaResult] = await Promise.allSettled([
      getGoogleSolarData(supabase, lat, lng),
      getPVGISData(supabase, lat, lng),
      getNASAPowerData(supabase, lat, lng)
    ]);

    // Extract results
    const googleData = googleResult.status === 'fulfilled' && googleResult.value.success 
      ? googleResult.value.data : null;
    const pvgisData = pvgisResult.status === 'fulfilled' && pvgisResult.value.success 
      ? pvgisResult.value.data : null;
    const nasaData = nasaResult.status === 'fulfilled' && nasaResult.value.success 
      ? nasaResult.value.data : null;

    // Calculate area from polygon if provided
    let usableArea = 30; // default fallback
    let areaSource = 'estimate';
    
    if (polygon?.coordinates?.length) {
      const coords = polygon.coordinates[0] as [number, number][];
      usableArea = Math.round(calculatePolygonArea([coords]) * 0.8); // 80% usage factor
      areaSource = 'polygon';
    } else if (googleData?.building_insights?.maxArrayAreaMeters2) {
      usableArea = Math.round(googleData.building_insights.maxArrayAreaMeters2);
      areaSource = 'google';
    }

    // Determine GHI from available sources
    let ghi = 1800; // default fallback
    let irradiationSource = 'default';
    
    if (nasaData?.annual_ghi) {
      ghi = nasaData.annual_ghi;
      irradiationSource = 'nasa';
    } else if (pvgisData?.annual_irradiation) {
      ghi = pvgisData.annual_irradiation;
      irradiationSource = 'pvgis';
    } else if (isBrazil) {
      // Use regional estimates for Brazil
      ghi = lat > -10 ? 1950 : lat > -16 ? 1800 : lat > -24 ? 1650 : 1450;
      irradiationSource = 'brazil_regional';
    }

    // Estimate shading based on location
    const shadingData = estimateShading(`${lat},${lng}`);
    
    // Calculate solar production using shared functions
    const solarResult = calculateSolarProduction({
      ghi_kwh_m2_year: ghi,
      usable_area_m2: usableArea,
      shade_factor: 1 - shadingData.shading_factor, // convert to shade factor
      temperature_celsius: getBrazilRegionalTemp(lat),
      latitude: lat
    });

    // Classify verdict using shared function
    const verdict = classifyVerdict({
      usable_area_m2: usableArea,
      shade_index: shadingData.shading_factor,
      is_brazil: isBrazil,
      lat: lat
    });

    // Save analysis to database and return minimal data + API IDs
    const { data: analysisRecord, error: saveError } = await supabase
      .from('analysis_results')
      .insert({
        user_id: auth.user.id,
        lat,
        lng,
        usable_area: usableArea,
        area_source: areaSource,
        annual_irradiation: ghi,
        irradiation_source: irradiationSource,
        shading_index: shadingData.shading_factor,
        shading_source: shadingData.shading_source,
        estimated_production: solarResult.annual_production_kwh,
        transposition_factor: solarResult.transposition_factor,
        temperature_losses: solarResult.temperature_losses_percent,
        degradation_factor: solarResult.degradation_factor,
        effective_pr: solarResult.effective_pr,
        verdict: verdict.verdict,
        google_solar_cache_id: googleData?.id || null,
        pvgis_cache_id: pvgisData?.id || null,
        nasa_power_cache_id: nasaData?.id || null,
        polygon: polygon ? JSON.stringify(polygon) : null
      })
      .select('id')
      .single();

    if (saveError) {
      console.error('Error saving analysis:', saveError);
      throw new Error('Failed to save analysis');
    }

    // Return minimal response for frontend processing
    const response = {
      success: true,
      data: {
        id: analysisRecord.id,
        coordinates: [lat, lng],
        usable_area: usableArea,
        area_source: areaSource,
        annual_irradiation: ghi,
        irradiation_source: irradiationSource,
        shading_index: shadingData.shading_factor,
        estimated_production: solarResult.annual_production_kwh,
        verdict: verdict.verdict,
        reasons: verdict.reasons,
        recommendations: verdict.recommendations,
        warnings: verdict.warnings,
        coverage: {
          google: !!googleData,
          pvgis: !!pvgisData,
          nasa: !!nasaData
        },
        api_cache_ids: {
          google: googleData?.id || null,
          pvgis: pvgisData?.id || null,
          nasa: nasaData?.id || null
        }
      },
      metadata: {
        version: "4.0",
        timestamp: new Date().toISOString(),
        location: isBrazil ? "Brazil" : "International",
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
    
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("Error in solar analysis:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
