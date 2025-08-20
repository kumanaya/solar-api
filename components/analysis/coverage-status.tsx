"use client";

import { Badge } from "@/components/ui/badge";
import { Info, Shield, ShieldCheck, ShieldAlert } from "lucide-react";
import { useAnalysis } from "./analysis-context";

export function CoverageStatus() {
  const { data, hasAnalysisResults } = useAnalysis();
  
  // Só renderizar se tivermos resultados de análise
  if (!hasAnalysisResults) return null;

  const getConfidenceIcon = () => {
    switch (data.confidence) {
      case "Alta":
        return <ShieldCheck className="h-4 w-4 text-green-500" />;
      case "Média":
        return <Shield className="h-4 w-4 text-yellow-500" />;
      case "Baixa":
        return <ShieldAlert className="h-4 w-4 text-red-500" />;
    }
  };

  const getConfidenceColor = () => {
    switch (data.confidence) {
      case "Alta":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "Média":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      case "Baixa":
        return "variant-destructive";
    }
  };

  const getConfidenceTooltip = () => {
    switch (data.confidence) {
      case "Alta":
        return "Dados de footprint + irradiância validados.";
      case "Média":
        return "Área confirmada, irradiância estimada.";
      case "Baixa":
        return "Dados limitados. Considere desenhar o telhado manualmente.";
    }
  };

  return (
    <div className="space-y-3">
      {/* Status de cobertura */}
      <div className="bg-muted/50 rounded-lg p-3">
        <div className="flex items-start space-x-2">
          <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Status de Cobertura</p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.coverage.google 
                ? "Google: dados disponíveis." 
                : `Google: indisponível aqui. ${data.coverage.fallback}.`
              }
            </p>
          </div>
        </div>
      </div>

      {/* Selo de confiança */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Confiança da Análise</span>
        <div className="group relative">
          {data.confidence === "Baixa" ? (
            <Badge variant="destructive">
              {getConfidenceIcon()}
              <span className="ml-1">{data.confidence}</span>
            </Badge>
          ) : (
            <Badge className={getConfidenceColor()}>
              {getConfidenceIcon()}
              <span className="ml-1">{data.confidence}</span>
            </Badge>
          )}
          
          {/* Tooltip */}
          <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block">
            <div className="bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap">
              {getConfidenceTooltip()}
              <div className="absolute top-full right-2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-black"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Botão Aprimorar precisão - se confiança baixa */}
      {data.confidence === "Baixa" && (
        <div className="bg-muted/50 border border-border rounded-lg p-3">
          <p className="text-sm text-muted-foreground mb-2">
            Precisão pode ser melhorada
          </p>
          <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">
            Desenhar/ajustar polígono manualmente
          </button>
        </div>
      )}
    </div>
  );
}