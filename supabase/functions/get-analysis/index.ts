// Edge Function – Get Analysis by ID

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

const GetAnalysisRequestSchema = z.object({
  id: z.string().uuid(),
});

/* ========= CORS ========= */
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
    "Access-Control-Max-Age": "86400",
  };
}

/* ========= AUTH ========= */
async function verifyAuth(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return { ok: false as const, error: "Missing or invalid Authorization header" };
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
  return { ok: true as const, user: { id: data.user.id, email: data.user.email ?? undefined } };
}

/* ========= HANDLER ========= */

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
      return new Response(JSON.stringify({ success: false, error: auth.error }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // Body
    const json = await req.json();
    const input = GetAnalysisRequestSchema.parse(json);

    console.log('input', input);
    console.log('input.id', input.id);

    // Get analysis from database with user's JWT token
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader!
        }
      }
    });
    
    const { data: analysis, error } = await supabase
      .from('analyses')
      .select('*')
      .eq('id', input.id)
      .single();

    if (error) {
      console.error('Database query error:', error);
      if (error.code === 'PGRST116') {
        return new Response(JSON.stringify({ success: false, error: "Analysis not found" }), {
          status: 404,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: false, error: "Database error" }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // Transform database result to frontend format
    const transformedAnalysis = {
      id: analysis.id,
      address: analysis.address,
      coordinates: analysis.coordinates,
      coverage: analysis.coverage,
      confidence: analysis.confidence,
      usableArea: analysis.usable_area,
      areaSource: analysis.area_source,
      usageFactor: analysis.usage_factor,
      annualGHI: analysis.annual_ghi,
      irradiationSource: analysis.irradiation_source,
      shadingIndex: analysis.shading_index,
      shadingLoss: analysis.shading_loss,
      shadingSource: analysis.shading_source,
      estimatedProduction: analysis.estimated_production,
      estimatedProductionAC: analysis.estimated_production_ac,
      estimatedProductionDC: analysis.estimated_production_dc,
      estimatedProductionYear1: analysis.estimated_production_year1,
      estimatedProductionYear25: analysis.estimated_production_year25,
      temperatureLosses: analysis.temperature_losses,
      degradationFactor: analysis.degradation_factor,
      effectivePR: analysis.effective_pr,
      verdict: analysis.verdict,
      reasons: analysis.reasons,
      recommendations: analysis.recommendations,
      warnings: analysis.warnings,
      footprints: analysis.footprints,
      googleSolarData: analysis.google_solar_data,
      technicalNote: analysis.technical_note,
      createdAt: analysis.created_at,
      updatedAt: analysis.updated_at
    };

    return new Response(JSON.stringify({ success: true, data: transformedAnalysis }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }
});