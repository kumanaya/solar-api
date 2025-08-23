"use client";

import { useState, useEffect, useRef } from "react";
import { MapPanel } from "@/components/analysis/map-panel";
import { ResultsPanel } from "@/components/analysis/results-panel";
import { AnalysisProvider } from "@/components/analysis/analysis-context";
import { ChevronLeft, ChevronRight, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDuplicateInitialization } from "@/lib/hooks/use-duplicate-initialization";
import { MapLibreMapRef } from "@/components/analysis/maplibre-map";

export default function AnalysisPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  
  // Shared map reference
  const mapRef = useRef<MapLibreMapRef>(null);

  // Initialize duplicate data if available
  useDuplicateInitialization();

  useEffect(() => {
    // Simular carregamento inicial
    const timer = setTimeout(() => setIsLoading(false), 1000);
    
    // Recuperar estado do sidebar do localStorage
    const savedState = localStorage.getItem('analysis-sidebar-collapsed');
    if (savedState !== null) {
      setIsSidebarCollapsed(JSON.parse(savedState));
    }
    
    // Verificar tamanho da tela
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 1024);
    };
    
    // Verificar imediatamente
    checkScreenSize();
    
    // Adicionar listener para mudanças
    window.addEventListener('resize', checkScreenSize);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkScreenSize);
    };
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

  if (isSmallScreen) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Alert className="max-w-md border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
          <Monitor className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <strong>Melhor experiência em desktop:</strong> Algumas funcionalidades de análise e ferramentas de desenho funcionam melhor em telas maiores. Use um dispositivo com tela maior para acessar todas as funcionalidades.
          </AlertDescription>
        </Alert>
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
          <MapPanel mapRef={mapRef} />
          
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
          {!isSidebarCollapsed && <ResultsPanel mapRef={mapRef} />}
        </div>
      </div>

      {/* Layout Mobile: mapa acima, resultados abaixo */}
      <div className="md:hidden flex flex-col h-screen overflow-hidden">
        {/* Mapa - metade superior */}
        <div className="flex-1 relative">
          <MapPanel mapRef={mapRef} />
        </div>
        
        {/* Painel de resultados - metade inferior */}
        <div className="flex-1 border-t bg-background overflow-y-auto">
          <ResultsPanel mapRef={mapRef} />
        </div>
      </div>
    </AnalysisProvider>
  );
}