"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, DollarSign, Loader2, Zap, Search } from "lucide-react";
import { useAnalysis } from "./analysis-context";
import { PDFModal } from "./pdf-modal";
import { analyzeAddress, transformAnalysisData } from "@/lib/analysis-api";
import { getFootprints, transformFootprintData } from "@/lib/footprints-api";
import { useErrorHandler } from "@/lib/hooks/use-error-handler";

export function ActionButtons() {
  const { 
    data, 
    updateData, 
    currentPolygon, 
    selectedAddress, 
    setIsLoading, 
    setError,
    setHasFootprintFromAction,
    hasFootprintFromAction,
    setHasAnalysisResults
  } = useAnalysis();
  
  const { handleError } = useErrorHandler({
    onDrawManual: () => {
      // Aqui poderia ativar modo de desenho automaticamente
      console.log('User should draw manually');
    }
  });
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSearchingFootprints, setIsSearchingFootprints] = useState(false);
  const [footprintNotFoundMessage, setFootprintNotFoundMessage] = useState<string | null>(null);

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


  const handleSearchFootprints = async () => {
    if (!data.coordinates) {
      setError('Nenhuma coordenada disponível para buscar footprints. Selecione um endereço ou coloque um pin no mapa.');
      return;
    }


    setIsSearchingFootprints(true);
    setError(null);
    setFootprintNotFoundMessage(null);

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
          
          // Clear any previous footprint not found message
          setFootprintNotFoundMessage(null);
          
          const locationSource = data.address.includes(',') && data.address.includes('.') ? 'pin' : 'endereço';
          alert(`Footprint encontrado usando ${locationSource}! Área: ${footprintData.area}m² (${footprintData.source})`);
        } else {
          setFootprintNotFoundMessage('Nenhum footprint encontrado para esta localização. Desenhe o telhado manualmente.');
        }
      } else {
        // Tratar especificamente o erro FOOTPRINT_NOT_FOUND
        if (result.errorCode === 'FOOTPRINT_NOT_FOUND') {
          setFootprintNotFoundMessage(result.error || 'Nenhum footprint encontrado para esta localização. Desenhe o telhado manualmente.');
        } else {
          // Usar sistema de códigos de erro padronizado para outros erros
          const errorInfo = handleError(result.error || 'Erro ao buscar footprints', result.errorCode);
          setError(errorInfo.userMessage);
        }
      }
    } catch (error) {
      console.error('Footprint search error:', error);
      setError(error instanceof Error ? error.message : 'Erro inesperado ao buscar footprints');
    } finally {
      setIsSearchingFootprints(false);
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
      console.log(`Starting analysis for address: ${selectedAddress}`);
      console.log('Current data coordinates:', data.coordinates);
      
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
      
      if (!result.success) {
        console.error('Analysis failed:', result.error);
        setError(result.error || "Erro na análise do endereço");
        return;
      }
      if (!result.data) {
        setError("Dados de análise não recebidos");
        return;
      }
      
      const transformedData = transformAnalysisData(result.data);
      if (!transformedData) {
        setError("Erro ao processar dados da análise");
        return;
      }
      
      console.log('Analysis completed successfully:', transformedData);
      
      // Preserve current coordinates (where user placed the pin)
      const currentCoordinates = data.coordinates;
      updateData({
        ...transformedData,
        coordinates: currentCoordinates, // Keep user's pin location
        // Preserve existing footprints if analysis doesn't return them
        footprints: result.data.footprints.length > 0 ? transformedData.footprints : data.footprints
      });
      
      // Mark that we have analysis results to show the technical results
      setHasAnalysisResults(true);
      
    } catch (error) {
      console.error('Analysis error:', error);
      setError(error instanceof Error ? error.message : 'Erro inesperado na análise');
    } finally {
      setIsAnalyzing(false);
      setIsLoading(false);
    }
  };
  
  const hasFootprint = data.footprints.length > 0;
  const canAnalyze = selectedAddress;

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
              Selecione um endereço para executar análise
            </p>
          )}
          {footprintNotFoundMessage && (
            <p className="text-orange-600">
              {footprintNotFoundMessage}
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