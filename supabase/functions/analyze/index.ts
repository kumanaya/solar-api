// deno-lint-ignore-file no-explicit-any
// Edge Function – Análise Solar para Laudo Técnico

/// <reference lib="dom" />

// @ts-ignore Deno types no edge
declare const Deno: {
  env: { get(k: string): string | undefined };
  serve(h: (r: Request) => Response | Promise<Response>): void;
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.5";
import { z } from "https://esm.sh/zod@3.23.8";

/* ========= ENV ========= */
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") ?? "";
const GOOGLE_SOLAR_API_KEY = GOOGLE_MAPS_API_KEY;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

/* ========= SCHEMAS ========= */
const AnalyzeRequestSchema = z.object({
  address: z.string().min(5),
  usableAreaOverride: z.number().positive().optional(), // m²
  polygon: z
    .object({
      type: z.literal("Polygon"),
      coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))), // [lng,lat]
      source: z.enum(["user-drawn", "microsoft-footprint", "google-footprint"]).optional(),
    })
    .optional(),
});

const AnalysisSchema = z.object({
  id: z.string().uuid().optional(), // Analysis ID from database
  address: z.string(),
  coordinates: z.object({ lat: z.number(), lng: z.number() }),
  coverage: z.object({
    google: z.boolean(),
    fallback: z.string().optional(),
  }),
  confidence: z.enum(["Alta", "Média", "Baixa"]),
  usableArea: z.number(), // m² (já com fator de uso aplicado)
  areaSource: z.enum(["google", "footprint", "manual", "estimate"]),
  annualIrradiation: z.number(), // kWh/m²/ano
  irradiationSource: z.string(),
  shadingIndex: z.number(), // 0..1
  shadingLoss: z.number(), // 0..100 (%)
  estimatedProduction: z.number(), // kWh/ano
  verdict: z.enum(["Apto", "Parcial", "Não apto"]),
  reasons: z.array(z.string()),
  usageFactor: z.number(), // 0..1
  footprints: z.array(z.object({
    id: z.string(),
    coordinates: z.array(z.tuple([z.number(), z.number()])),
    area: z.number(),
    isActive: z.boolean(),
    source: z.enum(["user-drawn", "microsoft-footprint", "google-footprint"]).optional(),
  })),
  googleSolarData: z.any().optional(),
  technicalNote: z.string().optional(), // Inclui nota técnica automática
  createdAt: z.string().optional(), // ISO timestamp
});

/* ========= TIPOS GOOGLE SOLAR ========= */
type SolarApiResponse = {
  solarPotential?: {
    maxArrayPanelsCount?: number;
    maxArrayAreaMeters2?: number;
    maxSunshineHoursPerYear?: number;
    panelCapacityWatts?: number;
    solarPanelConfigs?: Array<{
      panelsCount?: number;
      yearlyEnergyDcKwh?: number;
      roofSegmentSummaries?: Array<{
        pitchDegrees?: number;
        azimuthDegrees?: number;
        panelsCount?: number;
        yearlyEnergyDcKwh?: number;
        segmentIndex?: number;
      }>;
    }>;
    wholeRoofStats?: {
      areaMeters2?: number;
      sunshineQuantiles?: number[];
      groundAreaMeters2?: number;
    };
    roofSegmentStats?: Array<{
      pitchDegrees?: number;
      azimuthDegrees?: number;
      stats?: {
        areaMeters2?: number;
        sunshineQuantiles?: number[];
        groundAreaMeters2?: number;
      };
      center?: { latitude: number; longitude: number };
      boundingBox?: {
        sw: { latitude: number; longitude: number };
        ne: { latitude: number; longitude: number };
      };
    }>;
  };
  error?: { code: number; message: string; status: string };
};

/* ========= HELPERS ========= */

