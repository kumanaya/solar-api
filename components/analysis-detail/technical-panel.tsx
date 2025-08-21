"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Square, Sun, Cloud, Zap, CheckCircle, AlertTriangle, XCircle, Calendar, FileText, MapPin, Image, Timer, Leaf, Grid3X3, Clock, DollarSign } from "lucide-react";
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
        return "variant-destructive";
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
      <div className="p-4 border-b bg-muted/50">
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
        {/* Metadados */}
        <Card className="relative">
          <div className="absolute top-3 right-3">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-blue-500" />
              <span>Localização e Metadados</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Coordenadas:</span>
                  <span className="font-mono text-xs">
                    {analysis.coordinates[0].toFixed(6)}, {analysis.coordinates[1].toFixed(6)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Qualidade da imagem:</span>
                  <Badge variant="outline" className="text-xs">
                    {analysis.sources.google ? 'Alta' : 'Estimada'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fonte principal:</span>
                  <Badge variant="outline" className="text-xs">
                    {analysis.sources.google ? 'Google Solar API' : 'PVGIS + NASA'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Área útil */}
        <Card className="relative">
          <div className="absolute top-3 right-3">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center space-x-2">
              <Square className="h-4 w-4 text-blue-500" />
              <span>Área do Telhado</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{currentVersion.usableArea}m²</span>
                <Badge variant="outline">
                  {analysis.areaSource === 'google' ? 'Google' : 
                   analysis.areaSource === 'footprint' ? 'Footprint' : 
                   analysis.areaSource === 'manual' ? 'Manual' : 'Estimada'}
                </Badge>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Área bruta do polígono:</span>
                  <span className="font-medium">{analysis.polygon.area || analysis.footprints.find(fp => fp.isActive)?.area || 0}m²</span>
                </div>
                <div className="flex justify-between">
                  <span>Fator de uso aplicado:</span>
                  <span className="font-medium">{(currentVersion.parameters.usageFactor * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Área útil resultante:</span>
                  <span className="font-medium">{currentVersion.usableArea}m²</span>
                </div>
                <div className="flex justify-between">
                  <span>Margem de erro estimada:</span>
                  <span className="font-medium text-orange-600">±5%</span>
                </div>
                {currentVersion.parameters.tiltEstimated && (
                  <div className="flex justify-between">
                    <span>Inclinação estimada:</span>
                    <span className="font-medium">{currentVersion.parameters.tiltEstimated}°</span>
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
              <span>Irradiação Solar</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
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
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Horas médias de sol pleno/dia:</span>
                  <span className="font-medium">{(currentVersion.annualIrradiation / 365).toFixed(1)}h</span>
                </div>
                <div className="flex justify-between">
                  <span>Classificação regional:</span>
                  <Badge variant="outline" className="text-xs">
                    {currentVersion.annualIrradiation > 1800 ? 'Excelente' : 
                     currentVersion.annualIrradiation > 1600 ? 'Boa' : 
                     currentVersion.annualIrradiation > 1400 ? 'Moderada' : 'Baixa'}
                  </Badge>
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
            <div className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Índice de sombreamento médio:</span>
                  <span className="font-medium">{currentVersion.shadingIndex?.toFixed(2) || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Perda percentual estimada:</span>
                  <span className="font-medium text-red-600">{currentVersion.shadingLoss?.toFixed(0) || 'N/A'}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Classificação:</span>
                  <Badge variant="outline" className="text-xs">
                    {(currentVersion.shadingLoss || 0) < 10 ? 'Baixo impacto' : 
                     (currentVersion.shadingLoss || 0) < 20 ? 'Impacto moderado' : 'Alto impacto'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Período crítico:</span>
                  <span className="font-medium text-xs">9h-15h</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estimativa de produção */}
        <Card className="relative">
          <div className="absolute top-3 right-3">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center space-x-2">
              <Zap className="h-4 w-4 text-orange-500" />
              <span>Produção de Energia</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-center">
                <span className="text-3xl font-bold">
                  {currentVersion.estimatedProduction.toLocaleString()}
                </span>
                <p className="text-sm text-muted-foreground mt-1">kWh/ano</p>
              </div>
              
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Produção mensal estimada:</span>
                  <span className="font-medium">{Math.round(currentVersion.estimatedProduction / 12).toLocaleString()} kWh</span>
                </div>
                <div className="flex justify-between">
                  <span>Economia de CO₂ evitado:</span>
                  <div className="text-right">
                    <span className="font-medium text-green-600">
                      {(currentVersion.estimatedProduction * 0.4).toFixed(0)} kg/ano
                    </span>
                    <div className="flex items-center space-x-1 mt-1">
                      <Leaf className="h-3 w-3 text-green-500" />
                      <span className="text-xs">Equivale a {Math.round(currentVersion.estimatedProduction * 0.4 / 22)} árvores</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configurações de Painéis Sugeridas */}
        <Card className="relative">
          <div className="absolute top-3 right-3">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center space-x-2">
              <Grid3X3 className="h-4 w-4 text-purple-500" />
              <span>Configuração Sugerida</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Número máximo de painéis:</span>
                  <span className="font-medium">{Math.floor(currentVersion.usableArea / 2.5)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Potência total instalada:</span>
                  <span className="font-medium">{(Math.floor(currentVersion.usableArea / 2.5) * 0.55).toFixed(1)} kWp</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Painel sugerido:</span>
                  <Badge variant="outline" className="text-xs">550W</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Área por painel:</span>
                  <span className="font-medium">2.5m²</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vida Útil do Sistema */}
        <Card className="relative">
          <div className="absolute top-3 right-3">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center space-x-2">
              <Clock className="h-4 w-4 text-indigo-500" />
              <span>Vida Útil do Sistema</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-center">
                <span className="text-3xl font-bold">25</span>
                <p className="text-sm text-muted-foreground mt-1">anos</p>
              </div>
              
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Produção total estimada:</span>
                  <span className="font-medium">{(currentVersion.estimatedProduction * 25).toLocaleString()} kWh</span>
                </div>
                <div className="flex justify-between">
                  <span>Degradação anual:</span>
                  <span className="font-medium">0.5%</span>
                </div>
                <div className="flex justify-between">
                  <span>Eficiência aos 25 anos:</span>
                  <span className="font-medium">87.5%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Veredicto */}
        <Card className="relative">
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
              {currentVersion.verdict === "Não apto" ? (
                <Badge variant="destructive">
                  {currentVersion.verdict}
                </Badge>
              ) : (
                <Badge className={getVerdictColor()}>
                  {currentVersion.verdict}
                </Badge>
              )}
              
              <div className="space-y-1">
                {analysis.reasons && analysis.reasons.length > 0 ? (
                  <>
                    <p className="text-xs font-medium">Motivos:</p>
                    <div className="space-y-1">
                      {analysis.reasons.map((reason, index) => (
                        <Badge key={index} variant="outline" className="text-xs block w-fit">
                          {reason}
                        </Badge>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-medium">Baseado em:</p>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-xs">
                        Irradiação {currentVersion.annualIrradiation > 1600 ? 'alta' : 'moderada'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Área {currentVersion.usableArea > 80 ? 'suficiente' : 'limitada'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Sombreamento {(currentVersion.shadingLoss || 0) < 10 ? 'baixo' : (currentVersion.shadingLoss || 0) < 20 ? 'moderado' : 'alto'}
                      </Badge>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Nota técnica */}
        {analysis.technicalNote && (
          <Card className="relative">
            <div className="absolute top-3 right-3">
              <Lock className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center space-x-2">
                <FileText className="h-4 w-4 text-blue-500" />
                <span>Nota Técnica</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                {analysis.technicalNote}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Informação sobre congelamento */}
        <div className="bg-muted/50 border border-border rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <Lock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Resultados Congelados</p>
              <p className="text-muted-foreground mt-1">
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