"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Square, Sun, Cloud, Zap, CheckCircle, AlertTriangle, XCircle, Calendar } from "lucide-react";
import { useAnalysisDetail } from "./analysis-detail-context";

export function TechnicalPanel() {
  const { analysis, isLoading } = useAnalysisDetail();

  if (isLoading || !analysis) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-24 bg-gray-200 rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  const { currentVersion } = analysis;

  const getVerdictIcon = () => {
    switch (currentVersion.verdict) {
      case "Apto":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "Parcial":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "Não apto":
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getVerdictColor = () => {
    switch (currentVersion.verdict) {
      case "Apto":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "Parcial":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      case "Não apto":
        return "bg-red-100 text-red-800 hover:bg-red-100";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header do painel */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Resultados Técnicos</h2>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" />
            <span>Congelado</span>
          </div>
        </div>
        <div className="flex items-center space-x-2 mt-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Calculado em {formatDate(currentVersion.date)}</span>
        </div>
      </div>

      {/* Conteúdo do painel */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Área útil */}
        <Card className="relative">
          <div className="absolute top-3 right-3">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center space-x-2">
              <Square className="h-4 w-4 text-blue-500" />
              <span>Área Útil</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{currentVersion.usableArea}m²</span>
                <Badge variant="outline">Footprint</Badge>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Área bruta:</span>
                  <span>{analysis.polygon.area}m²</span>
                </div>
                <div className="flex justify-between">
                  <span>Fator de uso:</span>
                  <span>{(currentVersion.parameters.usageFactor * 100).toFixed(0)}%</span>
                </div>
                {currentVersion.parameters.tiltEstimated && (
                  <div className="flex justify-between">
                    <span>Inclinação estimada:</span>
                    <span>{currentVersion.parameters.tiltEstimated}°</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Irradiação anual */}
        <Card className="relative">
          <div className="absolute top-3 right-3">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center space-x-2">
              <Sun className="h-4 w-4 text-orange-500" />
              <span>Irradiação Anual GHI</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{currentVersion.annualIrradiation}</span>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">kWh/m²/ano</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {currentVersion.sources.map((source) => (
                    <Badge key={source} variant="outline" className="text-xs">
                      {source}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sombreamento */}
        <Card className="relative">
          <div className="absolute top-3 right-3">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center space-x-2">
              <Cloud className="h-4 w-4 text-gray-500" />
              <span>Sombreamento</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Índice</span>
                <span className="font-medium">0.15</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Perda estimada</span>
                <span className="font-medium text-red-600">8%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estimativa de produção */}
        <Card className="border-orange-200 bg-orange-50 relative">
          <div className="absolute top-3 right-3">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center space-x-2">
              <Zap className="h-4 w-4 text-orange-500" />
              <span>Estimativa de Produção</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <span className="text-3xl font-bold text-orange-600">
                {currentVersion.estimatedProduction.toLocaleString()}
              </span>
              <p className="text-sm text-orange-700 mt-1">kWh/ano</p>
            </div>
          </CardContent>
        </Card>

        {/* Veredicto */}
        <Card className={`border-2 ${
          currentVersion.verdict === "Apto" ? "border-green-200 bg-green-50" :
          currentVersion.verdict === "Parcial" ? "border-yellow-200 bg-yellow-50" :
          "border-red-200 bg-red-50"
        } relative`}>
          <div className="absolute top-3 right-3">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center space-x-2">
              {getVerdictIcon()}
              <span>Veredicto Final</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Badge className={getVerdictColor()}>
                {currentVersion.verdict}
              </Badge>
              
              <div className="space-y-1">
                <p className="text-xs font-medium">Baseado em:</p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-xs">
                    Irradiação {currentVersion.annualIrradiation > 1600 ? 'alta' : 'moderada'}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Área {currentVersion.usableArea > 80 ? 'suficiente' : 'limitada'}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Sombreamento baixo
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informação sobre congelamento */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <Lock className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-blue-800">Resultados Congelados</p>
              <p className="text-blue-600 mt-1">
                Estes dados foram calculados em {formatDate(currentVersion.date)} e não podem ser editados. 
                Use &ldquo;Reprocessar&rdquo; para gerar novos resultados.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}