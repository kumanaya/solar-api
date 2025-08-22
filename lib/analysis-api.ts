import { createClient } from "@/lib/supabase/client";
import { ERROR_CODES, createApiError, detectErrorCode } from "@/lib/shared/error-codes";

interface AnalysisRequest {
  address: string;
  lat: number;
  lng: number;
  polygon: {
    type: "Polygon";
    coordinates: number[][][]; // [lng,lat]
    source?: "user-drawn" | "microsoft-footprint" | "google-footprint";
  }; // Now required
  usableAreaOverride?: number; // m²
}

interface AnalysisResponse {
  success: boolean;
  data?: {
    id?: string;
    address: string;
    coordinates: {
      lat: number;
      lng: number;
    };
    coverage: {
      google: boolean;
      fallback?: string;
      dataQuality?: 'measured' | 'calculated' | 'estimated';
    };
    confidence: 'Alta' | 'Média' | 'Baixa';
    usableArea: number;
    areaSource: 'google' | 'estimate' | 'footprint' | 'manual';
    annualGHI: number;
    irradiationSource: string;
    shadingIndex: number;
    shadingLoss: number;
    shadingSource?: 'google_measured' | 'user_input' | 'description' | 'heuristic';
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
    createdAt?: string;
    updatedAt?: string;
    customPolygon?: {
      type: "Polygon";
      coordinates: number[][][];
      source?: "user-drawn" | "microsoft-footprint" | "google-footprint";
    };
  };
  error?: string;
  errorCode?: string;
}

export async function analyzeAddress(
  address: string,
  lat: number,
  lng: number, 
  polygon: { type: "Polygon"; coordinates: number[][][]; source?: "user-drawn" | "microsoft-footprint" | "google-footprint" },
  usableAreaOverride?: number
): Promise<AnalysisResponse> {
  try {
    const supabase = createClient();
    
    // Call the edge function (Supabase client handles auth automatically)
    console.log('Calling edge function with coordinates:', { address, lat, lng });
    
    const requestBody: AnalysisRequest = { 
      address, 
      lat, 
      lng, 
      polygon 
    };
    
    console.log('Including polygon in analysis request:', polygon);
    
    // Add usable area override if provided
    if (usableAreaOverride && usableAreaOverride > 0) {
      requestBody.usableAreaOverride = usableAreaOverride;
      console.log('Including usable area override in analysis request:', usableAreaOverride);
    }
    
    const { data, error } = await supabase.functions.invoke('analyze', {
      body: requestBody
    });

    console.log('Edge function response:', { data, error });
    console.log('Data type:', typeof data);
    console.log('Data content:', data);

    if (error) {
      console.error('Edge function error:', error);
      const apiError = createApiError(ERROR_CODES.EDGE_FUNCTION_ERROR);
      return {
        success: false,
        error: apiError.userMessage,
        errorCode: apiError.code
      };
    }

    // Handle empty or malformed response
    if (!data) {
      console.error('Empty response from edge function');
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
        return parsedData as AnalysisResponse;
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

    return data as AnalysisResponse;
    
  } catch (error) {
    console.error('Analysis API error:', error);
    
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

// Function to transform API response to frontend format
export function transformAnalysisData(apiData: AnalysisResponse['data']) {
  if (!apiData) return null;

  console.log('transformAnalysisData - apiData keys:', Object.keys(apiData));
  console.log('transformAnalysisData - annualGHI value:', apiData.annualGHI);

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
    annualIrradiation: apiData.annualGHI || 1800,
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
    createdAt: apiData.createdAt,
    updatedAt: apiData.updatedAt,
    customPolygon: apiData.customPolygon
  };
}