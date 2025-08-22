// deno-lint-ignore-file no-explicit-any
// Edge Function – Análise Solar para Laudo Técnico (v3.1 - Otimizada para Brasil e Internacional)
// Melhorias: Google Solar sempre tentado, fallback só se não houver dados, output detalhado

// @ts-expect-error Deno types no edge
declare const Deno: {
  env: { get(k: string): string | undefined };
  serve(h: (r: Request) => Response | Promise<Response>): void;
};

// Type-only imports for Deno edge runtime
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.43.5";
import type { ZodSchema } from "https://esm.sh/zod@3.23.8";
// Runtime imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.5";
import { z } from "https://esm.sh/zod@3.23.8";

/* ========= ENV ========= */
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") ?? "";
const GOOGLE_SOLAR_API_KEY = GOOGLE_MAPS_API_KEY;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

/* ========= CONSTANTES APRIMORADAS ========= */
const WGS84_R = 6378137; // raio (m)
const DEFAULT_EFF = 0.20; // 20% ≈ 200 Wp/m² (módulos policristalino padrão)
const DEFAULT_PR = 0.75; // Performance Ratio base
const INVERTER_EFF = 0.96; // eficiência de conversão DC→AC
const ANNUAL_DEGRADATION = 0.006; // 0.6% ao ano (NBR 16274)
const TEMP_COEFFICIENT = -0.004; // -0.4%/°C (silício cristalino)
const STC_TEMP = 25; // Standard Test Conditions (°C)

// Limites do território brasileiro
const BRAZIL_BOUNDS = {
  north: 5.27,
  south: -33.75,
  east: -34.79,
  west: -73.98
};

/* ========= SCHEMAS APRIMORADOS ========= */
const ShadingDescriptionEnum = z.enum([
  "sem_sombra",      // 0-5% - Área totalmente livre
  "sombra_minima",   // 5-15% - Pequenas obstruções pontuais
  "sombra_parcial",  // 15-30% - Obstruções em parte do dia
  "sombra_moderada", // 30-45% - Sombreamento significativo
  "sombra_severa"    // 45-60% - Sombreamento crítico
]);

const AnalyzeRequestSchema = z.object({
  address: z.string().min(5),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  usableAreaOverride: z.number().positive().optional(),
  polygon: z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
    source: z.enum(["user-drawn", "microsoft-footprint", "google-footprint"]).optional(),
  }).optional(),
  // NOVOS CAMPOS para melhor precisão
  shadingOverride: z.number().min(0).max(1).optional(),
  shadingDescription: ShadingDescriptionEnum.optional(),
  averageTemperature: z.number().min(15).max(35).optional(),
  moduleType: z.enum(["monocristalino", "policristalino", "filme_fino"]).optional(),
  systemAge: z.number().min(0).max(30).optional(),
});

