"use client";

import { CoverageStatus } from "./coverage-status";
import { TechnicalResults } from "./technical-results";
import { ActionButtons } from "./action-buttons";
import { TechnicianInputsPanel } from "./technician-inputs-panel";
import { useAnalysis } from "./analysis-context";
import { AlertCircle } from "lucide-react";
import { useErrorHandler } from "@/lib/hooks/use-error-handler";
import { MapLibreMapRef } from "./maplibre-map";

interface ResultsPanelProps {
  mapRef: React.RefObject<MapLibreMapRef | null>;
}

export function ResultsPanel({ mapRef }: ResultsPanelProps) {
  const { data, error, hasCredits, selectedAddress, hasAnalysisResults } = useAnalysis();
  
  const { } = useErrorHandler();
  
  // Function to determine if error should be hidden from banner
  const shouldHideErrorFromBanner = (errorMessage: string | null): boolean => {
    if (!errorMessage) return false;
    
    const footprintKeywords = [
      'footprint',
      'Nenhum footprint',
      'footprint encontrado',
      'FOOTPRINT_NOT_FOUND',
      'Desenhe o telhado',
      'buscar footprint',
      'footprints'
    ];
    
    const lowercaseError = errorMessage.toLowerCase();
    return footprintKeywords.some(keyword => lowercaseError.includes(keyword.toLowerCase()));
  };
  
  // Only show error in banner if it's not a footprint-related error
  const shouldShowErrorBanner = error && !shouldHideErrorFromBanner(error);
  
  // Debug logging
  if (error) {
    console.log('ResultsPanel error detected:', error);
    console.log('shouldHideErrorFromBanner:', shouldHideErrorFromBanner(error));
    console.log('shouldShowErrorBanner:', shouldShowErrorBanner);
  }


  // Modal de sem créditos
  if (!hasCredits) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-orange-500 mx-auto" />
          <h3 className="text-lg font-semibold">Créditos Insuficientes</h3>
          <p className="text-muted-foreground">
            Você precisa de créditos para realizar análises.
          </p>
          <div className="space-x-2">
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">
              Comprar Créditos
            </button>
            <button className="px-4 py-2 border rounded-lg">
              Fazer Upgrade
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Análise Solar</h2>
        {data.address && (
          <p className="text-sm text-muted-foreground mt-1 truncate">
            {data.address}
          </p>
        )}
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Banner de erro - Only show non-footprint errors */}
        {shouldShowErrorBanner && (
          <div className={`border rounded-lg p-3 ${
            error!.includes('autenticado') || error!.includes('login')
              ? 'bg-destructive/10 border-destructive/20'
              : 'bg-muted/50 border-border'
          }`}>
            <div className="flex items-start space-x-2">
              <AlertCircle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                error!.includes('autenticado') || error!.includes('login')
                  ? 'text-destructive'
                  : 'text-orange-500'
              }`} />
              <div>
                <p className="text-sm text-foreground">{error}</p>
                {!error!.includes('autenticado') && !error!.includes('login') && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Tentando fonte alternativa...
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Status de cobertura */}
        <CoverageStatus />

        {/* Inputs do técnico - aparece quando há endereço selecionado */}
        {selectedAddress && !hasAnalysisResults && (
          <TechnicianInputsPanel />
        )}

        {/* Resultados técnicos */}
        <TechnicalResults />
        
        {/* Mensagem quando não há endereço selecionado */}
        {!selectedAddress && (
          <div className="bg-muted/50 border border-border rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Digite um endereço acima para iniciar a análise
            </p>
          </div>
        )}

      </div>

      {/* Ações */}
      {data.coordinates && (
        <div className="border-t p-4">
          <ActionButtons mapRef={mapRef} />
        </div>
      )}
    </div>
  );
}