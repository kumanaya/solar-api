"use client";

import { useState, useEffect } from "react";
import { MapPanel } from "@/components/analysis/map-panel";
import { ResultsPanel } from "@/components/analysis/results-panel";
import { AnalysisProvider } from "@/components/analysis/analysis-context";

export default function AnalysisPage() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simular carregamento inicial
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Carregando análise...</p>
        </div>
      </div>
    );
  }

  return (
    <AnalysisProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Coluna esquerda - Mapa (65%) */}
        <div className="flex-1 w-[65%] relative">
          <MapPanel />
        </div>
        
        {/* Coluna direita - Painel de resultados (35%) */}
        <div className="w-[35%] border-l bg-background overflow-y-auto">
          <ResultsPanel />
        </div>
      </div>
    </AnalysisProvider>
  );
}