// deno-lint-ignore-file no-explicit-any
// Edge Function – Análise Solar para Laudo Técnico (v3.2 - Melhorias PR, Eficiência e Transposição)
// Aprimorada conforme recomendações técnicas para o Brasil e Internacional

// @ts-expect-error Import from URL
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.5";
// @ts-expect-error Import from URL
import { z } from "https://esm.sh/zod@3.23.8";

declare const Deno: {
  env: { get(k: string): string | undefined };
  serve(h: (r: Request) => Response | Promise<Response>): void;
};

/* ========= ENV ========= */
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") ?? "";
const GOOGLE_SOLAR_API_KEY = GOOGLE_MAPS_API_KEY;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

/* ========= CONSTANTES APRIMORADAS ========= */
const WGS84_R = 6378137;
const DEFAULT_EFF = 0.21; // 21% (mais realista, Brasil 2024+)
const DEFAULT_PR = 0.82; // Performance Ratio base (NBR 16274)
const INVERTER_EFF = 0.96;
const ANNUAL_DEGRADATION = 0.006;
const TEMP_COEFFICIENT = -0.004;
const STC_TEMP = 25;
const BRAZIL_BOUNDS = {
  north: 5.27,
  south: -33.75,
  east: -34.79,
  west: -73.98,
};

/* ========= SCHEMAS ========= */
const ShadingDescriptionEnum = z.enum([
  "sem_sombra",
  "sombra_minima",
  "sombra_parcial",
  "sombra_moderada",
  "sombra_severa",
]);
const AnalyzeRequestSchema = z.object({
  address: z.string().min(5),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  usableAreaOverride: z.number().positive().optional(),
  polygon: z
    .object({
      type: z.literal("Polygon"),
      coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
      source: z
        .enum(["user-drawn", "microsoft-footprint", "google-footprint"])
        .optional(),
    })
    .optional(),
  shadingOverride: z.number().min(0).max(1).optional(),
  shadingDescription: ShadingDescriptionEnum.optional(),
  averageTemperature: z.number().min(15).max(35).optional(),
  moduleType: z
    .enum(["monocristalino", "policristalino", "filme_fino"])
    .optional(),
  systemAge: z.number().min(0).max(30).optional(),
  tiltEstimated: z.number().min(0).max(60).optional(),
  preferredSource: z.enum(["PVGIS", "NASA"]).optional(),
  // Technician inputs
  technicianInputs: z.object({
    panel_count: z.number().nullable().optional(),
    energy_cost_per_kwh: z.number().nullable().optional(),
    solar_incentives: z.number().nullable().optional(),
    installation_cost_per_watt: z.number().nullable().optional(),
    panel_capacity_watts: z.number().nullable().optional(),
    show_advanced_settings: z.boolean().optional(),
    additional_details: z.string().nullable().optional(),
    system_lifetime_years: z.number().nullable().optional(),
    dc_to_ac_conversion: z.number().nullable().optional(),
    annual_degradation_rate: z.number().nullable().optional(),
    annual_energy_cost_increase: z.number().nullable().optional(),
    discount_rate: z.number().nullable().optional()
  }).optional(),

});


/* ========= INTERFACE PARA API PVGIS (PVcalc) ========= */

// Interface para localização
interface PVGISLocation {
  latitude: number;
  longitude: number;
  elevation: number;
}

// Interface para dados meteorológicos
interface PVGISMeteoData {
  radiation_db: string;
  meteo_db: string;
  year_min: number;
  year_max: number;
  use_horizon: boolean;
  horizon_db: string;
}

// Interface para configurações de inclinação e azimute
interface PVGISSlopeAzimuth {
  value: number;
  optimal: boolean;
}

// Interface para sistema de montagem fixo
interface PVGISFixedMounting {
  slope: PVGISSlopeAzimuth;
  azimuth: PVGISSlopeAzimuth;
  type: string;
}

// Interface para sistema de montagem
interface PVGISMountingSystem {
  fixed: PVGISFixedMounting;
}

// Interface para módulo fotovoltaico
interface PVGISPVModule {
  technology: string;
  peak_power: number;
  system_loss: number;
}

// Interface para dados econômicos
interface PVGISEconomicData {
  system_cost: number | null;
  interest: number | null;
  lifetime: number | null;
}

// Interface para entradas da API PVGIS
interface PVGISInputs {
  location: PVGISLocation;
  meteo_data: PVGISMeteoData;
  mounting_system: PVGISMountingSystem;
  pv_module: PVGISPVModule;
  economic_data: PVGISEconomicData;
}

// Interface para dados mensais
interface PVGISMonthlyData {
  month: number;
  E_d: number;
  E_m: number;
  "H(i)_d": number;
  "H(i)_m": number;
  SD_m: number;
}

// Interface para saídas mensais
interface PVGISMonthlyOutputs {
  fixed: PVGISMonthlyData[];
}

// Interface para totais fixos
interface PVGISFixedTotals {
  E_d: number;
  E_m: number;
  E_y: number;
  "H(i)_d": number;
  "H(i)_m": number;
  "H(i)_y": number;
  SD_m: number;
  SD_y: number;
  l_aoi: number;
  l_spec: string;
  l_tg: number;
  l_total: number;
}

// Interface para totais
interface PVGISTotals {
  fixed: PVGISFixedTotals;
}

// Interface para saídas da API PVGIS
interface PVGISOutputs {
  monthly: PVGISMonthlyOutputs;
  totals: PVGISTotals;
}

// Interface para variáveis de metadados
interface PVGISMetaVariable {
  description: string;
  units?: string;
}

// Interface para campos de metadados
interface PVGISMetaField {
  description: string;
  units?: string;
}

