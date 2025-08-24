// Shared solar calculation functions
// Moved from analyze function to be reusable

export const SOLAR_CONSTANTS = {
  STC_IRRADIANCE: 1000, // W/m² Standard Test Conditions
  STC_TEMP: 25, // °C Standard Test Conditions
  TEMP_COEFFICIENT: -0.0045, // Temperature coefficient for c-Si panels (%/°C)
  INVERTER_EFF: 0.96, // Default inverter efficiency
  ANNUAL_DEGRADATION: 0.006, // Default annual degradation (0.6%)
  DEFAULT_PR: 0.82, // Default Performance Ratio for Brazil (NBR 16274)
  MODULE_EFF: 0.215, // Default module efficiency (21.5%)
} as const;

// Regional temperature adjustments for Brazil
export const BRAZIL_REGIONAL_TEMPS = {
  // Average temperatures by region for thermal losses calculation
  north: 27, // Norte
  northeast: 26, // Nordeste  
  southeast: 23, // Sudeste
  south: 20, // Sul
  centerwest: 25, // Centro-Oeste
} as const;

// Shading heuristics by address type
export const SHADING_HEURISTICS = {
  sem_sombra: 0.02,
  sombra_minima: 0.08,
  sombra_parcial: 0.18,
  sombra_moderada: 0.28,
  sombra_severa: 0.45,
} as const;

export interface SolarCalculationParams {
  ghi_kwh_m2_year: number;
  usable_area_m2: number;
  shade_factor: number; // 0-1, where 1 = no shade, 0 = full shade
  temperature_celsius?: number;
  tilt_deg?: number;
  azimuth_deg?: number;
  latitude?: number;
  module_efficiency?: number;
  pr_base?: number;
  system_age_years?: number;
  annual_degradation_rate?: number;
}

export interface SolarCalculationResult {
  annual_production_kwh: number;
  annual_production_dc: number;
  annual_production_ac: number;
  transposition_factor: number;
  temperature_losses_percent: number;
  degradation_factor: number;
  effective_pr: number;
  final_efficiency: number;
}

/**
 * Calculate solar transposition factor (Liu & Jordan method)
 */
export function calculateTransposition(
  latitude: number,
  tilt: number,
  azimuth: number
): number {
  const lat_rad = (Math.abs(latitude) * Math.PI) / 180;
  const tilt_rad = (tilt * Math.PI) / 180;
  const azimuth_rad = (azimuth * Math.PI) / 180;

  // Simplified Liu & Jordan model for Brazil (Southern Hemisphere)
  const base_factor = Math.cos(lat_rad - tilt_rad);
  const azimuth_factor = 1 - Math.abs(Math.sin(azimuth_rad)) * 0.1;
  
  // Clamp to reasonable values
  return Math.max(0.5, Math.min(1.2, base_factor * azimuth_factor));
}

/**
 * Calculate temperature losses based on ambient temperature
 */
export function calculateTemperatureLosses(
  ambient_temp: number,
  stc_temp: number = SOLAR_CONSTANTS.STC_TEMP,
  temp_coefficient: number = SOLAR_CONSTANTS.TEMP_COEFFICIENT
): number {
  const temp_diff = ambient_temp - stc_temp;
  return Math.max(-50, Math.min(0, temp_diff * Math.abs(temp_coefficient) * 100));
}

/**
 * Calculate degradation factor based on system age
 */
export function calculateDegradation(
  age_years: number,
  annual_degradation: number = SOLAR_CONSTANTS.ANNUAL_DEGRADATION
): number {
  return Math.pow(1 - annual_degradation, age_years);
}

/**
 * Get regional temperature estimate for Brazil based on latitude
 */
export function getBrazilRegionalTemp(latitude: number): number {
  const lat = Math.abs(latitude);
  
  // Rough regional mapping by latitude
  if (lat <= 5) return BRAZIL_REGIONAL_TEMPS.north; // Norte
  if (lat <= 15) return BRAZIL_REGIONAL_TEMPS.northeast; // Nordeste
  if (lat <= 25) return BRAZIL_REGIONAL_TEMPS.southeast; // Sudeste/Centro-Oeste
  return BRAZIL_REGIONAL_TEMPS.south; // Sul
}

/**
 * Estimate shading based on address heuristics
 */
export function estimateShading(address: string): {
  shading_factor: number;
  shading_source: string;
  confidence: string;
} {
  const addr_lower = address.toLowerCase();
  
  // Urban indicators (higher shading)
  if (addr_lower.includes('centro') || addr_lower.includes('downtown')) {
    return {
      shading_factor: SHADING_HEURISTICS.sombra_moderada,
      shading_source: 'heuristic',
      confidence: 'Baixa'
    };
  }
  
  // Dense urban areas
  if (addr_lower.includes('vila') || addr_lower.includes('conjunto')) {
    return {
      shading_factor: SHADING_HEURISTICS.sombra_parcial,
      shading_source: 'heuristic', 
      confidence: 'Baixa'
    };
  }
  
  // Residential areas (medium shading)
  if (addr_lower.includes('residencial') || addr_lower.includes('jardim')) {
    return {
      shading_factor: SHADING_HEURISTICS.sombra_minima,
      shading_source: 'heuristic',
      confidence: 'Média'
    };
  }
  
  // Default moderate shading
  return {
    shading_factor: SHADING_HEURISTICS.sombra_parcial,
    shading_source: 'heuristic',
    confidence: 'Baixa'
  };
}