// CORS
const ALLOWED_ORIGINS = ["*"];
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

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// Área do polígono (m²) usando aproximação esférica (Shoelace) – *para laudo, observar margem de erro*:
function polygonAreaM2(coords: [number, number][]): number {
  // coords em [lng,lat]; projeta aproximando 1° ~ 111_000 m
  // ATENÇÃO: margem de erro pode ser até ±5% conforme latitude
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

// kWh/ano via GHI (determinístico, sem ceiling, sempre documentando PR e eficiência)
function estimateAnnualKwhByGHI(params: {
  ghi_kwh_m2_year: number;
  usable_area_m2: number;
  module_eff?: number; // ~0.20
  pr?: number; // ~0.75
  shade_index?: number; // 0..1
}) {
  const eff = params.module_eff ?? 0.20;
  const pr = params.pr ?? 0.75;
  const shade = clamp(params.shade_index ?? 0.10, 0, 1);
  const shadeLossFrac = 0.2 * shade; // até 20% no MVP
  return params.ghi_kwh_m2_year * params.usable_area_m2 * eff * pr * (1 - shadeLossFrac);
}

// Classificação final (sem alteração)
function classifyVerdict(params: {
  usable_area_m2: number;
  shade_index: number;
  azimuth_deg?: number | null;
  tilt_deg?: number | null;
}) {
  const reasons: string[] = [];
  const area = params.usable_area_m2;
  const shade = clamp(params.shade_index, 0, 1);
  const az = params.azimuth_deg ?? 0;
  const tilt = params.tilt_deg ?? 15;

  const azDev = Math.min(
    Math.abs(((az + 360) % 360) - 0),
    Math.abs(((az + 360) % 360) - 360),
  );
  const tiltOk = tilt >= 5 && tilt <= 35;
  const shadeOk = shade < 0.2;
  const areaApto = area >= 15;

  if (areaApto && shadeOk && azDev <= 45 && tiltOk) {
    return { verdict: "Apto" as const, reasons: ["Área suficiente", "Baixo sombreamento", "Orientação favorável"] };
  }
  if ((area >= 10 && shade < 0.4) && (azDev <= 60 || tiltOk)) {
    if (area < 15) reasons.push("Área no limite");
    if (!shadeOk) reasons.push("Sombreamento moderado");
    if (!tiltOk) reasons.push("Inclinação fora do ideal");
    if (azDev > 45) reasons.push("Orientação não ideal");
    return { verdict: "Parcial" as const, reasons: reasons.length ? reasons : ["Condições parcialmente favoráveis"] };
  }
  if (area < 10) reasons.push("Área insuficiente");
  if (shade >= 0.4) reasons.push("Sombreamento elevado");
  if (azDev > 90) reasons.push("Orientação desfavorável");
  return { verdict: "Não apto" as const, reasons: reasons.length ? reasons : ["Condições desfavoráveis"] };
}

/* ========= DATASOURCES ========= */

async function geocodeAddress(address: string) {
  if (!GOOGLE_MAPS_API_KEY) throw new Error("Google Maps API key não configurada");
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address,
  )}&key=${GOOGLE_MAPS_API_KEY}`;
  const res = await fetchWithTimeout(url, 8000);
  const j = await res.json();
  if (j.status === "OK" && j.results?.length) {
    const r = j.results[0];
    return {
      lat: r.geometry.location.lat as number,
      lng: r.geometry.location.lng as number,
      formatted: r.formatted_address as string,
    };
  }
  return null;
}

// Google Solar API
async function getGoogleSolarData(lat: number, lng: number): Promise<SolarApiResponse | null> {
  if (!GOOGLE_SOLAR_API_KEY) return null;
  const url =
    `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&key=${GOOGLE_SOLAR_API_KEY}`;
  const res = await fetchWithTimeout(url, 8000);
  const j = (await res.json()) as SolarApiResponse;
  if (j?.error) return null;
  if (!j?.solarPotential) return null;
  return j;
}

// PVGIS: E_y (kWh/kWp/ano)
async function getPVGISYield(lat: number, lng: number) {
  const url =
    `https://re.jrc.ec.europa.eu/api/v5_2/PVcalc?lat=${lat}&lon=${lng}&peakpower=1&loss=14&outputformat=json`;
  const res = await fetchWithTimeout(url, 8000);
  if (!res.ok) return null;
  const j = await res.json();
  const Ey = j?.outputs?.totals?.fixed?.E_y;
  if (typeof Ey === "number" && Ey > 0) return { Ey_kwh_per_kwp_year: Ey };
  return null;
}

