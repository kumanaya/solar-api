"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Calendar, FileText, MapPin } from "lucide-react";
import { useAnalysisDetail } from "./analysis-detail-context";
import {
  AreaCard,
  IrradiationCard,
  ShadingCard,
  ProductionCard,
  VerdictCard,
  SystemConfigCard,
  SystemLifetimeCard,
  ConfidenceCard,
  TechnicalDetailsCard,
  RecommendationsCard,
  WarningsCard
} from "@/components/shared/analysis-cards";

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

  const cv = analysis.currentVersion;

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
          <span>Calculado em {formatDate(cv.date)}</span>
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
                    {analysis.sources.google ? 'Google Solar API' : (cv.sources?.[0] || 'PVGIS + NASA')}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <ConfidenceCard
          confidence={cv.confidence}
          coverage={{
            google: analysis.sources.google,
            fallback: cv.sources?.[0] || 'PVGIS + NASA',
            dataQuality: analysis.sources.google ? 'alta' : 'estimated'
          }}
          isLocked={true}
        />

        <AreaCard
          usableArea={cv.usableArea}
          areaSource={analysis.footprints?.[0]?.source || "manual"}
          footprints={analysis.footprints}
          usageFactor={cv.parameters?.usageFactor}
          isLocked={true}
        />

        <IrradiationCard
          annualIrradiation={cv.annualIrradiation}
          irradiationSource={cv.sources?.[0] || 'PVGIS + NASA'}
          isLocked={true}
        />

        <ShadingCard
          shadingIndex={cv.shadingIndex || 0}
          shadingLoss={cv.shadingLoss || 0}
          isLocked={true}
          showDetails={true}
        />

        <ProductionCard
          estimatedProduction={cv.estimatedProduction}
          usableArea={cv.usableArea}
          isLocked={true}
          showDetails={true}
        />

        <TechnicalDetailsCard
          estimatedProductionAC={cv.estimatedProductionAC || 0}
          estimatedProductionDC={cv.estimatedProductionDC || 0}
          estimatedProductionYear1={cv.estimatedProductionYear1 || 0}
          estimatedProductionYear25={cv.estimatedProductionYear25 || 0}
          temperatureLosses={cv.temperatureLosses || 0}
          degradationFactor={cv.degradationFactor || 0}
          effectivePR={cv.effectivePR || 0}
          isLocked={true}
        />

        <SystemConfigCard
          usableArea={cv.usableArea}
          isLocked={true}
        />

        <SystemLifetimeCard
          estimatedProduction={cv.estimatedProduction}
          isLocked={true}
        />

        <RecommendationsCard
          recommendations={analysis.recommendations ?? []}
          isLocked={true}
        />

        <WarningsCard
          warnings={analysis.warnings ?? []}
          isLocked={true}
        />

        <VerdictCard
          verdict={cv.verdict}
          reasons={analysis.reasons}
          isLocked={true}
        />

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
                Estes dados foram calculados em {formatDate(cv.date)} e não podem ser editados.
                Use &ldquo;Reprocessar&rdquo; para gerar novos resultados.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
