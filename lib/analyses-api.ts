import { createClient } from "@/lib/supabase/client";

export interface AnalysisSummary {
  id: string;
  address: string;
  verdict: 'Apto' | 'Parcial' | 'Não apto';
  estimatedProduction: number;
  usableArea: number;
  createdAt: string;
  confidence: 'Alta' | 'Média' | 'Baixa';
  areaSource: 'google' | 'estimate' | 'footprint' | 'manual';
}

export interface AnalysisListResponse {
  success: boolean;
  data?: AnalysisSummary[];
  error?: string;
  total?: number;
}

export async function getUserAnalyses(
  page: number = 1,
  limit: number = 10,
  sortBy: 'created_at' | 'address' | 'verdict' = 'created_at',
  sortOrder: 'asc' | 'desc' = 'desc'
): Promise<AnalysisListResponse> {
  try {
    const supabase = createClient();
    
    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    
    console.log('Fetching user analyses:', { page, limit, sortBy, sortOrder });
    
    // Query analyses with pagination and sorting
    const { data, error, count } = await supabase
      .from('analyses')
      .select(`
        id,
        address,
        verdict,
        estimated_production,
        usable_area,
        created_at,
        confidence,
        area_source
      `, { count: 'exact' })
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Database query error:', error);
      return {
        success: false,
        error: 'Erro ao buscar análises'
      };
    }

    // Transform data to frontend format
    const analyses: AnalysisSummary[] = (data || []).map(analysis => ({
      id: analysis.id,
      address: analysis.address,
      verdict: analysis.verdict,
      estimatedProduction: analysis.estimated_production,
      usableArea: analysis.usable_area,
      createdAt: analysis.created_at,
      confidence: analysis.confidence,
      areaSource: analysis.area_source
    }));

    return {
      success: true,
      data: analyses,
      total: count || 0
    };
    
  } catch (error) {
    console.error('Get analyses error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro inesperado ao buscar análises'
    };
  }
}

export async function getAnalysisById(id: string): Promise<{
  success: boolean;
  data?: {
    id: string;
    address: string;
    coordinates: { lat: number; lng: number };
    coverage: { google: boolean; fallback?: string };
    confidence: 'Alta' | 'Média' | 'Baixa';
    usableArea: number;
    areaSource: 'google' | 'estimate' | 'footprint' | 'manual';
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
      source?: "user-drawn" | "microsoft-footprint" | "google-footprint";
    }>;
    usageFactor: number;
    googleSolarData?: object;
    technicalNote?: string;
    createdAt: string;
  };
  error?: string;
}> {
  try {
    const supabase = createClient();
    
    console.log('Fetching analysis by ID:', id);
    
    const { data, error } = await supabase
      .from('analyses')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Database query error:', error);
      if (error.code === 'PGRST116') {
        return {
          success: false,
          error: 'Análise não encontrada'
        };
      }
      return {
        success: false,
        error: 'Erro ao buscar análise'
      };
    }

    // Transform database result to frontend format
    const transformedAnalysis = {
      id: data.id,
      address: data.address,
      coordinates: data.coordinates,
      coverage: data.coverage,
      confidence: data.confidence,
      usableArea: data.usable_area,
      areaSource: data.area_source,
      annualIrradiation: data.annual_irradiation,
      irradiationSource: data.irradiation_source,
      shadingIndex: data.shading_index,
      shadingLoss: data.shading_loss,
      estimatedProduction: data.estimated_production,
      verdict: data.verdict,
      reasons: data.reasons,
      footprints: data.footprints,
      usageFactor: data.usage_factor,
      googleSolarData: data.google_solar_data,
      technicalNote: data.technical_note,
      createdAt: data.created_at,
    };

    return {
      success: true,
      data: transformedAnalysis
    };
    
  } catch (error) {
    console.error('Get analysis by ID error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro inesperado ao buscar análise'
    };
  }
}

export async function deleteAnalysis(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = createClient();
    
    console.log('Deleting analysis:', id);
    
    const { error } = await supabase
      .from('analyses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Database delete error:', error);
      return {
        success: false,
        error: 'Erro ao deletar análise'
      };
    }

    return {
      success: true
    };
    
  } catch (error) {
    console.error('Delete analysis error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro inesperado ao deletar análise'
    };
  }
}