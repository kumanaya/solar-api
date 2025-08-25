import { createClient } from "@/lib/supabase/client";
import { ERROR_CODES, createApiError, detectErrorCode } from "@/lib/shared/error-codes";

interface AnalysisRequest {
  lat: number;
  lng: number;
  polygon?: {
    type: "Polygon";
    coordinates: number[][][]; // [lng,lat]
  };
}

interface AnalysisResponse {
  success: boolean;
  data?: {
    id: string;
    coordinates: [number, number];
    usable_area: number;
    area_source: string;
    annual_irradiation: number;
    irradiation_source: string;
    shading_index: number;
    estimated_production: number;
    verdict: 'Apto' | 'Parcial' | 'Não apto';
    reasons: string[];
    recommendations?: string[];
    warnings?: string[];
    coverage: {
      google: boolean;
      pvgis: boolean;
      nasa: boolean;
    };
    api_cache_ids: {
      google: string | null;
      pvgis: string | null;
      nasa: string | null;
    };
  };
  metadata?: {
    version: string;
    timestamp: string;
    location: string;
  };
  error?: string;
  errorCode?: string;
}

export async function analyzeAddress(
  lat: number,
  lng: number, 
  polygon?: { type: "Polygon"; coordinates: number[][][]; source?: "user-drawn" | "microsoft-footprint" | "google-footprint" }
): Promise<AnalysisResponse> {
  try {
    const supabase = createClient();
    
    // Call the simplified edge function
    console.log('Calling simplified edge function with coordinates:', { lat, lng });
    
    const requestBody: AnalysisRequest = { 
      lat, 
      lng
    };
    
    if (polygon) {
      requestBody.polygon = {
        type: polygon.type,
        coordinates: polygon.coordinates
      };
      console.log('Including polygon in analysis request:', polygon);
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

// Function to transform simplified API response to basic analysis data
export function transformAnalysisData(apiData: AnalysisResponse['data']) {
  if (!apiData) return null;

  console.log('transformAnalysisData - simplified data:', apiData);

  return {
    id: apiData.id,
    coordinates: apiData.coordinates,
    usableArea: apiData.usable_area,
    areaSource: apiData.area_source,
    annualIrradiation: apiData.annual_irradiation,
    irradiationSource: apiData.irradiation_source,
    shadingIndex: apiData.shading_index,
    estimatedProduction: apiData.estimated_production,
    verdict: apiData.verdict,
    reasons: apiData.reasons,
    recommendations: apiData.recommendations,
    warnings: apiData.warnings,
    coverage: apiData.coverage,
    apiCacheIds: apiData.api_cache_ids,
    // Default values for compatibility
    address: '',
    confidence: 'Média' as const,
    shadingLoss: Math.round(apiData.shading_index * 100),
    footprints: [],
    usageFactor: 0.8
  };
}