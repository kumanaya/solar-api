"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, CheckCircle, AlertTriangle, Database } from "lucide-react";
import { useAnalysisDetail } from "./analysis-detail-context";
import { toast } from "sonner";

type ProcessingStep = "sources" | "calculation" | "validation" | "completed" | "error";

const stepLabels: Record<ProcessingStep, string> = {
  "sources": "Coletando dados atualizados das fontes...",
  "calculation": "Aplicando novos parâmetros e recalculando...",
  "validation": "Validando e finalizando resultados...",
  "completed": "Reprocessamento concluído!",
  "error": "Erro no reprocessamento"
};

export function ReprocessModal() {
  const { 
    analysis, 
    isReprocessModalOpen, 
    setIsReprocessModalOpen, 
    reprocessAnalysis 
  } = useAnalysisDetail();

  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<ProcessingStep>("sources");
  const [progress, setProgress] = useState(0);
  const [hasError, setHasError] = useState(false);

  // Parâmetros do reprocessamento
  const [usageFactor, setUsageFactor] = useState(0.75);
  const [tiltEstimated, setTiltEstimated] = useState<number>(15);
  const [autoTilt, setAutoTilt] = useState(true);
  const [preferredSource, setPreferredSource] = useState("PVGIS");
  const [updateFootprint, setUpdateFootprint] = useState(false);

  const resetModal = () => {
    setIsProcessing(false);
    setCurrentStep("sources");
    setProgress(0);
    setHasError(false);
    // Reset dos parâmetros
    setUsageFactor(analysis?.currentVersion.parameters.usageFactor || 0.75);
    setTiltEstimated(analysis?.currentVersion.parameters.tiltEstimated || 15);
    setAutoTilt(!analysis?.currentVersion.parameters.tiltEstimated);
  };

  const handleClose = () => {
    if (!isProcessing) {
      resetModal();
      setIsReprocessModalOpen(false);
    }
  };

  const simulateProgress = async () => {
    const steps: { step: ProcessingStep; duration: number }[] = [
      { step: "sources", duration: 2000 },      // 2s - Coletando dados das fontes
      { step: "calculation", duration: 3500 },  // 3.5s - Recalculando com novos parâmetros
      { step: "validation", duration: 1500 }    // 1.5s - Validando resultados
    ];
    
    for (let i = 0; i < steps.length; i++) {
      const { step, duration } = steps[i];
      setCurrentStep(step);
      
      const stepProgress = (i / steps.length) * 100;
      const nextStepProgress = ((i + 1) / steps.length) * 100;
      
      // Progressive loading with variable speed to feel more natural
      const totalIncrements = Math.floor(duration / 100); // 100ms intervals
      const progressIncrement = (nextStepProgress - stepProgress) / totalIncrements;
      
      for (let j = 0; j < totalIncrements; j++) {
        const currentProgress = stepProgress + (j * progressIncrement);
        setProgress(Math.min(currentProgress, nextStepProgress));
        
        // Variable delay to make it feel more realistic
        const delay = 80 + Math.random() * 40; // 80-120ms random intervals
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    setProgress(100);
    setCurrentStep("completed");
  };

  const handleReprocess = async () => {
    setIsProcessing(true);
    setHasError(false);
    
    try {
      const parameters = {
        usageFactor,
        tiltEstimated: autoTilt ? undefined : tiltEstimated,
        preferredSource,
        updateFootprint,
        usableAreaOverride: Math.round((analysis?.polygon.area || 0) * usageFactor)
      };

      // Start progress simulation and actual reprocessing in parallel
      const progressPromise = simulateProgress();
      const reprocessPromise = reprocessAnalysis(parameters);
      
      // Wait for both to complete
      await Promise.all([progressPromise, reprocessPromise]);
      
      toast.success("Análise reprocessada com sucesso!", {
        description: "Os novos resultados estão disponíveis.",
      });

      // Métricas
      console.log("📊 Reprocessamento realizado:", {
        analysis_id: analysis?.id,
        parameters,
        previous_confidence: analysis?.currentVersion.confidence,
        reprocess_count: (analysis?.reprocessCount || 0) + 1
      });

      // Fechar modal após sucesso
      setTimeout(() => {
        handleClose();
      }, 2000);
      
    } catch (error) {
      console.error("Erro ao reprocessar:", error);
      setCurrentStep("error");
      setHasError(true);
      
      toast.error("Erro no reprocessamento", {
        description: error instanceof Error ? error.message : "Não foi possível atualizar a análise. Tente novamente.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetry = () => {
    resetModal();
    handleReprocess();
  };

  if (!analysis) return null;

  return (
    <Dialog open={isReprocessModalOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <RefreshCw className="h-5 w-5 text-blue-500" />
            <span>Reprocessar Análise</span>
          </DialogTitle>
          <DialogDescription>
            Configure os parâmetros para atualizar os cálculos com dados mais recentes
          </DialogDescription>
        </DialogHeader>

        {!isProcessing && currentStep !== "completed" && !hasError && (
          <div className="space-y-6 py-4">
            {/* Informações da análise atual */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Análise Atual</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Confiança: {analysis.currentVersion.confidence}</div>
                <div>Última atualização: {new Date(analysis.lastUpdated).toLocaleDateString('pt-BR')}</div>
                <div>Área útil: {analysis.currentVersion.usableArea}m²</div>
                <div>Produção: {analysis.currentVersion.estimatedProduction.toLocaleString()} kWh/ano</div>
              </div>
            </div>

            {/* Fator de uso */}
            <div className="space-y-2">
              <Label htmlFor="usage-factor">
                Fator de Uso ({Math.round(usageFactor * 100)}%)
              </Label>
              <Input
                id="usage-factor"
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={usageFactor}
                onChange={(e) => setUsageFactor(Number(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Percentual da área do telhado utilizável para painéis solares
              </p>
            </div>

            {/* Inclinação */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-tilt">Inclinação Automática</Label>
                <Switch
                  id="auto-tilt"
                  checked={autoTilt}
                  onCheckedChange={setAutoTilt}
                />
              </div>
              
              {!autoTilt && (
                <div className="space-y-2">
                  <Label htmlFor="tilt">Inclinação Estimada (graus)</Label>
                  <Input
                    id="tilt"
                    type="number"
                    min="0"
                    max="60"
                    value={tiltEstimated}
                    onChange={(e) => setTiltEstimated(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ângulo de inclinação dos painéis em relação ao solo
                  </p>
                </div>
              )}
            </div>

            {/* Fonte preferida */}
            <div className="space-y-2">
              <Label>Fonte de Dados Preferida</Label>
              <Select value={preferredSource} onValueChange={setPreferredSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PVGIS">PVGIS (Recomendado)</SelectItem>
                  <SelectItem value="NASA">NASA POWER</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Atualizar footprint */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="update-footprint">Atualizar Polígono</Label>
                <p className="text-sm text-muted-foreground">
                  Tentar obter dados mais recentes do polígono do telhado
                </p>
              </div>
              <Switch
                id="update-footprint"
                checked={updateFootprint}
                onCheckedChange={setUpdateFootprint}
              />
            </div>

            {/* Botão reprocessar */}
            <Button onClick={handleReprocess} className="w-full" size="lg">
              <RefreshCw className="mr-2 h-4 w-4" />
              Iniciar Reprocessamento
            </Button>
          </div>
        )}

        {/* Estado de processamento */}
        {isProcessing && (
          <div className="space-y-6 py-8">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <div className="space-y-2">
                <h3 className="font-medium">Reprocessando análise</h3>
                <p className="text-sm text-muted-foreground">Isso pode levar alguns segundos...</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>{stepLabels[currentStep]}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        )}

        {/* Estado de sucesso */}
        {currentStep === "completed" && !isProcessing && (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <div>
                <h3 className="font-medium text-green-700">Reprocessamento Concluído!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  A análise foi atualizada com sucesso
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Estado de erro */}
        {hasError && (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-4">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
              <div>
                <h3 className="font-medium text-red-700">Erro no Reprocessamento</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Não foi possível atualizar a análise
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Button onClick={handleRetry} className="w-full" size="lg">
                Tentar Novamente
              </Button>
              
              <Button 
                onClick={handleClose} 
                variant="outline" 
                className="w-full"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}