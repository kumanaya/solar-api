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
    
    const response = await supabase.functions.invoke('footprints', {
      body: { lat, lng } as FootprintRequest
    });

    console.log('Raw Supabase response:', response);
    const { data, error } = response;
    console.log('Footprints edge function response:', { data, error });
    console.log('Response type:', typeof data, 'Error type:', typeof error);
    
    // For 404 responses, Supabase might put the actual response in error.context or similar
    if (error && error.message && error.context) {
      console.log('Error context found:', error.context);
    }

    // IMPORTANT: Check data first, even if there's an error (404 case)
    // For 404 responses, Supabase sets error but data contains the actual response
    if (data) {
      console.log('Footprints response data found, analyzing...');
      
      // Handle JSON parsing if data is string
      let parsedData = data;
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data);
          console.log('Parsed footprints data:', parsedData);
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
          console.error('Failed to parse string:', data);
        }
      }
      
      // Check if it's a footprint not found response (even with 404 error)
      if (parsedData && typeof parsedData === 'object' && parsedData.errorCode === 'FOOTPRINT_NOT_FOUND') {
        console.log('FOOTPRINT_NOT_FOUND detected in response data');
        return {
          success: false,
          error: parsedData.error || 'Nenhum footprint encontrado para esta localização. Desenhe o telhado manualmente.',
          errorCode: parsedData.errorCode
        };
      }
      
      // Handle successful response
      if (parsedData && parsedData.success) {
        return parsedData as FootprintResponse;
      }
      
      // Handle failed response with data
      if (parsedData && !parsedData.success) {
        const errorCode = parsedData.errorCode || detectErrorCode(parsedData.error || '');
        if (errorCode === ERROR_CODES.FOOTPRINT_NOT_FOUND) {
          return {
            success: false,
            error: parsedData.error,
            errorCode: errorCode
          };
        }
        const apiError = createApiError(errorCode, parsedData.error);
        return {
          success: false,
          error: apiError.userMessage,
          errorCode: apiError.code
        };
      }
    }

    // Only handle error if we don't have data or couldn't parse it
    if (error) {
      console.error('Footprints edge function error (no usable data):', error);
      
      // Determine errorCode based on error type, not HTTP status
      let errorCode = ERROR_CODES.EDGE_FUNCTION_ERROR;
      
      if (error.message) {
        const message = error.message.toLowerCase();
        
        // Auth-related errors
        if (message.includes('unauthorized') || message.includes('auth') || message.includes('401')) {
          errorCode = ERROR_CODES.AUTH_REQUIRED;
        }
        // Network/timeout errors
        else if (message.includes('timeout') || message.includes('network') || message.includes('fetch')) {
          errorCode = ERROR_CODES.NETWORK_ERROR;
        }
        // Function not found (but not footprint-specific 404)
        else if (message.includes('function not found') || message.includes('edge function')) {
          errorCode = ERROR_CODES.FUNCTION_NOT_FOUND;
        }
        // For any other 404 without footprint context, treat as function not found
        else if (message.includes('404')) {
          errorCode = ERROR_CODES.FUNCTION_NOT_FOUND;
        }
      }
      
      const apiError = createApiError(errorCode);
      return {
        success: false,
        error: apiError.userMessage,
        errorCode: apiError.code
      };
    }

    // Handle case where there's no data and no error (shouldn't happen)
    console.error('No data and no error from footprints edge function');
    const apiError = createApiError(ERROR_CODES.EMPTY_RESPONSE);
    return {
      success: false,
      error: apiError.userMessage,
      errorCode: apiError.code
    };
    
  } catch (error) {
    console.error('Footprints API error:', error);
    
    // Determine errorCode based on error characteristics, not HTTP status
    let errorCode = ERROR_CODES.UNKNOWN_ERROR;
    
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      // Auth errors
      if (message.includes('unauthorized') || message.includes('auth') || message.includes('401')) {
        errorCode = ERROR_CODES.AUTH_REQUIRED;
      }
      // Network/connection errors
      else if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
        errorCode = ERROR_CODES.NETWORK_ERROR;
      }
      // Function/service not available
      else if (message.includes('functionshttperror') || message.includes('edge function') || message.includes('service')) {
        errorCode = ERROR_CODES.FUNCTION_NOT_FOUND;
      }
      // Timeout errors
      else if (message.includes('timeout') || message.includes('aborted')) {
        errorCode = ERROR_CODES.FOOTPRINT_TIMEOUT;
      }
      // For generic 404s in catch, treat as function not found
      else if (message.includes('404')) {
        errorCode = ERROR_CODES.FUNCTION_NOT_FOUND;
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