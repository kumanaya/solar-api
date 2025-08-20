import { createClient } from "@/lib/supabase/client";
import { ERROR_CODES, createApiError, detectErrorCode } from "@/lib/shared/error-codes";

interface FootprintRequest {
  lat: number;
  lng: number;
}

interface FootprintResponse {
  success: boolean;
  data?: {
    polygon?: {
      type: "Polygon";
      coordinates: number[][][]; // [lng,lat]
    };
    area?: number; // m²
    confidence: 'Alta' | 'Média' | 'Baixa';
    source: string;
    azimuth?: number; // graus, orientação do telhado
    tilt?: number; // graus, inclinação do telhado
  };
  error?: string;
  errorCode?: string;
}

export async function getFootprints(lat: number, lng: number): Promise<FootprintResponse> {
  try {
    const supabase = createClient();
    
    console.log('Calling footprints edge function with coordinates:', { lat, lng });
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    
    const { data, error } = await supabase.functions.invoke('footprints', {
      body: { lat, lng } as FootprintRequest
    });

    console.log('Footprints edge function response:', { data, error });
    console.log('Response type:', typeof data, 'Error type:', typeof error);

    if (error) {
      console.error('Footprints edge function error:', error);
      const apiError = createApiError(ERROR_CODES.EDGE_FUNCTION_ERROR);
      return {
        success: false,
        error: apiError.userMessage,
        errorCode: apiError.code
      };
    }

    // Handle empty or malformed response
    if (!data) {
      console.error('Empty response from footprints edge function');
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
        console.log('Parsed footprints data successfully:', parsedData);
        if (!parsedData.success) {
          const errorCode = parsedData.errorCode || detectErrorCode(parsedData.error || '');
          const apiError = createApiError(errorCode, parsedData.error);
          return {
            success: false,
            error: apiError.userMessage,
            errorCode: apiError.code
          };
        }
        return parsedData as FootprintResponse;
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

    return data as FootprintResponse;
    
  } catch (error) {
    console.error('Footprints API error:', error);
    
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

// Helper function to convert footprint API response to frontend format
export function transformFootprintData(footprintData: FootprintResponse['data']) {
  if (!footprintData || !footprintData.polygon) return null;

  // Convert coordinates from [lng,lat] to [lat,lng] for frontend
  const coordinates = footprintData.polygon.coordinates[0].map(coord => [coord[1], coord[0]] as [number, number]);

  return {
    id: `footprint-${Date.now()}`,
    coordinates,
    area: footprintData.area || 0,
    isActive: true,
    confidence: footprintData.confidence,
    source: footprintData.source,
    azimuth: footprintData.azimuth,
    tilt: footprintData.tilt
  };
}