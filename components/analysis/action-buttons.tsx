"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, DollarSign, Save, Loader2, Trash2, Undo2, Zap, Search } from "lucide-react";
import { useAnalysis } from "./analysis-context";
import { PDFModal } from "./pdf-modal";
import { analyzeAddress, transformAnalysisData } from "@/lib/analysis-api";
import { getFootprints, transformFootprintData } from "@/lib/footprints-api";

export function ActionButtons() {
  const { 
    data, 
    updateData, 
    currentPolygon, 
    selectedAddress, 
    setIsLoading, 
    setError,
    setHasFootprintFromAction,
    hasFootprintFromAction
  } = useAnalysis();
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSearchingFootprints, setIsSearchingFootprints] = useState(false);
  const [previousState, setPreviousState] = useState<{
    footprints: typeof data.footprints;
    areaSource: typeof data.areaSource;
    usableArea: number;
    confidence: typeof data.confidence;
  } | null>(null);

  const handleOpenPDFModal = () => {
    setIsPDFModalOpen(true);
  };

  const handleAddProposal = async () => {
    try {
      // Simular chamada para /pricing
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log("Proposta adicionada para:", data.address);
      alert("Proposta comercial adicionada ao laudo!");
    } catch (error) {
      console.error("Erro ao adicionar proposta:", error);
      alert("Erro ao adicionar proposta. Tente novamente.");
    }
  };

  const handleSaveAnalysis = async () => {
    setIsSaving(true);
    try {
      // Simular salvamento
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log("Análise salva:", data.address);
      alert("Análise salva com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar análise:", error);
      alert("Erro ao salvar análise. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSearchFootprints = async () => {
    if (!data.coordinates) {
      setError('Nenhuma coordenada disponível para buscar footprints. Selecione um endereço ou coloque um pin no mapa.');
      return;
    }

    // Salvar estado anterior antes de fazer mudanças
    setPreviousState({
      footprints: data.footprints,
      areaSource: data.areaSource,
      usableArea: data.usableArea,
      confidence: data.confidence
    });

    setIsSearchingFootprints(true);
    setError(null);

    try {
      const [lng, lat] = data.coordinates;
      console.log('Searching footprints for coordinates (from pin/address):', { lat, lng, address: data.address });
      
      const result = await getFootprints(lat, lng);
      
      if (result.success && result.data) {
        const footprintData = transformFootprintData(result.data);
        
        if (footprintData) {
          console.log('Footprint found:', footprintData);
          
          updateData({
            footprints: [footprintData],
            areaSource: 'footprint' as const,
            usableArea: Math.round(footprintData.area * 0.75),
            confidence: footprintData.confidence
          });
          
          // Mark that footprint came from manual action
          setHasFootprintFromAction(true);
          
          const locationSource = data.address.includes(',') && data.address.includes('.') ? 'pin' : 'endereço';
          alert(`Footprint encontrado usando ${locationSource}! Área: ${footprintData.area}m² (${footprintData.source})`);
        } else {
          setError('Nenhum footprint encontrado para esta localização');
        }
      } else {
        setError(result.error || 'Erro ao buscar footprints');
      }
    } catch (error) {
      console.error('Footprint search error:', error);
      setError(error instanceof Error ? error.message : 'Erro inesperado ao buscar footprints');
    } finally {
      setIsSearchingFootprints(false);
    }
  };

  const handleClearPolygons = () => {
    // Salvar estado anterior antes de limpar
    setPreviousState({
      footprints: data.footprints,
      areaSource: data.areaSource,
      usableArea: data.usableArea,
      confidence: data.confidence
    });

    // Limpar todos os polígonos e resetar dados relacionados
    updateData({
      footprints: [],
      areaSource: 'estimate' as const,
      usableArea: 0,
      confidence: 'Baixa' as const
    });

    console.log('All polygons cleared');
  };

  const handleUndoLastAction = () => {
    if (previousState) {
      // Restaurar estado anterior
      updateData({
        footprints: previousState.footprints,
        areaSource: previousState.areaSource,
        usableArea: previousState.usableArea,
        confidence: previousState.confidence
      });

      // Limpar o estado anterior (só permite um undo)
      setPreviousState(null);
      
      console.log('Reverted to previous state');
    }
  };
  
  
  const handleRunAnalysis = async () => {
    if (!selectedAddress) {
      setError('Nenhum endereço selecionado para análise');
      return;
    }
    
    setIsAnalyzing(true);
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Running analysis with:', {
        address: selectedAddress,
        polygon: currentPolygon,
        footprints: data.footprints
      });
      
      // Calculate usable area override from footprints if available
      let usableAreaOverride: number | undefined;
      if (data.footprints.length > 0 && data.areaSource === 'footprint') {
        const totalArea = data.footprints.reduce((sum, fp) => sum + fp.area, 0);
        usableAreaOverride = Math.round(totalArea * data.usageFactor);
      }
      
      const result = await analyzeAddress(
        selectedAddress,
        currentPolygon || undefined,
        usableAreaOverride
      );
      
      if (result.success && result.data) {
        const transformedData = transformAnalysisData(result.data);
        if (transformedData) {
          updateData({
            ...transformedData,
            // Preserve existing footprints if analysis doesn't return them
            footprints: result.data.footprints.length > 0 ? transformedData.footprints : data.footprints
          });
        }
      } else {
        setError(result.error || 'Erro na análise');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setError(error instanceof Error ? error.message : 'Erro inesperado na análise');
    } finally {
      setIsAnalyzing(false);
      setIsLoading(false);
    }
  };
  
  const hasFootprint = data.footprints.length > 0;
  const canAnalyze = selectedAddress && (hasFootprint || currentPolygon);

  return (
    <>
      <div className="space-y-3">
        {/* Botão principal - Executar Análise */}
        <Button 
          onClick={handleRunAnalysis}
          className="w-full"
          disabled={!canAnalyze || isAnalyzing}
        >
          {isAnalyzing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Zap className="mr-2 h-4 w-4" />
          )}
          {isAnalyzing ? 'Analisando...' : 'Executar Análise'}
        </Button>
        
        {/* Botão - Gerar PDF */}
        <Button 
          onClick={handleOpenPDFModal}
          className="w-full"
          variant="outline"
          disabled={!data.estimatedProduction || data.estimatedProduction === 0}
        >
          <FileText className="mr-2 h-4 w-4" />
          Gerar PDF do Laudo
        </Button>

      {/* Botões secundários */}
      <div className="grid grid-cols-3 gap-2">
        <Button 
          variant="outline" 
          onClick={handleClearPolygons}
          disabled={data.footprints.length === 0}
          title="Limpar todos os polígonos"
        >
          <Trash2 className="mr-1 h-4 w-4" />
          Limpar
        </Button>

        <Button 
          variant="outline" 
          onClick={handleUndoLastAction}
          disabled={!previousState}
          title="Voltar à seleção anterior"
        >
          <Undo2 className="mr-1 h-4 w-4" />
          Voltar
        </Button>
        
        <Button 
          variant="outline" 
          onClick={handleSaveAnalysis}
          disabled={isSaving || !data.estimatedProduction}
        >
          {isSaving ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1 h-4 w-4" />
          )}
          Salvar
        </Button>
      </div>

      {/* Botão de buscar footprints */}
      {data.coordinates && (
        <Button 
          variant="outline" 
          onClick={handleSearchFootprints}
          disabled={isSearchingFootprints}
          className="w-full"
        >
          {isSearchingFootprints ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          {isSearchingFootprints ? 'Buscando...' : 'Buscar Footprint Automático'}
        </Button>
      )}
      
      <div className="grid grid-cols-1 gap-2">
        <Button 
          variant="outline" 
          onClick={handleAddProposal}
          disabled={!data.estimatedProduction || data.estimatedProduction === 0}
        >
          <DollarSign className="mr-2 h-4 w-4" />
          Adicionar Proposta
        </Button>
      </div>

        {/* Informações adicionais */}
        <div className="text-xs text-muted-foreground text-center pt-2 border-t space-y-1">
          {!canAnalyze && (
            <p className="text-amber-600">
              {!selectedAddress && "Selecione um endereço"}
              {selectedAddress && data.footprints.length === 0 && !currentPolygon && "Busque footprint automático ou desenhe o telhado"}
            </p>
          )}
          {data.footprints.length > 0 && hasFootprintFromAction && (
            <p className="text-green-600">
              Telhado detectado ({Math.round(data.footprints[0]?.area || 0)}m²) - {data.areaSource}
            </p>
          )}
          {data.estimatedProduction > 0 && (
            <p>Análise concluída - {data.estimatedProduction.toLocaleString()} kWh/ano</p>
          )}
        </div>
      </div>

      {/* Modal do PDF */}
      <PDFModal 
        isOpen={isPDFModalOpen} 
        onClose={() => setIsPDFModalOpen(false)}
        analysisData={data}
      />
    </>
  );
}