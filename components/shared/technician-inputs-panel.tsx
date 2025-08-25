"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Calculator, Settings, DollarSign, Zap, Clock, TrendingUp } from "lucide-react";
import { TechnicianInputs, calculateSolarProduction, SolarCalculationParams, classifyVerdict } from "@/lib/solar-calculations";

interface TechnicianInputsPanelProps {
  initialInputs?: TechnicianInputs;
  analysisData: {
    annual_irradiation: number;
    usable_area: number;
    shading_index: number;
    coordinates: [number, number];
  };
  onInputsChange?: (inputs: TechnicianInputs) => void;
  onRecalculate?: (result: {
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
  }) => void;
  isLocked?: boolean;
}

export function TechnicianInputsPanel({
  initialInputs,
  analysisData,
  onInputsChange,
  onRecalculate,
  isLocked = false
}: TechnicianInputsPanelProps) {
  const [inputs, setInputs] = useState<TechnicianInputs>(initialInputs || {
    panel_count: null,
    energy_cost_per_kwh: null,
    solar_incentives: null,
    installation_cost_per_watt: null,
    panel_capacity_watts: 550,
    show_advanced_settings: false,
    additional_details: null,
    system_lifetime_years: 25,
    dc_to_ac_conversion: 0.96,
    annual_degradation_rate: 0.6,
    annual_energy_cost_increase: 5.0,
    discount_rate: 6.0
  });

  const [calculatedResults, setCalculatedResults] = useState<{
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

  // Auto-calculate when inputs change
  useEffect(() => {
    if (inputs.panel_count && inputs.panel_capacity_watts && analysisData) {
      const calculationParams: SolarCalculationParams = {
        ghi_kwh_m2_year: analysisData.annual_irradiation,
        usable_area_m2: analysisData.usable_area,
        shade_factor: 1 - analysisData.shading_index, // Convert to shade factor
        latitude: analysisData.coordinates[1],
        technicianInputs: inputs
      };

      const result = calculateSolarProduction(calculationParams);
      
      // Calculate verdict
      const verdict = classifyVerdict({
        usable_area_m2: analysisData.usable_area,
        shade_index: analysisData.shading_index,
        is_brazil: true,
        lat: analysisData.coordinates[1]
      });

      const fullResult = {
        ...result,
        verdict: verdict.verdict,
        reasons: verdict.reasons,
        recommendations: verdict.recommendations,
        warnings: verdict.warnings
      };

      setCalculatedResults(fullResult);
      onRecalculate?.(fullResult);
    }
  }, [inputs, analysisData, onRecalculate]);

  const handleInputChange = (field: keyof TechnicianInputs, value: string | number | boolean | null) => {
    const newInputs = { ...inputs, [field]: value };
    setInputs(newInputs);
    onInputsChange?.(newInputs);
  };

  const handleNumberInput = (field: keyof TechnicianInputs, value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    handleInputChange(field, numValue);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-blue-600" />
          Dados do Técnico
        </CardTitle>
        {!isLocked && (
          <p className="text-sm text-muted-foreground">
            Configure os parâmetros para cálculo personalizado
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* System Configuration */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="panel_count" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Quantidade de Painéis
            </Label>
            <Input
              id="panel_count"
              type="number"
              value={inputs.panel_count || ''}
              onChange={(e) => handleNumberInput('panel_count', e.target.value)}
              placeholder="Ex: 4"
              disabled={isLocked}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="panel_capacity_watts">
              Potência por Painel (W)
            </Label>
            <Input
              id="panel_capacity_watts"
              type="number"
              value={inputs.panel_capacity_watts || ''}
              onChange={(e) => handleNumberInput('panel_capacity_watts', e.target.value)}
              placeholder="Ex: 550"
              disabled={isLocked}
            />
          </div>
        </div>

        {/* Financial Parameters */}
        <Separator />
        <div className="space-y-3">
          <h4 className="flex items-center gap-2 font-medium">
            <DollarSign className="h-4 w-4 text-green-600" />
            Parâmetros Financeiros
          </h4>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="energy_cost">Custo da Energia (R$/kWh)</Label>
              <Input
                id="energy_cost"
                type="number"
                step="0.01"
                value={inputs.energy_cost_per_kwh || ''}
                onChange={(e) => handleNumberInput('energy_cost_per_kwh', e.target.value)}
                placeholder="Ex: 0.75"
                disabled={isLocked}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="installation_cost">Custo Instalação (R$/W)</Label>
              <Input
                id="installation_cost"
                type="number"
                step="0.01"
                value={inputs.installation_cost_per_watt || ''}
                onChange={(e) => handleNumberInput('installation_cost_per_watt', e.target.value)}
                placeholder="Ex: 4.50"
                disabled={isLocked}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="solar_incentives">Incentivos (%)</Label>
              <Input
                id="solar_incentives"
                type="number"
                step="0.1"
                value={inputs.solar_incentives || ''}
                onChange={(e) => handleNumberInput('solar_incentives', e.target.value)}
                placeholder="Ex: 10"
                disabled={isLocked}
              />
            </div>
          </div>
        </div>

        {/* Advanced Settings */}
        <Separator />
        <div className="flex items-center justify-between">
          <Label htmlFor="show_advanced" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configurações Avançadas
          </Label>
          <Switch
            id="show_advanced"
            checked={inputs.show_advanced_settings}
            onCheckedChange={(checked) => handleInputChange('show_advanced_settings', checked)}
            disabled={isLocked}
          />
        </div>

        {inputs.show_advanced_settings && (
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="system_lifetime">
                  <Clock className="h-4 w-4 inline mr-1" />
                  Vida Útil (anos)
                </Label>
                <Input
                  id="system_lifetime"
                  type="number"
                  value={inputs.system_lifetime_years || ''}
                  onChange={(e) => handleNumberInput('system_lifetime_years', e.target.value)}
                  placeholder="25"
                  disabled={isLocked}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dc_to_ac">Eficiência Inversor (%)</Label>
                <Input
                  id="dc_to_ac"
                  type="number"
                  step="0.01"
                  value={inputs.dc_to_ac_conversion ? inputs.dc_to_ac_conversion * 100 : ''}
                  onChange={(e) => handleNumberInput('dc_to_ac_conversion', parseFloat(e.target.value) / 100)}
                  placeholder="96"
                  disabled={isLocked}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="degradation">Degradação Anual (%)</Label>
                <Input
                  id="degradation"
                  type="number"
                  step="0.1"
                  value={inputs.annual_degradation_rate || ''}
                  onChange={(e) => handleNumberInput('annual_degradation_rate', e.target.value)}
                  placeholder="0.6"
                  disabled={isLocked}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="energy_increase">
                  <TrendingUp className="h-4 w-4 inline mr-1" />
                  Aumento Energia (%/ano)
                </Label>
                <Input
                  id="energy_increase"
                  type="number"
                  step="0.1"
                  value={inputs.annual_energy_cost_increase || ''}
                  onChange={(e) => handleNumberInput('annual_energy_cost_increase', e.target.value)}
                  placeholder="5.0"
                  disabled={isLocked}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discount_rate">Taxa Desconto (%)</Label>
                <Input
                  id="discount_rate"
                  type="number"
                  step="0.1"
                  value={inputs.discount_rate || ''}
                  onChange={(e) => handleNumberInput('discount_rate', e.target.value)}
                  placeholder="6.0"
                  disabled={isLocked}
                />
              </div>
            </div>
          </div>
        )}

        {/* Additional Details */}
        <div className="space-y-2">
          <Label htmlFor="additional_details">Observações Técnicas</Label>
          <Textarea
            id="additional_details"
            value={inputs.additional_details || ''}
            onChange={(e) => handleInputChange('additional_details', e.target.value)}
            placeholder="Observações adicionais sobre a instalação..."
            disabled={isLocked}
          />
        </div>

        {/* Results Preview */}
        {calculatedResults && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Resultado do Cálculo:</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Produção Anual:</span>
                <span className="font-medium ml-2">{calculatedResults.annual_production_kwh.toLocaleString()} kWh</span>
              </div>
              <div>
                <span className="text-muted-foreground">Potência Total:</span>
                <span className="font-medium ml-2">
                  {inputs.panel_count && inputs.panel_capacity_watts 
                    ? `${((inputs.panel_count * inputs.panel_capacity_watts) / 1000).toFixed(1)} kWp`
                    : 'N/A'
                  }
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Classificação:</span>
                <span className={`font-medium ml-2 ${
                  calculatedResults.verdict === 'Apto' ? 'text-green-600' : 
                  calculatedResults.verdict === 'Parcial' ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {calculatedResults.verdict}
                </span>
              </div>
              {calculatedResults.financial_data && (
                <div>
                  <span className="text-muted-foreground">Payback:</span>
                  <span className="font-medium ml-2">
                    {calculatedResults.financial_data.simple_payback_years.toFixed(1)} anos
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {isLocked && (
          <div className="text-xs text-muted-foreground text-center p-2 bg-muted rounded">
            Dados congelados. Para editar, use o modo de edição da análise.
          </div>
        )}
      </CardContent>
    </Card>
  );
}