/**
 * Main solar production calculation function
 */
export function calculateSolarProduction(params: SolarCalculationParams): SolarCalculationResult {
  const {
    ghi_kwh_m2_year,
    usable_area_m2,
    shade_factor,
    temperature_celsius = getBrazilRegionalTemp(params.latitude || -15),
    tilt_deg = Math.abs(params.latitude || 15), // Default tilt = latitude
    azimuth_deg = 0, // Default North orientation for Brazil
    latitude = -15,
    module_efficiency = SOLAR_CONSTANTS.MODULE_EFF,
    pr_base = SOLAR_CONSTANTS.DEFAULT_PR,
    system_age_years = 0,
    annual_degradation_rate = SOLAR_CONSTANTS.ANNUAL_DEGRADATION
  } = params;

  // Calculate transposition factor
  const transposition_factor = calculateTransposition(latitude, tilt_deg, azimuth_deg);
  
  // Calculate temperature losses
  const temp_losses_percent = calculateTemperatureLosses(temperature_celsius);
  const temp_factor = 1 + (temp_losses_percent / 100);
  
  // Calculate degradation
  const degradation_factor = calculateDegradation(system_age_years, annual_degradation_rate);
  
  // Calculate effective Performance Ratio
  const effective_pr = pr_base * temp_factor * degradation_factor;
  
  // Calculate final module efficiency
  const final_efficiency = module_efficiency;
  
  // Calculate DC production
  const annual_production_dc = 
    ghi_kwh_m2_year * 
    usable_area_m2 * 
    final_efficiency * 
    effective_pr * 
    transposition_factor * 
    shade_factor;
  
  // Calculate AC production (after inverter losses)
  const annual_production_ac = annual_production_dc * SOLAR_CONSTANTS.INVERTER_EFF;
  
  return {
    annual_production_kwh: Math.round(annual_production_ac),
    annual_production_dc: Math.round(annual_production_dc),
    annual_production_ac: Math.round(annual_production_ac),
    transposition_factor: Number(transposition_factor.toFixed(3)),
    temperature_losses_percent: Number(temp_losses_percent.toFixed(1)),
    degradation_factor: Number(degradation_factor.toFixed(3)),
    effective_pr: Number(effective_pr.toFixed(3)),
    final_efficiency: Number(final_efficiency.toFixed(3))
  };
}

/**
 * Calculate polygon area from coordinates
 */
export function calculatePolygonArea(coordinates: number[][][]): number {
  if (!coordinates || coordinates.length === 0) return 0;
  
  const ring = coordinates[0];
  if (!ring || ring.length < 3) return 0;
  
  // Shoelace formula for polygon area
  let area = 0;
  const n = ring.length;
  
  for (let i = 0; i < n - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    area += (x1 * y2) - (x2 * y1);
  }
  
  area = Math.abs(area) / 2;
  
  // Convert from degrees² to m² (rough approximation)
  const lat_factor = Math.cos((coordinates[0][0][1] * Math.PI) / 180);
  const meters_per_degree_lat = 111320;
  const meters_per_degree_lng = meters_per_degree_lat * lat_factor;
  
  return area * meters_per_degree_lat * meters_per_degree_lng;
}

/**
 * Classify verdict based on analysis results
 */
