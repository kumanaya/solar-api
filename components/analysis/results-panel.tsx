"use client";

import { CoverageStatus } from "./coverage-status";
import { TechnicalResults } from "./technical-results";
import { ActionButtons } from "./action-buttons";
import { useAnalysis } from "./analysis-context";
import { AlertCircle, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analyzeAddress, transformAnalysisData } from "@/lib/analysis-api";

export function ResultsPanel() {
  const { data, error, hasCredits, selectedAddress, updateData, setIsLoading, setError, isLoading, setHasAnalysisResults } = useAnalysis();

  const performAnalysis = async () => {
    if (!selectedAddress) return;
    
    setIsLoading(true);
    setError(null);

    try {
      console.log(`Starting analysis for address: ${selectedAddress}`);
      console.log('Current data coordinates:', data.coordinates);
      
      // Call the real API
      const result = await analyzeAddress(selectedAddress);
      console.log('Analysis result:', result);
      
      if (!result.success) {
        console.error('Analysis failed:', result.error);
        setError(result.error || "Erro na análise do endereço");
        return;
      }
      if (!result.data) {
        setError("Dados de análise não recebidos");
        return;
      }
      const frontendData = transformAnalysisData(result.data);
      if (!frontendData) {
        setError("Erro ao processar dados da análise");
        return;
      }
      console.log('Analysis completed successfully:', frontendData);
      
      // Preserve current coordinates (where user placed the pin)
      const currentCoordinates = data.coordinates;
      updateData({
        ...frontendData,
        coordinates: currentCoordinates // Keep user's pin location
      });
      
      // Mark that we have analysis results
      setHasAnalysisResults(true);
      
    } catch (error) {
      console.error('Analysis error:', error);
      setError("Erro inesperado durante a análise. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

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
            error.includes('autenticado') || error.includes('login')
              ? 'bg-destructive/10 border-destructive/20'
              : 'bg-muted/50 border-border'
          }`}>
            <div className="flex items-start space-x-2">
              <AlertCircle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                error.includes('autenticado') || error.includes('login')
                  ? 'text-destructive'
                  : 'text-orange-500'
              }`} />
              <div>
                <p className="text-sm text-foreground">{error}</p>
                {!error.includes('autenticado') && !error.includes('login') && (
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

        {/* Analysis Button */}
        {selectedAddress && (
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground mb-1">Endereço selecionado</p>
                <p className="text-xs text-muted-foreground truncate">{selectedAddress}</p>
              </div>
              <Button
                onClick={performAnalysis}
                disabled={isLoading}
                size="sm"
                className="ml-3 flex-shrink-0"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Realizar Análise
                  </>
                )}
              </Button>
            </div>
          </div>
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