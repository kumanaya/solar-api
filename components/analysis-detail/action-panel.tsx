"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, RefreshCw, Copy, History, Loader2, Image } from "lucide-react";
import { useAnalysisDetail } from "./analysis-detail-context";
import { PDFModal } from "../analysis/pdf-modal";
import { GeoTIFFCarousel } from "./geotiff-carousel";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getDataLayersByAnalysisId, requestDataLayers } from "@/lib/data-layers-api";
import { toast } from "sonner";

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
  const [isGeoTIFFModalOpen, setIsGeoTIFFModalOpen] = useState(false);
  const [isLoadingGeoTIFFs, setIsLoadingGeoTIFFs] = useState(false);
  const [geoTIFFImages, setGeoTIFFImages] = useState<Array<{
    url: string;
    title: string;
    description: string;
  }>>([]);

  const handleLoadGeoTIFFs = async () => {
    if (!analysis?.id) return;
    
    setIsLoadingGeoTIFFs(true);
    try {
      // Primeiro, tenta buscar dados existentes
      let dataLayers = await getDataLayersByAnalysisId(analysis.id);
      
      // Se não existirem dados, faz a requisição para a edge function
      if (!dataLayers?.stored_layers) {
        toast.info("Gerando imagens GeoTIFF...");
        
        const [latitude, longitude] = analysis.coordinates;
        const response = await requestDataLayers({
          latitude,
          longitude,
          radiusMeters: 100,
          view: "FULL_LAYERS",
          requiredQuality: "HIGH"
        });

        if (!response.success || !response.data?.storedLayers) {
          toast.error("Erro ao gerar as imagens GeoTIFF");
          return;
        }

        // Atualiza dataLayers com a resposta
        dataLayers = {
          stored_layers: response.data.storedLayers
        };
      }

      // Converter os dados para o formato do carrossel
      const images: Array<{ url: string; title: string; description: string }> = [];
      
      // Processar camadas principais
      const mainLayers = ['dsmUrl', 'rgbUrl', 'maskUrl', 'annualFluxUrl', 'monthlyFluxUrl'];
      mainLayers.forEach(key => {
        const layer = dataLayers.stored_layers[key];
        if (layer && !Array.isArray(layer)) {
          images.push({
            url: layer.url,
            title: layer.title,
            description: layer.description
          });
        }
      });

      // Processar camadas horárias
      const hourlyLayers = dataLayers.stored_layers.hourlyShadeUrls;
      if (Array.isArray(hourlyLayers)) {
        hourlyLayers.forEach(layer => {
          images.push({
            url: layer.url,
            title: layer.title,
            description: layer.description
          });
        });
      }

      setGeoTIFFImages(images);
      setIsGeoTIFFModalOpen(true);
    } catch (error) {
      console.error('Error loading GeoTIFFs:', error);
      toast.error("Erro ao carregar as imagens GeoTIFF");
    } finally {
      setIsLoadingGeoTIFFs(false);
    }
  };

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

            {/* GeoTIFFs */}
            <Button 
              onClick={handleLoadGeoTIFFs}
              className="flex-1 min-w-0"
              variant="outline"
              disabled={isLoadingGeoTIFFs}
            >
              {isLoadingGeoTIFFs ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando...
                </>
              ) : (
                <>
                  <Image className="mr-2 h-4 w-4" aria-hidden="true" />
                  GeoTIFFs
                </>
              )}
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

      {/* Modal dos GeoTIFFs */}
      <Dialog open={isGeoTIFFModalOpen} onOpenChange={setIsGeoTIFFModalOpen}>
        <DialogContent className="max-w-4xl">
          <GeoTIFFCarousel
            images={geoTIFFImages}
            onClose={() => setIsGeoTIFFModalOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}