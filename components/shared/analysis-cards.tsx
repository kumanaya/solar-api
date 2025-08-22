// Shared Analysis Cards Components
// These components can be used in both analysis results and detail pages

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
  Info,
  Lock,
  Grid3X3,
  Clock,
  Leaf,
  Shield,
  Settings,
  Lightbulb,
  AlertCircle,
} from "lucide-react";

// Types for card props
export interface AreaCardProps {
  usableArea: number;
  areaSource: string;
  footprints?: Array<{ area: number; isActive: boolean }>;
  usageFactor?: number;
  onUsageFactorChange?: (value: number) => void;
  isEditable?: boolean;
  isLocked?: boolean;
}

export interface IrradiationCardProps {
  annualIrradiation: number;
  irradiationSource: string;
  sources?: string[];
  isLocked?: boolean;
}

export interface ShadingCardProps {
  shadingIndex: number;
  shadingLoss: number;
  isLocked?: boolean;
  showDetails?: boolean;
}

export interface ProductionCardProps {
  estimatedProduction: number;
  usableArea?: number;
  isLocked?: boolean;
  showDetails?: boolean;
}

export interface VerdictCardProps {
  verdict: "Apto" | "Parcial" | "Não apto";
  reasons: string[];
  isLocked?: boolean;
}

export interface SystemConfigCardProps {
  usableArea: number;
  isLocked?: boolean;
}

export interface SystemLifetimeCardProps {
  estimatedProduction: number;
  isLocked?: boolean;
}

export interface ConfidenceCardProps {
  confidence: string;
  coverage: {
    google: boolean;
    fallback?: string;
    dataQuality: string;
  };
  isLocked?: boolean;
}

export interface TechnicalDetailsCardProps {
  estimatedProductionAC: number;
  estimatedProductionDC: number;
  estimatedProductionYear1: number;
  estimatedProductionYear25: number;
  temperatureLosses: number;
  degradationFactor: number;
  effectivePR: number;
  isLocked?: boolean;
}

export interface RecommendationsCardProps {
  recommendations: string[];
  isLocked?: boolean;
}

export interface WarningsCardProps {
  warnings: string[];
  isLocked?: boolean;
}

// Utility functions
const getVerdictIcon = (verdict: string) => {
  switch (verdict) {
    case "Apto":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "Parcial":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case "Não apto":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-gray-500" />;
  }
};

const getVerdictColor = (verdict: string) => {
  switch (verdict) {
    case "Apto":
      return "bg-green-100 text-green-800 hover:bg-green-100";
    case "Parcial":
      return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
    case "Não apto":
      return "variant-destructive";
    default:
      return "bg-gray-100 text-gray-800 hover:bg-gray-100";
  }
};

// Card Components

