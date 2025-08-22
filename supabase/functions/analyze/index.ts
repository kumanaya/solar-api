// deno-lint-ignore-file no-explicit-any
// Edge Function – Análise Solar para Laudo Técnico (corrigida, patches aplicados v2.2)

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

/* ========= CONSTANTES ========= */
const WGS84_R = 6378137; // raio (m)
const DEFAULT_EFF = 0.20; // 20% ≈ 200 Wp/m²
const DEFAULT_PR = 0.75;
const MAX_SHADE_LOSS = 0.30; // agora até 30%
const INVERTER_EFF = 0.96; // eficiência de conversão DC→AC (~4% perdas)

/* ========= SCHEMAS ========= */
const AnalyzeRequestSchema = z.object({
  address: z.string().min(5),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  usableAreaOverride: z.number().positive().optional(),
  polygon: z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
    source: z.enum(["user-drawn", "microsoft-footprint", "google-footprint"]).optional(),
  }),
});

const AnalysisSchema = z.object({
  id: z.string().uuid().optional(),
  address: z.string(),
  coordinates: z.object({ lat: z.number(), lng: z.number() }),
  coverage: z.object({
    google: z.boolean(),
    fallback: z.string().optional(),
  }),
  confidence: z.enum(["Alta", "Média", "Baixa"]),
  usableArea: z.number(),
  areaSource: z.enum(["google", "footprint", "manual", "estimate"]),
  annualGHI: z.number(),
  irradiationSource: z.string(),
  shadingIndex: z.number(),
  shadingLoss: z.number(),
  estimatedProduction: z.number(),
  estimatedProductionAC: z.number().optional(),
  estimatedProductionDC: z.number().optional(),
  verdict: z.enum(["Apto", "Parcial", "Não apto"]),
  reasons: z.array(z.string()),
  usageFactor: z.number(),
  footprints: z.array(z.object({
    id: z.string(),
    coordinates: z.array(z.tuple([z.number(), z.number()])),
    area: z.number(),
    isActive: z.boolean(),
    source: z.enum(["user-drawn", "microsoft-footprint", "google-footprint"]).optional(),
  })),
  googleSolarData: z.any().optional(),
  technicalNote: z.string().optional(),
  createdAt: z.string().optional(),
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

function corsHeaders(_origin: string | null) {
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

function shadeLossFracFromIndex(idx: number) {
  const clamped = clamp(idx ?? 0, 0, 1);
  return MAX_SHADE_LOSS * clamped;
}

/** Área de polígono geodésica em m² (Chamberlain & Duquette, esfera) */
function polygonAreaM2_geodesic(coords: [number, number][]): number {
  if (coords.length < 3) return 0;
  const ring = coords[0][0] === coords[coords.length - 1][0] &&
               coords[0][1] === coords[coords.length - 1][1]
               ? coords
               : [...coords, coords[0]];
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[i + 1];
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const λ1 = (lon1 * Math.PI) / 180;
    let λ2 = (lon2 * Math.PI) / 180;
    let dλ = λ2 - λ1;
    if (dλ > Math.PI) dλ -= 2 * Math.PI;
    if (dλ < -Math.PI) dλ += 2 * Math.PI;
    sum += dλ * (Math.sin(φ1) + Math.sin(φ2));
  }
  const area = Math.abs((WGS84_R * WGS84_R * sum) / 2);
  return area;
}

function polygonAreaM2_planar(coords: [number, number][]): number {
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

function polygonAreaM2(coords: [number, number][]): number {
  try {
    const a = polygonAreaM2_geodesic(coords);
    if (!isFinite(a) || a <= 0) throw new Error("invalid area");
    return a;
  } catch {
    return polygonAreaM2_planar(coords);
  }
}

// Média circular para azimutes (em graus)
function circularMean(degArr: number[]): number {
  if (!degArr.length) return 0;
  const rads = degArr.map(d => d * Math.PI / 180);
  const x = rads.reduce((a, t) => a + Math.cos(t), 0);
  const y = rads.reduce((a, t) => a + Math.sin(t), 0);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Produção via PVGIS E_y (kWh/kWp/ano) → NÃO usar PR
function estimateByPVGIS_Ey(params: {
  Ey_kwh_per_kwp_year: number;
  usable_area_m2: number;
  module_eff?: number;
  shade_index?: number;
}) {
  const eff = params.module_eff ?? DEFAULT_EFF;
  const kWp = params.usable_area_m2 * eff;
  const shadeLoss = 1 - shadeLossFracFromIndex(params.shade_index ?? 0);
  return params.Ey_kwh_per_kwp_year * kWp * shadeLoss;
}

// Produção via GHI (kWh/m²/ano) → aplica PR + transposição para POA
function estimateByGHI(params: {
  ghi_kwh_m2_year: number;
  usable_area_m2: number;
  module_eff?: number;
  pr?: number;
  shade_index?: number;
  tilt_deg?: number;
  lat?: number;
}) {
  const eff = params.module_eff ?? DEFAULT_EFF;
  const pr = params.pr ?? DEFAULT_PR;
  const shadeLoss = 1 - shadeLossFracFromIndex(params.shade_index ?? 0);
  // Ajuste de transposição GHI→POA (simplificado)
  let transpositionFactor = 1.0;
  if (params.tilt_deg != null && params.lat != null) {
    const tilt = params.tilt_deg * Math.PI / 180;
    const lat = Math.abs(params.lat) * Math.PI / 180;
    transpositionFactor = Math.max(0.7, Math.cos(lat - tilt) / Math.cos(lat)); // clamp mínimo 0.7
  } else {
    transpositionFactor = 0.9; // valor médio para tilts 10–25°
  }
  return params.ghi_kwh_m2_year * params.usable_area_m2 * eff * pr * transpositionFactor * shadeLoss;
}

// Classificação final
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

// PVGIS: E_y (kWh/kWp/ano) com tilt/azim reais
async function getPVGISYield(lat: number, lng: number, tilt_deg?: number, azimuth_deg?: number) {
  let angle = tilt_deg ? Math.round(tilt_deg) : undefined;
  let aspect: number | undefined;
  if (azimuth_deg != null) {
    // Patch: CORREÇÃO do azimute invertido (agora correto!)
    aspect = ((azimuth_deg - 180 + 540) % 360) - 180;
  }
  let url = `https://re.jrc.ec.europa.eu/api/v5_2/PVcalc?lat=${lat}&lon=${lng}&peakpower=1&loss=14&outputformat=json`;
  if (angle != null) url += `&angle=${angle}`;
  if (aspect != null) url += `&aspect=${aspect}`;
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

function computeShadeIndexFromQuantiles(q: number[] | undefined, fallbackMax: number | undefined) {
  if (!q?.length) {
    const maxSun = fallbackMax ?? 1500;
    const mid = maxSun * 0.85;
    return clamp(1 - (mid / Math.max(maxSun, 1)), 0, 1);
  }
  const n = q.length;
  let center: number;
  if (n >= 5) {
    const p40 = q[Math.floor(n * 0.4)];
    const p50 = q[Math.floor(n * 0.5)];
    const p60 = q[Math.floor(n * 0.6)];
    center = (p40 + p50 + p60) / 3;
  } else {
    center = q[Math.floor(n / 2)];
  }
  const max = q[n - 1] ?? fallbackMax ?? center;
  return clamp(1 - (center / Math.max(max, 1)), 0, 1);
}

// Google Solar Data
async function processGoogleSolarData(
  solar: SolarApiResponse,
  address: string,
  lat: number,
  lng: number,
  polygon?: { type: "Polygon"; coordinates: number[][][]; source?: "user-drawn"|"microsoft-footprint"|"google-footprint" },
  usableAreaOverride?: number,
) {
  const sp = solar.solarPotential!;
  const wholeArea = sp.wholeRoofStats?.areaMeters2 ?? 0;

  // --- ÁREA UTIL (corrigido) ---
  let usageFactor = 0.80;
  let usableAreaRaw: number = 0;
  let areaSource: "google" | "manual" | "footprint" = "google";
  let applyUF = 1.0;

  if (usableAreaOverride && usableAreaOverride > 0) {
    usableAreaRaw = usableAreaOverride;
    areaSource = "manual";
    applyUF = 1.0;
  } else if (polygon?.coordinates?.length) {
    const ring = polygon.coordinates[0] as [number, number][];
    usableAreaRaw = polygonAreaM2(ring);
    areaSource = "footprint";
    applyUF = usageFactor;
  } else if (typeof sp.maxArrayAreaMeters2 === "number" && sp.maxArrayAreaMeters2 > 0) {
    usableAreaRaw = sp.maxArrayAreaMeters2; // já descontado
    areaSource = "google";
    applyUF = 1.0; // NÃO aplica uso de novo!
  } else {
    usableAreaRaw = wholeArea * 0.70; // fallback conservador
    areaSource = "google";
    applyUF = usageFactor;
  }

  const usableArea = Math.max(0, Math.round(usableAreaRaw * applyUF));

  // ÍNDICE DE SOMBRA
  const q = sp.wholeRoofStats?.sunshineQuantiles;
  const shadeIndex = computeShadeIndexFromQuantiles(q, sp.maxSunshineHoursPerYear);
  const shadingLoss = Math.round(shadeLossFracFromIndex(shadeIndex) * 100);

  // --- GHI
  let ghi_kwh_m2_year = 0;
  let irradiationSource = "";
  const nasa = await getNASAGHI(lat, lng).catch(() => null);
  if (nasa?.ghi_kwh_m2_year) {
    ghi_kwh_m2_year = nasa.ghi_kwh_m2_year;
    irradiationSource = "NASA POWER (GHI)";
  } else {
    ghi_kwh_m2_year = 1800;
    irradiationSource = "Heurística conservadora";
  }

  // --- ORIENTAÇÃO/INCLINAÇÃO
  let avgAz = 0;
  let avgTilt = 15;
  if (sp.roofSegmentStats?.length) {
    // Patch: média circular do azimute
    const azArr = sp.roofSegmentStats.map(s => s.azimuthDegrees ?? 0);
    avgAz = circularMean(azArr);
    // Tilt: média aritmética
    avgTilt = sp.roofSegmentStats.reduce((a, s) => a + (s.pitchDegrees ?? 15), 0) / sp.roofSegmentStats.length;
  }

  // --- PRODUÇÃO
  let estimatedProduction = 0;
  let estimatedProductionDC = 0;
  let estimatedProductionAC = 0;
  if (sp.solarPanelConfigs?.length && areaSource === "google") {
    const best = sp.solarPanelConfigs.reduce((a, b) =>
      (b.yearlyEnergyDcKwh ?? 0) > (a.yearlyEnergyDcKwh ?? 0) ? b : a,
    );
    estimatedProductionDC = Math.floor(best.yearlyEnergyDcKwh ?? 0);
    estimatedProductionAC = Math.floor(estimatedProductionDC * INVERTER_EFF); // Patch: conversão DC→AC
    estimatedProduction = estimatedProductionAC; // priorizar AC como resultado principal
  } else {
    const pvgis = await getPVGISYield(lat, lng, avgTilt, avgAz).catch(() => null);
    if (pvgis?.Ey_kwh_per_kwp_year) {
      estimatedProduction = Math.round(
        estimateByPVGIS_Ey({
          Ey_kwh_per_kwp_year: pvgis.Ey_kwh_per_kwp_year,
          usable_area_m2: usableArea,
          shade_index: shadeIndex,
        }),
      );
      estimatedProductionAC = estimatedProduction;
    } else {
      estimatedProduction = Math.round(
        estimateByGHI({
          ghi_kwh_m2_year,
          usable_area_m2: usableArea,
          shade_index: shadeIndex,
          tilt_deg: avgTilt,
          lat,
        }),
      );
      estimatedProductionAC = estimatedProduction;
    }
    estimatedProductionDC = Math.round(estimatedProductionAC / INVERTER_EFF);
  }

  const cls = classifyVerdict({
    usable_area_m2: usableArea,
    shade_index: shadeIndex,
    azimuth_deg: avgAz,
    tilt_deg: avgTilt,
  });

  // Footprints
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

  // Nota técnica
  let technicalNote =
    "Nota técnica: Produção estimada com base em Google Solar API (para geometrias e configs) + PVGIS (E_y) e NASA POWER (GHI). " +
    "Áreas calculadas por polígono via fórmula geodésica esférica (WGS84), podendo variar conforme delineamento e resolução dos dados. " +
    "Valores de produção priorizam AC (corrigido) e expõem DC para referência. Recomenda-se validação in loco para projetos críticos.";
  if (polygon?.source === "microsoft-footprint") {
    technicalNote += " Footprint: Microsoft Building Footprints (ML).";
  }

  return AnalysisSchema.parse({
    address,
    coordinates: { lat, lng },
    coverage: { google: true },
    confidence: "Alta",
    usableArea,
    areaSource,
    annualGHI: Math.round(ghi_kwh_m2_year),
    irradiationSource,
    shadingIndex: Number(shadeIndex.toFixed(2)),
    shadingLoss,
    estimatedProduction,
    estimatedProductionAC,
    estimatedProductionDC,
    verdict: cls.verdict,
    reasons: cls.reasons,
    usageFactor: applyUF,
    footprints,
    googleSolarData: { ...solar, derived: { avgAz, avgTilt, estimatedProductionDC, estimatedProductionAC, inverterEff: INVERTER_EFF } },
    technicalNote,
  });
}

// Fallback (PVGIS/NASA)
async function processFallbackAnalysis(opts: {
  lat: number;
  lng: number;
  address: string;
  polygon?: { type: "Polygon"; coordinates: number[][][]; source?: "user-drawn"|"microsoft-footprint"|"google-footprint" };
  usableAreaOverride?: number;
}) {
  const { lat, lng, address, polygon, usableAreaOverride } = opts;
  const usageFactor = 0.75;
  let areaSource: "manual" | "estimate" | "footprint" = "estimate";
  let usableAreaRaw = 60 / usageFactor;
  if (usableAreaOverride && usableAreaOverride > 0) {
    usableAreaRaw = usableAreaOverride;
    areaSource = "manual";
  } else if (polygon?.coordinates?.length) {
    const ring = polygon.coordinates[0] as [number, number][];
    usableAreaRaw = polygonAreaM2(ring);
    areaSource = "footprint";
  }
  const usableArea = Math.round(usableAreaRaw * usageFactor);

  let ghi_kwh_m2_year = 0;
  let irradiationSource = "";
  const nasa = await getNASAGHI(lat, lng).catch(() => null);
  if (nasa?.ghi_kwh_m2_year) {
    ghi_kwh_m2_year = nasa.ghi_kwh_m2_year;
    irradiationSource = "NASA POWER (GHI)";
  } else {
    ghi_kwh_m2_year = 1800;
    irradiationSource = "Heurística conservadora";
  }

  const lower = address.toLowerCase();
  const isUrban = lower.includes("rua ") || lower.includes("avenida ") || lower.includes("centro") || lower.includes("cidade");
  const shadeIndex = isUrban ? 0.15 : 0.08;
  const shadingLossPct = Math.round(shadeLossFracFromIndex(shadeIndex) * 100);

  let estimatedProduction = 0;
  let estimatedProductionAC = 0;
  let estimatedProductionDC = 0;
  const optimalTilt = Math.max(5, Math.min(30, Math.abs(lat) - 10));
  const pvgis = await getPVGISYield(lat, lng, optimalTilt, 0).catch(() => null);
  if (pvgis?.Ey_kwh_per_kwp_year) {
    estimatedProduction = Math.round(
      estimateByPVGIS_Ey({
        Ey_kwh_per_kwp_year: pvgis.Ey_kwh_per_kwp_year,
        usable_area_m2: usableArea,
        shade_index: shadeIndex,
      }),
    );
    estimatedProductionAC = estimatedProduction;
    estimatedProductionDC = Math.round(estimatedProductionAC / INVERTER_EFF);
  } else {
    estimatedProduction = Math.round(
      estimateByGHI({
        ghi_kwh_m2_year,
        usable_area_m2: usableArea,
        shade_index: shadeIndex,
        tilt_deg: optimalTilt,
        lat,
      }),
    );
    estimatedProductionAC = estimatedProduction;
    estimatedProductionDC = Math.round(estimatedProductionAC / INVERTER_EFF);
  }

  const cls = classifyVerdict({
    usable_area_m2: usableArea,
    shade_index: shadeIndex,
    azimuth_deg: 0,
    tilt_deg: optimalTilt,
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
    `Nota técnica: Irradiação (GHI) via ${irradiationSource}. ` +
    `Produção estimada com PVGIS (E_y) quando disponível, ou GHI + PR caso contrário. ` +
    `Sombreamento estimado em ${Math.round(shadeIndex * 100)}% por contexto urbano/rural. ` +
    `Tilt ótimo ≈ ${optimalTilt}°. Área por polígono via fórmula geodésica esférica (WGS84). Produção em AC e DC explicitadas.`;
  if (polygon?.source === "microsoft-footprint") {
    technicalNote += " Footprint: Microsoft Building Footprints (ML).";
  }

  return AnalysisSchema.parse({
    address,
    coordinates: { lat, lng },
    coverage: { google: false, fallback: "PVGIS/NASA" },
    confidence: "Média",
    usableArea,
    areaSource,
    annualGHI: Math.round(ghi_kwh_m2_year),
    irradiationSource,
    shadingIndex: Number(shadeIndex.toFixed(2)),
    shadingLoss: shadingLossPct,
    estimatedProduction,
    estimatedProductionAC,
    estimatedProductionDC,
    verdict: cls.verdict,
    reasons: cls.reasons,
    usageFactor,
    footprints,
    technicalNote,
  });
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

    const { lat, lng, address } = input;
    console.log(`Using coordinates directly: lat=${lat}, lng=${lng}, address="${address}"`);

    // Google Solar primeiro, depois fallback
    let analysis;
    const google = await getGoogleSolarData(lat, lng).catch(() => null);
    if (google?.solarPotential) {
      analysis = await processGoogleSolarData(
        google,
        address,
        lat,
        lng,
        input.polygon as any,
        input.usableAreaOverride,
      );
    } else {
      analysis = await processFallbackAnalysis({
        lat,
        lng,
        address,
        polygon: input.polygon as any,
        usableAreaOverride: input.usableAreaOverride,
      });
    }

    return new Response(JSON.stringify({ success: true, data: analysis }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
