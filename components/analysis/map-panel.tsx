"use client";

import { useState } from "react";
import { AddressSearch } from "./address-search";
import { MapView } from "./map-view";
import { DrawingToolbar } from "./drawing-toolbar";
import { LayerToggles } from "./layer-toggles";
import { MapPin } from "lucide-react";

export function MapPanel() {
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isPinMode, setIsPinMode] = useState(false);
  const [mapLayer, setMapLayer] = useState<"satellite" | "streets">("satellite");
  const [showShadow, setShowShadow] = useState(false);
  const [showRelief, setShowRelief] = useState(false);

  return (
    <div className="relative h-full w-full">
      {/* Busca de endereço - fixa no topo */}
      <div className="absolute top-2 md:top-4 left-2 md:left-4 right-12 md:right-16 z-20">
        <AddressSearch />
      </div>

      {/* Toolbar de desenho - quando ativo */}
      {isDrawingMode && (
        <div className="absolute top-16 md:top-20 left-2 md:left-4 z-20">
          <DrawingToolbar onExit={() => setIsDrawingMode(false)} />
        </div>
      )}

      {/* Controles lado esquerdo - empilhados */}
      <div className="absolute bottom-2 md:bottom-4 left-2 md:left-4 z-20 space-y-2">
        {/* Controles de camada */}
        <LayerToggles
          mapLayer={mapLayer}
          onMapLayerChange={setMapLayer}
          showShadow={showShadow}
          onShadowToggle={setShowShadow}
          showRelief={showRelief}
          onReliefToggle={setShowRelief}
        />
        
        {/* Botão Colocar Pin */}
        <button
          onClick={() => {
            setIsPinMode(!isPinMode);
            if (isDrawingMode) setIsDrawingMode(false);
          }}
          className={`w-full px-3 md:px-4 py-2 rounded-lg font-medium transition-colors text-sm md:text-base shadow-lg flex items-center justify-center space-x-2 ${
            isPinMode
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-background text-foreground hover:bg-muted border"
          }`}
        >
          <MapPin className="h-4 w-4" />
          <span className="hidden md:inline">
            {isPinMode ? "Cancelar Pin" : "Colocar Pin"}
          </span>
          <span className="md:hidden">
            {isPinMode ? "Cancelar" : "Pin"}
          </span>
        </button>
        
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
        layer={mapLayer}
        showShadow={showShadow}
        showRelief={showRelief}
        isDrawingMode={isDrawingMode}
        isPinMode={isPinMode}
      />

      {/* Instruções de desenho - quando ativo */}
      {isDrawingMode && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
          <div className="bg-black/75 text-white px-4 py-2 rounded-lg text-sm">
            Clique para marcar os vértices. Feche o polígono no último ponto.
          </div>
        </div>
      )}
      
      {/* Instruções de pin - quando ativo */}
      {isPinMode && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
          <div className="bg-black/75 text-white px-4 py-2 rounded-lg text-sm">
            Clique no mapa para colocar um pin no local desejado.
          </div>
        </div>
      )}
    </div>
  );
}