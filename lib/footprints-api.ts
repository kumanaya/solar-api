import { createClient } from "@/lib/supabase/client";

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
      return {
        success: false,
        error: `Erro de comunicação: ${error.message || 'Falha na conexão com o serviço'}`
      };
    }

    // Handle empty or malformed response
    if (!data) {
      console.error('Empty response from footprints edge function');
      return {
        success: false,
        error: 'Resposta vazia do servidor. Verifique se a edge function está funcionando.'
      };
    }

    // Handle JSON parsing errors
    if (typeof data === 'string') {
      console.log('Attempting to parse string data:', data);
      try {
        const parsedData = JSON.parse(data);
        console.log('Parsed footprints data successfully:', parsedData);
        if (!parsedData.success) {
          return {
            success: false,
            error: parsedData.error || 'Erro na busca por footprint'
          };
        }
        return parsedData as FootprintResponse;
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Failed to parse string:', data);
        return {
          success: false,
          error: 'Erro ao processar resposta do servidor. Resposta malformada.'
        };
      }
    }

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Erro desconhecido na busca por footprint'
      };
    }

    return data as FootprintResponse;
    
  } catch (error) {
    console.error('Footprints API error:', error);
    
    // Check if it's a network or function not found error
    if (error instanceof Error) {
      if (error.message.includes('FunctionsHttpError') || error.message.includes('404')) {
        return {
          success: false,
          error: 'Edge function footprints não encontrada. Verifique se a função foi deployada no Supabase.'
        };
      }
      
      if (error.message.includes('network') || error.message.includes('fetch')) {
        return {
          success: false,
          error: 'Erro de conexão. Verifique sua internet e tente novamente.'
        };
      }
    }
    
    return {
      success: false,
      error: `Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
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