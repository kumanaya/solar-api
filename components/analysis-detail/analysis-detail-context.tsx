"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAnalysisById, transformGetAnalysisData } from "@/lib/get-analysis-api";
import { analyzeAddress } from "@/lib/analysis-api";

import { AnalysisVersion as BaseAnalysisVersion, DetailedAnalysis as BaseDetailedAnalysis } from "@/lib/types/analysis";

export interface AnalysisVersion extends BaseAnalysisVersion {
  id: string;
  sources: string[];
  parameters: {
    usageFactor: number;
    tiltEstimated?: number;
  };
  variationFromPrevious?: number;
  marginOfError?: string;
}

export interface DetailedAnalysis extends BaseDetailedAnalysis {
  id: string;
  address: string;
  createdAt: string;
  lastUpdated: string;
  currentVersion: AnalysisVersion; // Override with extended AnalysisVersion
  history: AnalysisVersion[];
  polygon: {
    coordinates: [number, number][];
    area: number;
  };
  sources: {
    pvgis: boolean;
    nasa: boolean;
    solcast: boolean;
    google: boolean;
  };
  reprocessCount: number;
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
}

interface AnalysisDetailContextType {
  analysis: DetailedAnalysis | null;
  isLoading: boolean;
  error: string | null;
  isReprocessModalOpen: boolean;
  setIsReprocessModalOpen: (open: boolean) => void;
  reprocessAnalysis: (parameters: Record<string, unknown>) => Promise<void>;
  duplicateAnalysis: () => Promise<void>;
  generatePDF: () => Promise<void>;
}

const AnalysisDetailContext = createContext<AnalysisDetailContextType | undefined>(undefined);

// Transform API data to DetailedAnalysis format
const transformApiDataToDetailedAnalysis = (apiData: ReturnType<typeof transformGetAnalysisData>): DetailedAnalysis => {
  if (!apiData) throw new Error("No analysis data received");

  // Create current version from API data
  const currentVersion: AnalysisVersion = {
    id: `${apiData.id}-v1`,
    date: apiData.createdAt,
    confidence: apiData.confidence,
    usableArea: apiData.usableArea,
    annualGHI: apiData.annualGHI || 1800,
    estimatedProduction: apiData.estimatedProduction,
    verdict: apiData.verdict,
    sources: [apiData.irradiationSource],
    parameters: {
      usageFactor: apiData.usageFactor,
      tiltEstimated: undefined // Not available in current API
    },
    variationFromPrevious: undefined,
    shadingIndex: apiData.shadingIndex,
    shadingLoss: apiData.shadingLoss,
    shadingSource: apiData.shadingSource,
    estimatedProductionAC: apiData.estimatedProductionAC,
    estimatedProductionDC: apiData.estimatedProductionDC,
    estimatedProductionYear1: apiData.estimatedProductionYear1,
    estimatedProductionYear25: apiData.estimatedProductionYear25,
    temperatureLosses: apiData.temperatureLosses,
    degradationFactor: apiData.degradationFactor,
    effectivePR: apiData.effectivePR,
    irradiationSource: apiData.irradiationSource,
    areaSource: apiData.areaSource,
    usageFactor: apiData.usageFactor,
    temperature: undefined,
    moduleEff: undefined,
    marginOfError: apiData.marginOfError
  };

  // For now, history contains only the current version
  // TODO: Implement version history in the database
  const history = [currentVersion];

  // Get polygon from active footprint or create fallback
  const activeFootprint = apiData.footprints.find((fp) => fp.isActive);
  const polygon = activeFootprint ? {
    coordinates: activeFootprint.coordinates,
    area: activeFootprint.area
  } : {
    coordinates: [], // Fallback for no footprint
    area: apiData.usableArea
  };

        return {
        id: apiData.id,
        address: apiData.address,
        coordinates: [apiData.coordinates[1], apiData.coordinates[0]], // lat, lng
        createdAt: apiData.createdAt,
        lastUpdated: apiData.createdAt,
        currentVersion,
        history,
        polygon,
        footprints: apiData.footprints,
        sources: {
          pvgis: apiData.irradiationSource.includes('PVGIS'),
          nasa: apiData.irradiationSource.includes('NASA'),
          solcast: apiData.irradiationSource.includes('Solcast'),
          google: apiData.coverage.google
        },
        coverage: {
          google: apiData.coverage.google,
          dataQuality: apiData.coverage.dataQuality || "estimated"
        },
        reprocessCount: 0, // TODO: Implement reprocess count in database
        technicalNote: apiData.technicalNote,
        reasons: apiData.reasons,
        recommendations: apiData.recommendations,
        warnings: apiData.warnings,
        technicianInputs: apiData.technicianInputs,
        suggestedSystemConfig: apiData.suggestedSystemConfig
      };
};

