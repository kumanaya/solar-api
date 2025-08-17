"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Square, 
  Sun, 
  Cloud, 
  Zap, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Info
} from "lucide-react";
import { useAnalysis } from "./analysis-context";
import { useState } from "react";

export function TechnicalResults() {
  const { data, updateData, isLoading } = useAnalysis();
  const [localUsageFactor, setLocalUsageFactor] = useState(data.usageFactor);

  const handleUsageFactorChange = (value: number) => {
    setLocalUsageFactor(value);
    updateData({ 
      usageFactor: value,
      usableArea: Math.floor(data.footprints[0]?.area * value || 0),
      estimatedProduction: Math.floor((data.footprints[0]?.area * value || 0) * data.annualIrradiation * 0.15)
    });
  };

  const getVerdictIcon = () => {
    switch (data.verdict) {
      case "Apto":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "Parcial":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "Não apto":
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getVerdictColor = () => {
    switch (data.verdict) {
      case "Apto":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "Parcial":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      case "Não apto":
        return "bg-red-100 text-red-800 hover:bg-red-100";
    }
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
      {/* Área útil */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center space-x-2">
            <Square className="h-4 w-4 text-blue-500" />
            <span>Área Útil</span>
            <div className="group relative">
              <Info className="h-3 w-3 text-muted-foreground" />
              <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block">
                <div className="bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                  Área bruta × fator de uso
                  <div className="absolute top-full left-2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-black"></div>
                </div>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold">{data.usableArea}m²</span>
            <Badge variant="outline">
              {data.areaSource === "footprint" ? "Footprint" : "Manual"}
            </Badge>
          </div>
          
          {data.footprints.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="usage-factor" className="text-xs">
                Fator de uso ({Math.round(localUsageFactor * 100)}%)
              </Label>
              <Input
                id="usage-factor"
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={localUsageFactor}
                onChange={(e) => handleUsageFactorChange(Number(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Área bruta: {data.footprints[0]?.area}m²
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Irradiação anual */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center space-x-2">
            <Sun className="h-4 w-4 text-orange-500" />
            <span>Irradiação Anual GHI</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold">{data.annualIrradiation}</span>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">kWh/m²/ano</p>
              <Badge variant="outline" className="text-xs">
                {data.irradiationSource}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sombreamento */}
      <Card>
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
              <span className="font-medium">{data.shadingIndex.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Perda estimada</span>
              <span className="font-medium text-red-600">{data.shadingLoss}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estimativa de produção */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center space-x-2">
            <Zap className="h-4 w-4 text-orange-500" />
            <span>Estimativa de Produção</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <span className="text-3xl font-bold text-orange-600">
              {data.estimatedProduction.toLocaleString()}
            </span>
            <p className="text-sm text-orange-700 mt-1">kWh/ano</p>
          </div>
        </CardContent>
      </Card>

      {/* Veredicto */}
      <Card className={`border-2 ${
        data.verdict === "Apto" ? "border-green-200 bg-green-50" :
        data.verdict === "Parcial" ? "border-yellow-200 bg-yellow-50" :
        "border-red-200 bg-red-50"
      }`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center space-x-2">
            {getVerdictIcon()}
            <span>Veredicto</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Badge className={getVerdictColor()}>
              {data.verdict}
            </Badge>
            
            <div className="space-y-1">
              <p className="text-xs font-medium">Razões:</p>
              <div className="flex flex-wrap gap-1">
                {data.reasons.map((reason, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {reason}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}