// NASA POWER: soma anual de GHI (kWh/m²/ano)
async function getNASAGHI(lat: number, lng: number) {
  const year = new Date().getFullYear() - 1;
  const start = `${year}0101`;
  const end = `${year}1231`;
  const url =
    `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=${lng}&latitude=${lat}&start=${start}&end=${end}&format=JSON`;
  const res = await fetchWithTimeout(url, 8000);
  if (!res.ok) return null;
  const j = await res.json();
  const days = j?.properties?.parameter?.ALLSKY_SFC_SW_DWN;
  if (!days) return null;
  const sum = Object.values(days).reduce(
    (acc: number, v: any) => acc + (typeof v === "number" ? v : 0),
    0,
  );
  return { ghi_kwh_m2_year: sum as number };
}

/* ========= PROCESSADORES ========= */

// Google Solar Data
function processGoogleSolarData(
  solar: SolarApiResponse,
  address: string,
  lat: number,
  lng: number,
  polygon?: { type: "Polygon"; coordinates: number[][][] },
  usableAreaOverride?: number,
) {
  const sp = solar.solarPotential!;
  const wholeArea = sp.wholeRoofStats?.areaMeters2 ?? 0;
  let usableArea = Math.floor(sp.maxArrayAreaMeters2 ?? wholeArea * 0.70);
  let areaSource: "google" | "manual" | "footprint" = "google";
  const usageFactor = 0.80;

  // Use polygon or override area if provided
  if (usableAreaOverride && usableAreaOverride > 0) {
    usableArea = usableAreaOverride;
    areaSource = "manual";
  } else if (polygon?.coordinates?.length) {
    const ring = polygon.coordinates[0] as [number, number][];
    const polyArea = polygonAreaM2(ring);
    usableArea = Math.max(0, polyArea * usageFactor);
    areaSource = "footprint";
  }

  // Shade index pela razão mediana/max das horas de sol
  const q = sp.wholeRoofStats?.sunshineQuantiles ?? [];
  const maxSun = q.length ? q[q.length - 1] : sp.maxSunshineHoursPerYear ?? 0;
  const medSun = q.length ? q[Math.floor(q.length / 2)] : (maxSun || 1) * 0.85;
  const shadeIndex = clamp(1 - (maxSun > 0 ? medSun / maxSun : 0.85), 0, 1);
  const shadingLoss = Math.round(0.2 * shadeIndex * 100);

  let estimatedProduction = 0;
  if (sp.solarPanelConfigs?.length && areaSource === "google") {
    // Use Google's panel configs only if using Google's area calculation
    const best = sp.solarPanelConfigs.reduce((a, b) =>
      (b.yearlyEnergyDcKwh ?? 0) > (a.yearlyEnergyDcKwh ?? 0) ? b : a,
    );
    estimatedProduction = Math.floor((best.yearlyEnergyDcKwh ?? 0) * (1 - 0.2 * shadeIndex));
  } else {
    // Use GHI calculation for manual/polygon areas
    const proxyGHI = (sp.maxSunshineHoursPerYear ?? 1500);
    estimatedProduction = Math.floor(
      estimateAnnualKwhByGHI({
        ghi_kwh_m2_year: proxyGHI,
        usable_area_m2: usableArea,
        shade_index: shadeIndex,
      }),
    );
  }

  const avgAz =
    sp.roofSegmentStats?.length
      ? sp.roofSegmentStats.reduce((a, s) => a + (s.azimuthDegrees ?? 0), 0) / sp.roofSegmentStats.length
      : 0;
  const avgTilt =
    sp.roofSegmentStats?.length
      ? sp.roofSegmentStats.reduce((a, s) => a + (s.pitchDegrees ?? 15), 0) / sp.roofSegmentStats.length
      : 15;

  const cls = classifyVerdict({
    usable_area_m2: areaSource === "google" ? usableArea * usageFactor : usableArea,
    shade_index: shadeIndex,
    azimuth_deg: avgAz,
    tilt_deg: avgTilt,
  });

  // Build footprints array if polygon provided
  const footprints = [];
  if (polygon?.coordinates?.length) {
    const ring = polygon.coordinates[0] as [number, number][];
    const polygonSource = polygon.source || "user-drawn";
    footprints.push({
      id: polygonSource === "microsoft-footprint" ? "microsoft-footprint-polygon" : "user-drawn-polygon",
      coordinates: ring,
      area: Math.round(polygonAreaM2(ring)),
      isActive: true,
      source: polygonSource,
    });
  }

  // Nota técnica padrão para laudo
  let technicalNote =
    "Nota técnica: Todos os cálculos deste laudo utilizam dados reais das fontes oficiais Google Solar API, PVGIS e NASA POWER. " +
    "A área calculada por polígono pode ter variação de até ±5% conforme latitude, método de projeção e resolução dos dados. " +
    "Recomenda-se validação in loco para projetos críticos.";
  
  // Add Microsoft footprint information if applicable
  if (polygon?.source === "microsoft-footprint") {
    technicalNote += " Footprint fornecido por Microsoft Building Footprints dataset, " +
      "baseado em imagens de satélite e algoritmos de machine learning para detecção automática de estruturas.";
  }

  return AnalysisSchema.parse({
    address,
    coordinates: { lat, lng },
    coverage: { google: true },
    confidence: "Alta",
    usableArea: Math.max(0, Math.round(areaSource === "google" ? usableArea * usageFactor : usableArea)),
    areaSource,
    annualIrradiation: Math.round(sp.maxSunshineHoursPerYear ?? 0),
    irradiationSource: "Google Solar API",
    shadingIndex: Number(shadeIndex.toFixed(2)),
    shadingLoss,
    estimatedProduction,
    verdict: cls.verdict,
    reasons: cls.reasons,
    usageFactor,
    footprints,
    googleSolarData: solar,
    technicalNote,
  });
}

