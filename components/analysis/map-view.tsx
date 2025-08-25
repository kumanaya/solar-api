"use client";

import { forwardRef } from "react";
import { MapLibreMap, MapLibreMapRef } from "./maplibre-map";

interface MapViewProps {
  layer: "satellite" | "streets";
  showShadow: boolean;
  showRelief: boolean;
  showDataLayers: boolean;
  selectedDataLayer?: string;
  isDrawingMode: boolean;
  onDrawingCoordinatesChange?: (coordinates: [number, number][]) => void;
  onDataLayersDataChange?: (data: unknown, loading: boolean) => void;
}

export const MapView = forwardRef<MapLibreMapRef, MapViewProps>(({ layer, showShadow, showRelief, showDataLayers, selectedDataLayer, isDrawingMode, onDrawingCoordinatesChange, onDataLayersDataChange }, ref) => {
  return (
    <MapLibreMap 
      ref={ref}
      layer={layer}
      showShadow={showShadow}
      showRelief={showRelief}
      showDataLayers={showDataLayers}
      selectedDataLayer={selectedDataLayer}
      isDrawingMode={isDrawingMode}
      onDrawingCoordinatesChange={onDrawingCoordinatesChange}
      onDataLayersDataChange={onDataLayersDataChange}
    />
  );
});

MapView.displayName = 'MapView';