export function classifyVerdict(params: {
  usable_area_m2: number;
  shade_index: number;
  azimuth_deg?: number | null;
  tilt_deg?: number | null;
  is_brazil?: boolean;
  lat?: number;
}): {
  verdict: 'Apto' | 'Parcial' | 'Não apto';
  reasons: string[];
  recommendations: string[];
  warnings: string[];
} {
  const reasons: string[] = [];
  const recommendations: string[] = [];
  const warnings: string[] = [];
  const area = params.usable_area_m2;
  const shade = Math.max(0, Math.min(1, params.shade_index));
  const az = params.azimuth_deg ?? 0;
  const tilt = params.tilt_deg ?? 15;
  const isBrazil = params.is_brazil ?? false;
  const lat = params.lat ?? (isBrazil ? -15 : 40);
  
  // Orientation deviation from ideal (North for Brazil)
  const azDev = isBrazil
    ? Math.min(Math.abs(az), Math.abs(az - 360))
    : Math.min(Math.abs(az - 180), Math.abs(az + 180));
  
  // Tilt analysis based on latitude
  const optimalTilt = Math.abs(lat);
  const tiltDeviation = Math.abs(tilt - optimalTilt);
  const maxAcceptableTilt = Math.min(45, Math.abs(lat) + 20);
  const tiltExcellent = tilt >= 5 && tiltDeviation <= 10;
  const tiltAcceptable = tilt >= 5 && tilt <= maxAcceptableTilt && tiltDeviation <= 20;
  
  // Shading analysis with modern technologies
  const shadeExcellent = shade < 0.15;
  const shadeGood = shade < 0.30;
  const shadeAcceptable = shade < 0.45;
  
  // Area analysis for modern 550W+ panels
  const areaExcellent = area >= 20;
  const areaGood = area >= 15;
  const areaAcceptable = area >= 12;
  const areaMinimum = area >= 8;
  
  // Orientation analysis
  const orientationExcellent = azDev <= 20;
  const orientationGood = azDev <= 45;
  const orientationAcceptable = azDev <= 90;
  const orientationPoor = azDev > 135;

  // Classification logic
  if ((areaGood || areaAcceptable) && shadeGood && orientationGood && tiltAcceptable && !orientationPoor) {
    reasons.push(`Área ${areaExcellent ? 'excelente' : 'adequada'} para instalação (${area.toFixed(1)}m²)`);
    
    if (shadeExcellent) {
      reasons.push("Excelentes condições de sombreamento");
    } else {
      reasons.push("Boas condições de sombreamento");
    }
    
    if (orientationExcellent) {
      reasons.push(`Orientação ideal (${az.toFixed(0)}° do Norte)`);
    } else {
      reasons.push(`Boa orientação solar (${az.toFixed(0)}°)`);
    }
    
    if (tiltExcellent) {
      reasons.push(`Inclinação próxima ao ideal (${tilt.toFixed(0)}° vs ${optimalTilt.toFixed(0)}° ótimo)`);
    } else {
      reasons.push(`Inclinação aceitável (${tilt.toFixed(0)}°)`);
    }

    recommendations.push("Sistema com excelente potencial de geração");
    
    if (area >= 25) {
      recommendations.push("Considerar sistema de 5-8kWp para máximo aproveitamento");
    } else if (area >= 20) {
      recommendations.push("Sistema de 4-6kWp adequado para este telhado");
    } else if (area >= 15) {
      recommendations.push("Sistema de 3-4kWp recomendado (padrão residencial)");
    } else if (area >= 12) {
      recommendations.push("Sistema compacto de 2-3kWp viável");
    }
    
    if (!tiltExcellent) {
      recommendations.push(`Para máxima eficiência, ajustar inclinação para ${optimalTilt.toFixed(0)}°`);
    }
    
    return { verdict: "Apto", reasons, recommendations, warnings };
  }
  
  // Partial classification
  if (areaMinimum && shadeAcceptable && orientationAcceptable && !orientationPoor) {
    if (areaMinimum && !areaAcceptable) {
      reasons.push(`Área no limite mínimo viável (${area.toFixed(1)}m² - mín. 8m²)`);
      recommendations.push("Sistema compacto de 1,5-2kWp recomendado");
      recommendations.push("Utilizar módulos de alta eficiência (550W+) para maximizar geração");
    } else if (areaAcceptable && !areaGood) {
      reasons.push(`Área adequada para sistema médio (${area.toFixed(1)}m²)`);
      recommendations.push("Sistema de 2-3kWp adequado para este telhado");
    }
    
    if (!shadeGood && shadeAcceptable) {
      const lossPercent = (shade * 100).toFixed(0);
      reasons.push(`Sombreamento moderado presente (${lossPercent}% de perdas)`);
      
      if (shade <= 0.35) {
        recommendations.push("Considerar otimizadores de potência para compensar sombreamento");
      } else {
        recommendations.push("Microinversores recomendados para sombreamento alto");
        recommendations.push("Análise detalhada de sombreamento necessária");
      }
      
      if (shade > 0.40) {
        warnings.push("Sombreamento alto - viabilidade depende de tecnologias modernas");
      } else if (shade > 0.35) {
        warnings.push("Considerar remoção de obstáculos se economicamente viável");
      }
    }
    
    return { verdict: "Parcial", reasons, recommendations, warnings };
  }
  
  // Not suitable classification
  if (!areaMinimum) {
    reasons.push(`Área insuficiente para instalação viável (${area.toFixed(1)}m²)`);
    warnings.push("Mínimo recomendado: 8m² para sistema básico de 1,5kWp");
  }
  
  if (!shadeAcceptable) {
    const lossPercent = (shade * 100).toFixed(0);
    reasons.push(`Sombreamento excessivo detectado (${lossPercent}% de perdas)`);
    warnings.push("Perdas por sombreamento inviabilizam economicamente o sistema");
  }
  
  if (orientationPoor) {
    const direction = isBrazil ? "Sul" : "Norte";
    reasons.push(`Orientação desfavorável - face voltada para ${direction}`);
    warnings.push("Perdas direcionais superiores a 30% tornam instalação inviável");
  }
  
  return {
    verdict: "Não apto",
    reasons: reasons.length ? reasons : ["Condições desfavoráveis para instalação"],
    recommendations: ["Buscar localização alternativa para instalação"],
    warnings
  };
}