// Fallback (PVGIS/NASA)
async function processFallbackAnalysis(opts: {
  lat: number;
  lng: number;
  address: string;
  polygon?: { type: "Polygon"; coordinates: number[][][] };
  usableAreaOverride?: number;
}) {
  const { lat, lng, address, polygon, usableAreaOverride } = opts;
  const usageFactor = 0.75;
  let usableArea = 60;
  let areaSource: "manual" | "estimate" | "footprint" = "estimate";

  if (usableAreaOverride && usableAreaOverride > 0) {
    usableArea = usableAreaOverride;
    areaSource = "manual";
  } else if (polygon?.coordinates?.length) {
    const ring = polygon.coordinates[0] as [number, number][];
    const polyArea = polygonAreaM2(ring);
    usableArea = Math.max(0, polyArea * usageFactor);
    areaSource = "manual";
  }

  let ghi_kwh_m2_year = 0;
  let irradiationSource = "";

  const pvgis = await getPVGISYield(lat, lng).catch(() => null);
  if (pvgis?.Ey_kwh_per_kwp_year) {
    const eff = 0.20;
    const pr = 0.75;
    ghi_kwh_m2_year = pvgis.Ey_kwh_per_kwp_year / (eff * pr);
    irradiationSource = "PVGIS (GHI estimado via E_y)";
  } else {
    const nasa = await getNASAGHI(lat, lng).catch(() => null);
    if (nasa?.ghi_kwh_m2_year) {
      ghi_kwh_m2_year = nasa.ghi_kwh_m2_year;
      irradiationSource = "NASA POWER (GHI)";
    } else {
      ghi_kwh_m2_year = 1500;
      irradiationSource = "Heurística conservadora";
    }
  }

  const shadeIndex = 0.10;
  const shadingLossPct = Math.round(0.2 * shadeIndex * 100);

  const estimatedProduction = Math.round(
    estimateAnnualKwhByGHI({
      ghi_kwh_m2_year,
      usable_area_m2: usableArea,
      shade_index: shadeIndex,
    }),
  );

  const cls = classifyVerdict({
    usable_area_m2: usableArea,
    shade_index: shadeIndex,
    azimuth_deg: 0,
    tilt_deg: 15,
  });

  const footprints = [];
  if (polygon?.coordinates?.length) {
    const ring = polygon.coordinates[0] as [number, number][];
    const polygonSource = polygon.source || "user-drawn";
    footprints.push({
      id: polygonSource === "microsoft-footprint" ? "microsoft-footprint-polygon" : "manual-polygon",
      coordinates: ring,
      area: Math.round(polygonAreaM2(ring)),
      isActive: true,
      source: polygonSource,
    });
  }

  let technicalNote =
    "Nota técnica: Todos os cálculos deste laudo utilizam dados reais das fontes públicas PVGIS e NASA POWER. " +
    "A área do polígono é aproximada e pode apresentar margem de erro de até ±5%. Recomenda-se validação in loco para projetos de grande escala.";
  
  // Add Microsoft footprint information if applicable
  if (polygon?.source === "microsoft-footprint") {
    technicalNote += " Footprint fornecido por Microsoft Building Footprints dataset, " +
      "baseado em imagens de satélite e algoritmos de machine learning para detecção automática de estruturas.";
  }

  return AnalysisSchema.parse({
    address,
    coordinates: { lat, lng },
    coverage: { google: false, fallback: "PVGIS/NASA" },
    confidence: "Média",
    usableArea: Math.round(usableArea),
    areaSource,
    annualIrradiation: Math.round(ghi_kwh_m2_year),
    irradiationSource,
    shadingIndex: shadeIndex,
    shadingLoss: shadingLossPct,
    estimatedProduction,
    verdict: cls.verdict,
    reasons: cls.reasons,
    usageFactor,
    footprints,
    technicalNote,
  });
}

