// Client-side solar calculations for dynamic recalculation
// Based on the same constants and formulas as the shared functions

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
  north: 27, // Norte
  northeast: 26, // Nordeste  
  southeast: 23, // Sudeste
  south: 20, // Sul
  centerwest: 25, // Centro-Oeste
} as const;

export interface TechnicianInputs {
  panel_count?: number | null;
  energy_cost_per_kwh?: number | null;
  solar_incentives?: number | null;
  installation_cost_per_watt?: number | null;
  panel_capacity_watts?: number | null;
  show_advanced_settings?: boolean;
  additional_details?: string | null;
  system_lifetime_years?: number | null;
  dc_to_ac_conversion?: number | null;
  annual_degradation_rate?: number | null;
  annual_energy_cost_increase?: number | null;
  discount_rate?: number | null;
}

export interface SolarCalculationParams {
  ghi_kwh_m2_year: number;
  usable_area_m2: number;
  shade_factor: number; // 0-1, where 1 = no shade, 0 = full shade
  temperature_celsius?: number;
  latitude?: number;
  technicianInputs?: TechnicianInputs;
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
  // Financial calculations
  financial_data?: {
    total_system_cost: number;
    net_system_cost: number;
    total_system_watts: number;
    annual_savings: number;
    simple_payback_years: number;
    npv: number;
    roi: number;
    total_lifetime_savings: number;
    incentives_applied: number;
  };
}

export function getBrazilRegionalTemp(latitude: number): number {
  const lat = Math.abs(latitude);
  
  // Rough regional mapping by latitude
  if (lat <= 5) return BRAZIL_REGIONAL_TEMPS.north; // Norte
  if (lat <= 15) return BRAZIL_REGIONAL_TEMPS.northeast; // Nordeste
  if (lat <= 25) return BRAZIL_REGIONAL_TEMPS.southeast; // Sudeste/Centro-Oeste
  return BRAZIL_REGIONAL_TEMPS.south; // Sul
}

