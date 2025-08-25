"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Calendar, Shield, Database } from "lucide-react";
import { useAnalysisDetail } from "./analysis-detail-context";
import { useRouter } from "next/navigation";

export function AnalysisHeader() {
  const { analysis } = useAnalysisDetail();
  const router = useRouter();

  if (!analysis) {
    return (
      <div className="border-b p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-6 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  const getConfidenceColor = () => {
    console.log('Current confidence value:', analysis.currentVersion.confidence);
    switch (analysis.currentVersion.confidence) {
      case "Alta":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "Média":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      case "Baixa":
        return "variant-destructive";
      default:
        console.warn('Unknown confidence value:', analysis.currentVersion.confidence);
        return "bg-gray-100 text-gray-800 hover:bg-gray-100";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="border-b bg-background">
      <div className="p-4 space-y-4">
        {/* Linha superior com navegação */}
        <div className="flex items-center space-x-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.back()}
            className="flex items-center space-x-1"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar</span>
          </Button>
          <div className="h-4 w-px bg-border" />
          <span className="text-sm text-muted-foreground">Análise #{analysis.id}</span>
        </div>

        {/* Linha principal com endereço e metadados */}
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold flex items-center space-x-2">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <span>{analysis.address}</span>
              </h1>
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <Calendar className="h-4 w-4" />
                  <span>Criada: {formatDate(analysis.createdAt)}</span>
                </div>
                {analysis.reprocessCount > 0 && (
                  <div className="flex items-center space-x-1">
                    <Database className="h-4 w-4" />
                    <span>Última atualização: {formatDate(analysis.lastUpdated)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Selo de confiança */}
            <div className="flex items-center space-x-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              {analysis.currentVersion.confidence === "Baixa" ? (
                <Badge variant="destructive">
                  Confiança {analysis.currentVersion.confidence}
                </Badge>
              ) : (
                <Badge className={getConfidenceColor()}>
                  Confiança {analysis.currentVersion.confidence}
                </Badge>
              )}
            </div>
          </div>

          {/* Chips de fontes */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-muted-foreground">Fontes:</span>
            <div className="flex flex-wrap gap-1">
              {analysis.currentVersion.sources?.map((source) => (
                <Badge 
                  key={source}
                  variant="outline" 
                  className="text-xs"
                >
                  {source}
                </Badge>
              ))}
            </div>
          </div>

          {/* Informações de reprocessamento */}
          {analysis.reprocessCount > 0 && (
            <div className="bg-muted/50 border border-border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {analysis.reprocessCount} reprocessamento{analysis.reprocessCount > 1 ? 's' : ''} realizado{analysis.reprocessCount > 1 ? 's' : ''}
                  </span>
                </div>
                {analysis.currentVersion.variationFromPrevious !== undefined && (
                  <Badge 
                    variant="outline"
                    className="text-xs"
                  >
                    {analysis.currentVersion.variationFromPrevious > 0 ? '+' : ''}
                    {analysis.currentVersion.variationFromPrevious?.toFixed(1)}%
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}