export interface Coverage {
  google: boolean;
  dataQuality: "measured" | "estimated" | "calculated";
}

export interface Footprint {
  area: number;
  isActive: boolean;
  source?: string;
}

export interface AnalysisVersion {
  date: string;
  confidence: string;
  usableArea: number;
  annualGHI: number;
  shadingIndex?: number;
  shadingLoss?: number;
  estimatedProduction: number;
  estimatedProductionAC?: number;
  estimatedProductionDC?: number;
  estimatedProductionYear1?: number;
  estimatedProductionYear25?: number;
  temperatureLosses?: number;
  degradationFactor?: number;
  effectivePR?: number;
  verdict: "Apto" | "Parcial" | "Não apto";
  irradiationSource?: string;
  areaSource?: string;
  usageFactor?: number;
  shadingSource?: string;
  temperature?: number;
  moduleEff?: number;
}

export interface DetailedAnalysis {
  coordinates: [number, number];
  coverage: Coverage;
  footprints?: Footprint[];
  currentVersion: AnalysisVersion;
  recommendations?: string[];
  warnings?: string[];
  reasons: string[];
  technicalNote?: string;
  googleSolarData?: any;
  technicianInputs?: {
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
  };
}
