"use client";

import { CoverageStatus } from "./coverage-status";
import { TechnicalResults } from "./technical-results";
import { ActionButtons } from "./action-buttons";
import { useAnalysis } from "./analysis-context";
import { AlertCircle } from "lucide-react";
import { useErrorHandler } from "@/lib/hooks/use-error-handler";

export function ResultsPanel() {
  const { data, error, hasCredits, selectedAddress, updateData, setIsLoading, setError, isLoading, setHasAnalysisResults } = useAnalysis();
  
  const { isFootprintError } = useErrorHandler();


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
        {/* Banner de erro */}
        {error && (
          <div className={`border rounded-lg p-3 ${
            isFootprintError() 
              ? 'bg-amber-50 border-amber-200'
              : error.includes('autenticado') || error.includes('login')
              ? 'bg-destructive/10 border-destructive/20'
              : 'bg-muted/50 border-border'
          }`}>
            <div className="flex items-start space-x-2">
              <AlertCircle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                isFootprintError()
                  ? 'text-amber-600'
                  : error.includes('autenticado') || error.includes('login')
                  ? 'text-destructive'
                  : 'text-orange-500'
              }`} />
              <div>
                <p className="text-sm text-foreground">{error}</p>
                {isFootprintError() && (
                  <p className="text-xs text-amber-600 mt-1">
                    💡 Use a ferramenta &quot;Desenhar Telhado&quot; no mapa
                  </p>
                )}
                {!error.includes('autenticado') && !error.includes('login') && !isFootprintError() && (
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
          <ActionButtons />
        </div>
      )}
    </div>
  );
}