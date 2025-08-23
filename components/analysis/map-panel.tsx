"use client";

import { useState, useRef, useEffect } from "react";
import { AddressSearch } from "./address-search";
import { MapView } from "./map-view";
import { DrawingToolbar } from "./drawing-toolbar";
import { LayerToggles } from "./layer-toggles";
import { MapPin } from "lucide-react";
import { MapLibreMapRef } from "./maplibre-map";
import { useAnalysis } from "./analysis-context";

interface MapPanelProps {
  mapRef: React.RefObject<MapLibreMapRef>;
}

export function MapPanel({ mapRef }: MapPanelProps) {
  const { data: _data, hasAnalysisResults: _hasAnalysisResults } = useAnalysis();
  
  // Debug da referência do mapa
  useEffect(() => {
    console.log('🗺️ MapPanel - mapRef status:', {
      hasRef: !!mapRef,
      hasCurrent: !!mapRef.current,
      refType: typeof mapRef.current
    });
  }, [mapRef]);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isPinMode, setIsPinMode] = useState(false);
  const [mapLayer, setMapLayer] = useState<"satellite" | "streets">("satellite");
  const [showShadow, setShowShadow] = useState(false);
  const [showRelief, setShowRelief] = useState(false);
  const [showDataLayers, setShowDataLayers] = useState(false);
  const [selectedDataLayer, setSelectedDataLayer] = useState<string>('');
  const [hasPin, setHasPin] = useState(false);
  const [drawingCoordinates, setDrawingCoordinates] = useState<[number, number][]>([]);
  const [showDrawingInstructions, setShowDrawingInstructions] = useState(false);
  const [showPinInstructions, setShowPinInstructions] = useState(false);

  // Drawing toolbar functions
  const handleUndoLastPoint = () => {
    mapRef.current?.undoLastPoint();
  };

  const handleClearDrawing = () => {
    mapRef.current?.clearDrawing();
  };

  // Callback to sync coordinates from map
  const handleDrawingCoordinatesChange = (coordinates: [number, number][]) => {
    setDrawingCoordinates(coordinates);
  };


  // Callback to receive pin status from map
  const handlePinStatusChange = (hasPin: boolean) => {
    setHasPin(hasPin);
  };

  // Function to handle pin removal
  const handleClearPin = () => {
    mapRef.current?.clearPin();
  };

  // Auto-hide drawing instructions after 5 seconds
  useEffect(() => {
    if (isDrawingMode) {
      setShowDrawingInstructions(true);
      const timer = setTimeout(() => {
        setShowDrawingInstructions(false);
      }, 5000); // 5 seconds

      return () => clearTimeout(timer);
    } else {
      setShowDrawingInstructions(false);
    }
  }, [isDrawingMode]);

  // Auto-hide pin instructions after 5 seconds
  useEffect(() => {
    if (isPinMode) {
      setShowPinInstructions(true);
      const timer = setTimeout(() => {
        setShowPinInstructions(false);
      }, 5000); // 5 seconds

      return () => clearTimeout(timer);
    } else {
      setShowPinInstructions(false);
    }
  }, [isPinMode]);

  // Note: Data Layers are not auto-enabled anymore
  // Users must manually click to enable and load them

  return (
    <div className="relative h-full w-full">
      {/* Busca de endereço - fixa no topo */}
      {!isDrawingMode && (
        <div className="absolute top-2 md:top-4 left-2 md:left-4 right-12 md:right-16 z-20">
          <AddressSearch />
        </div>
      )}

      {/* Toolbar de desenho - quando ativo */}
      {isDrawingMode && (
        <div className="absolute top-2 md:top-4 left-2 md:left-4 z-20">
          <DrawingToolbar 
            onExit={() => setIsDrawingMode(false)}
            drawingCoordinates={drawingCoordinates}
            onUndoLastPoint={handleUndoLastPoint}
            onClearDrawing={handleClearDrawing}
          />
        </div>
      )}

      {/* Controles lado esquerdo - empilhados */}
      <div className="absolute bottom-2 md:bottom-4 left-2 md:left-4 z-20 space-y-2">
        {/* Controles de camada - ocultos no modo desenho */}
        {!isDrawingMode && (
          <LayerToggles
            mapLayer={mapLayer}
            onMapLayerChange={setMapLayer}
            showShadow={showShadow}
            onShadowToggle={setShowShadow}
            showRelief={showRelief}
            onReliefToggle={setShowRelief}
            showDataLayers={showDataLayers}
            onDataLayersToggle={setShowDataLayers}
            selectedDataLayer={selectedDataLayer}
            onDataLayerSelect={setSelectedDataLayer}
            hasPin={hasPin}
          />
        )}
        
        {/* Botão Colocar Pin - oculto no modo desenho */}
        {!isDrawingMode && (
          <button
            onClick={() => {
              if (isPinMode || hasPin) {
                // Se está no modo pin OU há um pin no mapa, cancelar e limpar pin existente
                setIsPinMode(false);
                handleClearPin();
              } else {
                // Se não está no modo pin e não há pin, ativar modo pin
                setIsPinMode(true);
                if (isDrawingMode) setIsDrawingMode(false);
              }
            }}
            className={`w-full px-3 md:px-4 py-2 rounded-lg font-medium transition-colors text-sm md:text-base shadow-lg flex items-center justify-center space-x-2 ${
              isPinMode || hasPin
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-background text-foreground hover:bg-muted border"
            }`}
          >
            <MapPin className="h-4 w-4" />
            <span className="hidden md:inline">
              {(isPinMode || hasPin) ? "Cancelar Pin" : "Colocar Pin"}
            </span>
            <span className="md:hidden">
              {(isPinMode || hasPin) ? "Cancelar" : "Pin"}
            </span>
          </button>
        )}
        
        {/* Botão Desenhar telhado */}
        <button
          onClick={() => {
            setIsDrawingMode(!isDrawingMode);
            if (isPinMode) setIsPinMode(false);
          }}
          className={`w-full px-3 md:px-4 py-2 rounded-lg font-medium transition-colors text-sm md:text-base shadow-lg ${
            isDrawingMode
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              : "bg-background text-foreground hover:bg-muted border"
          }`}
        >
          <span className="hidden md:inline">
            {isDrawingMode ? "Cancelar Desenho" : "Desenhar Telhado"}
          </span>
          <span className="md:hidden">
            {isDrawingMode ? "Cancelar" : "Desenhar"}
          </span>
        </button>
      </div>

      {/* Mapa principal */}
      <MapView
        ref={mapRef}
        layer={mapLayer}
        showShadow={showShadow}
        showRelief={showRelief}
        showDataLayers={showDataLayers}
        selectedDataLayer={selectedDataLayer}
        isDrawingMode={isDrawingMode}
        isPinMode={isPinMode}
        onDrawingCoordinatesChange={handleDrawingCoordinatesChange}
        onPinStatusChange={handlePinStatusChange}
      />

      {/* Instruções de desenho - quando ativo */}
      {showDrawingInstructions && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
          <div className="bg-black/75 text-white px-4 py-2 rounded-lg text-sm animate-fade-in">
            Clique para marcar os vértices. Feche o polígono no último ponto.
          </div>
        </div>
      )}
      
      {/* Instruções de pin - quando ativo */}
      {showPinInstructions && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
          <div className="bg-black/75 text-white px-4 py-2 rounded-lg text-sm animate-fade-in">
            Clique no mapa para colocar um pin no local desejado.
          </div>
        </div>
      )}
    </div>
  );
}