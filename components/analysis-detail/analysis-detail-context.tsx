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
}

export interface DetailedAnalysis extends BaseDetailedAnalysis {
  id: string;
  address: string;
  createdAt: string;
  lastUpdated: string;
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
    effectivePR: apiData.effectivePR
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
        reasons: apiData.reasons
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
      
      // Apply usage factor to override usable area if provided
      let usableAreaOverride: number | undefined;
      if (parameters.usageFactor && typeof parameters.usageFactor === 'number') {
        usableAreaOverride = Math.round(analysis.polygon.area * parameters.usageFactor);
      }
      
      const response = await analyzeAddress(
        analysis.address,
        analysis.coordinates[0], // lat (corrected index)
        analysis.coordinates[1], // lng (corrected index)
        polygon || { type: "Polygon", coordinates: [[]] },
        usableAreaOverride
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
        usageFactor: parameters.usageFactor || response.data.usageFactor,
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
      const newProduction = transformedData.estimatedProduction;
      const variationFromPrevious = previousProduction > 0 ? 
        ((newProduction - previousProduction) / previousProduction) * 100 : 0;
      
      const newVersion: AnalysisVersion = {
        id: newAnalysisId,
        date: transformedData.createdAt,
        confidence: transformedData.confidence,
        usableArea: transformedData.usableArea,
        annualGHI: transformedData.annualGHI || 1800,
        estimatedProduction: transformedData.estimatedProduction,
        verdict: transformedData.verdict,
        sources: [transformedData.irradiationSource],
        parameters: {
          usageFactor: transformedData.usageFactor,
          tiltEstimated: parameters.tiltEstimated as number | undefined
        },
        variationFromPrevious,
        shadingIndex: transformedData.shadingIndex,
        shadingLoss: transformedData.shadingLoss,
        shadingSource: transformedData.shadingSource,
        estimatedProductionAC: transformedData.estimatedProductionAC,
        estimatedProductionDC: transformedData.estimatedProductionDC,
        estimatedProductionYear1: transformedData.estimatedProductionYear1,
        estimatedProductionYear25: transformedData.estimatedProductionYear25,
        temperatureLosses: transformedData.temperatureLosses,
        degradationFactor: transformedData.degradationFactor,
        effectivePR: transformedData.effectivePR
      };

      const updatedAnalysis = {
        ...analysis,
        lastUpdated: transformedData.lastUpdated,
        currentVersion: newVersion,
        history: [...analysis.history, newVersion],
        reprocessCount: analysis.reprocessCount + 1,
        sources: {
          pvgis: transformedData.irradiationSource.includes('PVGIS'),
          nasa: transformedData.irradiationSource.includes('NASA'),
          solcast: transformedData.irradiationSource.includes('Solcast'),
          google: transformedData.coverage?.google || false
        },
        // Update polygon area if usage factor changed
        polygon: {
          ...analysis.polygon,
          area: transformedData.usableArea / (parameters.usageFactor as number || 0.75)
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
      
      // For now, redirect to new analysis page with the same address
      // In the future, we could copy the polygon and parameters
      const encodedAddress = encodeURIComponent(analysis.address);
      window.open(`/dashboard/analysis?address=${encodedAddress}`, '_blank');
      
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