// Interface para metadados de entrada
interface PVGISMetaInputs {
  location: {
    description: string;
    variables: {
      latitude: PVGISMetaVariable;
      longitude: PVGISMetaVariable;
      elevation: PVGISMetaVariable;
    };
  };
  meteo_data: {
    description: string;
    variables: {
      radiation_db: PVGISMetaVariable;
      meteo_db: PVGISMetaVariable;
      year_min: PVGISMetaVariable;
      year_max: PVGISMetaVariable;
      use_horizon: PVGISMetaVariable;
      horizon_db: PVGISMetaVariable;
    };
  };
  mounting_system: {
    description: string;
    choices: string;
    fields: {
      slope: PVGISMetaField;
      azimuth: PVGISMetaField;
    };
  };
  pv_module: {
    description: string;
    variables: {
      technology: PVGISMetaVariable;
      peak_power: PVGISMetaVariable;
      system_loss: PVGISMetaVariable;
    };
  };
  economic_data: {
    description: string;
    variables: {
      system_cost: PVGISMetaVariable;
      interest: PVGISMetaVariable;
      lifetime: PVGISMetaVariable;
    };
  };
}

// Interface para metadados de saída
interface PVGISMetaOutputs {
  monthly: {
    type: string;
    timestamp: string;
    variables: {
      E_d: PVGISMetaVariable;
      E_m: PVGISMetaVariable;
      "H(i)_d": PVGISMetaVariable;
      "H(i)_m": PVGISMetaVariable;
      SD_m: PVGISMetaVariable;
    };
  };
  totals: {
    type: string;
    variables: {
      E_d: PVGISMetaVariable;
      E_m: PVGISMetaVariable;
      E_y: PVGISMetaVariable;
      "H(i)_d": PVGISMetaVariable;
      "H(i)_m": PVGISMetaVariable;
      "H(i)_y": PVGISMetaVariable;
      SD_m: PVGISMetaVariable;
      SD_y: PVGISMetaVariable;
      l_aoi: PVGISMetaVariable;
      l_spec: PVGISMetaVariable;
      l_tg: PVGISMetaVariable;
      l_total: PVGISMetaVariable;
    };
  };
}

// Interface para metadados
interface PVGISMeta {
  inputs: PVGISMetaInputs;
  outputs: PVGISMetaOutputs;
}

// Interface principal para resposta da API PVGIS
interface PVGISResponse {
  inputs: PVGISInputs;
  outputs: PVGISOutputs;
  meta: PVGISMeta;
}

/* ========= INTERFACE PARA API NASA POWER ========= */

// Interface para geometria do ponto
interface NASAGeometry {
  type: "Point";
  coordinates: [number, number, number]; // [longitude, latitude, elevation]
}

// Interface para parâmetros de irradiação solar
interface NASASolarParameter {
  [date: string]: number; // YYYYMMDD format
}

// Interface para parâmetros
interface NASAParameters {
  ALLSKY_SFC_SW_DWN: NASASolarParameter;
  [key: string]: NASASolarParameter; // Para outros parâmetros possíveis
}

// Interface para propriedades
interface NASAProperties {
  parameter: NASAParameters;
}

// Interface para API do cabeçalho
interface NASAHeaderAPI {
  version: string;
  name: string;
}

// Interface para cabeçalho
interface NASAHeader {
  title: string;
  api: NASAHeaderAPI;
  sources: string[];
  fill_value: number;
  time_standard: string;
  start: string;
  end: string;
}

// Interface para definições de parâmetros
interface NASAParameterDefinition {
  units: string;
  longname: string;
}

// Interface para definições de parâmetros
interface NASAParameterDefinitions {
  ALLSKY_SFC_SW_DWN: NASAParameterDefinition;
  [key: string]: NASAParameterDefinition; // Para outros parâmetros possíveis
}

// Interface para tempos de processamento
interface NASATimes {
  data: number;
  process: number;
}

// Interface principal para resposta da API NASA POWER
interface NASAPowerResponse {
  type: "Feature";
  geometry: NASAGeometry;
  properties: NASAProperties;
  header: NASAHeader;
  messages: string[];
  parameters: NASAParameterDefinitions;
  times: NASATimes;
}

/* ========= API TRACKING TYPES ========= */
interface ApiTracker {
  sourcesUsed: string[];
  responseTimes: { [key: string]: number };
  errors: { [key: string]: string };
  fallbackReasons: string[];
  nasaPowerData?: NASAPowerResponse;
  pvgisData?: PVGISResponse;
}

