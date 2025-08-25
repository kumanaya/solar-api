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
  "sem_sombra", "sombra_minima", "sombra_parcial", "sombra_moderada", "sombra_severa"
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

    // Get analysis from database with user's JWT token
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader!
        }
      }
    });
    
    // Query the new architecture tables
    const { data: analysisResult, error: resultError } = await supabase
      .from('analysis_results')
      .select('*')
      .eq('id', input.id)
      .single();

    if (resultError) {
      if (resultError.code === 'PGRST116') {
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

    // Get the most recent adjustments for this analysis (if any)
    const { data: adjustments, error: adjustError } = await supabase
      .from('analysis_adjustments')
      .select('*')
      .eq('analysis_id', input.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    // Combine data from analysis_results and analysis_adjustments
    const latestAdjustment = adjustments && adjustments.length > 0 ? adjustments[0] : null;
    
    // Build response from analysis_results with potential adjustments
    const transformedAnalysis = {
      id: analysisResult.id,
      address: `Análise ${analysisResult.id.slice(0, 8)}`, // Generic address since we don't store it in new architecture
      coordinates: {
        lat: Number(analysisResult.lat),
        lng: Number(analysisResult.lng)
      },
      coverage: {
        google: latestAdjustment?.metadata ? 
          JSON.parse(latestAdjustment.metadata).coverage?.google || false : 
          false,
        fallback: "Usando dados NASA SRTM"
      },
      confidence: "Média", // Default confidence
      usableArea: Number(latestAdjustment?.usable_area || analysisResult.usable_area),
      areaSource: latestAdjustment?.area_source || analysisResult.area_source,
      usageFactor: 0.8, // Default usage factor
      annualIrradiation: Number(latestAdjustment?.annual_irradiation || analysisResult.annual_irradiation),
      irradiationSource: latestAdjustment?.irradiation_source || analysisResult.irradiation_source,
      shadingIndex: Number(latestAdjustment?.shading_index || analysisResult.shading_index),
      shadingLoss: Math.round((latestAdjustment?.shading_index || analysisResult.shading_index) * 100),
      shadingSource: "heuristic", // Default shading source
      estimatedProduction: Number(latestAdjustment?.estimated_production || analysisResult.estimated_production),
      estimatedProductionAC: Number(latestAdjustment?.estimated_production || analysisResult.estimated_production),
      estimatedProductionDC: Number((latestAdjustment?.estimated_production || analysisResult.estimated_production) * 1.05),
      estimatedProductionYear1: Number(latestAdjustment?.estimated_production || analysisResult.estimated_production),
      estimatedProductionYear25: Number((latestAdjustment?.estimated_production || analysisResult.estimated_production) * 0.85),
      temperatureLosses: Number(analysisResult.temperature_losses || 5),
      degradationFactor: Number(analysisResult.degradation_factor || 0.995),
      effectivePR: Number(analysisResult.effective_pr || 0.8),
      verdict: latestAdjustment?.verdict || analysisResult.verdict,
      reasons: latestAdjustment?.metadata ? 
        JSON.parse(latestAdjustment.metadata).reasons || [] : 
        [],
      recommendations: latestAdjustment?.metadata ? 
        JSON.parse(latestAdjustment.metadata).recommendations || [] : 
        [],
      warnings: latestAdjustment?.metadata ? 
        JSON.parse(latestAdjustment.metadata).warnings || [] : 
        [],
      footprints: [], // Footprints not stored in new architecture
      googleSolarData: null, // Not stored in new architecture
      technicalNote: latestAdjustment?.additional_details || "Análise gerada pela nova arquitetura",
      technicianInputs: latestAdjustment ? {
        panel_count: latestAdjustment.panel_count,
        energy_cost_per_kwh: latestAdjustment.energy_cost_per_kwh,
        solar_incentives: latestAdjustment.solar_incentives,
        installation_cost_per_watt: latestAdjustment.installation_cost_per_watt,
        panel_capacity_watts: latestAdjustment.panel_capacity_watts,
        show_advanced_settings: false,
        additional_details: latestAdjustment.additional_details,
        system_lifetime_years: latestAdjustment.system_lifetime_years,
        dc_to_ac_conversion: 0.96,
        annual_degradation_rate: latestAdjustment.annual_degradation_rate,
        annual_energy_cost_increase: latestAdjustment.annual_energy_cost_increase,
        discount_rate: latestAdjustment.discount_rate
      } : null,
      marginOfError: latestAdjustment?.margin_of_error || analysisResult.margin_of_error || "±5%",
      suggestedSystemConfig: latestAdjustment ? {
        panel_count: latestAdjustment.suggested_panel_count || 0,
        system_power_kwp: (latestAdjustment.suggested_panel_count || 0) * (latestAdjustment.suggested_panel_power_watts || 550) / 1000,
        panel_power_watts: latestAdjustment.suggested_panel_power_watts || 550,
        panel_area_m2: latestAdjustment.suggested_panel_area_m2 || 2.5,
        module_efficiency_percent: latestAdjustment.suggested_module_efficiency_percent || 21.5,
        occupied_area_m2: latestAdjustment.suggested_occupied_area_m2 || 0,
        power_density_w_m2: latestAdjustment.suggested_power_density_w_m2 || 0,
        area_utilization_percent: latestAdjustment.suggested_area_utilization_percent || 0
      } : {
        panel_count: 0,
        system_power_kwp: 0,
        panel_power_watts: 550,
        panel_area_m2: 2.5,
        module_efficiency_percent: 21.5,
        occupied_area_m2: 0,
        power_density_w_m2: 0,
        area_utilization_percent: 0
      },
      createdAt: analysisResult.created_at,
      updatedAt: analysisResult.updated_at
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
