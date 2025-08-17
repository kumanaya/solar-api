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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { FileText, Download, ExternalLink, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { AnalysisData } from "./analysis-context";

interface PDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysisData?: AnalysisData;
}

type Language = "pt-BR" | "en" | "es";
type GenerationStep = "texto" | "composicao" | "render" | "completed" | "error";

const languageOptions: Record<Language, string> = {
  "pt-BR": "Português (Brasil)",
  "en": "English",
  "es": "Español"
};

const stepLabels: Record<GenerationStep, string> = {
  "texto": "Processando dados técnicos...",
  "composicao": "Montando estrutura do documento...",
  "render": "Renderizando PDF final...",
  "completed": "PDF gerado com sucesso!",
  "error": "Erro na geração"
};

export function PDFModal({ isOpen, onClose }: PDFModalProps) {
  const [includeProposal, setIncludeProposal] = useState(false);
  const [language, setLanguage] = useState<Language>("pt-BR");
  const [observations, setObservations] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState<GenerationStep>("texto");
  const [progress, setProgress] = useState(0);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  const resetModal = () => {
    setIsGenerating(false);
    setCurrentStep("texto");
    setProgress(0);
    setPdfUrl(null);
    setHasError(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const simulateProgress = async () => {
    const steps: GenerationStep[] = ["texto", "composicao", "render"];
    
    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(steps[i]);
      
      // Simular progresso gradual para cada etapa
      const stepProgress = (i / steps.length) * 100;
      const nextStepProgress = ((i + 1) / steps.length) * 100;
      
      for (let p = stepProgress; p <= nextStepProgress; p += 2) {
        setProgress(p);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Pausa entre etapas
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    setProgress(100);
    setCurrentStep("completed");
  };

  const handleGeneratePDF = async () => {
    setIsGenerating(true);
    setHasError(false);
    
    try {
      // Simular chamada para /pricing se incluir proposta
      if (includeProposal) {
        console.log("Chamando /pricing para proposta comercial...");
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Simular geração do PDF com progresso
      await simulateProgress();
      
      // Simular URL do PDF gerado
      const mockPdfUrl = `https://example.com/reports/laudo-${Date.now()}.pdf`;
      setPdfUrl(mockPdfUrl);
      
      // Toast de sucesso
      toast.success("PDF gerado com sucesso!", {
        description: "Seu laudo está pronto para download.",
        action: {
          label: "Baixar",
          onClick: () => window.open(mockPdfUrl, '_blank')
        }
      });
      
      // Métricas (simulação)
      console.log("📊 Métricas:", {
        taxa_geracao_pdf: "98.5%",
        tempo_render: "4.2s",
        idioma: language,
        inclui_proposta: includeProposal,
        observacoes_length: observations.length
      });
      
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      setCurrentStep("error");
      setHasError(true);
      
      toast.error("Erro ao gerar PDF", {
        description: "Algo deu errado. Tente novamente.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (pdfUrl) {
      // Simular download
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `laudo-solar-${Date.now()}.pdf`;
      link.click();
      
      // Métrica de clique em download
      console.log("📊 Métrica: Clique em 'Baixar PDF'");
      
      toast.success("Download iniciado!");
    }
  };

  const handleOpenInBrowser = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
      
      // Métrica de abertura no navegador
      console.log("📊 Métrica: Clique em 'Abrir no navegador'");
    }
  };

  const handleRetry = () => {
    resetModal();
    handleGeneratePDF();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-blue-500" />
            <span>Gerar PDF do Laudo</span>
          </DialogTitle>
          <DialogDescription>
            Configure as opções do seu relatório técnico
          </DialogDescription>
        </DialogHeader>

        {!isGenerating && !pdfUrl && !hasError && (
          <div className="space-y-6 py-4">
            {/* Switch Proposta Comercial */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="include-proposal">Incluir Proposta Comercial</Label>
                <p className="text-sm text-muted-foreground">
                  Adiciona orçamento automático ao laudo
                </p>
              </div>
              <Switch
                id="include-proposal"
                checked={includeProposal}
                onCheckedChange={setIncludeProposal}
              />
            </div>

            {/* Seleção de Idioma */}
            <div className="space-y-2">
              <Label>Idioma do Relatório</Label>
              <Select value={language} onValueChange={(value) => setLanguage(value as Language)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(languageOptions).map(([code, name]) => (
                    <SelectItem key={code} value={code}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Campo Observações */}
            <div className="space-y-2">
              <Label htmlFor="observations">Observações (opcional)</Label>
              <Textarea
                id="observations"
                placeholder="Adicione comentários ou observações especiais para incluir no laudo..."
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                className="min-h-[80px]"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">
                {observations.length}/500 caracteres
              </p>
            </div>

            {/* Botão Gerar */}
            <Button onClick={handleGeneratePDF} className="w-full" size="lg">
              <FileText className="mr-2 h-4 w-4" />
              Gerar PDF
            </Button>
          </div>
        )}

        {/* Estado de Geração */}
        {isGenerating && (
          <div className="space-y-6 py-8">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <div className="space-y-2">
                <h3 className="font-medium">Gerando seu laudo</h3>
                <p className="text-sm text-muted-foreground">≈ 5 segundos</p>
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

        {/* Estado de Sucesso */}
        {pdfUrl && currentStep === "completed" && (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <div>
                <h3 className="font-medium text-green-700">PDF Gerado com Sucesso!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Seu laudo técnico está pronto
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Button onClick={handleDownload} className="w-full" size="lg">
                <Download className="mr-2 h-4 w-4" />
                Baixar PDF
              </Button>
              
              <Button 
                onClick={handleOpenInBrowser} 
                variant="outline" 
                className="w-full"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir no Navegador
              </Button>
            </div>
          </div>
        )}

        {/* Estado de Erro */}
        {hasError && (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
              <div>
                <h3 className="font-medium text-red-700">Erro na Geração</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Algo deu errado ao gerar o PDF
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