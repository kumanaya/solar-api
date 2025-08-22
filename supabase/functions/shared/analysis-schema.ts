import { z } from "https://esm.sh/zod@3.23.8";

// Enums
export const ConfidenceLevelEnum = z.enum(["Alta", "Média", "Baixa"]);
export const VerdictEnum = z.enum(["Apto", "Parcial", "Não apto"]);
export const AreaSourceEnum = z.enum(["google", "footprint", "manual", "estimate"]);
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
  
  // Metadata
  createdAt: z.string().optional()
});
