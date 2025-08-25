import { createClient } from "@/lib/supabase/client";
import { ERROR_CODES, createApiError, detectErrorCode } from "@/lib/shared/error-codes";

interface GetAnalysisRequest {
  id: string;
}

interface GetAnalysisResponse {
  success: boolean;
  data?: {
    id: string;
    address: string;
    coordinates: {
      lat: number;
      lng: number;
    };
    coverage: {
      google: boolean;
      fallback?: string;
      dataQuality?: "measured" | "calculated" | "estimated";
    };
    confidence: 'Alta' | 'Média' | 'Baixa';
    usableArea: number;
    areaSource: 'google' | 'estimate' | 'footprint' | 'manual';
    annualGHI: number;
    irradiationSource: string;
    shadingIndex: number;
    shadingLoss: number;
    shadingSource?: "google_measured" | "user_input" | "description" | "heuristic";
    estimatedProduction: number;
    estimatedProductionAC?: number;
    estimatedProductionDC?: number;
    estimatedProductionYear1?: number;
    estimatedProductionYear25?: number;
    temperatureLosses?: number;
    degradationFactor?: number;
    effectivePR?: number;
    verdict: 'Apto' | 'Parcial' | 'Não apto';
    reasons: string[];
    recommendations?: string[];
    warnings?: string[];
    footprints: Array<{
      id: string;
      coordinates: [number, number][];
      area: number;
      isActive: boolean;
      source?: "user-drawn" | "microsoft-footprint" | "google-footprint";
    }>;
    usageFactor: number;
    googleSolarData?: object;
    technicalNote?: string;
    imageryMetadata?: {
      source?: "google_solar" | "esri_world_imagery";
      captureDate?: string;
      resolution?: string;
      sourceInfo?: string;
      accuracy?: string;
    };
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
    marginOfError?: string;
    suggestedSystemConfig?: {
      panel_count: number;
      system_power_kwp: number;
      panel_power_watts: number;
      panel_area_m2: number;
      module_efficiency_percent: number;
      occupied_area_m2: number;
      power_density_w_m2: number;
      area_utilization_percent: number;
    };
    createdAt: string;
  };
  error?: string;
  errorCode?: string;
}

export async function getAnalysisById(id: string): Promise<GetAnalysisResponse> {
  try {
    const supabase = createClient();
    
    console.log('Calling get-analysis edge function with ID:', id);
    
    const { data, error } = await supabase.functions.invoke('get-analysis', {
      body: { id } as GetAnalysisRequest
    });

    console.log('Get-analysis edge function response:', { data, error });

    if (error) {
      console.error('Get-analysis edge function error:', error);
      const apiError = createApiError(ERROR_CODES.EDGE_FUNCTION_ERROR);
      return {
        success: false,
        error: apiError.userMessage,
        errorCode: apiError.code
      };
    }

    // Handle empty or malformed response
    if (!data) {
      console.error('Empty response from get-analysis edge function');
      const apiError = createApiError(ERROR_CODES.EMPTY_RESPONSE);
      return {
        success: false,
        error: apiError.userMessage,
        errorCode: apiError.code
      };
    }

    // Handle JSON parsing errors
    if (typeof data === 'string') {
      console.log('Attempting to parse string data:', data);
      try {
        const parsedData = JSON.parse(data);
        console.log('Parsed data successfully:', parsedData);
        if (!parsedData.success) {
          const errorCode = parsedData.errorCode || detectErrorCode(parsedData.error || '');
          const apiError = createApiError(errorCode, parsedData.error);
          return {
            success: false,
            error: apiError.userMessage,
            errorCode: apiError.code
          };
        }
        return parsedData as GetAnalysisResponse;
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Failed to parse string:', data);
        const apiError = createApiError(ERROR_CODES.MALFORMED_RESPONSE);
        return {
          success: false,
          error: apiError.userMessage,
          errorCode: apiError.code
        };
      }
    }

    if (!data.success) {
      const errorCode = data.errorCode || detectErrorCode(data.error || '');
      const apiError = createApiError(errorCode, data.error);
      return {
        success: false,
        error: apiError.userMessage,
        errorCode: apiError.code
      };
    }

    return data as GetAnalysisResponse;
    
  } catch (error) {
    console.error('Get Analysis API error:', error);
    
    let errorCode = ERROR_CODES.UNKNOWN_ERROR;
    
    if (error instanceof Error) {
      if (error.message.includes('FunctionsHttpError') || error.message.includes('404')) {
        errorCode = ERROR_CODES.FUNCTION_NOT_FOUND;
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorCode = ERROR_CODES.NETWORK_ERROR;
      }
    }
    
    const apiError = createApiError(errorCode);
    return {
      success: false,
      error: apiError.userMessage,
      errorCode: apiError.code
    };
  }
}

// Helper function to transform API response to frontend format
export function transformGetAnalysisData(apiData: GetAnalysisResponse['data']) {
  if (!apiData) return null;

  return {
    id: apiData.id,
    address: apiData.address,
    coordinates: [apiData.coordinates.lng, apiData.coordinates.lat] as [number, number],
    coverage: {
      google: apiData.coverage.google,
      fallback: apiData.coverage.fallback || (apiData.coverage.google ? undefined : "Usando estimativas regionais"),
      dataQuality: apiData.coverage.dataQuality
    },
    confidence: apiData.confidence,
    usableArea: apiData.usableArea,
    areaSource: apiData.areaSource,
    annualGHI: apiData.annualGHI,
    irradiationSource: apiData.irradiationSource,
    shadingIndex: apiData.shadingIndex,
    shadingLoss: apiData.shadingLoss,
    shadingSource: apiData.shadingSource,
    estimatedProduction: apiData.estimatedProduction,
    estimatedProductionAC: apiData.estimatedProductionAC,
    estimatedProductionDC: apiData.estimatedProductionDC,
    estimatedProductionYear1: apiData.estimatedProductionYear1,
    estimatedProductionYear25: apiData.estimatedProductionYear25,
    temperatureLosses: apiData.temperatureLosses,
    degradationFactor: apiData.degradationFactor,
    effectivePR: apiData.effectivePR,
    verdict: apiData.verdict,
    reasons: apiData.reasons,
    recommendations: apiData.recommendations,
    warnings: apiData.warnings,
    footprints: apiData.footprints.map(fp => ({
      id: fp.id,
      coordinates: fp.coordinates,
      area: fp.area,
      isActive: fp.isActive,
      source: fp.source
    })),
    usageFactor: apiData.usageFactor,
    googleSolarData: apiData.googleSolarData,
    technicalNote: apiData.technicalNote,
    imageryMetadata: apiData.imageryMetadata,
    technicianInputs: apiData.technicianInputs,
    marginOfError: apiData.marginOfError || "±5%",
    suggestedSystemConfig: apiData.suggestedSystemConfig || {
      panel_count: 0,
      system_power_kwp: 0,
      panel_power_watts: 550,
      panel_area_m2: 2.5,
      module_efficiency_percent: 21.5,
      occupied_area_m2: 0,
      power_density_w_m2: 0,
      area_utilization_percent: 0
    },
    createdAt: apiData.createdAt
  };
}