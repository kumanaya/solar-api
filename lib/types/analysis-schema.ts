import { z } from "zod";

// Enums
export const ConfidenceLevelEnum = z.enum(["Alta", "Média", "Baixa"]);
export const VerdictEnum = z.enum(["Apto", "Parcial", "Não apto"]);
export const AreaSourceEnum = z.enum(["google", "footprint", "manual", "estimate", "polygon"]);
export const FootprintSourceEnum = z.enum(["user-drawn", "microsoft-footprint", "google-footprint"]);
export const ShadingSourceEnum = z.enum(["google_measured", "user_input", "description", "heuristic"]);

// Sub-schemas
export const CoordinatesSchema = z.union([
  z.tuple([z.number(), z.number()]),
  z.object({
    lat: z.number(),
    lng: z.number()
  })
]);

export const CoverageSchema = z.object({
  google: z.boolean(),
  fallback: z.string().optional(),
  dataQuality: z.enum(["measured", "calculated", "estimated"]).optional()
});

export const FootprintSchema = z.object({
  id: z.string(),
  coordinates: z.array(z.tuple([z.number(), z.number()])),
  area: z.number(),
  isActive: z.boolean(),
  source: FootprintSourceEnum.optional()
});

// Main Analysis Schema
export const AnalysisSchema = z.object({
  // Base data
  id: z.string().optional(),
  address: z.string(),
  coordinates: CoordinatesSchema,
  
  // Coverage and confidence
  coverage: CoverageSchema,
  confidence: ConfidenceLevelEnum,
  
  // Area information
  usableArea: z.number(),
  areaSource: AreaSourceEnum,
  usageFactor: z.number(),
  
  // Solar radiation data
  annualIrradiation: z.number(),
  annualGHI: z.number(),
  irradiationSource: z.string(),
  
  // Shading information
  shadingIndex: z.number(),
  shadingLoss: z.number(),
  shadingSource: ShadingSourceEnum.optional(),
  
  // Production estimates
  estimatedProduction: z.number(),
  estimatedProductionAC: z.number().optional(),
  estimatedProductionDC: z.number().optional(),
  estimatedProductionYear1: z.number().optional(),
  estimatedProductionYear25: z.number().optional(),
  
  // Technical details
  temperatureLosses: z.number().optional(),
  degradationFactor: z.number().optional(),
  effectivePR: z.number().optional(),
  
  // Analysis results
  verdict: VerdictEnum,
  reasons: z.array(z.string()),
  recommendations: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  
  // Footprints and technical data
  footprints: z.array(FootprintSchema),
  googleSolarData: z.any().optional(),
  technicalNote: z.string().optional(),
  
  // Technician inputs
  technicianInputs: z.object({
    panel_count: z.number().nullable().optional(),
    energy_cost_per_kwh: z.number().nullable().optional(),
    solar_incentives: z.number().nullable().optional(),
    installation_cost_per_watt: z.number().nullable().optional(),
    panel_capacity_watts: z.number().nullable().optional(),
    show_advanced_settings: z.boolean().optional(),
    additional_details: z.string().nullable().optional(),
    // New advanced fields
    system_lifetime_years: z.number().nullable().optional(),
    dc_to_ac_conversion: z.number().nullable().optional(),
    annual_degradation_rate: z.number().nullable().optional(),
    annual_energy_cost_increase: z.number().nullable().optional(),
    discount_rate: z.number().nullable().optional()
  }).optional(),
  
  // Financial analysis results from dynamic calculations
  financialData: z.object({
    system_power_kw: z.number(),
    installation_cost_gross: z.number(),
    installation_cost_net: z.number(),
    annual_savings_year_1: z.number(),
    simple_payback_years: z.number(),
    total_lifetime_savings: z.number(),
    net_present_value: z.number(),
    roi_percentage: z.number(),
  }).optional(),
  
  // Metadata
  createdAt: z.string().optional(),
  
  // New API tracking fields
  apiSourcesUsed: z.array(z.string()).optional(),
  apiResponseTimes: z.record(z.string(), z.number()).optional(),
  apiErrors: z.record(z.string(), z.string()).optional(),
  fallbackReasons: z.array(z.string()).optional(),
  nasaPowerData: z.any().optional(),
  pvgisData: z.any().optional(),

  // Imagery metadata fields
  imageryMetadata: z.object({
    source: z.enum(["google_solar", "esri_world_imagery"]).optional(),
    imageryDate: z.object({
      year: z.number(),
      month: z.number(),
      day: z.number()
    }).optional(),
    imageryProcessedDate: z.object({
      year: z.number(),
      month: z.number(),
      day: z.number()
    }).optional(),
    imageryQuality: z.string().optional(),
    // Esri specific fields
    resolution: z.string().optional(),
    accuracy: z.string().optional(),
    sourceInfo: z.string().optional()
  }).optional()
});

// Types
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelEnum>;
export type Verdict = z.infer<typeof VerdictEnum>;
export type AreaSource = z.infer<typeof AreaSourceEnum>;
export type FootprintSource = z.infer<typeof FootprintSourceEnum>;
export type ShadingSource = z.infer<typeof ShadingSourceEnum>;
export type Coordinates = z.infer<typeof CoordinatesSchema>;
export type Coverage = z.infer<typeof CoverageSchema>;
export type Footprint = z.infer<typeof FootprintSchema>;
export type Analysis = z.infer<typeof AnalysisSchema>;