function createApiTracker(): ApiTracker {
  return {
    sourcesUsed: [],
    responseTimes: {},
    errors: {},
    fallbackReasons: [],
  };
}

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
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, apikey, x-client-info",
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
function isBrazilianCoordinate(lat: number, lng: number): boolean {
  return (
    lat >= BRAZIL_BOUNDS.south &&
    lat <= BRAZIL_BOUNDS.north &&
    lng >= BRAZIL_BOUNDS.west &&
    lng <= BRAZIL_BOUNDS.east
  );
}
function getBrazilianAverageTemperature(lat: number): number {
  if (lat > -5) return 27;
  if (lat > -10) return 26;
  if (lat > -16) return 25;
  if (lat > -24) return 23;
  return 20;
}
function getBrazilianPR(lat: number, lng: number, baseTemp: number): number {
  const basePR = DEFAULT_PR;
  const tempLoss = (baseTemp - STC_TEMP) * Math.abs(TEMP_COEFFICIENT);
  let regionalFactor = 1.0;
  if (lat < -20) regionalFactor = 1.02;
  else if (lat > -10 && lng > -40) regionalFactor = 0.97;
  else regionalFactor = 0.98;
  return basePR * (1 - tempLoss) * regionalFactor;
}
function getBrazilianTypicalGHI(lat: number): number {
  if (lat > -10) return 1950;
  if (lat > -16) return 1800;
  if (lat > -24) return 1650;
  if (lat > -28) return 1550;
  return 1450;
}
function shadingDescriptionToIndex(description: string): number {
  const mapping: Record<string, number> = {
    sem_sombra: 0.025,
    sombra_minima: 0.1,
    sombra_parcial: 0.225,
    sombra_moderada: 0.375,
    sombra_severa: 0.525,
  };
  return mapping[description] ?? 0.15;
}
function analyzeUrbanShading(address: string, lat: number): number {
  const lower = address.toLowerCase();
  const highDensity = [
    "centro",
    "downtown",
    "edifício",
    "edificio",
    "prédio",
    "predio",
    "apartamento",
    "torre",
    "tower",
    "arranha",
  ];
  const openArea = [
    "fazenda",
    "sítio",
    "sitio",
    "chácara",
    "chacara",
    "rural",
    "rodovia",
    "estrada",
    "km ",
    "distrito industrial",
    "galpão",
    "galpao",
    "armazém",
    "armazem",
    "condomínio logístico",
    "condominio logistico",
  ];
  const suburban = [
    "jardim",
    "jardins",
    "parque",
    "residencial",
    "condomínio fechado",
    "condominio fechado",
    "alameda",
    "alphaville",
    "granja",
  ];
  const vegetation = [
    "bosque",
    "floresta",
    "mata",
    "arborizado",
    "verde",
    "ecological",
  ];
  let shadeIndex = 0.1;
  if (highDensity.some((term) => lower.includes(term))) shadeIndex = 0.25;
  else if (openArea.some((term) => lower.includes(term))) shadeIndex = 0.05;
  else if (vegetation.some((term) => lower.includes(term))) shadeIndex = 0.35;
  else if (suburban.some((term) => lower.includes(term))) shadeIndex = 0.15;
  else if (lower.includes("rua ") || lower.includes("avenida "))
    shadeIndex = 0.18;
  if (lat < -23) shadeIndex += 0.03;
  return clamp(shadeIndex, 0, 0.6);
}
function shadeLossFracFromIndex(idx: number) {
  const clamped = clamp(idx ?? 0, 0, 1);
  return clamped;
}
function polygonAreaM2_geodesic(coords: [number, number][]): number {
  if (coords.length < 3) return 0;
  const ring =
    coords[0][0] === coords[coords.length - 1][0] &&
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
    const x = lng * Math.cos((lat * Math.PI) / 180) * 111_000;
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
  const rads = degArr.map((d) => (d * Math.PI) / 180);
  const x = rads.reduce((a, t) => a + Math.cos(t), 0);
  const y = rads.reduce((a, t) => a + Math.sin(t), 0);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// MELHORADO: Fator de transposição realista (Liu & Jordan simplificada)
function getTranspositionFactor(
  lat: number,
  tilt: number
): number {
  const beta = (tilt * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const Rb = Math.cos(phi - beta) / Math.cos(phi);
  const diffuse_ratio = 0.2;
  const albedo = 0.2;
  const diffuse_factor =
    1 - diffuse_ratio + (diffuse_ratio * (1 + Math.cos(beta))) / 2;
  const albedo_factor = (albedo * (1 - Math.cos(beta))) / 2;
  const total = Rb * diffuse_factor + albedo_factor;
  return Math.max(0.7, Math.min(1.1, total));
}
function getModuleEfficiency(moduleType?: string): number {
  const efficiencies: Record<string, number> = {
    monocristalino: 0.215,
    policristalino: 0.2,
    filme_fino: 0.14,
  };
  return efficiencies[moduleType ?? "monocristalino"] ?? DEFAULT_EFF;
}

// Estimativa usando GHI, PR e transposição APERFEIÇOADA!
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
  segments?: { area: number; tilt: number; az: number }[];
}) {
  const eff = params.module_eff ?? DEFAULT_EFF;
  const pr = params.pr ?? DEFAULT_PR;
  const shadeLoss = 1 - shadeLossFracFromIndex(params.shade_index ?? 0);
  let transpositionFactor = 1.0;
  if (params.segments && params.segments.length > 0) {
    let totalArea = 0,
      sum = 0;
    for (const seg of params.segments) {
      const tf = getTranspositionFactor(params.lat ?? 0, seg.tilt);
      sum += seg.area * tf;
      totalArea += seg.area;
    }
    transpositionFactor = totalArea > 0 ? sum / totalArea : 1.0;
  } else if (params.tilt_deg != null && params.lat != null) {
    transpositionFactor = getTranspositionFactor(params.lat, params.tilt_deg);
  }
  const tempLoss = params.temperature
    ? 1 -
      Math.max(0, (params.temperature - STC_TEMP) * Math.abs(TEMP_COEFFICIENT))
    : 1;
  const years = params.system_age ?? 0;
  const degradation = Math.pow(1 - ANNUAL_DEGRADATION, years);
  return {
    value:
      params.ghi_kwh_m2_year *
      params.usable_area_m2 *
      eff *
      pr *
      transpositionFactor *
      shadeLoss *
      tempLoss *
      degradation,
    transpositionFactor,
  };
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
      recommendations.push(
        "Considerar módulos de alta eficiência para maximizar produção"
      );
    }
    return {
      verdict: "Apto" as const,
      reasons,
      recommendations,
      warnings: warnings.length ? warnings : undefined,
    };
  }
  if (areaMinimo && shadeAcceptable && (azDev <= 90 || tiltOk)) {
    if (area < 20) {
      reasons.push("Área no limite mínimo recomendado");
      recommendations.push("Utilizar módulos de alta eficiência");
    }
    if (!shadeOk && shade < 0.35) {
      reasons.push("Sombreamento moderado presente");
      recommendations.push("Realizar análise detalhada de sombreamento");
      recommendations.push(
        "Considerar otimizadores de potência ou microinversores"
      );
    }
    if (!tiltOk) {
      reasons.push(`Inclinação de ${tilt}° fora do ideal`);
      recommendations.push(
        `Ajustar inclinação para ${isBrazil ? "15-25°" : "30-40°"}`
      );
    }
    if (azDev > 45) {
      reasons.push("Orientação parcialmente favorável");
      warnings.push("Produção pode ser 5-15% menor que o ideal");
    }
    return {
      verdict: "Parcial" as const,
      reasons: reasons.length ? reasons : ["Condições parcialmente favoráveis"],
      recommendations: recommendations.length ? recommendations : undefined,
      warnings: warnings.length ? warnings : undefined,
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
    warnings.push(
      isBrazil
        ? "Face voltada predominantemente para Sul"
        : "Face voltada predominantemente para Norte"
    );
  }
  return {
    verdict: "Não apto" as const,
    reasons: reasons.length
      ? reasons
      : ["Condições desfavoráveis para instalação"],
    recommendations: ["Buscar localização alternativa para instalação"],
    warnings: warnings.length ? warnings : undefined,
  };
}

