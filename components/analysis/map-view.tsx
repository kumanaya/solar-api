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
  isPinMode?: boolean;
  onDrawingCoordinatesChange?: (coordinates: [number, number][]) => void;
  onDataLayersDataChange?: (data: unknown, loading: boolean) => void;
  onPinStatusChange?: (hasPin: boolean) => void;
}

export const MapView = forwardRef<MapLibreMapRef, MapViewProps>(({ layer, showShadow, showRelief, showDataLayers, selectedDataLayer, isDrawingMode, isPinMode = false, onDrawingCoordinatesChange, onDataLayersDataChange, onPinStatusChange }, ref) => {
  return (
    <MapLibreMap 
      ref={ref}
      layer={layer}
      showShadow={showShadow}
      showRelief={showRelief}
      showDataLayers={showDataLayers}
      selectedDataLayer={selectedDataLayer}
      isDrawingMode={isDrawingMode}
      isPinMode={isPinMode}
      onDrawingCoordinatesChange={onDrawingCoordinatesChange}
      onDataLayersDataChange={onDataLayersDataChange}
      onPinStatusChange={onPinStatusChange}
    />
  );
});

MapView.displayName = 'MapView';