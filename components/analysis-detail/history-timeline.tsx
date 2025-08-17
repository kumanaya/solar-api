"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Calendar, TrendingUp, TrendingDown, Minus, RefreshCw, FileText } from "lucide-react";
import { useAnalysisDetail } from "./analysis-detail-context";

interface HistoryTimelineProps {
  onClose: () => void;
}

export function HistoryTimeline({ onClose }: HistoryTimelineProps) {
  const { analysis } = useAnalysisDetail();

  if (!analysis) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Carregando histórico...</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getVariationIcon = (variation?: number) => {
    if (!variation) return <FileText className="h-4 w-4 text-blue-500" />;
    if (variation > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (variation < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const getVariationColor = (variation?: number) => {
    if (!variation) return "text-gray-600";
    if (variation > 0) return "text-green-600";
    if (variation < 0) return "text-red-600";
    return "text-gray-600";
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "Alta":
        return "bg-green-100 text-green-800";
      case "Média":
        return "bg-yellow-100 text-yellow-800";
      case "Baixa":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case "Apto":
        return "bg-green-100 text-green-800";
      case "Parcial":
        return "bg-yellow-100 text-yellow-800";
      case "Não apto":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Estatísticas do histórico
  const totalVersions = analysis.history.length;
  const productionValues = analysis.history.map(v => v.estimatedProduction);
  const maxProduction = Math.max(...productionValues);
  const minProduction = Math.min(...productionValues);
  const avgProduction = productionValues.reduce((a, b) => a + b, 0) / totalVersions;
  const productionVariation = ((maxProduction - minProduction) / minProduction) * 100;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Histórico de Reprocessamentos</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {analysis.address}
        </p>
      </div>

      {/* Estatísticas */}
      <div className="border-b p-4 space-y-3">
        <h3 className="font-medium text-sm">Estatísticas</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-1">
            <p className="text-muted-foreground">Total de versões</p>
            <p className="font-medium">{totalVersions}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Variação de produção</p>
            <p className={`font-medium ${getVariationColor(productionVariation)}`}>
              ±{productionVariation.toFixed(1)}%
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Produção média</p>
            <p className="font-medium">{Math.round(avgProduction).toLocaleString()} kWh/ano</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Último reprocessamento</p>
            <p className="font-medium">
              {analysis.reprocessCount > 0 
                ? new Date(analysis.lastUpdated).toLocaleDateString('pt-BR')
                : 'N/A'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {analysis.history.slice().reverse().map((version, index) => {
            const isLatest = index === 0;
            const isOriginal = index === analysis.history.length - 1;
            
            return (
              <Card key={version.id} className={`${isLatest ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center space-x-2">
                      {getVariationIcon(version.variationFromPrevious)}
                      <span>
                        {isOriginal ? 'Análise Original' : `Reprocessamento ${analysis.history.length - index - 1}`}
                      </span>
                      {isLatest && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                          Atual
                        </Badge>
                      )}
                    </CardTitle>
                    
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {formatDate(version.date)}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {/* Badges de status */}
                  <div className="flex flex-wrap gap-1">
                    <Badge className={`text-xs ${getConfidenceColor(version.confidence)}`}>
                      {version.confidence}
                    </Badge>
                    <Badge className={`text-xs ${getVerdictColor(version.verdict)}`}>
                      {version.verdict}
                    </Badge>
                  </div>

                  {/* Métricas principais */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Área útil</p>
                      <p className="font-medium">{version.usableArea}m²</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Irradiação</p>
                      <p className="font-medium">{version.annualIrradiation} kWh/m²</p>
                    </div>
                  </div>

                  {/* Produção estimada */}
                  <div className="bg-orange-50 rounded-lg p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Produção estimada</span>
                      {version.variationFromPrevious !== undefined && (
                        <span className={`text-xs font-medium ${getVariationColor(version.variationFromPrevious)}`}>
                          {version.variationFromPrevious > 0 ? '+' : ''}
                          {version.variationFromPrevious.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-orange-600">
                      {version.estimatedProduction.toLocaleString()} kWh/ano
                    </p>
                  </div>

                  {/* Fontes de dados */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Fontes</p>
                    <div className="flex flex-wrap gap-1">
                      {version.sources.map((source) => (
                        <Badge key={source} variant="outline" className="text-xs">
                          {source}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Parâmetros */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Parâmetros</p>
                    <div className="text-xs space-y-0.5">
                      <div className="flex justify-between">
                        <span>Fator de uso:</span>
                        <span>{(version.parameters.usageFactor * 100).toFixed(0)}%</span>
                      </div>
                      {version.parameters.tiltEstimated && (
                        <div className="flex justify-between">
                          <span>Inclinação:</span>
                          <span>{version.parameters.tiltEstimated}°</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ação de reprocessamento */}
                  {!isOriginal && (
                    <div className="pt-2 border-t">
                      <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                        <RefreshCw className="h-3 w-3" />
                        <span>
                          Reprocessamento {analysis.history.length - index - 1} •
                          {version.variationFromPrevious !== undefined && (
                            <span className={getVariationColor(version.variationFromPrevious)}>
                              {' '}
                              {version.variationFromPrevious > 0 ? 'Melhora' : version.variationFromPrevious < 0 ? 'Redução' : 'Sem alteração'} na produção
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Footer com informações */}
      <div className="border-t p-4">
        <div className="text-xs text-muted-foreground space-y-1">
          <p>💡 Reprocessamentos atualizam os cálculos com dados mais recentes</p>
          <p>📊 Variações são calculadas em relação à versão anterior</p>
        </div>
      </div>
    </div>
  );
}