export function AreaCard({
  usableArea,
  areaSource,
  footprints,
  usageFactor,
  onUsageFactorChange,
  isEditable = false,
  isLocked = false,
}: AreaCardProps) {
  const displayAreaSource = () => {
    switch (areaSource) {
      case "google":
        return "Google";
      case "footprint":
        return "Footprint";
      case "manual":
        return "Manual";
      case "estimate":
        return "Estimada";
      default:
        return areaSource;
    }
  };

  return (
    <Card className="relative">
      {isLocked && (
        <div className="absolute top-3 right-3">
          <Lock className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center space-x-2">
          <Square className="h-4 w-4 text-blue-500" />
          <span>Área Útil</span>
          {!isLocked && (
            <div className="group relative">
              <Info className="h-3 w-3 text-muted-foreground" />
              <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block">
                <div className="bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                  Área bruta × fator de uso
                  <div className="absolute top-full left-2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-black"></div>
                </div>
              </div>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold">{usableArea}m²</span>
          <Badge variant="outline">{displayAreaSource()}</Badge>
        </div>

        {isEditable &&
          footprints &&
          footprints.length > 0 &&
          usageFactor !== undefined &&
          onUsageFactorChange && (
            <div className="space-y-2">
              <Label htmlFor="usage-factor" className="text-xs">
                Fator de uso ({Math.round(usageFactor * 100)}%)
              </Label>
              <Input
                id="usage-factor"
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={usageFactor}
                onChange={(e) => onUsageFactorChange(Number(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Área bruta:{" "}
                {footprints.find((fp) => fp.isActive)?.area ||
                  footprints[0]?.area}
                m²
              </p>
            </div>
          )}

        {isLocked &&
          footprints &&
          footprints.length > 0 &&
          usageFactor !== undefined && (
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Área bruta do polígono:</span>
                <span className="font-medium">
                  {footprints.find((fp) => fp.isActive)?.area ||
                    footprints[0]?.area ||
                    0}
                  m²
                </span>
              </div>
              <div className="flex justify-between">
                <span>Fator de uso aplicado:</span>
                <span className="font-medium">
                  {(usageFactor * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Área útil resultante:</span>
                <span className="font-medium">{usableArea}m²</span>
              </div>
              <div className="flex justify-between">
                <span>Margem de erro estimada:</span>
                <span className="font-medium text-orange-600">±5%</span>
              </div>
            </div>
          )}
      </CardContent>
    </Card>
  );
}

export function IrradiationCard({
  annualIrradiation,
  irradiationSource,
  sources,
  isLocked = false,
}: IrradiationCardProps) {
  const getClassification = () => {
    if (annualIrradiation > 1800) return "Excelente";
    if (annualIrradiation > 1600) return "Boa";
    if (annualIrradiation > 1400) return "Moderada";
    return "Baixa";
  };

  return (
    <Card className="relative">
      {isLocked && (
        <div className="absolute top-3 right-3">
          <Lock className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center space-x-2">
          <Sun className="h-4 w-4 text-orange-500" />
          <span>Irradiação Anual GHI</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold">{annualIrradiation}</span>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">kWh/m²/ano</p>
            <Badge variant="outline" className="text-xs">
              {sources ? sources.join(" + ") : irradiationSource}
            </Badge>
          </div>
        </div>

        {isLocked && (
          <div className="space-y-2 text-sm text-muted-foreground mt-3">
            <div className="flex justify-between">
              <span>Horas médias de sol pleno/dia:</span>
              <span className="font-medium">
                {(annualIrradiation / 365).toFixed(1)}h
              </span>
            </div>
            <div className="flex justify-between">
              <span>Classificação regional:</span>
              <Badge variant="outline" className="text-xs">
                {getClassification()}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ShadingCard({
  shadingIndex = 0,
  shadingLoss = 0,
  isLocked = false,
  showDetails = false,
}: ShadingCardProps) {
  const getImpactClass = () => {
    if (shadingLoss < 10) return "Baixo impacto";
    if (shadingLoss < 20) return "Impacto moderado";
    return "Alto impacto";
  };

  return (
    <Card className="relative">
      {isLocked && (
        <div className="absolute top-3 right-3">
          <Lock className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
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
            <span className="font-medium">
              {typeof shadingIndex === "number"
                ? shadingIndex.toFixed(2)
                : "N/A"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Perda estimada</span>
            <span className="font-medium text-red-600">
              {typeof shadingLoss === "number" ? shadingLoss + "%" : "N/A"}
            </span>
          </div>

          {showDetails && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Classificação:
                </span>
                <Badge variant="outline" className="text-xs">
                  {getImpactClass()}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Período crítico:
                </span>
                <span className="font-medium text-xs">9h-15h</span>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ProductionCard({ 
  estimatedProduction = 0, 
  usableArea,
  isLocked = false, 
  showDetails = false 
}: ProductionCardProps) {
  return (
    <Card className="relative">
      {isLocked && (
        <div className="absolute top-3 right-3">
          <Lock className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center space-x-2">
          <Zap className="h-4 w-4 text-orange-500" />
          <span>Estimativa de Produção</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center">
          <span className="text-3xl font-bold">
            {typeof estimatedProduction === "number"
              ? estimatedProduction.toLocaleString()
              : "N/A"}
          </span>
          <p className="text-sm text-muted-foreground mt-1">kWh/ano</p>
        </div>

        {showDetails && (
          <div className="space-y-2 text-sm text-muted-foreground mt-3">
            <div className="flex justify-between">
              <span>Produção mensal estimada:</span>
              <span className="font-medium">
                {typeof estimatedProduction === "number"
                  ? Math.round(estimatedProduction / 12).toLocaleString() + " kWh"
                  : "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Economia de CO₂ evitado:</span>
              <div className="text-right">
                <span className="font-medium text-green-600">
                  {typeof estimatedProduction === "number"
                    ? (estimatedProduction * 0.4).toFixed(0) + " kg/ano"
                    : "N/A"}
                </span>
                <div className="flex items-center space-x-1 mt-1">
                  <Leaf className="h-3 w-3 text-green-500" />
                  <span className="text-xs">
                    {typeof estimatedProduction === "number"
                      ? `Equivale a ${Math.round(
                          (estimatedProduction * 0.4) / 22
                        )} árvores`
                      : "Equivale a N/A árvores"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function VerdictCard({
  verdict,
  reasons,
  isLocked = false,
}: VerdictCardProps) {
  return (
    <Card className="relative">
      {isLocked && (
        <div className="absolute top-3 right-3">
          <Lock className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center space-x-2">
          {getVerdictIcon(verdict)}
          <span>Veredicto</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {verdict === "Não apto" ? (
            <Badge variant="destructive">{verdict}</Badge>
          ) : (
            <Badge className={getVerdictColor(verdict)}>{verdict}</Badge>
          )}

          {reasons.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium">Razões:</p>
              <div className="flex flex-wrap gap-1">
                {reasons.map((reason, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {reason}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function SystemConfigCard({
  usableArea,
  isLocked = false,
}: SystemConfigCardProps) {
  const maxPanels = Math.floor(usableArea / 2.5);
  const totalPower = maxPanels * 0.55;

  return (
    <Card className="relative">
      {isLocked && (
        <div className="absolute top-3 right-3">
          <Lock className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
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
              <span className="text-muted-foreground">
                Número máximo de painéis:
              </span>
              <span className="font-medium">{maxPanels}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Potência total instalada:
              </span>
              <span className="font-medium">{totalPower.toFixed(1)} kWp</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Painel sugerido:</span>
              <Badge variant="outline" className="text-xs">
                550W
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Área por painel:</span>
              <span className="font-medium">2.5m²</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SystemLifetimeCard({
  estimatedProduction,
  isLocked = false,
}: SystemLifetimeCardProps) {
  const lifetimeYears = 25;
  const totalProduction = estimatedProduction * lifetimeYears;

  return (
    <Card className="relative">
      {isLocked && (
        <div className="absolute top-3 right-3">
          <Lock className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center space-x-2">
          <Clock className="h-4 w-4 text-indigo-500" />
          <span>Vida Útil do Sistema</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-center">
            <span className="text-3xl font-bold">{lifetimeYears}</span>
            <p className="text-sm text-muted-foreground mt-1">anos</p>
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>Produção total estimada:</span>
              <span className="font-medium">
                {totalProduction.toLocaleString()} kWh
              </span>
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
  );
}

export function ConfidenceCard({
  confidence,
  coverage,
  isLocked = false,
}: ConfidenceCardProps) {
  const getConfidenceColor = () => {
    if (!confidence) return "bg-gray-100 text-gray-800 hover:bg-gray-100";

    switch (confidence.toLowerCase()) {
      case "alta":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "média":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      case "baixa":
        return "bg-orange-100 text-orange-800 hover:bg-orange-100";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100";
    }
  };

  return (
    <Card className="relative">
      {isLocked && (
        <div className="absolute top-3 right-3">
          <Lock className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center space-x-2">
          <Shield className="h-4 w-4 text-blue-500" />
          <span>Nível de Confiança</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold">{confidence || "N/A"}</span>
            <Badge className={getConfidenceColor()}>
              {confidence || "N/A"}
            </Badge>
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>Fonte principal:</span>
              <Badge variant="outline" className="text-xs">
                {coverage?.google
                  ? "Google Solar API"
                  : coverage?.fallback || "PVGIS + NASA"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Qualidade dos dados:</span>
              <Badge variant="outline" className="text-xs">
                {coverage?.dataQuality === "estimated"
                  ? "Estimada"
                  : coverage?.dataQuality || "N/A"}
              </Badge>
            </div>
            {coverage && !coverage.google && (
              <div className="flex items-start space-x-2 mt-2 p-2 bg-yellow-50 rounded-md">
                <AlertTriangle className="h-3 w-3 text-yellow-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-yellow-700">
                  Dados baseados em estimativas. Recomenda-se validação com
                  medições locais.
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TechnicalDetailsCard({
  estimatedProductionAC,
  estimatedProductionDC,
  estimatedProductionYear1,
  estimatedProductionYear25,
  temperatureLosses,
  degradationFactor,
  effectivePR,
  isLocked = false,
}: TechnicalDetailsCardProps) {
  return (
    <Card className="relative">
      {isLocked && (
        <div className="absolute top-3 right-3">
          <Lock className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center space-x-2">
          <Settings className="h-4 w-4 text-purple-500" />
          <span>Detalhes Técnicos</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <span className="text-muted-foreground">Produção AC:</span>
              <p className="font-medium">
                {estimatedProductionAC.toLocaleString()} kWh/ano
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground">Produção DC:</span>
              <p className="font-medium">
                {estimatedProductionDC.toLocaleString()} kWh/ano
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <span className="text-muted-foreground">Ano 1:</span>
              <p className="font-medium">
                {estimatedProductionYear1.toLocaleString()} kWh
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground">Ano 25:</span>
              <p className="font-medium">
                {estimatedProductionYear25.toLocaleString()} kWh
              </p>
            </div>
          </div>

          <div className="space-y-2 text-sm border-t pt-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">PR efetivo:</span>
              <span className="font-medium">
                {(effectivePR * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Perdas térmicas:</span>
              <span className="font-medium text-orange-600">
                {temperatureLosses}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Fator de degradação (25a):
              </span>
              <span className="font-medium">
                {(degradationFactor * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function RecommendationsCard({
  recommendations,
  isLocked = false,
}: RecommendationsCardProps) {
  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  return (
    <Card className="relative">
      {isLocked && (
        <div className="absolute top-3 right-3">
          <Lock className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center space-x-2">
          <Lightbulb className="h-4 w-4 text-yellow-500" />
          <span>Recomendações</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {recommendations.map((recommendation, index) => (
            <div
              key={index}
              className="flex items-start space-x-2 p-2 bg-blue-50 rounded-md"
            >
              <CheckCircle className="h-3 w-3 text-blue-600 mt-1 flex-shrink-0" />
              <p className="text-sm text-blue-800">{recommendation}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function WarningsCard({
  warnings,
  isLocked = false,
}: WarningsCardProps) {
  if (!warnings || warnings.length === 0) {
    return null;
  }

  return (
    <Card className="relative">
      {isLocked && (
        <div className="absolute top-3 right-3">
          <Lock className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 text-orange-500" />
          <span>Avisos Importantes</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {warnings.map((warning, index) => (
            <div
              key={index}
              className="flex items-start space-x-2 p-2 bg-orange-50 rounded-md border-l-2 border-orange-300"
            >
              <AlertTriangle className="h-3 w-3 text-orange-600 mt-1 flex-shrink-0" />
              <p className="text-sm text-orange-800">{warning}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
