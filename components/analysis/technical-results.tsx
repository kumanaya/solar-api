"use client";

import { useAnalysis } from "./analysis-context";
import { useState } from "react";
import {
  AreaCard,
  IrradiationCard,
  ShadingCard,
  ProductionCard,
  VerdictCard,
  SystemConfigCard,
  SystemLifetimeCard,
  ImageryInfoCard,
  FinancialAnalysisCard
} from "@/components/shared/analysis-cards";

export function TechnicalResults() {
  const { data, updateData, isLoading, hasAnalysisResults } = useAnalysis();
  const [localUsageFactor, setLocalUsageFactor] = useState(data.usageFactor);
  
  // Só renderizar se tivermos resultados de análise
  if (!hasAnalysisResults) return null;

  const handleUsageFactorChange = (value: number) => {
    setLocalUsageFactor(value);
    updateData({ 
      usageFactor: value,
      usableArea: Math.floor(data.footprints[0]?.area * value || 0),
      estimatedProduction: Math.floor((data.footprints[0]?.area * value || 0) * data.annualIrradiation * 0.15)
    });
  };


  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-20 bg-gray-200 rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AreaCard
        usableArea={data.usableArea}
        areaSource={data.areaSource}
        footprints={data.footprints}
        usageFactor={localUsageFactor}
        onUsageFactorChange={handleUsageFactorChange}
        isEditable={true}
      />

      <IrradiationCard
        annualIrradiation={data.annualIrradiation}
        irradiationSource={data.irradiationSource}
        sources={data.sources}
      />

      <ShadingCard
        shadingIndex={data.shadingIndex}
        shadingLoss={data.shadingLoss}
        showDetails={true}
      />

      <ProductionCard
        estimatedProduction={data.estimatedProduction}
        usableArea={data.usableArea}
        showDetails={true}
      />

      <SystemConfigCard
        usableArea={data.usableArea}
      />

      <SystemLifetimeCard
        estimatedProduction={data.estimatedProduction}
      />

      <FinancialAnalysisCard
        technicianInputs={data.technicianInputs}
        estimatedProduction={data.estimatedProduction}
      />

      <VerdictCard
        verdict={data.verdict}
        reasons={data.reasons}
      />

      <ImageryInfoCard
        googleSolarData={data.googleSolarData}
      />
    </div>
  );
}