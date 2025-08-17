"use client";

import { useState } from "react";
import { AddressSearch } from "./address-search";
import { MapView } from "./map-view";
import { DrawingToolbar } from "./drawing-toolbar";
import { LayerToggles } from "./layer-toggles";

export function MapPanel() {
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [mapLayer, setMapLayer] = useState<"satellite" | "streets">("satellite");
  const [showShadow, setShowShadow] = useState(false);
  const [showRelief, setShowRelief] = useState(false);

  return (
    <div className="relative h-full w-full">
      {/* Busca de endereço - fixa no topo */}
      <div className="absolute top-4 left-4 right-4 z-20">
        <AddressSearch />
      </div>

      {/* Toolbar de desenho - quando ativo */}
      {isDrawingMode && (
        <div className="absolute top-20 left-4 z-20">
          <DrawingToolbar onExit={() => setIsDrawingMode(false)} />
        </div>
      )}

      {/* Controles de camada - canto inferior esquerdo */}
      <div className="absolute bottom-4 left-4 z-20">
        <LayerToggles
          mapLayer={mapLayer}
          onMapLayerChange={setMapLayer}
          showShadow={showShadow}
          onShadowToggle={setShowShadow}
          showRelief={showRelief}
          onReliefToggle={setShowRelief}
        />
      </div>

      {/* Botão Desenhar telhado - canto inferior direito */}
      <div className="absolute bottom-4 right-4 z-20">
        <button
          onClick={() => setIsDrawingMode(!isDrawingMode)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            isDrawingMode
              ? "bg-red-500 text-white hover:bg-red-600"
              : "bg-white text-gray-900 shadow-lg hover:bg-gray-50 border"
          }`}
        >
          {isDrawingMode ? "Cancelar Desenho" : "Desenhar Telhado"}
        </button>
      </div>

      {/* Mapa principal */}
      <MapView
        layer={mapLayer}
        showShadow={showShadow}
        showRelief={showRelief}
        isDrawingMode={isDrawingMode}
      />

      {/* Instruções de desenho - quando ativo */}
      {isDrawingMode && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
          <div className="bg-black/75 text-white px-4 py-2 rounded-lg text-sm">
            Clique para marcar os vértices. Feche o polígono no último ponto.
          </div>
        </div>
      )}
    </div>
  );
}