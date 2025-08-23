"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FileText, DollarSign, Loader2, Zap, Search, Save } from "lucide-react";
import { useAnalysis } from "./analysis-context";
import { PDFModal } from "./pdf-modal";
import { analyzeAddress, transformAnalysisData } from "@/lib/analysis-api";
import { getFootprints, transformFootprintData } from "@/lib/footprints-api";
import { useErrorHandler } from "@/lib/hooks/use-error-handler";
import { createClient } from "@/lib/supabase/client";

export function ActionButtons() {
  const router = useRouter();
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
  const [isSavingAnalysis, setIsSavingAnalysis] = useState(false);
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

  const handleSaveAnalysis = async () => {
    if (!data.estimatedProduction || data.estimatedProduction <= 0) {
      setError('Nenhuma análise disponível para salvar. Execute a análise primeiro.');
      return;
    }

    setIsSavingAnalysis(true);
    setError(null);

    try {
      console.log('Saving analysis to database...');
      console.log('Analysis data before saving:', JSON.stringify(data, null, 2));
      console.log('annualIrradiation field value:', data.annualIrradiation);
      console.log('apiSourcesUsed field value:', data.apiSourcesUsed);
      console.log('nasaPowerData field value:', data.nasaPowerData);
      console.log('pvgisData field value:', data.pvgisData);
      
      const supabase = createClient();
      // Validate and prepare analysis data for saving using schema
      const analysisDataToSave = {
        ...data,
        address: selectedAddress || data.address, // Use selectedAddress which contains the actual address
        coordinates: Array.isArray(data.coordinates) 
          ? { lat: data.coordinates[1], lng: data.coordinates[0] }
          : data.coordinates
      };

      console.log('Prepared analysis data for saving:', JSON.stringify(analysisDataToSave, null, 2));

      const { data: saveResult, error } = await supabase.functions.invoke('save-analysis', {
        body: {
          analysisData: analysisDataToSave
        }
      });

      console.log('Save analysis result:', { saveResult, error });

      if (error) {
        console.error('Save analysis error:', error);
        setError(error.message || 'Erro ao salvar análise');
        return;
      }

      if (!saveResult.success) {
        console.error('Save failed:', saveResult.error);
        setError(saveResult.error || 'Erro ao salvar análise');
        return;
      }

      // Update analysis data with database info
      updateData({
        ...data,
        id: saveResult.data.id,
        createdAt: saveResult.data.createdAt
      });

      console.log('Analysis saved successfully:', saveResult.data);
      
      // Redirect to analysis detail page
      router.push(`/dashboard/analysis/${saveResult.data.id}`);

    } catch (error) {
      console.error('Save analysis error:', error);
      setError(error instanceof Error ? error.message : 'Erro inesperado ao salvar análise');
    } finally {
      setIsSavingAnalysis(false);
    }
  };


  const handleSearchFootprints = async () => {
    if (!data.coordinates) {
      setError('Nenhuma coordenada disponível para buscar footprints. Selecione um endereço ou coloque um pin no mapa.');
      return;
    }

    setIsSearchingFootprints(true);
    // Clear all previous errors and messages  
    setError(null);
    setFootprintNotFoundMessage(null);
    // IMPORTANT: Reset hasFootprintFromAction when starting new search
    setHasFootprintFromAction(false);
    console.log('Starting footprint search - cleared all errors and reset hasFootprintFromAction');

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
          
          // Update session storage with footprint polygon
          try {
            const PIN_STORAGE_KEY = 'lumionfy-pin-data';
            const currentStoredData = sessionStorage.getItem(PIN_STORAGE_KEY);
            if (currentStoredData && data.coordinates) {
              const storedData = JSON.parse(currentStoredData);
              const polygonData = {
                type: "Polygon" as const,
                coordinates: [footprintData.coordinates.map(coord => [coord[0], coord[1]])],
                source: footprintData.source
              };
              const updatedData = {
                ...storedData,
                coordinates: [data.coordinates[0], data.coordinates[1]],
                address: data.address,
                polygon: polygonData,
                timestamp: Date.now()
              };
              sessionStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(updatedData));
            }
          } catch (error) {
            console.error('Error updating session storage with footprint:', error);
          }
        } else {
          // Footprint data returned but no valid footprint - user must draw manually
          // Explicitly set hasFootprintFromAction to false to ensure message shows
          setHasFootprintFromAction(false);
          setFootprintNotFoundMessage('Nenhum footprint encontrado para esta localização. Desenhe o telhado manualmente.');
        }
      } else {
        // Handle errors based on errorCode only, not status codes
        console.log('Footprint API error - errorCode:', result.errorCode);
        
        // Route errors based on errorCode
        switch (result.errorCode) {
          case 'FOOTPRINT_NOT_FOUND':
            console.log('FOOTPRINT_NOT_FOUND - user must draw roof manually');
            setFootprintNotFoundMessage(result.error || 'Nenhum footprint encontrado para esta localização. Desenhe o telhado manualmente.');
            // Explicitly set hasFootprintFromAction to false to ensure message shows
            setHasFootprintFromAction(false);
            break;
            
          case 'FOOTPRINT_TIMEOUT':
            console.log('FOOTPRINT_TIMEOUT - user must draw roof manually');
            setFootprintNotFoundMessage('Busca por footprint demorou muito. Desenhe o telhado manualmente.');
            // Explicitly set hasFootprintFromAction to false to ensure message shows
            setHasFootprintFromAction(false);
            break;
            
          case 'FOOTPRINT_INVALID':
            console.log('FOOTPRINT_INVALID - user must draw roof manually');
            setFootprintNotFoundMessage('Dados de footprint inválidos. Desenhe o telhado manualmente.');
            // Explicitly set hasFootprintFromAction to false to ensure message shows
            setHasFootprintFromAction(false);
            break;
            
          case 'AUTH_REQUIRED':
          case 'AUTH_EXPIRED':
          case 'AUTH_INVALID':
            console.log('Auth error detected - showing in error banner');
            const errorInfo = handleError(result.error || 'Erro de autenticação', result.errorCode);
            setError(errorInfo.userMessage);
            break;
            
          case 'INSUFFICIENT_CREDITS':
            console.log('Credits error detected - showing in error banner');
            const creditsError = handleError(result.error || 'Créditos insuficientes', result.errorCode);
            setError(creditsError.userMessage);
            break;
            
          // All other errors (network, server, etc.) during footprint search
          // are treated as "footprint not available" - user must draw manually
          default:
            console.log('Other error during footprint search - user must draw roof manually');
            setFootprintNotFoundMessage('Footprint não disponível no momento. Desenhe o telhado manualmente.');
            // Don't set hasFootprintFromAction - force manual drawing
            break;
        }
      }
    } catch (error) {
      console.error('Footprint search error:', error);
      
      // For unexpected errors during footprint search, user must draw manually
      // Explicitly set hasFootprintFromAction to false to ensure message shows
      setHasFootprintFromAction(false);
      setFootprintNotFoundMessage('Erro inesperado ao buscar footprint. Desenhe o telhado manualmente.');
    } finally {
      setIsSearchingFootprints(false);
    }
  };

  
  
  const handleRunAnalysis = async () => {
    if (!selectedAddress) {
      setError('Nenhum endereço selecionado para análise');
      return;
    }
    
    // Check if we have coordinates and polygon (both required)
    if (!data.coordinates) {
      setError('Nenhuma coordenada disponível. Selecione um endereço primeiro.');
      return;
    }
    
    if (!hasFootprintFromAction && data.footprints.length === 0 && !currentPolygon) {
      setError('Execute primeiro a busca de footprint automático ou desenhe o telhado manualmente');
      return;
    }
    
    setIsAnalyzing(true);
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Starting analysis for address: ${selectedAddress}`);
      console.log('Current data coordinates:', data.coordinates);
      
      // Determine polygon source and usable area override
      let polygonToSend = currentPolygon;
      let usableAreaOverride: number | undefined;
      
      // Ensure user-drawn polygons have the correct source
      if (currentPolygon && !currentPolygon.source) {
        polygonToSend = {
          ...currentPolygon,
          source: "user-drawn"
        };
      }
      
      // If we have footprints from automatic detection, convert to polygon format
      if (data.footprints.length > 0 && !currentPolygon) {
        const activeFootprint = data.footprints.find(fp => fp.isActive);
        if (activeFootprint) {
          // Determine source - check if it's from Microsoft footprints
          let source: "user-drawn" | "microsoft-footprint" | "google-footprint" = "user-drawn";
          if (activeFootprint.source) {
            if (activeFootprint.source.toLowerCase().includes('microsoft')) {
              source = "microsoft-footprint";
            } else if (activeFootprint.source.toLowerCase().includes('google')) {
              source = "google-footprint";
            }
          }
          
          polygonToSend = {
            type: "Polygon" as const,
            coordinates: [activeFootprint.coordinates],
            source: source
          };
          console.log('Using footprint polygon for analysis:', polygonToSend);
        }
      }
      
      // Calculate usable area override for manual areas
      if (data.footprints.length > 0 && data.areaSource === 'footprint') {
        const totalArea = data.footprints.reduce((sum, fp) => sum + fp.area, 0);
        usableAreaOverride = Math.round(totalArea * data.usageFactor);
      }
      
      // Ensure we have a polygon to send
      if (!polygonToSend) {
        setError('Nenhum polígono disponível para análise. Desenhe o telhado ou busque footprint automático.');
        return;
      }
      
      const [lng, lat] = data.coordinates;
      const result = await analyzeAddress(
        selectedAddress,
        lat,
        lng,
        polygonToSend,
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
      console.log('transformedData.annualIrradiation:', transformedData.annualIrradiation);
      
      // Show analysis ID if saved to database
      if (transformedData.id) {
        console.log('Analysis saved to database with ID:', transformedData.id);
      }
      
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
      
      // Update session storage with polygon data
      try {
        const PIN_STORAGE_KEY = 'lumionfy-pin-data';
        const currentStoredData = sessionStorage.getItem(PIN_STORAGE_KEY);
        if (currentStoredData && currentCoordinates) {
          const storedData = JSON.parse(currentStoredData);
          const updatedData = {
            ...storedData,
            coordinates: [currentCoordinates[0], currentCoordinates[1]],
            address: transformedData.address,
            polygon: polygonToSend,
            timestamp: Date.now()
          };
          sessionStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(updatedData));
        }
      } catch (error) {
        console.error('Error updating session storage:', error);
      }
      
    } catch (error) {
      console.error('Analysis error:', error);
      setError(error instanceof Error ? error.message : 'Erro inesperado na análise');
    } finally {
      setIsAnalyzing(false);
      setIsLoading(false);
    }
  };
  const canAnalyze = selectedAddress && (hasFootprintFromAction || data.footprints.length > 0 || currentPolygon);
  
  // Debug logging for canAnalyze
  console.log('ActionButtons canAnalyze check:', {
    selectedAddress: !!selectedAddress,
    hasFootprintFromAction,
    footprintsLength: data.footprints.length,
    hasCurrentPolygon: !!currentPolygon,
    canAnalyze
  });

  return (
    <>
      <div className="space-y-3">
        {/* Botão de buscar footprints - agora vem primeiro */}
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

        {/* Botão principal - Executar Análise */}
        <Button 
          onClick={handleRunAnalysis}
          className="w-full"
          disabled={!canAnalyze || isAnalyzing || !!data.id}
        >
          {isAnalyzing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Zap className="mr-2 h-4 w-4" />
          )}
          {data.id ? 'Análise Salva' : (isAnalyzing ? 'Analisando...' : 'Executar Análise')}
        </Button>

        {/* Botão Salvar Análise - apenas após análise ser executada e não foi salva ainda */}
        {data.estimatedProduction > 0 && !data.id && (
          <Button 
            variant="secondary"
            onClick={handleSaveAnalysis}
            className="w-full"
            disabled={isSavingAnalysis}
          >
            {isSavingAnalysis ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isSavingAnalysis ? 'Salvando...' : 'Salvar Análise'}
          </Button>
        )}
      

        {/* Informações adicionais */}
        <div className="text-xs text-muted-foreground text-center pt-2 border-t space-y-1">
          {!selectedAddress && (
            <p className="text-amber-600">
              Selecione um endereço para executar análise
            </p>
          )}
          {/* Show specific footprint message if available, otherwise show generic instruction */}
          {selectedAddress && !hasFootprintFromAction && data.footprints.length === 0 && !currentPolygon && (
            footprintNotFoundMessage ? (
              <p className="text-orange-600">
                {footprintNotFoundMessage}
              </p>
            ) : (
              <p className="text-amber-600">
                Execute a busca de footprint automático ou desenhe o telhado manualmente
              </p>
            )
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