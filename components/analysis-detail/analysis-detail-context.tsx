"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

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

// Mock data generator
const generateMockAnalysis = (id: string): DetailedAnalysis => {
  const baseDate = new Date();
  const createdAt = new Date(baseDate.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
  
  const versions: AnalysisVersion[] = [];
  const versionCount = Math.floor(Math.random() * 3) + 1;
  
  for (let i = 0; i < versionCount; i++) {
    const versionDate = new Date(createdAt.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    const area = 120 + Math.random() * 80;
    const irradiation = 1400 + Math.random() * 400;
    const production = area * irradiation * 0.15;
    
    versions.push({
      id: `${id}-v${i + 1}`,
      date: versionDate.toISOString(),
      confidence: ["Alta", "Média", "Baixa"][Math.floor(Math.random() * 3)] as "Alta" | "Média" | "Baixa",
      usableArea: Math.floor(area),
      annualIrradiation: Math.floor(irradiation),
      estimatedProduction: Math.floor(production),
      verdict: ["Apto", "Parcial", "Não apto"][Math.floor(Math.random() * 3)] as "Apto" | "Parcial" | "Não apto",
      sources: ["PVGIS", "NASA SRTM", Math.random() > 0.5 ? "Solcast" : "Google"].filter(Boolean),
      parameters: {
        usageFactor: 0.7 + Math.random() * 0.2,
        tiltEstimated: Math.random() > 0.5 ? Math.floor(Math.random() * 20 + 10) : undefined
      },
      variationFromPrevious: i > 0 ? (Math.random() - 0.5) * 20 : undefined
    });
  }

  return {
    id,
    address: `Rua Exemplo ${id}, São Paulo - SP`,
    coordinates: [-23.550520 + Math.random() * 0.01, -46.633308 + Math.random() * 0.01],
    createdAt: createdAt.toISOString(),
    lastUpdated: versions[versions.length - 1].date,
    currentVersion: versions[versions.length - 1],
    history: versions,
    polygon: {
      coordinates: [
        [-23.550520, -46.633308],
        [-23.550530, -46.633290],
        [-23.550540, -46.633310],
        [-23.550530, -46.633320]
      ],
      area: Math.floor(150 + Math.random() * 100)
    },
    sources: {
      pvgis: true,
      nasa: true,
      solcast: Math.random() > 0.3,
      google: Math.random() > 0.5
    },
    reprocessCount: versions.length - 1
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
        // Simular carregamento da API
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const mockAnalysis = generateMockAnalysis(analysisId);
        setAnalysis(mockAnalysis);
      } catch {
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
      
      // Simular chamada para /analyze
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Criar nova versão
      const newVersion: AnalysisVersion = {
        id: `${analysis.id}-v${analysis.history.length + 1}`,
        date: new Date().toISOString(),
        confidence: ["Alta", "Média", "Baixa"][Math.floor(Math.random() * 3)] as "Alta" | "Média" | "Baixa",
        usableArea: Math.floor(120 + Math.random() * 80),
        annualIrradiation: Math.floor(1400 + Math.random() * 400),
        estimatedProduction: Math.floor((120 + Math.random() * 80) * (1400 + Math.random() * 400) * 0.15),
        verdict: ["Apto", "Parcial", "Não apto"][Math.floor(Math.random() * 3)] as "Apto" | "Parcial" | "Não apto",
        sources: ["PVGIS", "NASA SRTM", "Solcast"],
        parameters: {
          usageFactor: (parameters.usageFactor as number) || 0.75,
          tiltEstimated: parameters.tiltEstimated as number | undefined
        },
        variationFromPrevious: (Math.random() - 0.5) * 15
      };

      const updatedAnalysis = {
        ...analysis,
        lastUpdated: newVersion.date,
        currentVersion: newVersion,
        history: [...analysis.history, newVersion],
        reprocessCount: analysis.reprocessCount + 1
      };

      setAnalysis(updatedAnalysis);
      
      // Métricas
      console.log("📊 Reprocessamento:", {
        analysis_id: analysisId,
        reprocess_count: updatedAnalysis.reprocessCount,
        variation: newVersion.variationFromPrevious,
        new_confidence: newVersion.confidence
      });
      
    } catch {
      setError("Erro ao reprocessar análise");
    } finally {
      setIsLoading(false);
    }
  };

  const duplicateAnalysis = async () => {
    if (!analysis) return;
    
    try {
      // Simular duplicação
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log("Análise duplicada:", analysis.address);
      
      // Aqui redirecionaria para nova análise
      alert("Análise duplicada com sucesso!");
    } catch {
      setError("Erro ao duplicar análise");
    }
  };

  const generatePDF = async () => {
    if (!analysis) return;
    
    try {
      // Simular geração de PDF
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log("PDF gerado para análise:", analysis.id);
      alert("PDF gerado com sucesso!");
    } catch {
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