/* ========= DATASOURCES ========= */
async function getGoogleSolarData(
  lat: number,
  lng: number,
  apiTracker?: ApiTracker
): Promise<SolarApiResponse | null> {
  if (!GOOGLE_SOLAR_API_KEY) {
    if (apiTracker) {
      apiTracker.errors['GOOGLE_SOLAR'] = 'API key not configured';
      apiTracker.fallbackReasons.push('Google Solar API key not configured');
    }
    return null;
  }
  
  const startTime = Date.now();
  
  try {
    const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&key=${GOOGLE_SOLAR_API_KEY}`;
    const res = await fetchWithTimeout(url, 8000);
    const responseTime = Date.now() - startTime;
    
    if (apiTracker) {
      apiTracker.responseTimes['GOOGLE_SOLAR'] = responseTime;
    }
    
    const j = (await res.json()) as SolarApiResponse;
    
    if (j?.error) {
      if (apiTracker) {
        apiTracker.errors['GOOGLE_SOLAR'] = `${j.error.code}: ${j.error.message}`;
        apiTracker.fallbackReasons.push('Google Solar API returned error');
      }
      return null;
    }
    
    if (!j?.solarPotential) {
      if (apiTracker) {
        apiTracker.errors['GOOGLE_SOLAR'] = 'No solar potential data available';
        apiTracker.fallbackReasons.push('No Google Solar data available for location');
      }
      return null;
    }
    
    if (apiTracker) {
      apiTracker.sourcesUsed.push('GOOGLE_SOLAR');
    }
    
    return j;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    if (apiTracker) {
      apiTracker.responseTimes['GOOGLE_SOLAR'] = responseTime;
      apiTracker.errors['GOOGLE_SOLAR'] = error instanceof Error ? error.message : 'Unknown error';
      apiTracker.fallbackReasons.push('Google Solar API request failed');
    }
    
    return null;
  }
}

async function getPVGISData(lat: number, lng: number, apiTracker?: ApiTracker): Promise<PVGISResponse | null> {
  const startTime = Date.now();
  
  try {
    // PVGIS API endpoint for photovoltaic calculation
    const url = `https://re.jrc.ec.europa.eu/api/v5_2/PVcalc?lat=${lat}&lon=${lng}&raddatabase=PVGIS-SARAH2&browser=0&outputformat=json&usehorizon=1&userhorizon=&js=1&select_database_grid=PVGIS-SARAH2&pvtechchoice=crystSi&peakpower=1&loss=14&mountingplace=free&angle=35&aspect=0`;
    
    const res = await fetchWithTimeout(url, 10000);
    const responseTime = Date.now() - startTime;
    
    if (apiTracker) {
      apiTracker.responseTimes['PVGIS'] = responseTime;
    }
    
    if (!res.ok) throw new Error("PVGIS API error");
    const j = await res.json() as PVGISResponse;
    
    if (!j?.outputs) throw new Error("No PVGIS data available");
    
    if (apiTracker) {
      apiTracker.sourcesUsed.push('PVGIS');
      apiTracker.pvgisData = j;
    }
    
    return j;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    if (apiTracker) {
      apiTracker.responseTimes['PVGIS'] = responseTime;
      apiTracker.errors['PVGIS'] = error instanceof Error ? error.message : 'Unknown error';
      apiTracker.fallbackReasons.push('PVGIS API failed');
    }
    
    return null;
  }
}

