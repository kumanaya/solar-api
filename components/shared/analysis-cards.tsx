// Shared Analysis Cards Components
// Atualizado: agora inclui badges de origem dos dados, margem de erro, fontes de irradiação/sombreamento etc.

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Coverage, Footprint } from "@/lib/types/analysis";
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
  footprints?: Footprint[];
  usageFactor?: number;
  onUsageFactorChange?: (value: number) => void;
  isEditable?: boolean;
  isLocked?: boolean;
  marginOfError?: string;
}

export interface IrradiationCardProps {
  annualIrradiation: number;
  irradiationSource: string;
  sources?: string[];
  isLocked?: boolean;
  irradiationSourceRaw?: string;
}

export interface ShadingCardProps {
  shadingIndex: number;
  shadingLoss: number;
  shadingSource?: string;
  isLocked?: boolean;
  showDetails?: boolean;
}

export interface ProductionCardProps {
  estimatedProduction: number;
  usableArea?: number;
  estimatedProductionYear1?: number;
  estimatedProductionYear25?: number;
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
  coverage: Coverage & {
    fallback?: string;
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
  temperature?: number;
  moduleEff?: number;
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

// Removido getVerdictColor pois não é mais usado

// Componentes base para padronização dos cards
interface BaseCardProps {
  icon: React.ReactNode;
  title: string;
  isLocked?: boolean;
  tooltip?: string;
  className?: string;
}

function BaseCard({
  icon,
  title,
  isLocked = false,
  tooltip,
  className,
  children,
}: BaseCardProps & { children: React.ReactNode }) {
  return (
    <Card className={`relative w-full ${className || ""}`}>
      {isLocked && (
        <div className="absolute top-3 right-3">
          <Lock className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center space-x-2">
          {icon}
          <span>{title}</span>
          {tooltip && (
            <div className="group relative">
              <Info className="h-3 w-3 text-muted-foreground" />
              <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50">
                <div className="bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                  {tooltip}
                  <div className="absolute top-full left-2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-black"></div>
                </div>
              </div>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

// Card Components
export function AreaCard({
  usableArea,
  areaSource,
  footprints,
  usageFactor,
  onUsageFactorChange,
  isEditable = false,
  isLocked = false,
  marginOfError,
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
    <BaseCard
      icon={<Square className="h-4 w-4 text-blue-500" />}
      title="Área Útil"
      isLocked={isLocked}
      tooltip={!isLocked ? "Área bruta × fator de uso" : undefined}
    >
      {/* Valor principal */}
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold">{usableArea}m²</span>
        <Badge variant="outline">{displayAreaSource()}</Badge>
      </div>

      {/* Margem de erro */}
      {areaSource !== "google" && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Margem de erro estimada</span>
          <span className="font-medium">{marginOfError || "±5%"}</span>
        </div>
      )}

      {/* Controles de edição */}
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
              {footprints.find((fp) => fp.isActive)?.area || footprints[0]?.area}m²
            </p>
          </div>
        )}

      {/* Detalhes quando bloqueado */}
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
    </BaseCard>
  );
}

export function IrradiationCard({
  annualIrradiation,
  irradiationSource,
  sources,
  irradiationSourceRaw,
  isLocked = false,
}: IrradiationCardProps) {
  const getClassification = () => {
    if (annualIrradiation > 1800) return "Excelente";
    if (annualIrradiation > 1600) return "Boa";
    if (annualIrradiation > 1400) return "Moderada";
    return "Baixa";
  };

  const classification = getClassification();

  return (
    <BaseCard
      icon={<Sun className="h-4 w-4 text-orange-500" />}
      title="Irradiação Anual GHI"
      isLocked={isLocked}
      tooltip="Irradiação Global Horizontal"
    >
      {/* Valor principal */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-2xl font-bold">{annualIrradiation}</span>
          <span className="text-sm text-muted-foreground ml-1">kWh/m²/ano</span>
        </div>
        <Badge variant="outline" className="text-xs">
          {classification}
        </Badge>
      </div>

      {/* Fonte dos dados */}
      <div className="flex flex-wrap gap-1">
        <Badge variant="outline" className="text-xs">
          {sources ? sources.join(" + ") : irradiationSource}
        </Badge>
        {irradiationSourceRaw && irradiationSourceRaw !== irradiationSource && (
          <Badge variant="outline" className="text-xs">
            Fonte: {irradiationSourceRaw}
          </Badge>
        )}
      </div>

      {/* Detalhes quando bloqueado */}
      {isLocked && (
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>Horas médias de sol pleno/dia:</span>
            <span className="font-medium">
              {(annualIrradiation / 365).toFixed(1)}h
            </span>
          </div>
          <div className="flex justify-between">
            <span>Irradiação média mensal:</span>
            <span className="font-medium">
              {(annualIrradiation / 12).toFixed(0)} kWh/m²
            </span>
          </div>
          <div className="flex justify-between">
            <span>Irradiação média diária:</span>
            <span className="font-medium">
              {(annualIrradiation / 365).toFixed(1)} kWh/m²
            </span>
          </div>
        </div>
      )}
    </BaseCard>
  );
}

export function ShadingCard({
  shadingIndex = 0,
  shadingLoss = 0,
  shadingSource,
  isLocked = false,
  showDetails = false,
}: ShadingCardProps) {
  const getImpactClass = () => {
    if (shadingLoss < 10) return "Baixo impacto";
    if (shadingLoss < 20) return "Impacto moderado";
    return "Alto impacto";
  };

  const impactClass = getImpactClass();
  const impactColor = {
    "Baixo impacto": "text-green-600",
    "Impacto moderado": "text-yellow-600",
    "Alto impacto": "text-red-600",
  }[impactClass];

  const displayShadingSource = () => {
    switch (shadingSource) {
      case "google_measured":
        return "Google Solar";
      case "user_input":
        return "Informado usuário";
      case "description":
        return "Descrição";
      default:
        return "Heurística";
    }
  };

  return (
    <BaseCard
      icon={<Cloud className="h-4 w-4 text-gray-500" />}
      title="Sombreamento"
      isLocked={isLocked}
      tooltip="Impacto do sombreamento na produção"
    >
      {/* Valor principal */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-2xl font-bold text-red-600">
            {shadingLoss}%
          </span>
          <span className="text-sm text-muted-foreground ml-1">perda</span>
        </div>
        <Badge variant="outline" className={impactColor}>
          {impactClass}
        </Badge>
      </div>

      {/* Detalhes técnicos */}
      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="flex justify-between">
          <span>Índice de sombreamento:</span>
          <span className="font-medium">
            {typeof shadingIndex === "number" ? shadingIndex.toFixed(2) : "N/A"}
          </span>
        </div>
        {shadingSource && (
          <div className="flex justify-between">
            <span>Fonte dos dados:</span>
            <Badge variant="outline" className="text-xs">
              {displayShadingSource()}
            </Badge>
          </div>
        )}
      </div>

      {/* Detalhes adicionais */}
      {showDetails && (
        <div className="space-y-2 text-sm text-muted-foreground border-t pt-2">
          <div className="flex justify-between">
            <span>Período crítico:</span>
            <span className="font-medium">9h-15h</span>
          </div>
          <div className="flex justify-between">
            <span>Impacto na produção:</span>
            <span className="font-medium text-red-600">
              {(shadingLoss / 100 * 100).toFixed(1)}% menor
            </span>
          </div>
          <div className="flex justify-between">
            <span>Recomendação:</span>
            <span className="font-medium">
              {shadingLoss < 10 ? "Aceitável" : "Verificar alternativas"}
            </span>
          </div>
        </div>
      )}
    </BaseCard>
  );
}

export function ProductionCard({
  estimatedProduction = 0,
  isLocked = false,
  showDetails = false,
  estimatedProductionYear1,
  estimatedProductionYear25,
}: ProductionCardProps) {
  const formatNumber = (num: number) => num.toLocaleString("pt-BR");
  const degradation = estimatedProductionYear1 && estimatedProductionYear25
    ? Math.round((1 - (estimatedProductionYear25 / estimatedProductionYear1)) * 100)
    : 0;

  return (
    <BaseCard
      icon={<Zap className="h-4 w-4 text-orange-500" />}
      title="Estimativa de Produção"
      isLocked={isLocked}
      tooltip="Produção anual estimada de energia"
    >
      {/* Valor principal */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="text-3xl font-bold">
            {formatNumber(estimatedProduction)}
          </span>
          <span className="text-sm text-muted-foreground">kWh/ano</span>
        </div>
      </div>

      {/* Produção ano 1 x ano 25 */}
      {typeof estimatedProductionYear1 === "number" && 
       typeof estimatedProductionYear25 === "number" && (
        <div className="flex flex-wrap gap-2 justify-center">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Ano 1: {formatNumber(estimatedProductionYear1)} kWh
            </Badge>
            <Badge variant="outline" className="text-xs">
              Ano 25: {formatNumber(estimatedProductionYear25)} kWh
            </Badge>
          </div>
          <Badge 
            variant="outline" 
            className={`text-xs ${degradation > 15 ? "text-red-600" : "text-yellow-600"}`}
          >
            Degradação: {degradation}%
          </Badge>
        </div>
      )}

      {/* Detalhes de produção */}
      {showDetails && (
        <div className="space-y-2 text-sm text-muted-foreground border-t pt-2">
          <div className="flex justify-between">
            <span>Produção mensal média:</span>
            <span className="font-medium">
              {formatNumber(Math.round(estimatedProduction / 12))} kWh
            </span>
          </div>
          <div className="flex justify-between">
            <span>Produção diária média:</span>
            <span className="font-medium">
              {formatNumber(Math.round(estimatedProduction / 365))} kWh
            </span>
          </div>
          <div className="flex justify-between items-start">
            <span>Impacto ambiental:</span>
            <div className="text-right">
              <div className="font-medium text-green-600">
                {formatNumber(Math.round(estimatedProduction * 0.4))} kg CO₂/ano
              </div>
              <div className="flex items-center gap-1 mt-1">
                <Leaf className="h-3 w-3 text-green-500" />
                <span className="text-xs">
                  Equivale a {formatNumber(Math.round((estimatedProduction * 0.4) / 22))} árvores
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </BaseCard>
  );
}

export function VerdictCard({
  verdict,
  reasons,
  isLocked = false,
}: VerdictCardProps) {
  const verdictColor = {
    "Apto": "text-green-600",
    "Parcial": "text-yellow-600",
    "Não apto": "text-red-600",
  }[verdict];

  const verdictBadgeVariant = "outline" as const;

  const verdictDescription = {
    "Apto": "Local adequado para instalação solar",
    "Parcial": "Local com algumas restrições",
    "Não apto": "Local não recomendado para instalação solar",
  }[verdict];

  return (
    <BaseCard
      icon={getVerdictIcon(verdict)}
      title="Veredicto"
      isLocked={isLocked}
      tooltip="Avaliação final da viabilidade"
    >
      {/* Veredicto principal */}
      <div className="flex flex-col items-center gap-2">
        <Badge 
          variant={verdictBadgeVariant} 
          className={`text-base px-4 py-1 ${verdictColor}`}
        >
          {verdict}
        </Badge>
        <p className={`text-sm ${verdictColor}`}>{verdictDescription}</p>
      </div>

      {/* Razões */}
      {reasons.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Fatores considerados:
          </p>
          <div className="flex flex-wrap gap-1">
            {reasons.map((reason, index) => (
              <Badge 
                key={index} 
                variant="outline" 
                className={`text-xs ${
                  reason.toLowerCase().includes("não") || 
                  reason.toLowerCase().includes("inadequado")
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {reason}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Recomendações baseadas no veredicto */}
      <div className="text-sm text-muted-foreground border-t pt-2">
        <p className="font-medium mb-1">Próximos passos:</p>
        {verdict === "Apto" && (
          <p>Prosseguir com o projeto e solicitar orçamento detalhado.</p>
        )}
        {verdict === "Parcial" && (
          <p>Avaliar alternativas para mitigar as restrições identificadas.</p>
        )}
        {verdict === "Não apto" && (
          <p>Considerar outras localidades ou aguardar melhorias tecnológicas.</p>
        )}
      </div>
    </BaseCard>
  );
}

export function SystemConfigCard({
  usableArea,
  isLocked = false,
}: SystemConfigCardProps) {
  const maxPanels = Math.floor(usableArea / 2.5);
  const totalPower = maxPanels * 0.55;
  const panelPower = 550;
  const panelArea = 2.5;
  const panelEfficiency = 21.5;

  return (
    <BaseCard
      icon={<Grid3X3 className="h-4 w-4 text-purple-500" />}
      title="Configuração Sugerida"
      isLocked={isLocked}
      tooltip="Configuração otimizada do sistema"
    >
      {/* Potência total */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-2xl font-bold">{totalPower.toFixed(1)}</span>
          <span className="text-sm text-muted-foreground ml-1">kWp</span>
        </div>
        <Badge variant="outline">
          {maxPanels} painéis
        </Badge>
      </div>

      {/* Especificações do painel */}
      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="flex justify-between">
          <span>Potência do painel:</span>
          <Badge variant="outline" className="text-xs text-purple-600">
            {panelPower}W
          </Badge>
        </div>
        <div className="flex justify-between">
          <span>Área por painel:</span>
          <span className="font-medium">{panelArea}m²</span>
        </div>
        <div className="flex justify-between">
          <span>Eficiência do módulo:</span>
          <span className="font-medium">{panelEfficiency}%</span>
        </div>
      </div>

      {/* Detalhes do arranjo */}
      <div className="space-y-2 text-sm text-muted-foreground border-t pt-2">
        <div className="flex justify-between">
          <span>Área total ocupada:</span>
          <span className="font-medium">
            {(maxPanels * panelArea).toFixed(1)}m²
          </span>
        </div>
        <div className="flex justify-between">
          <span>Densidade de potência:</span>
          <span className="font-medium">
            {((totalPower * 1000) / (maxPanels * panelArea)).toFixed(0)} W/m²
          </span>
        </div>
        <div className="flex justify-between">
          <span>Fator de ocupação:</span>
          <span className="font-medium">
            {((maxPanels * panelArea / usableArea) * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </BaseCard>
  );
}

export function SystemLifetimeCard({
  estimatedProduction,
  isLocked = false,
}: SystemLifetimeCardProps) {
  const lifetimeYears = 25;
  const totalProduction = estimatedProduction * lifetimeYears;
  const degradationRate = 0.6;
  const finalEfficiency = 100 - (degradationRate * lifetimeYears);
  const formatNumber = (num: number) => num.toLocaleString("pt-BR");

  return (
    <BaseCard
      icon={<Clock className="h-4 w-4 text-indigo-500" />}
      title="Vida Útil do Sistema"
      isLocked={isLocked}
      tooltip="Desempenho ao longo da vida útil"
    >
      {/* Valor principal */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-2xl font-bold">{lifetimeYears}</span>
          <span className="text-sm text-muted-foreground ml-1">anos</span>
        </div>
        <Badge variant="outline" className="text-xs">
          Garantia de performance
        </Badge>
      </div>

      {/* Produção total */}
      <div className="text-center py-2 bg-muted/50 rounded-lg">
        <div className="text-sm text-muted-foreground">Produção total estimada</div>
        <div className="text-xl font-bold mt-1">
          {formatNumber(totalProduction)} kWh
        </div>
      </div>

      {/* Detalhes de degradação */}
      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="flex justify-between">
          <span>Taxa de degradação anual:</span>
          <span className="font-medium">
            {degradationRate}% a.a.
          </span>
        </div>
        <div className="flex justify-between">
          <span>Eficiência aos {lifetimeYears} anos:</span>
          <span className={`font-medium ${
            finalEfficiency > 85 ? "text-green-600" : "text-yellow-600"
          }`}>
            {finalEfficiency.toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span>Produção média anual:</span>
          <span className="font-medium">
            {formatNumber(Math.round(totalProduction / lifetimeYears))} kWh
          </span>
        </div>
      </div>

      {/* Garantias */}
      <div className="text-sm text-muted-foreground border-t pt-2">
        <div className="flex items-start gap-2">
          <Shield className="h-4 w-4 text-green-500 mt-0.5" />
          <div>
            <p className="font-medium">Garantias inclusas:</p>
            <ul className="list-disc list-inside text-xs space-y-1 mt-1">
              <li>Performance linear por {lifetimeYears} anos</li>
              <li>Defeitos de fabricação por 12 anos</li>
              <li>Eficiência mínima de {finalEfficiency.toFixed(0)}% ao final</li>
            </ul>
          </div>
        </div>
      </div>
    </BaseCard>
  );
}

export function ConfidenceCard({
  confidence,
  coverage,
  isLocked = false,
}: ConfidenceCardProps) {
  type ConfidenceLevel = "alta" | "média" | "baixa";
  
  const confidenceConfig = {
    alta: {
      color: "text-green-600",
      badge: "outline" as const,
      icon: <CheckCircle className="h-4 w-4 text-green-500" />,
      description: "Alta precisão e confiabilidade dos dados",
    },
    média: {
      color: "text-yellow-600",
      badge: "outline" as const,
      icon: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
      description: "Dados confiáveis com algumas estimativas",
    },
    baixa: {
      color: "text-red-600",
      badge: "outline" as const,
      icon: <AlertCircle className="h-4 w-4 text-red-500" />,
      description: "Baseado principalmente em estimativas",
    },
  };

  const config = confidenceConfig[confidence.toLowerCase() as ConfidenceLevel] || confidenceConfig.baixa;

  const getDataQualityLabel = (quality: string) => {
    switch (quality) {
      case "measured":
        return "Medida";
      case "calculated":
        return "Calculada";
      case "estimated":
        return "Estimada";
      default:
        return "N/A";
    }
  };

  return (
    <BaseCard
      icon={<Shield className="h-4 w-4 text-blue-500" />}
      title="Nível de Confiança"
      isLocked={isLocked}
      tooltip="Qualidade e confiabilidade dos dados"
    >
      {/* Nível de confiança */}
      <div className="flex flex-col items-center gap-2">
        <Badge variant="outline" className="text-base px-4 py-1">
          {confidence}
        </Badge>
        <p className="text-sm text-muted-foreground text-center">
          {config.description}
        </p>
      </div>

      {/* Fontes de dados */}
      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="flex justify-between items-center">
          <span>Fonte principal:</span>
          <Badge variant="outline" className="text-xs">
            {coverage.google ? "Google Solar API" : coverage.fallback || "PVGIS + NASA"}
          </Badge>
        </div>
        <div className="flex justify-between items-center">
          <span>Qualidade dos dados:</span>
          <Badge variant="outline" className="text-xs">
            {getDataQualityLabel(coverage.dataQuality)}
          </Badge>
        </div>
      </div>

      {/* Alertas e recomendações */}
      {!coverage.google && (
        <div className="mt-2 space-y-2">
          <div className="flex items-start gap-2 p-2 border rounded-md">
            <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                Dados baseados em estimativas
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Recomenda-se validação com medições locais para maior precisão.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-2 border rounded-md">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">
                Para melhorar a precisão, considere:
                <ul className="list-disc list-inside mt-1">
                  <li>Medições locais de irradiação</li>
                  <li>Análise detalhada de sombreamento</li>
                  <li>Levantamento topográfico</li>
                </ul>
              </p>
            </div>
          </div>
        </div>
      )}
    </BaseCard>
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
  temperature,
  moduleEff,
  isLocked = false,
}: TechnicalDetailsCardProps) {
  return (
    <Card className="relative w-full">
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
            {/* Temperatura média considerada e eficiência do módulo */}
            {typeof temperature === "number" && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Temperatura considerada:
                </span>
                <span className="font-medium">{temperature}°C</span>
              </div>
            )}
            {typeof moduleEff === "number" && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Eficiência do módulo:
                </span>
                <span className="font-medium">
                  {(moduleEff * 100).toFixed(0)}%
                </span>
              </div>
            )}
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
    <Card className="relative w-full">
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
    <Card className="relative w-full">
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
