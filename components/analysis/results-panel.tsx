"use client";

import { CoverageStatus } from "./coverage-status";
import { TechnicalResults } from "./technical-results";
import { ActionButtons } from "./action-buttons";
import { useAnalysis } from "./analysis-context";
import { AlertCircle } from "lucide-react";

export function ResultsPanel() {
  const { data, error, hasCredits } = useAnalysis();

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
        {/* Banner de erro não bloqueante */}
        {error && (
          <div className="bg-muted/50 border border-border rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-foreground">{error}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Tentando fonte alternativa...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Status de cobertura */}
        <CoverageStatus />

        {/* Resultados técnicos */}
        {data.coordinates ? (
          <TechnicalResults />
        ) : (
          <div className="bg-muted/50 border border-border rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Digite um endereço acima para iniciar a análise
            </p>
          </div>
        )}

        {/* Callout para desenhar telhado */}
        {data.coordinates && data.footprints.length === 0 && (
          <div className="bg-muted/50 border border-border rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Nenhum telhado detectado automaticamente
            </p>
            <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              Desenhar telhado manualmente
            </button>
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