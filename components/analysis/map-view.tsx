"use client";

import { forwardRef } from "react";
import { MapLibreMap, MapLibreMapRef } from "./maplibre-map";

interface MapViewProps {
  layer: "satellite" | "streets";
  showShadow: boolean;
  showRelief: boolean;
  isDrawingMode: boolean;
  isPinMode?: boolean;
  onDrawingCoordinatesChange?: (coordinates: [number, number][]) => void;
}

export const MapView = forwardRef<MapLibreMapRef, MapViewProps>(({ layer, showShadow, showRelief, isDrawingMode, isPinMode = false, onDrawingCoordinatesChange }, ref) => {
  return (
    <div className="h-full w-full relative">
      <MapLibreMap 
        ref={ref}
        layer={layer}
        showShadow={showShadow}
        showRelief={showRelief}
        isDrawingMode={isDrawingMode}
        isPinMode={isPinMode}
        onDrawingCoordinatesChange={onDrawingCoordinatesChange}
      />
      
      {/* Overlay de sombra (NDVI) - rendered on top of map */}
      {showShadow && (
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-green-500/20 to-green-800/40 pointer-events-none" />
      )}

      {/* Overlay de relevo (DEM) - rendered on top of map */}
      {showRelief && (
        <div className="absolute inset-0 bg-gradient-to-br from-orange-200/30 via-yellow-200/20 to-red-200/30 pointer-events-none" />
      )}
    </div>
  );
});

MapView.displayName = 'MapView';