async function getNASAGHI(lat: number, lng: number, apiTracker?: ApiTracker) {
  const year = new Date().getFullYear() - 1;
  const start = `${year}0101`;
  const end = `${year}1231`;
  const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=${lng}&latitude=${lat}&start=${start}&end=${end}&format=JSON`;
  
  const startTime = Date.now();
  
  try {
    const res = await fetchWithTimeout(url, 10000);
    const responseTime = Date.now() - startTime;
    
    if (apiTracker) {
      apiTracker.responseTimes['NASA_POWER'] = responseTime;
    }
    
    if (!res.ok) throw new Error("NASA API error");
    const j = await res.json() as NASAPowerResponse;
    
    const days = j?.properties?.parameter?.ALLSKY_SFC_SW_DWN;
    if (!days) throw new Error("No data from NASA");
    
    const sum = Object.values(days).reduce(
      (acc: number, v: unknown) => acc + (typeof v === "number" ? v : 0),
      0
    );
    
    if (apiTracker) {
      apiTracker.sourcesUsed.push('NASA_POWER');
      apiTracker.nasaPowerData = j;
    }
    
    return { ghi_kwh_m2_year: sum as number };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    if (apiTracker) {
      apiTracker.responseTimes['NASA_POWER'] = responseTime;
      apiTracker.errors['NASA_POWER'] = error instanceof Error ? error.message : 'Unknown error';
      apiTracker.fallbackReasons.push('NASA POWER API failed, using regional defaults');
    }
    
    return { ghi_kwh_m2_year: getBrazilianTypicalGHI(lat) };
  }
}

/* ========= PROCESSADORES ========= */

function computeShadeIndexFromQuantiles(
  q: number[] | undefined,
  fallbackMax: number | undefined
) {
  if (!q?.length) {
    const maxSun = fallbackMax ?? 1500;
    const mid = maxSun * 0.85;
    return clamp(1 - mid / Math.max(maxSun, 1), 0, 1);
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
  return clamp(1 - center / Math.max(max, 1), 0, 1);
}

// Google Solar: processa dados do payload real e detalha o output (MELHORADO)
async function processGoogleSolarData(
  solar: SolarApiResponse,
  address: string,
  lat: number,
  lng: number,
  polygon?: {
    type: "Polygon";
    coordinates: number[][][];
    source?: "user-drawn" | "microsoft-footprint" | "google-footprint";
  },
  usableAreaOverride?: number,
  shadingOverride?: number,
  shadingDescription?: string,
  averageTemperature?: number,
  moduleType?: string,
  systemAge?: number,
  tiltEstimated?: number,
  preferredSource?: "PVGIS" | "NASA",
  technicianInputs?: any
) {
  const sp = solar.solarPotential!;
  const wholeArea = sp.wholeRoofStats?.areaMeters2 ?? 0;
  const isBrazil = isBrazilianCoordinate(lat, lng);

  // --- ÁREA ÚTIL ---
  const usageFactor = 0.8;
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
  } else if (
    typeof sp.maxArrayAreaMeters2 === "number" &&
    sp.maxArrayAreaMeters2 > 0
  ) {
    usableAreaRaw = sp.maxArrayAreaMeters2;
    areaSource = "google";
    applyUF = 1.0;
  } else {
    usableAreaRaw = wholeArea * 0.7;
    areaSource = "google";
    applyUF = usageFactor;
  }
  const usableArea = Math.max(0, Math.round(usableAreaRaw * applyUF));

  // --- ÍNDICE DE SOMBRA ---
  let shadeIndex: number;
  let shadingSource:
    | "google_measured"
    | "user_input"
    | "description"
    | "heuristic" = "google_measured";
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
  const temperature =
    averageTemperature ?? (isBrazil ? getBrazilianAverageTemperature(lat) : 25);
  const moduleEff = getModuleEfficiency(moduleType);
  const age = systemAge ?? 0;

  // --- GHI ---
  let ghi_kwh_m2_year = 0;
  let irradiationSource = "";

  // Initialize API tracker for this analysis
  const apiTracker = createApiTracker();

  // SEMPRE fazer chamadas para TODAS as APIs de fallback para ter dados completos
  console.log("Fazendo chamadas para todas as APIs de fallback...");
  
  // Fazer chamadas paralelas para ambas as APIs de fallback
  const [nasaResult, pvgisResult] = await Promise.allSettled([
    getNASAGHI(lat, lng, apiTracker).catch(() => null),
    getPVGISData(lat, lng, apiTracker).catch(() => null)
  ]);

  // Extrair dados das chamadas
  const nasa = nasaResult.status === 'fulfilled' ? nasaResult.value : null;
  const pvgis = pvgisResult.status === 'fulfilled' ? pvgisResult.value : null;

  // Log dos resultados das APIs
  console.log("NASA POWER result:", nasa ? "SUCCESS" : "FAILED");
  console.log("PVGIS result:", pvgis ? "SUCCESS" : "FAILED");

  // Agora escolher qual usar baseado na preferência
  if (preferredSource === "NASA") {
    if (nasa?.ghi_kwh_m2_year) {
      ghi_kwh_m2_year = nasa.ghi_kwh_m2_year;
      irradiationSource = "NASA POWER (GHI) - Fonte Preferida";
    } else if (pvgis?.outputs?.totals?.fixed?.["H(i)_y"]) {
      ghi_kwh_m2_year = pvgis.outputs.totals.fixed["H(i)_y"];
      irradiationSource = "PVGIS (fallback from NASA preferred)";
      apiTracker.fallbackReasons.push('NASA POWER preferred but failed, using PVGIS');
    } else {
      ghi_kwh_m2_year = isBrazil ? getBrazilianTypicalGHI(lat) : 1800;
      irradiationSource = "Valores típicos (fallback from NASA preferred)";
      apiTracker.fallbackReasons.push('NASA POWER preferred but both APIs failed, using regional defaults');
    }
  } else if (preferredSource === "PVGIS") {
    if (pvgis?.outputs?.totals?.fixed?.["H(i)_y"]) {
      ghi_kwh_m2_year = pvgis.outputs.totals.fixed["H(i)_y"];
      irradiationSource = "PVGIS - Fonte Preferida";
    } else if (nasa?.ghi_kwh_m2_year) {
      ghi_kwh_m2_year = nasa.ghi_kwh_m2_year;
      irradiationSource = "NASA POWER (fallback from PVGIS preferred)";
      apiTracker.fallbackReasons.push('PVGIS preferred but failed, using NASA POWER');
    } else {
      ghi_kwh_m2_year = isBrazil ? getBrazilianTypicalGHI(lat) : 1800;
      irradiationSource = "Valores típicos (fallback from PVGIS preferred)";
      apiTracker.fallbackReasons.push('PVGIS preferred but both APIs failed, using regional defaults');
    }
  } else {
    // Default cascade: NASA -> PVGIS -> Regional defaults
    if (nasa?.ghi_kwh_m2_year) {
      ghi_kwh_m2_year = nasa.ghi_kwh_m2_year;
      irradiationSource = "NASA POWER (GHI)";
    } else if (pvgis?.outputs?.totals?.fixed?.["H(i)_y"]) {
      ghi_kwh_m2_year = pvgis.outputs.totals.fixed["H(i)_y"];
      irradiationSource = "PVGIS (fallback from NASA)";
      apiTracker.fallbackReasons.push('NASA POWER failed, using PVGIS');
    } else if (isBrazil) {
      ghi_kwh_m2_year = getBrazilianTypicalGHI(lat);
      irradiationSource = "Valores típicos brasileiros";
      apiTracker.fallbackReasons.push('All external APIs failed, using Brazilian regional defaults');
    } else {
      ghi_kwh_m2_year = 1800;
      irradiationSource = "Heurística conservadora";
      apiTracker.fallbackReasons.push('All external APIs failed, using conservative defaults');
    }
  }

  // --- ORIENTAÇÃO/INCLINAÇÃO: múltiplos segmentos?
  let avgAz = 0,
    avgTilt = tiltEstimated ?? 15;
  let segments: { area: number; tilt: number; az: number }[] = [];
  if (sp.roofSegmentStats?.length && !tiltEstimated) {
    segments = sp.roofSegmentStats.map((s) => ({
      area: s.stats?.areaMeters2 ?? 0,
      tilt: s.pitchDegrees ?? 15,
      az: s.azimuthDegrees ?? 0,
    }));
    avgAz = circularMean(segments.map((s) => s.az));
    avgTilt =
      segments.reduce((a, s) => a + s.tilt * (s.area || 1), 0) /
      (segments.reduce((a, s) => a + (s.area || 1), 0) || 1);
  }

  // --- PERFORMANCE RATIO EFETIVO ---
  const effectivePR = isBrazil
    ? getBrazilianPR(lat, lng, temperature)
    : DEFAULT_PR;

  // --- PRODUÇÃO e FATOR DE TRANSPOSIÇÃO ---
  let estimatedProduction = 0,
    estimatedProductionDC = 0,
    estimatedProductionAC = 0;
  let estimatedProductionYear1 = 0,
    estimatedProductionYear25 = 0,
    transpositionFactor = 1.0;
  if (sp.solarPanelConfigs?.length && areaSource === "google") {
    const best = sp.solarPanelConfigs.reduce((a, b) =>
      (b.yearlyEnergyDcKwh ?? 0) > (a.yearlyEnergyDcKwh ?? 0) ? b : a
    );
    estimatedProductionDC = Math.floor(best.yearlyEnergyDcKwh ?? 0);
    estimatedProductionAC = Math.floor(estimatedProductionDC * INVERTER_EFF);
    estimatedProduction = estimatedProductionAC;
    estimatedProductionYear1 = estimatedProductionAC;
    estimatedProductionYear25 = Math.floor(
      estimatedProductionAC * Math.pow(1 - ANNUAL_DEGRADATION, 25)
    );
    transpositionFactor = 1.0;
  } else {
    const result = estimateByGHI({
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
      segments,
    });
    estimatedProduction = Math.round(result.value);
    transpositionFactor = result.transpositionFactor;
    estimatedProductionAC = estimatedProduction;
    estimatedProductionDC = Math.round(estimatedProductionAC / INVERTER_EFF);
    estimatedProductionYear1 = estimatedProductionAC;
    estimatedProductionYear25 = Math.floor(
      estimatedProductionAC * Math.pow(1 - ANNUAL_DEGRADATION, 25)
    );
  }

  const temperatureLosses = Math.round(
    (temperature - STC_TEMP) * Math.abs(TEMP_COEFFICIENT) * 100
  );

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
      id:
        polygonSource === "microsoft-footprint"
          ? "microsoft-footprint-polygon"
          : "user-drawn-polygon",
      coordinates: ring,
      area: Math.round(polygonAreaM2(ring)),
      isActive: true,
      source: polygonSource,
    });
  }

  // --- NOTA TÉCNICA EXPLÍCITA ---
  let technicalNote =
    `Análise técnica v3.2: Produção estimada com Google Solar API + PVGIS/NASA. ` +
    `Eficiência do módulo: ${(moduleEff * 100).toFixed(1)}%. ` +
    `PR efetivo: ${(effectivePR * 100).toFixed(1)}%. ` +
    `Fator de transposição solar: ${transpositionFactor.toFixed(2)}. ` +
    `Perdas térmicas: ${temperatureLosses}% (T_média=${temperature}°C). ` +
    `Degradação: ${(ANNUAL_DEGRADATION * 100).toFixed(1)}%/ano. ` +
    `Valores AC (pós-inversor) priorizados. `;
  if (isBrazil)
    technicalNote += "Parâmetros otimizados para condições brasileiras. ";
  if (polygon?.source === "microsoft-footprint")
    technicalNote += "Footprint: Microsoft Building Footprints (ML). ";

  const derived = {
    avgAz,
    avgTilt,
    estimatedProductionDC,
    estimatedProductionAC,
    inverterEff: INVERTER_EFF,
    moduleEff,
    temperature,
    transpositionFactor,
    maxArrayPanelsCount: sp.maxArrayPanelsCount,
    maxArrayAreaMeters2: sp.maxArrayAreaMeters2,
    maxSunshineHoursPerYear: sp.maxSunshineHoursPerYear,
    panelCapacityWatts: sp.panelCapacityWatts,
    panelHeightMeters: sp.panelHeightMeters,
    panelWidthMeters: sp.panelWidthMeters,
    panelLifetimeYears: sp.panelLifetimeYears,
    solarPanelConfigs: sp.solarPanelConfigs,
    wholeRoofStats: sp.wholeRoofStats,
    roofSegmentStats: sp.roofSegmentStats,
  };

  return {
    address,
    coordinates: { lat, lng },
    coverage: { google: true },
    confidence: "Alta",
    usableArea,
    areaSource,
    annualIrradiation: Math.round(ghi_kwh_m2_year),
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
    transpositionFactor: Number(transpositionFactor.toFixed(3)),
    verdict: cls.verdict,
    reasons: cls.reasons,
    recommendations: cls.recommendations,
    warnings: cls.warnings,
    usageFactor: applyUF,
    footprints,
    googleSolarData: { ...solar, derived },
    technicalNote,
    // API tracking data
    apiSourcesUsed: apiTracker.sourcesUsed,
    apiResponseTimes: apiTracker.responseTimes,
    apiErrors: apiTracker.errors,
    fallbackReasons: apiTracker.fallbackReasons,
    nasaPowerData: apiTracker.nasaPowerData,
    pvgisData: apiTracker.pvgisData,
    technicianInputs: technicianInputs,
  };
}

// Function to fetch Esri World Imagery metadata
async function getEsriImageryMetadata(lat: number, lng: number) {
  console.log(`🗺️ Buscando metadados Esri para coordenadas: ${lat}, ${lng}`);
  
  try {
    const url = `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/4/query?` +
      `where=1%3D1&geometry=${lng}%2C${lat}&geometryType=esriGeometryPoint&` +
      `inSR=4326&spatialRel=esriSpatialRelIntersects&returnGeometry=false&` +
      `outFields=SRC_DATE2%2CSRC_RES%2CSRC_ACC%2CNICE_DESC%2CNICE_NAME%2CSRC_DATE&` +
      `orderByFields=SRC_DATE2%20DESC&resultRecordCount=1&f=json`;
    
    console.log(`🔗 URL da requisição Esri: ${url}`);
    
    const response = await fetchWithTimeout(url, 5000);
    
    console.log(`📡 Resposta Esri status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`📊 Dados Esri recebidos:`, JSON.stringify(data, null, 2));
      
      if (data.features && data.features.length > 0) {
        const attributes = data.features[0].attributes;
        const metadata = {
          source: "esri_world_imagery",
          captureDate: attributes.SRC_DATE2 || attributes.SRC_DATE,
          resolution: attributes.SRC_RES,
          sourceInfo: attributes.NICE_DESC || attributes.NICE_NAME,
          accuracy: attributes.SRC_ACC
        };
        
        console.log(`✅ Metadados Esri processados:`, JSON.stringify(metadata, null, 2));
        return metadata;
      } else {
        console.warn(`⚠️ Nenhum feature encontrado nos dados Esri`);
      }
    } else {
      console.error(`❌ Resposta Esri não OK: ${response.status}`);
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erro ao buscar metadados Esri:', error);
    return null;
  }
}

