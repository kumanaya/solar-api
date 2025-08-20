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
    <MapLibreMap 
      ref={ref}
      layer={layer}
      showShadow={showShadow}
      showRelief={showRelief}
      isDrawingMode={isDrawingMode}
      isPinMode={isPinMode}
      onDrawingCoordinatesChange={onDrawingCoordinatesChange}
    />
  );
});

MapView.displayName = 'MapView';