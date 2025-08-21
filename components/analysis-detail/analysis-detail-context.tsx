"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAnalysisById, transformGetAnalysisData } from "@/lib/get-analysis-api";
import { analyzeAddress } from "@/lib/analysis-api";

export interface AnalysisVersion {
  id: string;
  date: string;
  confidence: "Alta" | "Média" | "Baixa";
  usableArea: number;
  annualIrradiation: number;
  estimatedProduction: number;
  verdict: "Apto" | "Parcial" | "Não apto";
  sources: string[];
  parameters: {
    usageFactor: number;
    tiltEstimated?: number;
  };
  variationFromPrevious?: number;
  shadingIndex?: number;
  shadingLoss?: number;
}

export interface DetailedAnalysis {
  id: string;
  address: string;
  coordinates: [number, number];
  createdAt: string;
  lastUpdated: string;
  currentVersion: AnalysisVersion;
  history: AnalysisVersion[];
  polygon: {
    coordinates: [number, number][];
    area: number;
  };
  footprints: Array<{
    id: string;
    coordinates: [number, number][];
    area: number;
    isActive: boolean;
    source?: "user-drawn" | "microsoft-footprint" | "google-footprint";
  }>;
  sources: {
    pvgis: boolean;
    nasa: boolean;
    solcast: boolean;
    google: boolean;
  };
  reprocessCount: number;
  technicalNote?: string;
  reasons: string[];
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
    annualIrradiation: apiData.annualIrradiation,
    estimatedProduction: apiData.estimatedProduction,
    verdict: apiData.verdict,
    sources: [apiData.irradiationSource],
    parameters: {
      usageFactor: apiData.usageFactor,
      tiltEstimated: undefined // Not available in current API
    },
    variationFromPrevious: undefined,
    shadingIndex: apiData.shadingIndex,
    shadingLoss: apiData.shadingLoss
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
      setIsLoading(true);
      setError(null);
      
      console.log('Reprocessing analysis with parameters:', parameters);
      
      // Call the analyze function with the same address but new parameters
      const polygon = analysis.polygon.coordinates.length > 0 ? {
        type: "Polygon" as const,
        coordinates: [analysis.polygon.coordinates], // GeoJSON format
        source: "user-drawn" as const
      } : undefined;
      
      const response = await analyzeAddress({
        address: analysis.address,
        polygon,
        usableAreaOverride: parameters.usableAreaOverride as number | undefined
      });
      
      if (!response.success || !response.data) {
        setError(response.error || "Erro ao reprocessar análise");
        return;
      }
      
      // Transform the new data
      const transformedData = {
        ...response.data,
        id: analysis.id, // Keep the same ID
        createdAt: new Date().toISOString() // New timestamp for reprocessing
      };
      
      // Create new version
      const previousProduction = analysis.currentVersion.estimatedProduction;
      const newProduction = transformedData.estimatedProduction;
      const variationFromPrevious = previousProduction > 0 ? 
        ((newProduction - previousProduction) / previousProduction) * 100 : 0;
      
      const newVersion: AnalysisVersion = {
        id: `${analysis.id}-v${analysis.history.length + 1}`,
        date: transformedData.createdAt,
        confidence: transformedData.confidence,
        usableArea: transformedData.usableArea,
        annualIrradiation: transformedData.annualIrradiation,
        estimatedProduction: transformedData.estimatedProduction,
        verdict: transformedData.verdict,
        sources: [transformedData.irradiationSource],
        parameters: {
          usageFactor: transformedData.usageFactor,
          tiltEstimated: parameters.tiltEstimated as number | undefined
        },
        variationFromPrevious,
        shadingIndex: transformedData.shadingIndex,
        shadingLoss: transformedData.shadingLoss
      };

      const updatedAnalysis = {
        ...analysis,
        lastUpdated: newVersion.date,
        currentVersion: newVersion,
        history: [...analysis.history, newVersion],
        reprocessCount: analysis.reprocessCount + 1,
        sources: {
          pvgis: transformedData.irradiationSource.includes('PVGIS'),
          nasa: transformedData.irradiationSource.includes('NASA'),
          solcast: transformedData.irradiationSource.includes('Solcast'),
          google: transformedData.coverage.google
        }
      };

      setAnalysis(updatedAnalysis);
      
      console.log("📊 Reprocessamento concluído:", {
        analysis_id: analysisId,
        reprocess_count: updatedAnalysis.reprocessCount,
        variation: newVersion.variationFromPrevious,
        new_confidence: newVersion.confidence
      });
      
    } catch (error) {
      console.error('Error reprocessing analysis:', error);
      setError("Erro ao reprocessar análise");
    } finally {
      setIsLoading(false);
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