// Fallback robusto quando não há Google Solar disponível
async function processFallbackAnalysis({
  lat,
  lng,
  address,
  polygon,
  usableAreaOverride,
  shadingOverride,
  shadingDescription,
  averageTemperature,
  moduleType,
  systemAge,
  tiltEstimated,
  preferredSource,
  technicianInputs,

}: {
  lat: number;
  lng: number;
  address: string;
  polygon?: {
    type: "Polygon";
    coordinates: number[][][];
    source?: "user-drawn" | "microsoft-footprint" | "google-footprint";
  };
  usableAreaOverride?: number;
  shadingOverride?: number;
  shadingDescription?: string;
  averageTemperature?: number;
  moduleType?: string;
  systemAge?: number;
  tiltEstimated?: number;
  preferredSource?: "PVGIS" | "NASA";
  technicianInputs?: any;

}) {
  const isBrazil = isBrazilianCoordinate(lat, lng);

  // ÁREA
  const usageFactor = 0.8;
  let usableAreaRaw = 0;
  let areaSource: "manual" | "footprint" | "estimate" = "estimate";
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
  } else {
    usableAreaRaw = 30; // fallback absoluto
    areaSource = "estimate";
    applyUF = 1.0;
  }
  const usableArea = Math.max(0, Math.round(usableAreaRaw * applyUF));

  // SOMBRA
  let shadeIndex = 0.15;
  let shadingSource: "user_input" | "description" | "heuristic" = "heuristic";
  if (shadingOverride !== undefined) {
    shadeIndex = shadingOverride;
    shadingSource = "user_input";
  } else if (shadingDescription) {
    shadeIndex = shadingDescriptionToIndex(shadingDescription);
    shadingSource = "description";
  } else {
    shadeIndex = analyzeUrbanShading(address, lat);
    shadingSource = "heuristic";
  }
  const shadingLoss = Math.round(shadeLossFracFromIndex(shadeIndex) * 100);

  // TEMPERATURA, MÓDULO, ETC
  const temperature =
    averageTemperature ?? (isBrazil ? getBrazilianAverageTemperature(lat) : 25);
  const moduleEff = getModuleEfficiency(moduleType);
  const age = systemAge ?? 0;

  // GHI
  let ghi_kwh_m2_year = 0;
  let irradiationSource = "";

  // Initialize API tracker for fallback analysis
  const apiTracker = createApiTracker();

  // SEMPRE fazer chamadas para TODAS as APIs de fallback para ter dados completos
  console.log("Fazendo chamadas para todas as APIs de fallback (fallback analysis)...");
  
  // Fazer chamadas paralelas para ambas as APIs de fallback
  const [nasaResult, pvgisResult] = await Promise.allSettled([
    getNASAGHI(lat, lng, apiTracker).catch(() => null),
    getPVGISData(lat, lng, apiTracker).catch(() => null)
  ]);

  // Extrair dados das chamadas
  const nasa = nasaResult.status === 'fulfilled' ? nasaResult.value : null;
  const pvgis = pvgisResult.status === 'fulfilled' ? pvgisResult.value : null;

  // Log dos resultados das APIs
  console.log("NASA POWER result (fallback analysis):", nasa ? "SUCCESS" : "FAILED");
  console.log("PVGIS result (fallback analysis):", pvgis ? "SUCCESS" : "FAILED");

  // Agora escolher qual usar baseado na preferência
  if (preferredSource === "NASA") {
    if (nasa?.ghi_kwh_m2_year) {
      ghi_kwh_m2_year = nasa.ghi_kwh_m2_year;
      irradiationSource = "NASA POWER (GHI) - Fonte Preferida";
    } else if (pvgis?.outputs?.totals?.fixed?.["H(i)_y"]) {
      ghi_kwh_m2_year = pvgis.outputs.totals.fixed["H(i)_y"];
      irradiationSource = "PVGIS (fallback from NASA preferred)";
      apiTracker.fallbackReasons.push('NASA POWER preferred but failed, using PVGIS');
    } else {
      ghi_kwh_m2_year = isBrazil ? getBrazilianTypicalGHI(lat) : 1800;
      irradiationSource = "Valores típicos (fallback from NASA preferred)";
      apiTracker.fallbackReasons.push('NASA POWER preferred but both APIs failed, using regional defaults');
    }
  } else if (preferredSource === "PVGIS") {
    if (pvgis?.outputs?.totals?.fixed?.["H(i)_y"]) {
      ghi_kwh_m2_year = pvgis.outputs.totals.fixed["H(i)_y"];
      irradiationSource = "PVGIS - Fonte Preferida";
    } else if (nasa?.ghi_kwh_m2_year) {
      ghi_kwh_m2_year = nasa.ghi_kwh_m2_year;
      irradiationSource = "NASA POWER (fallback from PVGIS preferred)";
      apiTracker.fallbackReasons.push('PVGIS preferred but failed, using NASA POWER');
    } else {
      ghi_kwh_m2_year = isBrazil ? getBrazilianTypicalGHI(lat) : 1800;
      irradiationSource = "Valores típicos (fallback from PVGIS preferred)";
      apiTracker.fallbackReasons.push('PVGIS preferred but both APIs failed, using regional defaults');
    }
  } else {
    // Default cascade: NASA -> PVGIS -> Regional defaults
    if (nasa?.ghi_kwh_m2_year) {
      ghi_kwh_m2_year = nasa.ghi_kwh_m2_year;
      irradiationSource = "NASA POWER (GHI)";
    } else if (pvgis?.outputs?.totals?.fixed?.["H(i)_y"]) {
      ghi_kwh_m2_year = pvgis.outputs.totals.fixed["H(i)_y"];
      irradiationSource = "PVGIS (fallback from NASA)";
      apiTracker.fallbackReasons.push('NASA POWER failed, using PVGIS');
    } else if (isBrazil) {
      ghi_kwh_m2_year = getBrazilianTypicalGHI(lat);
      irradiationSource = "Valores típicos brasileiros";
      apiTracker.fallbackReasons.push('All external APIs failed, using Brazilian regional defaults');
    } else {
      ghi_kwh_m2_year = 1800;
      irradiationSource = "Heurística conservadora";
      apiTracker.fallbackReasons.push('All external APIs failed, using conservative defaults');
    }
  }

  // ORIENTAÇÃO/INCLINAÇÃO
  const avgAz = 0;
  const avgTilt = tiltEstimated ?? 15;

  // PERFORMANCE RATIO
  const effectivePR = isBrazil
    ? getBrazilianPR(lat, lng, temperature)
    : DEFAULT_PR;

  // PRODUÇÃO
  const result = estimateByGHI({
    ghi_kwh_m2_year,
    usable_area_m2: usableArea,
    module_eff: moduleEff,
    pr: effectivePR,
    shade_index: shadeIndex,
    tilt_deg: avgTilt,
    azimuth_deg: avgAz,
    lat,
    temperature,
    system_age: age,
  });

  const estimatedProduction = Math.round(result.value);
  const transpositionFactor = result.transpositionFactor;
  const estimatedProductionAC = estimatedProduction;
  const estimatedProductionDC = Math.round(
    estimatedProductionAC / INVERTER_EFF
  );
  const estimatedProductionYear1 = estimatedProductionAC;
  const estimatedProductionYear25 = Math.floor(
    estimatedProductionAC * Math.pow(1 - ANNUAL_DEGRADATION, 25)
  );

  const temperatureLosses = Math.round(
    (temperature - STC_TEMP) * Math.abs(TEMP_COEFFICIENT) * 100
  );

  const cls = classifyVerdict({
    usable_area_m2: usableArea,
    shade_index: shadeIndex,
    azimuth_deg: avgAz,
    tilt_deg: avgTilt,
    is_brazil: isBrazil,
  });

  const footprints = [];
  if (polygon?.coordinates?.length) {
    const ring = polygon.coordinates[0] as [number, number][];
    const polygonSource = polygon.source || "user-drawn";
    footprints.push({
      id:
        polygonSource === "microsoft-footprint"
          ? "microsoft-footprint-polygon"
          : "user-drawn-polygon",
      coordinates: ring,
      area: Math.round(polygonAreaM2(ring)),
      isActive: true,
      source: polygonSource,
    });
  }

  let technicalNote =
    `Análise fallback v3.2: Produção estimada sem Google Solar API. ` +
    `Eficiência do módulo: ${(moduleEff * 100).toFixed(1)}%. ` +
    `PR efetivo: ${(effectivePR * 100).toFixed(1)}%. ` +
    `Fator de transposição solar: ${transpositionFactor.toFixed(2)}. ` +
    `Perdas térmicas: ${temperatureLosses}% (T_média=${temperature}°C). ` +
    `Degradação: ${(ANNUAL_DEGRADATION * 100).toFixed(1)}%/ano. ` +
    `Valores AC (pós-inversor) priorizados. `;
  if (isBrazil)
    technicalNote += "Parâmetros otimizados para condições brasileiras. ";
  if (polygon?.source === "microsoft-footprint")
    technicalNote += "Footprint: Microsoft Building Footprints (ML). ";

  return {
    address,
    coordinates: { lat, lng },
    coverage: { google: false, fallback: irradiationSource },
    confidence: "Média",
    usableArea,
    areaSource,
    usageFactor: applyUF,
    annualIrradiation: Math.round(ghi_kwh_m2_year),
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
    transpositionFactor: Number(transpositionFactor.toFixed(3)),
    verdict: cls.verdict,
    reasons: cls.reasons,
    recommendations: cls.recommendations,
    warnings: cls.warnings,
    footprints,
    technicalNote,
    // API tracking data
    apiSourcesUsed: apiTracker.sourcesUsed,
    apiResponseTimes: apiTracker.responseTimes,
    apiErrors: apiTracker.errors,
    fallbackReasons: apiTracker.fallbackReasons,
    nasaPowerData: apiTracker.nasaPowerData,
    pvgisData: apiTracker.pvgisData,
    technicianInputs: technicianInputs
  };
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

