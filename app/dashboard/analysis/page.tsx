"use client";

import { useState, useEffect } from "react";
import { MapPanel } from "@/components/analysis/map-panel";
import { ResultsPanel } from "@/components/analysis/results-panel";
import { AnalysisProvider } from "@/components/analysis/analysis-context";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AnalysisPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    // Simular carregamento inicial
    const timer = setTimeout(() => setIsLoading(false), 1000);
    
    // Recuperar estado do sidebar do localStorage
    const savedState = localStorage.getItem('analysis-sidebar-collapsed');
    if (savedState !== null) {
      setIsSidebarCollapsed(JSON.parse(savedState));
    }
    
    return () => clearTimeout(timer);
  }, []);

  const toggleSidebar = () => {
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    localStorage.setItem('analysis-sidebar-collapsed', JSON.stringify(newState));
  };

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
      {/* Layout Desktop: lado a lado */}
      <div className="hidden md:flex h-screen max-w-full overflow-hidden">
        {/* Coluna esquerda - Mapa (flexível) */}
        <div 
          className={`relative transition-all duration-300 ${
            isSidebarCollapsed 
              ? 'flex-1' 
              : 'flex-1 max-w-[calc(100%-320px)]'
          }`}
        >
          <MapPanel />
          
          {/* Botão de toggle no mapa - alinhado com o input */}
          <Button
            variant="secondary"
            size="sm"
            className="absolute top-2 md:top-4 right-2 md:right-4 z-30 shadow-lg hover:shadow-xl transition-shadow h-10"
            onClick={toggleSidebar}
            title={isSidebarCollapsed ? "Mostrar painel" : "Ocultar painel"}
          >
            {isSidebarCollapsed ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {/* Coluna direita - Painel de resultados (largura fixa) */}
        <div 
          className={`border-l bg-background transition-all duration-300 flex-shrink-0 ${
            isSidebarCollapsed 
              ? 'w-0 opacity-0 overflow-hidden' 
              : 'w-80 opacity-100 overflow-y-auto'
          }`}
        >
          {!isSidebarCollapsed && <ResultsPanel />}
        </div>
      </div>

      {/* Layout Mobile: mapa acima, resultados abaixo */}
      <div className="md:hidden flex flex-col h-screen overflow-hidden">
        {/* Mapa - metade superior */}
        <div className="flex-1 relative">
          <MapPanel />
        </div>
        
        {/* Painel de resultados - metade inferior */}
        <div className="flex-1 border-t bg-background overflow-y-auto">
          <ResultsPanel />
        </div>
      </div>
    </AnalysisProvider>
  );
}