export function calculateTransposition(
  latitude: number,
  tilt: number,
  azimuth: number = 0
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

export function calculateTemperatureLosses(
  ambient_temp: number,
  stc_temp: number = SOLAR_CONSTANTS.STC_TEMP,
  temp_coefficient: number = SOLAR_CONSTANTS.TEMP_COEFFICIENT
): number {
  const temp_diff = ambient_temp - stc_temp;
  return Math.max(-50, Math.min(0, temp_diff * Math.abs(temp_coefficient) * 100));
}

export function calculateDegradation(
  age_years: number = 0,
  annual_degradation: number = SOLAR_CONSTANTS.ANNUAL_DEGRADATION
): number {
  return Math.pow(1 - annual_degradation, age_years);
}

export function calculateSolarProduction(params: SolarCalculationParams): SolarCalculationResult {
  const {
    ghi_kwh_m2_year,
    usable_area_m2,
    shade_factor,
    temperature_celsius,
    latitude = -15,
    technicianInputs
  } = params;

  // Use technician inputs if available
  const temperature = temperature_celsius || getBrazilRegionalTemp(latitude);
  const tilt = Math.abs(latitude); // Default tilt = latitude
  const module_efficiency = SOLAR_CONSTANTS.MODULE_EFF;
  const pr_base = SOLAR_CONSTANTS.DEFAULT_PR;
  
  // Calculate transposition factor
  const transposition_factor = calculateTransposition(latitude, tilt);
  
  // Calculate temperature losses
  const temp_losses_percent = calculateTemperatureLosses(temperature);
  const temp_factor = 1 + (temp_losses_percent / 100);
  
  // Calculate degradation
  const degradation_factor = calculateDegradation(0); // Assume new system
  
  // Calculate effective Performance Ratio
  const effective_pr = pr_base * temp_factor * degradation_factor;
  
  // Calculate final module efficiency
  let final_efficiency = module_efficiency;
  
  // Adjust efficiency based on technician inputs
  if (technicianInputs?.panel_capacity_watts && technicianInputs?.panel_count) {
    const totalPowerKw = (technicianInputs.panel_capacity_watts * technicianInputs.panel_count) / 1000;
    const areaBasedPowerKw = usable_area_m2 * module_efficiency * 1; // 1 kW/m² STC
    // Adjust efficiency based on actual vs theoretical power
    const efficiencyAdjustment = Math.min(totalPowerKw / Math.max(areaBasedPowerKw, 0.1), 1.5);
    final_efficiency = module_efficiency * efficiencyAdjustment;
  }
  
  // Calculate DC production
  const annual_production_dc = 
    ghi_kwh_m2_year * 
    usable_area_m2 * 
    final_efficiency * 
    effective_pr * 
    transposition_factor * 
    shade_factor;
  
  // Calculate AC production (after inverter losses)
  const inverter_eff = technicianInputs?.dc_to_ac_conversion || SOLAR_CONSTANTS.INVERTER_EFF;
  const annual_production_ac = annual_production_dc * inverter_eff;
  
  // Calculate financial data if technician inputs are provided
  let financial_data;
  if (technicianInputs?.energy_cost_per_kwh && 
      technicianInputs?.panel_capacity_watts && 
      technicianInputs?.panel_count && 
      technicianInputs?.installation_cost_per_watt) {
    
    financial_data = calculateFinancials({
      annualProductionKwh: annual_production_ac,
      energyCostPerKwh: technicianInputs.energy_cost_per_kwh,
      installationCostPerWatt: technicianInputs.installation_cost_per_watt,
      solarIncentives: technicianInputs.solar_incentives,
      panelCapacityWatts: technicianInputs.panel_capacity_watts,
      panelCount: technicianInputs.panel_count,
      systemLifetimeYears: technicianInputs.system_lifetime_years || 25,
      annualEnergyCostIncrease: technicianInputs.annual_energy_cost_increase || 5.0,
      discountRate: technicianInputs.discount_rate || 6.0,
    });
  }
  
  return {
    annual_production_kwh: Math.round(annual_production_ac),
    annual_production_dc: Math.round(annual_production_dc),
    annual_production_ac: Math.round(annual_production_ac),
    transposition_factor: Number(transposition_factor.toFixed(3)),
    temperature_losses_percent: Number(temp_losses_percent.toFixed(1)),
    degradation_factor: Number(degradation_factor.toFixed(3)),
    effective_pr: Number(effective_pr.toFixed(3)),
    final_efficiency: Number(final_efficiency.toFixed(3)),
    financial_data
  };
}

function calculateFinancials(params: {
  annualProductionKwh: number;
  energyCostPerKwh: number;
  installationCostPerWatt: number;
  solarIncentives?: number | null;
  panelCapacityWatts: number;
  panelCount: number;
  systemLifetimeYears: number;
  annualEnergyCostIncrease: number;
  discountRate: number;
}) {
  const {
    annualProductionKwh,
    energyCostPerKwh,
    installationCostPerWatt,
    solarIncentives,
    panelCapacityWatts,
    panelCount,
    systemLifetimeYears,
    annualEnergyCostIncrease,
    discountRate,
  } = params;

  const totalSystemWatts = panelCapacityWatts * panelCount;
  const totalSystemCost = totalSystemWatts * installationCostPerWatt;
  
  // Apply incentives
  const incentiveMultiplier = solarIncentives ? (1 - solarIncentives / 100) : 1;
  const netSystemCost = totalSystemCost * incentiveMultiplier;

  // Calculate annual savings
  const annualSavings = annualProductionKwh * energyCostPerKwh;

  // Simple payback
  const simplePaybackYears = netSystemCost / annualSavings;

  // Net Present Value (NPV)
  let npv = -netSystemCost; // Initial investment (negative)
  const discountRateDecimal = discountRate / 100;
  const energyIncreaseDecimal = annualEnergyCostIncrease / 100;

  for (let year = 1; year <= systemLifetimeYears; year++) {
    const yearlyEnergyCost = energyCostPerKwh * Math.pow(1 + energyIncreaseDecimal, year - 1);
    const yearlySavings = annualProductionKwh * yearlyEnergyCost;
    const presentValue = yearlySavings / Math.pow(1 + discountRateDecimal, year);
    npv += presentValue;
  }

  // Total lifetime savings
  const totalLifetimeSavings = annualSavings * systemLifetimeYears * 
    ((1 + energyIncreaseDecimal) ** systemLifetimeYears - 1) / energyIncreaseDecimal;
  
  const roi = ((totalLifetimeSavings - netSystemCost) / netSystemCost) * 100;

  return {
    total_system_cost: Math.round(totalSystemCost),
    net_system_cost: Math.round(netSystemCost),
    total_system_watts: totalSystemWatts,
    annual_savings: Math.round(annualSavings),
    simple_payback_years: Math.round(simplePaybackYears * 100) / 100,
    npv: Math.round(npv),
    roi: Math.round(roi * 100) / 100,
    total_lifetime_savings: Math.round(totalLifetimeSavings),
    incentives_applied: solarIncentives || 0,
  };
}

// Verdict classification
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
  recommendations?: string[];
  warnings?: string[];
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