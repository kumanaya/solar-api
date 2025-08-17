"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export type ConfidenceLevel = "Alta" | "Média" | "Baixa";
export type Verdict = "Apto" | "Parcial" | "Não apto";

export interface Footprint {
  id: string;
  coordinates: [number, number][];
  area: number;
  isActive: boolean;
}

export interface AnalysisData {
  address: string;
  coordinates: [number, number] | null;
  coverage: {
    google: boolean;
    fallback: string;
  };
  confidence: ConfidenceLevel;
  usableArea: number;
  areaSource: "footprint" | "manual";
  annualIrradiation: number;
  irradiationSource: string;
  shadingIndex: number;
  shadingLoss: number;
  estimatedProduction: number;
  verdict: Verdict;
  reasons: string[];
  footprints: Footprint[];
  usageFactor: number;
}

interface AnalysisContextType {
  data: AnalysisData;
  updateData: (updates: Partial<AnalysisData>) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  hasCredits: boolean;
  setHasCredits: (credits: boolean) => void;
}

const defaultData: AnalysisData = {
  address: "",
  coordinates: null,
  coverage: {
    google: false,
    fallback: "Usando dados NASA SRTM"
  },
  confidence: "Baixa",
  usableArea: 0,
  areaSource: "manual",
  annualIrradiation: 0,
  irradiationSource: "PVGIS",
  shadingIndex: 0,
  shadingLoss: 0,
  estimatedProduction: 0,
  verdict: "Não apto",
  reasons: ["Dados insuficientes"],
  footprints: [],
  usageFactor: 0.75
};

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AnalysisData>(defaultData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCredits, setHasCredits] = useState(true);

  const updateData = (updates: Partial<AnalysisData>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  return (
    <AnalysisContext.Provider value={{
      data,
      updateData,
      isLoading,
      setIsLoading,
      error,
      setError,
      hasCredits,
      setHasCredits
    }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const context = useContext(AnalysisContext);
  if (context === undefined) {
    throw new Error("useAnalysis must be used within an AnalysisProvider");
  }
  return context;
}