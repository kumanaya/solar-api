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
  FinancialAnalysisCard,
  RecommendationsCard,
  WarningsCard
} from "@/components/shared/analysis-cards";
import { TechnicianInputsPanel } from "@/components/shared/technician-inputs-panel";
import { TechnicianInputs } from "@/lib/solar-calculations";

export function TechnicalResults() {
  const { data, updateData, isLoading, hasAnalysisResults } = useAnalysis();
  const [localUsageFactor, setLocalUsageFactor] = useState(data.usageFactor);
  const [dynamicResults, setDynamicResults] = useState<{
    annual_production_kwh: number;
    annual_production_ac?: number;
    annual_production_dc?: number;
    verdict: string;
    reasons: string[];
    recommendations: string[];
    warnings: string[];
    financial_data?: {
      system_power_kw: number;
      installation_cost_gross: number;
      installation_cost_net: number;
      annual_savings_year_1: number;
      simple_payback_years: number;
      total_lifetime_savings: number;
      net_present_value: number;
      roi_percentage: number;
    };
  } | null>(null);
  
  // Só renderizar se tivermos resultados de análise
  if (!hasAnalysisResults) return null;

  const handleUsageFactorChange = (value: number) => {
    setLocalUsageFactor(value);
    const newUsableArea = Math.floor(data.footprints[0]?.area * value || 0);
    updateData({ 
      usageFactor: value,
      usableArea: newUsableArea
    });
    
    // Trigger recalculation if we have technician inputs
    if (data.technicianInputs && dynamicResults) {
      // The effect in TechnicianInputsPanel will handle recalculation
    }
  };


  const handleTechnicianInputsChange = (inputs: TechnicianInputs) => {
    updateData({
      technicianInputs: inputs
    });
  };

  const handleRecalculation = (results: {
    annual_production_kwh: number;
    annual_production_ac?: number;
    annual_production_dc?: number;
    verdict: string;
    reasons: string[];
    recommendations: string[];
    warnings: string[];
    financial_data?: {
      system_power_kw: number;
      installation_cost_gross: number;
      installation_cost_net: number;
      annual_savings_year_1: number;
      simple_payback_years: number;
      total_lifetime_savings: number;
      net_present_value: number;
      roi_percentage: number;
    };
  }) => {
    setDynamicResults(results);
    // Update the main data with recalculated values
    updateData({
      estimatedProduction: results.annual_production_kwh,
      verdict: results.verdict as "Apto" | "Parcial" | "Não apto",
      reasons: results.reasons,
      recommendations: results.recommendations,
      warnings: results.warnings,
      financialData: results.financial_data
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

  // Use dynamic results if available, otherwise use original data
  const displayData = dynamicResults ? {
    ...data,
    estimatedProduction: dynamicResults.annual_production_kwh,
    estimatedProductionAC: dynamicResults.annual_production_ac,
    estimatedProductionDC: dynamicResults.annual_production_dc,
    verdict: dynamicResults.verdict,
    reasons: dynamicResults.reasons,
    recommendations: dynamicResults.recommendations,
    warnings: dynamicResults.warnings,
    financialData: dynamicResults.financial_data
  } : data;

  return (
    <div className="space-y-4">
      {/* Technician Inputs Panel - First after analysis */}
      {hasAnalysisResults && (
        <TechnicianInputsPanel
          initialInputs={data.technicianInputs}
          analysisData={{
            annual_irradiation: data.annualIrradiation,
            usable_area: data.usableArea,
            shading_index: data.shadingIndex,
            coordinates: Array.isArray(data.coordinates) ? 
              data.coordinates : 
              [data.coordinates?.lng ?? 0, data.coordinates?.lat ?? 0] as [number, number]
          }}
          onInputsChange={handleTechnicianInputsChange}
          onRecalculate={handleRecalculation}
        />
      )}

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
        sources={[data.irradiationSource || 'PVGIS']}
      />

      <ShadingCard
        shadingIndex={data.shadingIndex}
        shadingLoss={data.shadingLoss}
        showDetails={true}
      />

      <ProductionCard
        estimatedProduction={displayData.estimatedProduction}
        usableArea={data.usableArea}
        estimatedProductionYear1={displayData.estimatedProductionAC}
        estimatedProductionYear25={displayData.estimatedProductionAC ? Math.round(displayData.estimatedProductionAC * 0.85) : undefined}
        showDetails={true}
      />

      <SystemConfigCard
        usableArea={data.usableArea}
        technicianInputs={data.technicianInputs ? {
          panel_count: data.technicianInputs.panel_count ?? undefined,
          panel_capacity_watts: data.technicianInputs.panel_capacity_watts ?? undefined,
        } : undefined}
      />

      <SystemLifetimeCard
        estimatedProduction={displayData.estimatedProduction}
      />

      <FinancialAnalysisCard
        technicianInputs={data.technicianInputs}
        estimatedProduction={displayData.estimatedProduction}
        financialData={displayData.financialData}
      />

      <VerdictCard
        verdict={displayData.verdict as "Apto" | "Parcial" | "Não apto"}
        reasons={displayData.reasons}
      />

      {displayData.recommendations && displayData.recommendations.length > 0 && (
        <RecommendationsCard
          recommendations={displayData.recommendations}
        />
      )}

      {displayData.warnings && displayData.warnings.length > 0 && (
        <WarningsCard
          warnings={displayData.warnings}
        />
      )}

      <ImageryInfoCard
        googleSolarData={data.googleSolarData}
      />
    </div>
  );
}