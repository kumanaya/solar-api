import { createClient } from "@/lib/supabase/client";

export interface DataLayersRequest {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  view?: "FULL_LAYERS" | "DSM_LAYER" | "IMAGERY_LAYER" | "IMAGERY_AND_ANNUAL_FLUX_LAYERS" | "IMAGERY_AND_ALL_FLUX_LAYERS";
  requiredQuality?: "LOW" | "MEDIUM" | "HIGH";
  pixelSizeMeters?: number;
  exactQualityRequired?: boolean;
}

export interface DataLayersResponse {
  success: boolean;
  data?: {
    id: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    imageryQuality: "LOW" | "MEDIUM" | "HIGH";
    imageryDate: {
      year: number;
      month: number;
      day: number;
    };
    storedLayers: {
      [key: string]: {
        url: string;
        title: string;
        description: string;
        metadata: {
          date?: {
            year: number;
            month: number;
            day: number;
          };
          pixelSize: number;
          regionCode?: string;
        };
      } | Array<{
        url: string;
        title: string;
        description: string;
        hour: number;
        metadata: {
          date?: {
            year: number;
            month: number;
            day: number;
          };
          pixelSize: number;
          regionCode?: string;
        };
      }>;
    };
    layerCount: number;
    createdAt: string;
  };
  error?: string;
}

export async function requestDataLayers(params: DataLayersRequest): Promise<DataLayersResponse> {
  try {
    const supabase = createClient();
    
    // Use Supabase's functions invoke which handles auth automatically
    const { data, error } = await supabase.functions.invoke('dataLayers', {
      body: {
        latitude: params.latitude,
        longitude: params.longitude,
        radiusMeters: params.radiusMeters || 100,
        view: params.view || "FULL_LAYERS",
        requiredQuality: params.requiredQuality || "HIGH",
        pixelSizeMeters: params.pixelSizeMeters || 0.1,
        exactQualityRequired: params.exactQualityRequired || false
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      return {
        success: false,
        error: error.message || 'Failed to request data layers'
      };
    }

    // Check if the response indicates success
    if (data && typeof data === 'object' && 'success' in data) {
      return data as DataLayersResponse;
    }

    // If we got data but no success field, assume success
    if (data) {
      return {
        success: true,
        data: data as DataLayersResponse['data']
      };
    }

    return {
      success: false,
      error: 'No data received from edge function'
    };
  } catch (error) {
    console.error('Data layers request error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function getDataLayersByAnalysisId(analysisId: string) {
  try {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('data_layers')
      .select('*')
      .eq('analysis_id', analysisId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching data layers:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Data layers fetch error:', error);
    return null;
  }
}

export async function getUserDataLayers(userId: string) {
  try {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('data_layers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user data layers:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('User data layers fetch error:', error);
    return [];
  }
}