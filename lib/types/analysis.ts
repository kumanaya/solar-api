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
}
