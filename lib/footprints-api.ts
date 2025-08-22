import { createClient } from "@/lib/supabase/client";
import { ERROR_CODES } from "@/lib/shared/error-codes";

interface FootprintRequest {
  lat: number;
  lng: number;
}

interface FootprintResponse {
  success: boolean;
  data?: {
    footprints: Array<{
      id: string;
      coordinates: [number, number][];
      area: number;
      isActive: boolean;
      source?: "microsoft-footprint" | "google-footprint";
    }>;
    confidence?: 'Alta' | 'Média' | 'Baixa';
  };
  error?: string;
  errorCode?: string;
}

export async function getFootprints(lat: number, lng: number): Promise<FootprintResponse> {
  try {
    const supabase = createClient();
    
    const { data, error } = await supabase.functions.invoke('footprints', {
      body: { lat, lng } as FootprintRequest
    });

    // Always try to get response body first (regardless of HTTP status)
    let responseBody = data;
    
    // If no data but error exists, check if error contains the response
    if (!data && error) {
      responseBody = error;
    }

    // Parse JSON if needed
    if (typeof responseBody === 'string') {
      try {
        responseBody = JSON.parse(responseBody);
      } catch (parseError) {
        // If can't parse, treat as network error
        return {
          success: false,
          error: 'Erro de comunicação com o servidor.',
          errorCode: ERROR_CODES.NETWORK_ERROR
        };
      }
    }

    // Check response body for errorCode (priority over everything else)
    if (responseBody && typeof responseBody === 'object') {
      // If has errorCode, use it directly
      if (responseBody.errorCode) {
        return {
          success: false,
          error: responseBody.error || 'Erro desconhecido',
          errorCode: responseBody.errorCode
        };
      }
      
      // If successful response
      if (responseBody.success === true) {
        return responseBody as FootprintResponse;
      }
    }

    // If no valid response body, treat as network error
    return {
      success: false,
      error: 'Erro de comunicação com o servidor.',
      errorCode: ERROR_CODES.NETWORK_ERROR
    };
    
  } catch (error) {
    console.error('Footprints API error:', error);
    return {
      success: false,
      error: 'Erro inesperado ao buscar footprint.',
      errorCode: ERROR_CODES.NETWORK_ERROR
    };
  }
}

export function transformFootprintData(apiData: FootprintResponse['data']) {
  if (!apiData || !apiData.footprints || apiData.footprints.length === 0) return null;

  const footprint = apiData.footprints[0]; // Use the first footprint
  
  return {
    id: footprint.id,
    coordinates: footprint.coordinates,
    area: footprint.area,
    isActive: footprint.isActive,
    source: footprint.source || 'microsoft-footprint',
    confidence: apiData.confidence || 'Média' as const
  };
}