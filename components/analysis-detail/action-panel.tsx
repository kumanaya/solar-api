"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, RefreshCw, Copy, History, Loader2 } from "lucide-react";
import { useAnalysisDetail } from "./analysis-detail-context";
import { PDFModal } from "../analysis/pdf-modal";

interface ActionPanelProps {
  onToggleHistory: () => void;
}

export function ActionPanel({ onToggleHistory }: ActionPanelProps) {
  const { 
    analysis, 
    setIsReprocessModalOpen, 
    duplicateAnalysis
  } = useAnalysisDetail();
  
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);

  const handleDuplicate = async () => {
    setIsDuplicating(true);
    try {
      await duplicateAnalysis();
    } finally {
      setIsDuplicating(false);
    }
  };


  const handleOpenPDFModal = () => {
    setIsPDFModalOpen(true);
  };

  if (!analysis) {
    return (
      <div className="border-t bg-white p-4">
        <div className="animate-pulse flex space-x-2">
          <div className="h-10 bg-gray-200 rounded flex-1"></div>
          <div className="h-10 bg-gray-200 rounded w-32"></div>
          <div className="h-10 bg-gray-200 rounded w-32"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border-t bg-background">
        <div className="p-4 space-y-4">
          {/* Ações principais */}
          <div className="flex flex-wrap gap-3">
            {/* Gerar PDF */}
            <Button 
              onClick={handleOpenPDFModal}
              className="flex-1 min-w-0"
            >
              <FileText className="mr-2 h-4 w-4" />
              Gerar PDF
            </Button>

            {/* Reprocessar */}
            <Button 
              onClick={() => setIsReprocessModalOpen(true)}
              variant="outline"
              className="flex-1 min-w-0"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reprocessar
            </Button>

            {/* Duplicar */}
            <Button 
              onClick={handleDuplicate}
              variant="outline"
              disabled={isDuplicating}
              className="flex-1 min-w-0"
            >
              {isDuplicating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Duplicando...
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicar
                </>
              )}
            </Button>

            {/* Histórico */}
            <Button 
              onClick={onToggleHistory}
              variant="outline"
              size="default"
            >
              <History className="mr-2 h-4 w-4" />
              Histórico
              {analysis.reprocessCount > 0 && (
                <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                  {analysis.reprocessCount}
                </span>
              )}
            </Button>
          </div>

          {/* Informações adicionais */}
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-center justify-between">
              <span>* PDF incluirá todos os dados atuais da análise</span>
              <span>ID: #{analysis.id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>* Reprocessar atualizará os cálculos com dados mais recentes</span>
              <span>
                {analysis.reprocessCount > 0 
                  ? `Última atualização: ${new Date(analysis.lastUpdated).toLocaleDateString('pt-BR')}`
                  : 'Versão original'
                }
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal do PDF */}
      <PDFModal 
        isOpen={isPDFModalOpen} 
        onClose={() => setIsPDFModalOpen(false)}
        analysisData={{
          address: analysis.address,
          coordinates: analysis.coordinates,
          coverage: {
            google: analysis.sources.google,
            fallback: analysis.sources.nasa ? "NASA SRTM" : "Dados indisponíveis"
          },
          confidence: analysis.currentVersion.confidence,
          usableArea: analysis.currentVersion.usableArea,
          areaSource: "manual",
          annualIrradiation: analysis.currentVersion.annualIrradiation,
          irradiationSource: analysis.currentVersion.sources[0] || "PVGIS",
          shadingIndex: 0,
          shadingLoss: 0,
          estimatedProduction: analysis.currentVersion.estimatedProduction,
          verdict: analysis.currentVersion.verdict,
          reasons: [],
          footprints: [{
            id: "main",
            coordinates: analysis.polygon.coordinates,
            area: analysis.polygon.area,
            isActive: true
          }],
          usageFactor: analysis.currentVersion.parameters.usageFactor
        }}
      />
    </>
  );
}