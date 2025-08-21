// Edge Function – Get Analysis by ID

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.5";
import { z } from "https://esm.sh/zod@3.23.8";

/* ========= ENV ========= */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

/* ========= SCHEMAS ========= */
const GetAnalysisRequestSchema = z.object({
  id: z.string().uuid(),
});

/* ========= CORS ========= */
function corsHeaders(origin: string | null) {
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
  const headers = corsHeaders(req.headers.get("origin"));

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
      annualIrradiation: analysis.annual_irradiation,
      irradiationSource: analysis.irradiation_source,
      shadingIndex: analysis.shading_index,
      shadingLoss: analysis.shading_loss,
      estimatedProduction: analysis.estimated_production,
      verdict: analysis.verdict,
      reasons: analysis.reasons,
      usageFactor: analysis.usage_factor,
      footprints: analysis.footprints,
      googleSolarData: analysis.google_solar_data,
      technicalNote: analysis.technical_note,
      createdAt: analysis.created_at,
    };

    return new Response(JSON.stringify({ success: true, data: transformedAnalysis }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
    });
  }
});