export function AnalysisDetailProvider({ 
  children, 
  analysisId 
}: { 
  children: ReactNode;
  analysisId: string;
}) {
  const [analysis, setAnalysis] = useState<DetailedAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReprocessModalOpen, setIsReprocessModalOpen] = useState(false);

  useEffect(() => {
    const loadAnalysis = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('Loading analysis with ID:', analysisId);
        const response = await getAnalysisById(analysisId);
        
        if (!response.success || !response.data) {
          setError(response.error || "Análise não encontrada");
          return;
        }
        
        const transformedData = transformGetAnalysisData(response.data);
        if (!transformedData) {
          setError("Erro ao processar dados da análise");
          return;
        }
        
        console.log('Transformed data from API:', transformedData);
        
        const detailedAnalysis = transformApiDataToDetailedAnalysis(transformedData);
        console.log('Final detailed analysis:', detailedAnalysis);
        
        setAnalysis(detailedAnalysis);
        
      } catch (error) {
        console.error('Error loading analysis:', error);
        setError("Erro ao carregar análise");
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalysis();
  }, [analysisId]);

  const reprocessAnalysis = async (parameters: Record<string, unknown>) => {
    if (!analysis) return;

    try {
      setError(null);
      
      console.log('Reprocessing analysis with parameters:', parameters);
      
      // Call the analyze function with the same address but new parameters
      const polygon = analysis.polygon.coordinates.length > 0 ? {
        type: "Polygon" as const,
        coordinates: [analysis.polygon.coordinates], // GeoJSON format
        source: "user-drawn" as const
      } : undefined;
      
      
      const response = await analyzeAddress(
        analysis.coordinates[0], // lat (corrected index)
        analysis.coordinates[1], // lng (corrected index)
        polygon || { type: "Polygon", coordinates: [[]] }
      );
      
      if (!response.success || !response.data) {
        throw new Error(response.error || "Erro ao reprocessar análise");
      }
      
      // Save new reprocessed analysis as a new entry for history tracking
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      
      const reprocessedAnalysisData = {
        ...response.data,
        address: analysis.address, // Keep original address
        usageFactor: parameters.usageFactor || 0.75,
        originalAnalysisId: analysis.id, // Link to original analysis
        reprocessParameters: {
          tiltEstimated: parameters.tiltEstimated,
          preferredSource: parameters.preferredSource,
          updateFootprint: parameters.updateFootprint
        }
      };

      const saveResponse = await supabase.functions.invoke('save-analysis', {
        body: {
          analysisData: reprocessedAnalysisData
        }
      });

      if (saveResponse.error) {
        throw new Error(saveResponse.error.message || "Erro ao salvar análise reprocessada");
      }

      if (!saveResponse.data?.success) {
        throw new Error(saveResponse.data?.error || "Erro ao salvar análise reprocessada");
      }
      
      // Transform the new data with the new analysis ID
      const newAnalysisId = saveResponse.data.data.id;
      const transformedData = {
        ...response.data,
        id: newAnalysisId, // Use new analysis ID
        createdAt: saveResponse.data.data.createdAt,
        lastUpdated: saveResponse.data.data.createdAt
      };
      
      // Create new version
      const previousProduction = analysis.currentVersion.estimatedProduction;
      const newProduction = transformedData.estimated_production;
      const variationFromPrevious = previousProduction > 0 ? 
        ((newProduction - previousProduction) / previousProduction) * 100 : 0;
      
      const newVersion: AnalysisVersion = {
        id: newAnalysisId,
        date: transformedData.createdAt,
        confidence: "Média",
        usableArea: transformedData.usable_area,
        annualGHI: 1800,
        estimatedProduction: transformedData.estimated_production,
        verdict: transformedData.verdict,
        sources: [transformedData.irradiation_source],
        parameters: {
          usageFactor: 0.75,
          tiltEstimated: parameters.tiltEstimated as number | undefined
        },
        variationFromPrevious,
        shadingIndex: transformedData.shading_index,
        shadingLoss: 0,
        shadingSource: "heuristic",
        estimatedProductionAC: transformedData.estimated_production,
        estimatedProductionDC: transformedData.estimated_production * 1.05,
        estimatedProductionYear1: transformedData.estimated_production,
        estimatedProductionYear25: transformedData.estimated_production * 0.85,
        temperatureLosses: 5,
        degradationFactor: 0.995,
        effectivePR: 0.8,
        irradiationSource: transformedData.irradiation_source,
        areaSource: "manual",
        usageFactor: 0.75,
        temperature: undefined,
        moduleEff: undefined
      };

      const updatedAnalysis = {
        ...analysis,
        lastUpdated: transformedData.lastUpdated,
        currentVersion: newVersion,
        history: [...analysis.history, newVersion],
        reprocessCount: analysis.reprocessCount + 1,
        sources: {
          pvgis: transformedData.irradiation_source.includes('PVGIS'),
          nasa: transformedData.irradiation_source.includes('NASA'),
          solcast: transformedData.irradiation_source.includes('Solcast'),
          google: transformedData.coverage?.google || false
        },
        // Update polygon area if usage factor changed
        polygon: {
          ...analysis.polygon,
          area: transformedData.usable_area / (parameters.usageFactor as number || 0.75)
        }
      };

      setAnalysis(updatedAnalysis);
      
      console.log("📊 Reprocessamento concluído:", {
        analysis_id: analysisId,
        reprocess_count: updatedAnalysis.reprocessCount,
        variation: newVersion.variationFromPrevious,
        new_confidence: newVersion.confidence,
        previous_production: previousProduction,
        new_production: newProduction
      });
      
    } catch (error) {
      console.error('Error reprocessing analysis:', error);
      throw error; // Re-throw to be handled by modal
    }
  };

  const duplicateAnalysis = async () => {
    if (!analysis) return;
    
    try {
      setError(null);
      console.log("Duplicating analysis:", analysis.address);
      
      // Prepare data to set in the analysis store
      const duplicateData = {
        address: analysis.address,
        coordinates: [analysis.coordinates[1], analysis.coordinates[0]] as [number, number], // Convert back to [lng, lat]
        polygon: analysis.polygon.coordinates.length > 0 ? {
          type: "Polygon" as const,
          coordinates: [analysis.polygon.coordinates],
          source: "user-drawn" as const
        } : null,
        footprints: [],
        timestamp: Date.now()
      };

      // Use Zustand store to set duplicate data
      const { useAnalysisStore } = await import('@/lib/stores/analysis-store');
      const { setDuplicateData } = useAnalysisStore.getState();
      setDuplicateData(duplicateData);
      
      // Navigate to new analysis page
      window.open('/dashboard/analysis', '_blank');
      
    } catch (error) {
      console.error('Error duplicating analysis:', error);
      setError("Erro ao duplicar análise");
    }
  };

  const generatePDF = async () => {
    if (!analysis) return;
    
    try {
      setError(null);
      console.log("Generating PDF for analysis:", analysis.id);
      
      // TODO: Implement PDF generation
      // This could call a separate edge function or generate client-side
      alert("Funcionalidade de PDF será implementada em breve!");
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      setError("Erro ao gerar PDF");
    }
  };

  return (
    <AnalysisDetailContext.Provider value={{
      analysis,
      isLoading,
      error,
      isReprocessModalOpen,
      setIsReprocessModalOpen,
      reprocessAnalysis,
      duplicateAnalysis,
      generatePDF
    }}>
      {children}
    </AnalysisDetailContext.Provider>
  );
}

export function useAnalysisDetail() {
  const context = useContext(AnalysisDetailContext);
  if (context === undefined) {
    throw new Error("useAnalysisDetail must be used within an AnalysisDetailProvider");
  }
  return context;
}