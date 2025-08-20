import { createClient } from "@/lib/supabase/client";

interface AnalysisRequest {
  address: string;
}

interface AnalysisResponse {
  success: boolean;
  data?: {
    address: string;
    coordinates: {
      lat: number;
      lng: number;
    };
    coverage: {
      google: boolean;
      fallback?: string;
    };
    confidence: 'Alta' | 'Média' | 'Baixa';
    usableArea: number;
    areaSource: 'google' | 'estimate' | 'footprint';
    annualIrradiation: number;
    irradiationSource: string;
    shadingIndex: number;
    shadingLoss: number;
    estimatedProduction: number;
    verdict: 'Apto' | 'Parcial' | 'Não apto';
    reasons: string[];
    footprints: Array<{
      id: string;
      coordinates: [number, number][];
      area: number;
      isActive: boolean;
    }>;
    usageFactor: number;
    googleSolarData?: object;
  };
  error?: string;
}

export async function analyzeAddress(address: string): Promise<AnalysisResponse> {
  try {
    const supabase = createClient();
    
    // Call the edge function (Supabase client handles auth automatically)
    console.log('Calling edge function with address:', address);
    
    const { data, error } = await supabase.functions.invoke('analyze', {
      body: { address } as AnalysisRequest
    });

    console.log('Edge function response:', { data, error });
    console.log('Data type:', typeof data);
    console.log('Data content:', data);

    if (error) {
      console.error('Edge function error:', error);
      return {
        success: false,
        error: `Erro de comunicação: ${error.message || 'Falha na conexão com o serviço'}`
      };
    }

    // Handle empty or malformed response
    if (!data) {
      console.error('Empty response from edge function');
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
        console.log('Parsed data successfully:', parsedData);
        if (!parsedData.success) {
          return {
            success: false,
            error: parsedData.error || 'Erro na análise'
          };
        }
        return parsedData as AnalysisResponse;
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
        error: data.error || 'Erro desconhecido na análise'
      };
    }

    return data as AnalysisResponse;
    
  } catch (error) {
    console.error('Analysis API error:', error);
    
    // Check if it's a network or function not found error
    if (error instanceof Error) {
      if (error.message.includes('FunctionsHttpError') || error.message.includes('404')) {
        return {
          success: false,
          error: 'Edge function não encontrada. Verifique se a função /analyze foi deployada no Supabase.'
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

// Function to transform API response to frontend format
export function transformAnalysisData(apiData: AnalysisResponse['data']) {
  if (!apiData) return null;

  return {
    address: apiData.address,
    coordinates: [apiData.coordinates.lng, apiData.coordinates.lat] as [number, number],
    coverage: {
      google: apiData.coverage.google,
      fallback: apiData.coverage.fallback || (apiData.coverage.google ? undefined : "Usando estimativas regionais")
    },
    confidence: apiData.confidence,
    usableArea: apiData.usableArea,
    areaSource: apiData.areaSource,
    annualIrradiation: apiData.annualIrradiation,
    irradiationSource: apiData.irradiationSource,
    shadingIndex: apiData.shadingIndex,
    shadingLoss: apiData.shadingLoss,
    estimatedProduction: apiData.estimatedProduction,
    verdict: apiData.verdict,
    reasons: apiData.reasons,
    footprints: apiData.footprints.map(fp => ({
      id: fp.id,
      coordinates: fp.coordinates,
      area: fp.area,
      isActive: fp.isActive
    })),
    usageFactor: apiData.usageFactor
  };
}