/* eslint-disable @typescript-eslint/no-explicit-any */
// deno-lint-ignore-file no-explicit-any
// Edge Function – Building Footprints (Deno/Vercel/Supabase Functions)
// - Microsoft Building Footprints API (se disponível)
// - Fallback: Nominatim building data
// - Retorna polígono do telhado mais provável para um ponto

/// <reference lib="dom" />

// @ts-ignore Deno types no edge
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
const FootprintRequestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const FootprintResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    polygon: z.object({
      type: z.literal("Polygon"),
      coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))), // [lng,lat]
    }).optional(),
    area: z.number().optional(), // m²
    confidence: z.enum(["Alta", "Média", "Baixa"]),
    source: z.string(),
    azimuth: z.number().optional(), // graus, orientação do telhado
    tilt: z.number().optional(), // graus, inclinação do telhado
  }).optional(),
  error: z.string().optional(),
});

/* ========= HELPERS ========= */

// CORS configuration
function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
    "Access-Control-Max-Age": "86400",
  };
}

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// Área do polígono (m²) usando fórmula do sapateiro + projeção simples
function polygonAreaM2(coords: [number, number][]): number {
  if (coords.length < 3) return 0;
  const toXY = (lng: number, lat: number) => {
    const x = (lng * Math.cos((lat * Math.PI) / 180)) * 111_000;
    const y = lat * 111_000;
    return { x, y };
  };
  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[(i + 1) % coords.length];
    const a = toXY(lng1, lat1);
    const b = toXY(lng2, lat2);
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area / 2);
}

// Calcular azimute principal de um polígono (orientação do telhado)
function calculatePolygonAzimuth(coords: [number, number][]): number {
  if (coords.length < 4) return 0;
  
  // Encontrar o lado mais longo
  let maxLength = 0;
  let azimuth = 0;
  
  for (let i = 0; i < coords.length - 1; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[i + 1];
    
    // Calcular distância
    const dx = lng2 - lng1;
    const dy = lat2 - lat1;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length > maxLength) {
      maxLength = length;
      // Calcular azimute (0° = Norte, 90° = Leste)
      azimuth = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    }
  }
  
  return Math.round(azimuth);
}

/* ========= DATASOURCES ========= */

// Microsoft Building Footprints - buscar no banco de dados
async function getMicrosoftFootprint(lat: number, lng: number) {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.log('Supabase not configured for Microsoft footprints');
      return null;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    console.log(`Searching Microsoft footprints for: ${lat}, ${lng}`);
    
    // Use the database function to find the closest building with timeout
    const { data, error } = await Promise.race([
      supabase.rpc('find_closest_building', {
        target_lat: lat,
        target_lng: lng,
        max_distance_meters: 50 // Reduced distance for faster query
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), 3000)
      )
    ]) as any;

    if (error) {
      console.error('Microsoft footprint query error:', error);
      return null;
    }

    if (!data || data.length === 0) {
      console.log('No Microsoft footprint found within range');
      return null;
    }

    const building = data[0];
    console.log(`Found Microsoft footprint: ${building.area_m2}m² at ${building.distance_meters.toFixed(1)}m distance`);

    // Parse the GeoJSON geometry
    const geometry = building.geometry_geojson;
    if (!geometry || geometry.type !== 'Polygon' || !geometry.coordinates) {
      console.error('Invalid geometry in Microsoft footprint data');
      return null;
    }

    const coordinates = geometry.coordinates[0] as [number, number][];
    const area = building.area_m2;
    const azimuth = calculatePolygonAzimuth(coordinates);
    
    // Estimate tilt based on building area (heurística)
    let tilt = 15; // padrão brasileiro
    if (area < 50) {
      tilt = 25; // casas pequenas geralmente mais inclinadas
    } else if (area > 200) {
      tilt = 10; // construções maiores geralmente mais planas
    }

    return {
      polygon: {
        type: "Polygon" as const,
        coordinates: [coordinates]
      },
      area,
      confidence: "Alta" as const,
      source: "Microsoft Building Footprints",
      azimuth,
      tilt
    };
    
  } catch (error) {
    console.error('Microsoft footprint fetch error:', error);
    // Se for timeout ou erro de query, continuar para OSM
    return null;
  }
}

// OSM fallback removido - apenas Microsoft Footprints são aceitos

// Estimativa heurística removida - apenas Microsoft Footprints são aceitos

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

  // CORS preflight
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
    console.log('Footprints request received:', req.method, req.url);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    
    // Auth
    const auth = await verifyAuth(req);
    console.log('Auth result:', auth);
    
    if (!auth.ok) {
      console.error('Auth failed:', auth.error);
      return new Response(JSON.stringify({ success: false, error: auth.error }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // Body
    const json = await req.json();
    const input = FootprintRequestSchema.parse(json);

    console.log("Footprints request:", input);

    let footprintData = null;

    // Apenas Microsoft Footprints - sem fallbacks
    console.log("Trying Microsoft footprints...");
    footprintData = await getMicrosoftFootprint(input.lat, input.lng).catch(() => null);

    // Se não encontrar, retornar erro - obrigar usuário a desenhar
    if (!footprintData) {
      console.log("No Microsoft footprint found - user must draw manually");
      return new Response(JSON.stringify({
        success: false,
        error: "Nenhum footprint encontrado nesta localização. Desenhe o telhado manualmente.",
        errorCode: "FOOTPRINT_NOT_FOUND"
      }), {
        status: 404,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const response = FootprintResponseSchema.parse({
      success: true,
      data: footprintData
    });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Footprints error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    
    const errorResponse = FootprintResponseSchema.parse({
      success: false,
      error: message
    });

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
    });
  }
});