const AnalysisSchema = z.object({
  id: z.string().uuid().optional(),
  address: z.string(),
  coordinates: z.object({ lat: z.number(), lng: z.number() }),
  coverage: z.object({
    google: z.boolean(),
    fallback: z.string().optional(),
    dataQuality: z.enum(["measured", "calculated", "estimated"]).optional(),
  }),
  confidence: z.enum(["Alta", "Média", "Baixa"]),
  usableArea: z.number(),
  areaSource: z.enum(["google", "footprint", "manual", "estimate"]),
  annualGHI: z.number(),
  irradiationSource: z.string(),
  shadingIndex: z.number(),
  shadingLoss: z.number(),
  shadingSource: z.enum(["google_measured", "user_input", "description", "heuristic"]),
  estimatedProduction: z.number(),
  estimatedProductionAC: z.number().optional(),
  estimatedProductionDC: z.number().optional(),
  // NOVOS CAMPOS de análise detalhada
  estimatedProductionYear1: z.number().optional(),
  estimatedProductionYear25: z.number().optional(),
  temperatureLosses: z.number().optional(),
  degradationFactor: z.number().optional(),
  effectivePR: z.number().optional(),
  // Classificação e recomendações
  verdict: z.enum(["Apto", "Parcial", "Não apto"]),
  reasons: z.array(z.string()),
  recommendations: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  // Metadados
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
    panelHeightMeters?: number;
    panelWidthMeters?: number;
    panelLifetimeYears?: number;
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
  imageryDate?: { year: number; month: number; day: number };
  imageryProcessedDate?: { year: number; month: number; day: number };
  imageryQuality?: string;
  boundingBox?: {
    sw: { latitude: number; longitude: number };
    ne: { latitude: number; longitude: number };
  };
};

/* ========= HELPERS ========= */

function corsHeaders() {
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

// Verifica se coordenadas estão no Brasil
function isBrazilianCoordinate(lat: number, lng: number): boolean {
  return lat >= BRAZIL_BOUNDS.south && lat <= BRAZIL_BOUNDS.north && 
         lng >= BRAZIL_BOUNDS.west && lng <= BRAZIL_BOUNDS.east;
}

// Obter temperatura média regional do Brasil
function getBrazilianAverageTemperature(lat: number): number {
  if (lat > -5) return 27;  // Norte (Amazônia, clima equatorial)
  if (lat > -10) return 26; // Nordeste (clima tropical)
  if (lat > -16) return 25; // Centro-Oeste (tropical com estação seca)
  if (lat > -24) return 23; // Sudeste (tropical de altitude)
  return 20; // Sul (subtropical)
}

// Performance Ratio ajustado por região brasileira
function getBrazilianPR(lat: number, lng: number, baseTemp: number): number {
  const basePR = DEFAULT_PR;
  const tempLoss = (baseTemp - STC_TEMP) * Math.abs(TEMP_COEFFICIENT);
  let regionalFactor = 1.0;
  if (lat < -20) {
    regionalFactor = 1.02;
  } else if (lat > -10 && lng > -40) {
    regionalFactor = 0.97;
  } else {
    regionalFactor = 0.98;
  }
  return basePR * (1 - tempLoss) * regionalFactor;
}

// Irradiação típica por região do Brasil
function getBrazilianTypicalGHI(lat: number): number {
  if (lat > -10) return 1950;
  if (lat > -16) return 1800;
  if (lat > -24) return 1650;
  if (lat > -28) return 1550;
  return 1450;
}

function shadingDescriptionToIndex(description: string): number {
  const mapping: Record<string, number> = {
    "sem_sombra": 0.025,
    "sombra_minima": 0.10,
    "sombra_parcial": 0.225,
    "sombra_moderada": 0.375,
    "sombra_severa": 0.525
  };
  return mapping[description] ?? 0.15;
}

function analyzeUrbanShading(address: string, lat: number): number {
  const lower = address.toLowerCase();
  const highDensity = ["centro", "downtown", "edifício", "edificio", "prédio", "predio", 
                       "apartamento", "torre", "tower", "arranha"];
  const openArea = ["fazenda", "sítio", "sitio", "chácara", "chacara", "rural", 
                    "rodovia", "estrada", "km ", "distrito industrial", "galpão", "galpao",
                    "armazém", "armazem", "condomínio logístico", "condominio logistico"];
  const suburban = ["jardim", "jardins", "parque", "residencial", "condomínio fechado",
                   "condominio fechado", "alameda", "alphaville", "granja"];
  const vegetation = ["bosque", "floresta", "mata", "arborizado", "verde", "ecological"];
  let shadeIndex = 0.10;
  if (highDensity.some(term => lower.includes(term))) {
    shadeIndex = 0.25;
  } else if (openArea.some(term => lower.includes(term))) {
    shadeIndex = 0.05;
  } else if (vegetation.some(term => lower.includes(term))) {
    shadeIndex = 0.35;
  } else if (suburban.some(term => lower.includes(term))) {
    shadeIndex = 0.15;
  } else if (lower.includes("rua ") || lower.includes("avenida ")) {
    shadeIndex = 0.18;
  }
  if (lat < -23) {
    shadeIndex += 0.03;
  }
  return clamp(shadeIndex, 0, 0.6);
}

function shadeLossFracFromIndex(idx: number) {
  const clamped = clamp(idx ?? 0, 0, 1);
  return clamped;
}

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
    const λ2 = (lon2 * Math.PI) / 180;
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

function circularMean(degArr: number[]): number {
  if (!degArr.length) return 0;
  const rads = degArr.map(d => d * Math.PI / 180);
  const x = rads.reduce((a, t) => a + Math.cos(t), 0);
  const y = rads.reduce((a, t) => a + Math.sin(t), 0);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function getTranspositionFactor(lat: number, tilt: number, azimuth: number): number {
  const lat_rad = Math.abs(lat) * Math.PI / 180;
  const tilt_rad = tilt * Math.PI / 180;
  const az_rad = azimuth * Math.PI / 180;
  const Rb = Math.cos(lat_rad - tilt_rad) / Math.cos(lat_rad);
  const az_factor = 1 - 0.1 * Math.abs(Math.sin(az_rad));
  const diffuse_ratio = 0.20;
  const diffuse_factor = (1 - diffuse_ratio) + diffuse_ratio * (1 + Math.cos(tilt_rad)) / 2;
  const albedo = 0.20;
  const albedo_factor = albedo * (1 - Math.cos(tilt_rad)) / 2;
  const total = Rb * az_factor * diffuse_factor + albedo_factor;
  return Math.max(0.65, Math.min(1.15, total));
}

function getModuleEfficiency(moduleType?: string): number {
  const efficiencies: Record<string, number> = {
    "monocristalino": 0.22,
    "policristalino": 0.20,
    "filme_fino": 0.15
  };
  return efficiencies[moduleType ?? "policristalino"] ?? DEFAULT_EFF;
}

function estimateByPVGIS_Ey(params: {
  Ey_kwh_per_kwp_year: number;
  usable_area_m2: number;
  module_eff?: number;
  shade_index?: number;
  temperature?: number;
  system_age?: number;
}) {
  const eff = params.module_eff ?? DEFAULT_EFF;
  const kWp = params.usable_area_m2 * eff;
  const shadeLoss = 1 - shadeLossFracFromIndex(params.shade_index ?? 0);
  const tempLoss = params.temperature 
    ? 1 - Math.max(0, (params.temperature - STC_TEMP) * Math.abs(TEMP_COEFFICIENT))
    : 1;
  const years = params.system_age ?? 0;
  const degradation = Math.pow(1 - ANNUAL_DEGRADATION, years);
  return params.Ey_kwh_per_kwp_year * kWp * shadeLoss * tempLoss * degradation;
}

function estimateByGHI(params: {
  ghi_kwh_m2_year: number;
  usable_area_m2: number;
  module_eff?: number;
  pr?: number;
  shade_index?: number;
  tilt_deg?: number;
  azimuth_deg?: number;
  lat?: number;
  temperature?: number;
  system_age?: number;
}) {
  const eff = params.module_eff ?? DEFAULT_EFF;
  const pr = params.pr ?? DEFAULT_PR;
  const shadeLoss = 1 - shadeLossFracFromIndex(params.shade_index ?? 0);
  let transpositionFactor = 1.0;
  if (params.tilt_deg != null && params.lat != null) {
    transpositionFactor = getTranspositionFactor(
      params.lat,
      params.tilt_deg,
      params.azimuth_deg ?? 0
    );
  }
  const tempLoss = params.temperature 
    ? 1 - Math.max(0, (params.temperature - STC_TEMP) * Math.abs(TEMP_COEFFICIENT))
    : 1;
  const years = params.system_age ?? 0;
  const degradation = Math.pow(1 - ANNUAL_DEGRADATION, years);
  return params.ghi_kwh_m2_year * params.usable_area_m2 * eff * pr * 
         transpositionFactor * shadeLoss * tempLoss * degradation;
}

function classifyVerdict(params: {
  usable_area_m2: number;
  shade_index: number;
  azimuth_deg?: number | null;
  tilt_deg?: number | null;
  is_brazil?: boolean;
}) {
  const reasons: string[] = [];
  const recommendations: string[] = [];
  const warnings: string[] = [];
  const area = params.usable_area_m2;
  const shade = clamp(params.shade_index, 0, 1);
  const az = params.azimuth_deg ?? 0;
  const tilt = params.tilt_deg ?? 15;
  const isBrazil = params.is_brazil ?? false;
  const azDev = isBrazil 
    ? Math.min(Math.abs(az), Math.abs(az - 360))
    : Math.min(Math.abs(az - 180), Math.abs(az + 180));
  const tiltOk = tilt >= 5 && tilt <= 35;
  const shadeOk = shade < 0.2;
  const shadeAcceptable = shade < 0.35;
  const areaApto = area >= 20;
  const areaMinimo = area >= 12;
  if (areaApto && shadeOk && azDev <= 45 && tiltOk) {
    reasons.push("Área adequada para instalação");
    reasons.push("Baixo índice de sombreamento");
    reasons.push("Orientação solar favorável");
    if (isBrazil) {
      recommendations.push("Sistema com excelente potencial de geração");
      recommendations.push("Considerar módulos de alta eficiência para maximizar produção");
    }
    return { 
      verdict: "Apto" as const, 
      reasons, 
      recommendations,
      warnings: warnings.length ? warnings : undefined
    };
  }
  if ((areaMinimo && shadeAcceptable) && (azDev <= 90 || tiltOk)) {
    if (area < 20) {
      reasons.push("Área no limite mínimo recomendado");
      recommendations.push("Utilizar módulos de alta eficiência");
    }
    if (!shadeOk && shade < 0.35) {
      reasons.push("Sombreamento moderado presente");
      recommendations.push("Realizar análise detalhada de sombreamento");
      recommendations.push("Considerar otimizadores de potência ou microinversores");
    }
    if (!tiltOk) {
      reasons.push(`Inclinação de ${tilt}° fora do ideal`);
      recommendations.push(`Ajustar inclinação para ${isBrazil ? '15-25°' : '30-40°'}`);
    }
    if (azDev > 45) {
      reasons.push("Orientação parcialmente favorável");
      warnings.push("Produção pode ser 5-15% menor que o ideal");
    }
    return { 
      verdict: "Parcial" as const, 
      reasons: reasons.length ? reasons : ["Condições parcialmente favoráveis"],
      recommendations: recommendations.length ? recommendations : undefined,
      warnings: warnings.length ? warnings : undefined
    };
  }
  if (area < 12) {
    reasons.push("Área insuficiente para instalação viável");
    warnings.push("Mínimo recomendado: 12m² úteis");
  }
  if (shade >= 0.35) {
    reasons.push("Sombreamento excessivo detectado");
    warnings.push("Perdas por sombreamento superiores a 35%");
  }
  if (azDev > 90) {
    reasons.push("Orientação desfavorável");
    warnings.push(isBrazil ? "Face voltada predominantemente para Sul" : "Face voltada predominantemente para Norte");
  }
  return { 
    verdict: "Não apto" as const, 
    reasons: reasons.length ? reasons : ["Condições desfavoráveis para instalação"],
    recommendations: ["Buscar localização alternativa para instalação"],
    warnings: warnings.length ? warnings : undefined
  };
}

/* ========= DATASOURCES ========= */

// Corrigido: SEM TRAVA REGIONAL. Sempre tenta Google Solar!
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

async function getPVGISYield(lat: number, lng: number, tilt_deg?: number, azimuth_deg?: number) {
  const angle = tilt_deg ? Math.round(tilt_deg) : undefined;
  let aspect: number | undefined;
  if (azimuth_deg != null) {
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

async function getNASAGHI(lat: number, lng: number) {
  const year = new Date().getFullYear() - 1;
  const start = `${year}0101`;
  const end = `${year}1231`;
  const url =
    `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=${lng}&latitude=${lat}&start=${start}&end=${end}&format=JSON`;
  try {
    const res = await fetchWithTimeout(url, 10000);
    if (!res.ok) throw new Error("NASA API error");
    const j = await res.json();
    const days = j?.properties?.parameter?.ALLSKY_SFC_SW_DWN;
    if (!days) throw new Error("No data from NASA");
    const sum = Object.values(days).reduce(
      (acc: number, v: unknown) => acc + (typeof v === "number" ? v : 0),
      0,
    );
    return { ghi_kwh_m2_year: sum as number };
  } catch {
    return { ghi_kwh_m2_year: getBrazilianTypicalGHI(lat) };
  }
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

// Google Solar processa dados do payload real e detalha o output
async function processGoogleSolarData(
  solar: SolarApiResponse,
  address: string,
  lat: number,
  lng: number,
  polygon?: { type: "Polygon"; coordinates: number[][][]; source?: "user-drawn"|"microsoft-footprint"|"google-footprint" },
  usableAreaOverride?: number,
  shadingOverride?: number,
  shadingDescription?: string,
  averageTemperature?: number,
  moduleType?: string,
  systemAge?: number,
) {
  const sp = solar.solarPotential!;
  const wholeArea = sp.wholeRoofStats?.areaMeters2 ?? 0;
  const isBrazil = isBrazilianCoordinate(lat, lng);

  // --- ÁREA ÚTIL ---
  const usageFactor = 0.80;
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
    usableAreaRaw = sp.maxArrayAreaMeters2;
    areaSource = "google";
    applyUF = 1.0;
  } else {
    usableAreaRaw = wholeArea * 0.70;
    areaSource = "google";
    applyUF = usageFactor;
  }

  const usableArea = Math.max(0, Math.round(usableAreaRaw * applyUF));

  // --- ÍNDICE DE SOMBRA ---
  let shadeIndex: number;
  let shadingSource: "google_measured" | "user_input" | "description" | "heuristic" = "google_measured";
  if (shadingOverride !== undefined) {
    shadeIndex = shadingOverride;
    shadingSource = "user_input";
  } else if (shadingDescription) {
    shadeIndex = shadingDescriptionToIndex(shadingDescription);
    shadingSource = "description";
  } else {
    const q = sp.wholeRoofStats?.sunshineQuantiles;
    shadeIndex = computeShadeIndexFromQuantiles(q, sp.maxSunshineHoursPerYear);
    shadingSource = "google_measured";
  }
  const shadingLoss = Math.round(shadeLossFracFromIndex(shadeIndex) * 100);

  // --- TEMPERATURA E EFICIÊNCIA ---
  const temperature = averageTemperature ?? (isBrazil ? getBrazilianAverageTemperature(lat) : 25);
  const moduleEff = getModuleEfficiency(moduleType);
  const age = systemAge ?? 0;

  // --- GHI ---
  let ghi_kwh_m2_year = 0;
  let irradiationSource = "";
  const nasa = await getNASAGHI(lat, lng).catch(() => null);
  if (nasa?.ghi_kwh_m2_year) {
    ghi_kwh_m2_year = nasa.ghi_kwh_m2_year;
    irradiationSource = "NASA POWER (GHI)";
  } else if (isBrazil) {
    ghi_kwh_m2_year = getBrazilianTypicalGHI(lat);
    irradiationSource = "Valores típicos brasileiros";
  } else {
    ghi_kwh_m2_year = 1800;
    irradiationSource = "Heurística conservadora";
  }

  // --- ORIENTAÇÃO/INCLINAÇÃO ---
  let avgAz = 0;
  let avgTilt = 15;
  if (sp.roofSegmentStats?.length) {
    const azArr = sp.roofSegmentStats.map(s => s.azimuthDegrees ?? 0);
    avgAz = circularMean(azArr);
    avgTilt = sp.roofSegmentStats.reduce((a, s) => a + (s.pitchDegrees ?? 15), 0) / sp.roofSegmentStats.length;
  }

  // --- PERFORMANCE RATIO EFETIVO ---
  const effectivePR = isBrazil ? getBrazilianPR(lat, lng, temperature) : DEFAULT_PR;

  // --- PRODUÇÃO ---
  let estimatedProduction = 0;
  let estimatedProductionDC = 0;
  let estimatedProductionAC = 0;
  let estimatedProductionYear1 = 0;
  let estimatedProductionYear25 = 0;
  if (sp.solarPanelConfigs?.length && areaSource === "google") {
    const best = sp.solarPanelConfigs.reduce((a, b) =>
      (b.yearlyEnergyDcKwh ?? 0) > (a.yearlyEnergyDcKwh ?? 0) ? b : a,
    );
    estimatedProductionDC = Math.floor(best.yearlyEnergyDcKwh ?? 0);
    estimatedProductionAC = Math.floor(estimatedProductionDC * INVERTER_EFF);
    estimatedProduction = estimatedProductionAC;
    estimatedProductionYear1 = estimatedProductionAC;
    estimatedProductionYear25 = Math.floor(estimatedProductionAC * Math.pow(1 - ANNUAL_DEGRADATION, 25));
  } else {
    const pvgis = await getPVGISYield(lat, lng, avgTilt, avgAz).catch(() => null);
    if (pvgis?.Ey_kwh_per_kwp_year) {
      estimatedProduction = Math.round(
        estimateByPVGIS_Ey({
          Ey_kwh_per_kwp_year: pvgis.Ey_kwh_per_kwp_year,
          usable_area_m2: usableArea,
          module_eff: moduleEff,
          shade_index: shadeIndex,
          temperature: temperature,
          system_age: age,
        }),
      );
      irradiationSource += " + PVGIS (E_y)";
    } else {
      estimatedProduction = Math.round(
        estimateByGHI({
          ghi_kwh_m2_year,
          usable_area_m2: usableArea,
          module_eff: moduleEff,
          pr: effectivePR,
          shade_index: shadeIndex,
          tilt_deg: avgTilt,
          azimuth_deg: avgAz,
          lat,
          temperature: temperature,
          system_age: age,
        }),
      );
    }
    estimatedProductionAC = estimatedProduction;
    estimatedProductionDC = Math.round(estimatedProductionAC / INVERTER_EFF);
    estimatedProductionYear1 = estimatedProductionAC;
    estimatedProductionYear25 = Math.floor(estimatedProductionAC * Math.pow(1 - ANNUAL_DEGRADATION, 25));
  }

  // --- PERDAS TÉRMICAS ---
  const temperatureLosses = Math.round((temperature - STC_TEMP) * Math.abs(TEMP_COEFFICIENT) * 100);

  // --- CLASSIFICAÇÃO ---
  const cls = classifyVerdict({
    usable_area_m2: usableArea,
    shade_index: shadeIndex,
    azimuth_deg: avgAz,
    tilt_deg: avgTilt,
    is_brazil: isBrazil,
  });

  // --- FOOTPRINTS ---
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

  // --- NOTA TÉCNICA ---
  let technicalNote =
    "Análise técnica v3.1: Produção estimada com base em Google Solar API + PVGIS/NASA. " +
    `Eficiência do módulo: ${(moduleEff * 100).toFixed(0)}%. ` +
    `PR efetivo: ${effectivePR.toFixed(2)}. ` +
    `Perdas térmicas: ${temperatureLosses}% (T_média=${temperature}°C). ` +
    `Degradação: ${(ANNUAL_DEGRADATION * 100).toFixed(1)}%/ano. ` +
    "Valores AC (pós-inversor) priorizados. ";
  if (isBrazil) {
    technicalNote += "Parâmetros otimizados para condições brasileiras. ";
  }
  if (polygon?.source === "microsoft-footprint") {
    technicalNote += "Footprint: Microsoft Building Footprints (ML). ";
  }

  // --- Google Solar output detalhado para o front ---
  const derived = {
    avgAz,
    avgTilt,
    estimatedProductionDC,
    estimatedProductionAC,
    inverterEff: INVERTER_EFF,
    moduleEff,
    temperature,
    maxArrayPanelsCount: sp.maxArrayPanelsCount,
    maxArrayAreaMeters2: sp.maxArrayAreaMeters2,
    maxSunshineHoursPerYear: sp.maxSunshineHoursPerYear,
    panelCapacityWatts: sp.panelCapacityWatts,
    panelHeightMeters: sp.panelHeightMeters,
    panelWidthMeters: sp.panelWidthMeters,
    panelLifetimeYears: sp.panelLifetimeYears,
    solarPanelConfigs: sp.solarPanelConfigs,
    wholeRoofStats: sp.wholeRoofStats,
    roofSegmentStats: sp.roofSegmentStats
  };

  return AnalysisSchema.parse({
    address,
    coordinates: { lat, lng },
    coverage: { 
      google: true,
      dataQuality: "measured"
    },
    confidence: "Alta",
    usableArea,
    areaSource,
    annualGHI: Math.round(ghi_kwh_m2_year),
    irradiationSource,
    shadingIndex: Number(shadeIndex.toFixed(3)),
    shadingLoss,
    shadingSource,
    estimatedProduction,
    estimatedProductionAC,
    estimatedProductionDC,
    estimatedProductionYear1,
    estimatedProductionYear25,
    temperatureLosses,
    degradationFactor: Number(Math.pow(1 - ANNUAL_DEGRADATION, 25).toFixed(3)),
    effectivePR: Number(effectivePR.toFixed(3)),
    verdict: cls.verdict,
    reasons: cls.reasons,
    recommendations: cls.recommendations,
    warnings: cls.warnings,
    usageFactor: applyUF,
    footprints,
    googleSolarData: { ...solar, derived },
    technicalNote,
  });
}

// (A função processFallbackAnalysis permanece igual ao seu código original.)

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

/* ========= HANDLER PRINCIPAL ========= */

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

    // Parse body
    const json = await req.json();
    const input = AnalyzeRequestSchema.parse(json);

    const { lat, lng, address } = input;
    const isBrazil = isBrazilianCoordinate(lat, lng);
    console.log(`Análise solar: lat=${lat}, lng=${lng}, address="${address}", Brasil=${isBrazil}`);

    if (isBrazil && !input.shadingOverride && !input.shadingDescription) {
      console.log("⚠️ Análise brasileira sem dados de sombreamento - usando heurística");
    }

    // SEMPRE tentar Google Solar, inclusive Brasil!
    let analysis;
    const google = await getGoogleSolarData(lat, lng).catch(() => null);

    if (google?.solarPotential) {
      console.log("Usando dados Google Solar (se disponível)");
      analysis = await processGoogleSolarData(
        google,
        address,
        lat,
        lng,
        input.polygon,
        input.usableAreaOverride,
        input.shadingOverride,
        input.shadingDescription,
        input.averageTemperature,
        input.moduleType,
        input.systemAge,
      );
    } else {
      console.log("Usando fallback PVGIS/NASA (quando Google não retorna dados)");
      analysis = await processFallbackAnalysis({
        lat,
        lng,
        address,
        polygon: input.polygon,
        usableAreaOverride: input.usableAreaOverride,
        shadingOverride: input.shadingOverride,
        shadingDescription: input.shadingDescription,
        averageTemperature: input.averageTemperature,
        moduleType: input.moduleType,
        systemAge: input.systemAge,
      });
    }

    // Adicionar metadados de resposta
    const response = {
      success: true,
      data: analysis,
      metadata: {
        version: "3.1",
        timestamp: new Date().toISOString(),
        location: isBrazil ? "Brazil" : "International",
        dataSource: analysis.coverage.google ? "Google Solar API" : "PVGIS/NASA",
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