/* ========= HANDLER PRINCIPAL ========= */
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
    // Parse body
    const json = await req.json();
    const input = AnalyzeRequestSchema.parse(json);

    const { lat, lng, address } = input;
    const isBrazil = isBrazilianCoordinate(lat, lng);
    console.log(
      `Análise solar: lat=${lat}, lng=${lng}, address="${address}", Brasil=${isBrazil}`
    );

    if (isBrazil && !input.shadingOverride && !input.shadingDescription) {
      console.log(
        "⚠️ Análise brasileira sem dados de sombreamento - usando heurística"
      );
    }

    let analysis;
    const apiTracker = createApiTracker();
    const google = await getGoogleSolarData(lat, lng, apiTracker).catch(() => null);

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
        input.tiltEstimated,
        input.preferredSource,
        input.technicianInputs
      );
    } else {
      // Fallback: sempre retorna com annualIrradiation (número) padronizado!
      console.log(
        "Usando fallback PVGIS/NASA (quando Google não retorna dados)"
      );
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
        tiltEstimated: input.tiltEstimated,
        preferredSource: input.preferredSource,
        technicianInputs: input.technicianInputs,

      });
      // Garante o campo annualIrradiation no output
      if (analysis) {
        analysis.annualIrradiation = Number(analysis.annualIrradiation ?? 0);
      }
    }

    // Os metadados da imagem do mapa (Esri) são agora buscados e salvos pelo frontend
    // no componente ImageryInfoCard quando o usuário visualiza os resultados

    const response = {
      success: true,
      data: analysis,
      metadata: {
        version: "3.2",
        timestamp: new Date().toISOString(),
        location: isBrazil ? "Brazil" : "International",
        dataSource: analysis.coverage.google
          ? "Google Solar API"
          : "PVGIS/NASA",
      },
    };

    // Debug log before returning
    console.log('Final response - apiResponseTimes:', response.data?.apiResponseTimes);
    console.log('Final response - apiResponseTimes type check:', typeof response.data?.apiResponseTimes);
    if (response.data?.apiResponseTimes) {
      console.log('Final response - apiResponseTimes entries:', Object.entries(response.data.apiResponseTimes));
    }

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