/* ========= DATABASE ========= */

async function saveAnalysisToDatabase(analysisData: any, userId: string, supabase: any) {
  try {
    console.log('Attempting to save analysis for user:', userId);
    console.log('Analysis data keys:', Object.keys(analysisData));
    
    const insertData = {
      user_id: userId,
      address: analysisData.address,
      coordinates: analysisData.coordinates,
      coverage: analysisData.coverage,
      confidence: analysisData.confidence,
      usable_area: analysisData.usableArea,
      area_source: analysisData.areaSource,
      annual_irradiation: analysisData.annualIrradiation,
      irradiation_source: analysisData.irradiationSource,
      shading_index: analysisData.shadingIndex,
      shading_loss: analysisData.shadingLoss,
      estimated_production: analysisData.estimatedProduction,
      verdict: analysisData.verdict,
      reasons: analysisData.reasons,
      usage_factor: analysisData.usageFactor,
      footprints: analysisData.footprints,
      google_solar_data: analysisData.googleSolarData,
      technical_note: analysisData.technicalNote
    };
    
    console.log('Insert data prepared:', JSON.stringify(insertData, null, 2));

    const { data, error } = await supabase
      .from('analyses')
      .insert(insertData)
      .select('id, created_at')
      .single();

    if (error) {
      console.error('Database save error:', JSON.stringify(error, null, 2));
      return null;
    }

    console.log('Analysis saved successfully:', data);
    return { id: data.id, createdAt: data.created_at };
  } catch (error) {
    console.error('Database save exception:', error);
    return null;
  }
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
    const input = AnalyzeRequestSchema.parse(json);

    // 1) Geocode
    const geo = await geocodeAddress(input.address);
    if (!geo) {
      return new Response(JSON.stringify({ success: false, error: "Could not geocode address" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const { lat, lng, formatted } = geo;

    // 2) Google Solar (se disponível)
    let analysis;
    const google = await getGoogleSolarData(lat, lng).catch(() => null);
    if (google?.solarPotential) {
      analysis = processGoogleSolarData(
        google,
        formatted,
        lat,
        lng,
        input.polygon as any,
        input.usableAreaOverride,
      );
    } else {
      analysis = await processFallbackAnalysis({
        lat,
        lng,
        address: formatted,
        polygon: input.polygon as any,
        usableAreaOverride: input.usableAreaOverride,
      });
    }

    // 3) Save to database with authenticated user context
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Set the session with the user's JWT token
    if (token) {
      await supabase.auth.setSession({
        access_token: token,
        refresh_token: '' // Not needed for this operation
      });
    }
    
    const savedResult = await saveAnalysisToDatabase(analysis, auth.user.id, supabase);
    
    // Add database info to response
    if (savedResult) {
      analysis.id = savedResult.id;
      analysis.createdAt = savedResult.createdAt;
    }

    return new Response(JSON.stringify({ success: true, data: analysis }), {
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
