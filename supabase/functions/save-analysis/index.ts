// Edge Function – Save Analysis to Database
// Separates the saving logic from the analysis computation

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
  "sem_sombra",      // 0-5% - Área totalmente livre
  "sombra_minima",   // 5-15% - Pequenas obstruções pontuais
  "sombra_parcial",  // 15-30% - Obstruções em parte do dia
  "sombra_moderada", // 30-45% - Sombreamento significativo
  "sombra_severa"    // 45-60% - Sombreamento crítico
]);

const AnalysisSchema = z.object({
  address: z.string(),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number()
  }),
  coverage: z.object({
    google: z.boolean(),
    fallback: z.string().optional()
  }),
  confidence: z.string(),
  usableArea: z.number(),
  areaSource: z.enum(["google", "manual", "footprint", "estimate"]),
  usageFactor: z.number(),
  annualIrradiation: z.number(),
  irradiationSource: z.string(),
  shadingIndex: z.number(),
  shadingLoss: z.number(),
  shadingSource: z.enum(["google_measured", "user_input", "description", "heuristic"]),
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
  footprints: z.array(z.object({
    id: z.string(),
    coordinates: z.array(z.tuple([z.number(), z.number()])),
    area: z.number(),
    isActive: z.boolean(),
    source: z.string()
  })),
  googleSolarData: z.any().optional(),
  technicalNote: z.string()
});

const SaveAnalysisRequestSchema = z.object({
  analysisData: AnalysisSchema
});

/* ========= DATABASE ========= */
async function saveAnalysisToDatabase(analysisData: z.infer<typeof AnalysisSchema>, userId: string, supabase: ReturnType<typeof createClient>) {
  try {
    console.log('Attempting to save analysis for user:', userId);
    console.log('Analysis data keys:', Object.keys(analysisData));
    
    // Normalize coordinates to {lat, lng} format
    let normalizedCoordinates;
    if (Array.isArray(analysisData.coordinates)) {
      // Convert [lng, lat] to {lat, lng}
      const [lng, lat] = analysisData.coordinates;
      normalizedCoordinates = { lat, lng };
    } else {
      // Already in {lat, lng} format
      normalizedCoordinates = analysisData.coordinates;
    }
    
    const insertData = {
      user_id: userId,
      address: analysisData.address,
      coordinates: normalizedCoordinates,
      coverage: analysisData.coverage,
      confidence: analysisData.confidence,
      usable_area: analysisData.usableArea,
      area_source: analysisData.areaSource,
      usage_factor: analysisData.usageFactor,
      annual_ghi: analysisData.annualGHI || analysisData.annualIrradiation,
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
      technical_note: analysisData.technicalNote
    };
    
    console.log('Insert data prepared:', JSON.stringify(insertData, null, 2));
    console.log('Google Solar Data present:', !!analysisData.googleSolarData);
    if (analysisData.googleSolarData) {
      console.log('Google Solar Data keys:', Object.keys(analysisData.googleSolarData));
    }

    const { data, error } = await supabase
      .from('analyses')
      .insert(insertData)
      .select('id, created_at')
      .single();

    if (error) {
      console.error('Database save error:', JSON.stringify(error, null, 2));
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return { error: error.message || 'Database error', code: error.code };
    }

    console.log('Analysis saved successfully:', data);
    return { id: data.id, createdAt: data.created_at };
  } catch (error) {
    console.error('Database save exception:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
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
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    console.error("Auth verification failed:", error);
    return null;
  }
  
  return { user, token };
}

/* ========= MAIN HANDLER ========= */
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    // 1) Auth verification
    const auth = await verifyAuth(req);
    if (!auth) {
      return new Response(JSON.stringify({ success: false, error: "Authentication required" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // 2) Parse and validate request
    const json = await req.json();
    console.log('Raw request body:', JSON.stringify(json, null, 2));
    
    const input = SaveAnalysisRequestSchema.parse(json);
    console.log('Validated input - user:', auth.user.id, 'address:', input.analysisData.address);
    console.log('Auth token present:', !!auth.token, 'length:', auth.token?.length);

    // 3) Save to database with authenticated user context
    // Create Supabase client with the user's access token
    const supabase = createClient(
      SUPABASE_URL, 
      SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${auth.token}`,
          },
        },
      }
    );
    
    const savedResult = await saveAnalysisToDatabase(input.analysisData, auth.user.id, supabase);
    
    if (!savedResult || savedResult.error) {
      console.error('SaveAnalysisToDatabase failed:', savedResult);
      return new Response(JSON.stringify({ 
        success: false, 
        error: savedResult?.error || "Failed to save analysis to database",
        errorCode: savedResult?.code || "DATABASE_SAVE_FAILED"
      }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // 4) Return success with database info
    return new Response(JSON.stringify({ 
      success: true, 
      data: {
        id: savedResult.id,
        createdAt: savedResult.createdAt
      }
    }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Save analysis error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});