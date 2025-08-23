// Edge Function – Save Analysis to Database
/// <reference lib="dom" />

// @ts-expect-error Deno types no edge
declare const Deno: {
  env: { get(k: string): string | undefined };
  serve(h: (r: Request) => Response | Promise<Response>): void;
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.5";
import { z } from "https://esm.sh/zod@3.23.8";

/* ========= ENV ========= */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

/* ========= SCHEMAS ========= */
const ShadingDescriptionEnum = z.enum([
  "sem_sombra",
  "sombra_minima",
  "sombra_parcial",
  "sombra_moderada",
  "sombra_severa",
]);

const AnalysisSchema = z.object({
  address: z.string(),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  coverage: z.object({
    google: z.boolean(),
    fallback: z.string().optional(),
  }),
  confidence: z.string(),
  usableArea: z.number(),
  areaSource: z.enum(["google", "manual", "footprint", "estimate"]),
  usageFactor: z.number(),
  annualIrradiation: z.number(),
  annualGHI: z.number().optional(), // Campo opcional para compatibilidade
  irradiationSource: z.string(),
  shadingIndex: z.number(),
  shadingLoss: z.number(),
  shadingSource: z.enum([
    "google_measured",
    "user_input",
    "description",
    "heuristic",
  ]),
  estimatedProduction: z.number(),
  estimatedProductionAC: z.number(),
  estimatedProductionDC: z.number(),
  estimatedProductionYear1: z.number(),
  estimatedProductionYear25: z.number(),
  temperatureLosses: z.number(),
  degradationFactor: z.number(),
  effectivePR: z.number(),
  verdict: z.enum(["Apto", "Parcial", "Não apto"]),
  reasons: z.array(z.string()),
  recommendations: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  footprints: z.array(
    z.object({
      id: z.string(),
      coordinates: z.array(z.tuple([z.number(), z.number()])),
      area: z.number(),
      isActive: z.boolean(),
      source: z.string(),
    })
  ),
  googleSolarData: z.any().optional(),
  technicalNote: z.string(),
  originalAnalysisId: z.string().uuid().optional(),
  reprocessParameters: z
    .object({
      tiltEstimated: z.number().optional(),
      preferredSource: z.string().optional(),
      updateFootprint: z.boolean().optional(),
    })
    .optional(),
  // New fields for API tracking
  apiSourcesUsed: z.array(z.string()).optional(),
  apiResponseTimes: z.record(z.number()).optional(),
  apiErrors: z.record(z.string()).optional(),
  fallbackReasons: z.array(z.string()).optional(),
  nasaPowerData: z.any().optional(),
  pvgisData: z.any().optional(),
  // Imagery metadata fields
  imageryMetadata: z.object({
    source: z.enum(["google_solar", "esri_world_imagery"]).optional(),
    captureDate: z.string().optional(),
    resolution: z.string().optional(),
    sourceInfo: z.string().optional(),
    accuracy: z.string().optional()
  }).optional(),
});

const SaveAnalysisRequestSchema = z.object({
  analysisData: AnalysisSchema,
});

/* ========= DATABASE ========= */
async function saveAnalysisToDatabase(
  analysisData: z.infer<typeof AnalysisSchema>,
  userId: string,
  supabase: ReturnType<typeof createClient>
) {
  try {
    // Normalize coordinates to {lat, lng} format
    let normalizedCoordinates;
    if (Array.isArray(analysisData.coordinates)) {
      const [lng, lat] = analysisData.coordinates;
      normalizedCoordinates = { lat, lng };
    } else {
      normalizedCoordinates = analysisData.coordinates;
    }

    // Novo: salve annual_irradiation sempre como número. Aceite ambos annualIrradiation e annualGHI por compatibilidade.
    const annualIrradiationValue = Number(
      analysisData.annualIrradiation ?? analysisData.annualGHI ?? 0
    );

    const insertData = {
      user_id: userId,
      address: analysisData.address,
      coordinates: normalizedCoordinates,
      coverage: analysisData.coverage,
      confidence: analysisData.confidence,
      usable_area: analysisData.usableArea,
      area_source: analysisData.areaSource,
      usage_factor: analysisData.usageFactor,
      annual_irradiation: annualIrradiationValue,
      annual_ghi: annualIrradiationValue, // Usando o mesmo valor do annual_irradiation por enquanto
      irradiation_source: analysisData.irradiationSource,
      shading_index: analysisData.shadingIndex,
      shading_loss: analysisData.shadingLoss,
      shading_source: analysisData.shadingSource,
      estimated_production: analysisData.estimatedProduction,
      estimated_production_ac: analysisData.estimatedProductionAC,
      estimated_production_dc: analysisData.estimatedProductionDC,
      estimated_production_year1: analysisData.estimatedProductionYear1,
      estimated_production_year25: analysisData.estimatedProductionYear25,
      temperature_losses: analysisData.temperatureLosses,
      degradation_factor: analysisData.degradationFactor,
      effective_pr: analysisData.effectivePR,
      verdict: analysisData.verdict,
      reasons: analysisData.reasons,
      recommendations: analysisData.recommendations,
      warnings: analysisData.warnings,
      footprints: analysisData.footprints,
      google_solar_data: analysisData.googleSolarData || null,
      technical_note: analysisData.technicalNote,
      original_analysis_id: analysisData.originalAnalysisId || null,
      reprocess_parameters: analysisData.reprocessParameters || null,
      // New API tracking fields
      api_sources_used: analysisData.apiSourcesUsed || [],
      api_response_times: analysisData.apiResponseTimes || {},
      api_errors: analysisData.apiErrors || {},
      fallback_reasons: analysisData.fallbackReasons || [],
      nasa_power_data: analysisData.nasaPowerData || null,
      pvgis_data: analysisData.pvgisData || null,
      imagery_metadata: analysisData.imageryMetadata || null,
    };

    const { data, error } = await supabase
      .from("analyses")
      .insert(insertData)
      .select("id, created_at")
      .single();

    if (error) {
      return { error: error.message || "Database error", code: error.code };
    }

    return { id: data.id, createdAt: data.created_at };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/* ========= AUTH ========= */
async function verifyAuth(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return { user, token };
}

/* ========= MAIN HANDLER ========= */
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...headers, "Content-Type": "application/json" },
      }
    );
  }

  try {
    // 1) Auth verification
    const auth = await verifyAuth(req);
    if (!auth) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        {
          status: 401,
          headers: { ...headers, "Content-Type": "application/json" },
        }
      );
    }

    // 2) Parse and validate request
    const json = await req.json();
    const input = SaveAnalysisRequestSchema.parse(json);

    // 3) Save to database with authenticated user context
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      },
    });

    const savedResult = await saveAnalysisToDatabase(
      input.analysisData,
      auth.user.id,
      supabase
    );

    if (!savedResult || savedResult.error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: savedResult?.error || "Failed to save analysis to database",
          errorCode: savedResult?.code || "DATABASE_SAVE_FAILED",
        }),
        {
          status: 500,
          headers: { ...headers, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: savedResult.id,
          createdAt: savedResult.createdAt,
        },
      }),
      {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
