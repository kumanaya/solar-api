"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings, ChevronDown, ChevronUp } from "lucide-react";
import { useAnalysis } from "./analysis-context";

interface TechnicianInputs {
  panel_count: number | null;
  energy_cost_per_kwh: number | null;
  solar_incentives: number | null;
  installation_cost_per_watt: number | null;
  panel_capacity_watts: number | null;
  show_advanced_settings: boolean;
  additional_details: string | null;
  // Novos campos avançados
  system_lifetime_years: number | null;
  dc_to_ac_conversion: number | null;
  annual_degradation_rate: number | null;
  annual_energy_cost_increase: number | null;
  discount_rate: number | null;
}

export function TechnicianInputsPanel() {
  const { data, updateData } = useAnalysis();
  const [localInputs, setLocalInputs] = useState<TechnicianInputs>(
    data.technicianInputs || {
      panel_count: null,
      energy_cost_per_kwh: null,
      solar_incentives: null,
      installation_cost_per_watt: null,
      panel_capacity_watts: null,
      show_advanced_settings: false,
      additional_details: null,
      system_lifetime_years: 25,
      dc_to_ac_conversion: 0.96,
      annual_degradation_rate: 0.6,
      annual_energy_cost_increase: 5.0,
      discount_rate: 6.0,
    }
  );

  const [showAdvanced, setShowAdvanced] = useState(localInputs.show_advanced_settings);

  const handleInputChange = (field: keyof TechnicianInputs, value: any) => {
    const newInputs = { ...localInputs, [field]: value };
    setLocalInputs(newInputs);
    
    // Update analysis context
    updateData({
      technicianInputs: newInputs
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const hasBasicInputs = localInputs.panel_count && localInputs.energy_cost_per_kwh && localInputs.panel_capacity_watts;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center space-x-2">
          <Settings className="h-5 w-5 text-green-500" />
          <span>Parâmetros da Instalação</span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure os parâmetros técnicos e financeiros para uma análise mais precisa
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          {/* Quantidade de painéis */}
          <div className="space-y-2">
            <Label htmlFor="panel-count" className="text-sm font-medium">
              Quantidade de painéis *
            </Label>
            <Input
              id="panel-count"
              type="number"
              placeholder="Ex: 10"
              value={localInputs.panel_count || ''}
              onChange={(e) => handleInputChange('panel_count', e.target.value ? Number(e.target.value) : null)}
              className="w-full"
            />
          </div>

          {/* Custo de energia por kWh */}
          <div className="space-y-2">
            <Label htmlFor="energy-cost" className="text-sm font-medium">
              Custo de energia por kWh *
            </Label>
            <Input
              id="energy-cost"
              type="number"
              step="0.01"
              placeholder="Ex: 0.75"
              value={localInputs.energy_cost_per_kwh || ''}
              onChange={(e) => handleInputChange('energy_cost_per_kwh', e.target.value ? Number(e.target.value) : null)}
              className="w-full"
            />
            {localInputs.energy_cost_per_kwh && (
              <p className="text-xs text-muted-foreground">
                {formatCurrency(localInputs.energy_cost_per_kwh)} por kWh
              </p>
            )}
          </div>

          {/* Capacidade do painel */}
          <div className="space-y-2">
            <Label htmlFor="panel-capacity" className="text-sm font-medium">
              Capacidade do painel (W) *
            </Label>
            <Input
              id="panel-capacity"
              type="number"
              placeholder="Ex: 550"
              value={localInputs.panel_capacity_watts || ''}
              onChange={(e) => handleInputChange('panel_capacity_watts', e.target.value ? Number(e.target.value) : null)}
              className="w-full"
            />
          </div>
        </div>

        {/* Incentivos solares */}
        <div className="space-y-2">
          <Label htmlFor="solar-incentives" className="text-sm font-medium">
            Incentivos solares (%)
          </Label>
          <Input
            id="solar-incentives"
            type="number"
            step="0.1"
            placeholder="Ex: 30"
            value={localInputs.solar_incentives || ''}
            onChange={(e) => handleInputChange('solar_incentives', e.target.value ? Number(e.target.value) : null)}
            className="w-full max-w-xs"
          />
        </div>

        {/* Custo de instalação por Watt */}
        <div className="space-y-2">
          <Label htmlFor="installation-cost" className="text-sm font-medium">
            Custo de instalação por Watt
          </Label>
          <Input
            id="installation-cost"
            type="number"
            step="0.01"
            placeholder="Ex: 4.50"
            value={localInputs.installation_cost_per_watt || ''}
            onChange={(e) => handleInputChange('installation_cost_per_watt', e.target.value ? Number(e.target.value) : null)}
            className="w-full max-w-xs"
          />
          {localInputs.installation_cost_per_watt && (
            <p className="text-xs text-muted-foreground">
              {formatCurrency(localInputs.installation_cost_per_watt)} por Watt
            </p>
          )}
        </div>

        {/* Configurações avançadas */}
        <div className="border-t pt-4">
          <Button
            variant="ghost"
            onClick={() => {
              const newShowAdvanced = !showAdvanced;
              setShowAdvanced(newShowAdvanced);
              handleInputChange('show_advanced_settings', newShowAdvanced);
            }}
            className="flex items-center space-x-2 text-sm"
          >
            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span>Configurações avançadas</span>
          </Button>

          {showAdvanced && (
            <div className="mt-4 space-y-4 bg-muted/50 p-4 rounded-lg">
              <div className="space-y-4">
                {/* Vida útil da instalação */}
                <div className="space-y-2">
                  <Label htmlFor="system-lifetime" className="text-sm font-medium">
                    Vida útil da instalação (anos)
                  </Label>
                  <Input
                    id="system-lifetime"
                    type="number"
                    placeholder="Ex: 25"
                    value={localInputs.system_lifetime_years || ''}
                    onChange={(e) => handleInputChange('system_lifetime_years', e.target.value ? Number(e.target.value) : null)}
                    className="w-full"
                  />
                </div>

                {/* Conversão CC para CA */}
                <div className="space-y-2">
                  <Label htmlFor="dc-to-ac" className="text-sm font-medium">
                    Conversão CC para CA (%)
                  </Label>
                  <Input
                    id="dc-to-ac"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 96"
                    value={localInputs.dc_to_ac_conversion ? (localInputs.dc_to_ac_conversion * 100) : ''}
                    onChange={(e) => handleInputChange('dc_to_ac_conversion', e.target.value ? Number(e.target.value) / 100 : null)}
                    className="w-full"
                  />
                </div>

                {/* Queda de eficiência do painel por ano */}
                <div className="space-y-2">
                  <Label htmlFor="degradation-rate" className="text-sm font-medium">
                    Queda de eficiência do painel por ano (%)
                  </Label>
                  <Input
                    id="degradation-rate"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 0.6"
                    value={localInputs.annual_degradation_rate || ''}
                    onChange={(e) => handleInputChange('annual_degradation_rate', e.target.value ? Number(e.target.value) : null)}
                    className="w-full"
                  />
                </div>

                {/* Aumento do custo da energia por ano */}
                <div className="space-y-2">
                  <Label htmlFor="energy-increase" className="text-sm font-medium">
                    Aumento do custo da energia por ano (%)
                  </Label>
                  <Input
                    id="energy-increase"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 5.0"
                    value={localInputs.annual_energy_cost_increase || ''}
                    onChange={(e) => handleInputChange('annual_energy_cost_increase', e.target.value ? Number(e.target.value) : null)}
                    className="w-full"
                  />
                </div>

                {/* Taxa de desconto por ano */}
                <div className="space-y-2">
                  <Label htmlFor="discount-rate" className="text-sm font-medium">
                    Taxa de desconto por ano (%)
                  </Label>
                  <Input
                    id="discount-rate"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 6.0"
                    value={localInputs.discount_rate || ''}
                    onChange={(e) => handleInputChange('discount_rate', e.target.value ? Number(e.target.value) : null)}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mais detalhes */}
        <div className="space-y-2">
          <Label htmlFor="additional-details" className="text-sm font-medium">
            Observações adicionais
          </Label>
          <textarea
            id="additional-details"
            placeholder="Detalhes específicos do projeto, condições especiais, etc..."
            value={localInputs.additional_details || ''}
            onChange={(e) => handleInputChange('additional_details', e.target.value || null)}
            className="w-full min-h-[80px] px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            rows={3}
          />
        </div>

        {/* Resumo do sistema */}
        {hasBasicInputs && (
          <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
            <h4 className="text-sm font-semibold text-green-800 mb-3">Resumo do Sistema</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-green-700">
              <div className="flex justify-between">
                <span>Potência total:</span>
                <span className="font-semibold">
                  {((localInputs.panel_count! * localInputs.panel_capacity_watts!) / 1000).toFixed(1)} kWp
                </span>
              </div>
              {localInputs.installation_cost_per_watt && (
                <div className="flex justify-between">
                  <span>Custo estimado:</span>
                  <span className="font-semibold">
                    {formatCurrency(localInputs.panel_count! * localInputs.panel_capacity_watts! * localInputs.installation_cost_per_watt)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Custo energia atual:</span>
                <span className="font-semibold">
                  {formatCurrency(localInputs.energy_cost_per_kwh!)} / kWh
                </span>
              </div>
              {localInputs.solar_incentives && (
                <div className="flex justify-between">
                  <span>Incentivos aplicados:</span>
                  <span className="font-semibold">
                    {localInputs.solar_incentives}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}