"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layers, Satellite, Map, Eye, Mountain } from "lucide-react";

interface LayerTogglesProps {
  mapLayer: "satellite" | "streets";
  onMapLayerChange: (layer: "satellite" | "streets") => void;
  showShadow: boolean;
  onShadowToggle: (show: boolean) => void;
  showRelief: boolean;
  onReliefToggle: (show: boolean) => void;
}

export function LayerToggles({
  mapLayer,
  onMapLayerChange,
  showShadow,
  onShadowToggle,
  showRelief,
  onReliefToggle
}: LayerTogglesProps) {
  return (
    <div className="bg-background rounded-lg shadow-lg border p-3 space-y-3 w-60">
      <div className="flex items-center space-x-2">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Camadas</span>
      </div>
      
      {/* Toggle de tipo de mapa */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Tipo de mapa</p>
        <div className="flex space-x-1">
          <Button
            size="sm"
            variant={mapLayer === "satellite" ? "default" : "outline"}
            onClick={() => onMapLayerChange("satellite")}
            className="flex-1"
          >
            <Satellite className="h-3 w-3 mr-1" />
            Satélite
          </Button>
          <Button
            size="sm"
            variant={mapLayer === "streets" ? "default" : "outline"}
            onClick={() => onMapLayerChange("streets")}
            className="flex-1"
          >
            <Map className="h-3 w-3 mr-1" />
            Ruas
          </Button>
        </div>
      </div>

      {/* Toggles de camadas extras */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Camadas extras</p>
        
        <Button
          size="sm"
          variant={showShadow ? "default" : "outline"}
          onClick={() => onShadowToggle(!showShadow)}
          className="w-full justify-between"
        >
          <div className="flex items-center">
            <Eye className="h-3 w-3 mr-2" />
            <span className="truncate">Sombra (NDVI)</span>
          </div>
          {showShadow && <Badge variant="secondary" className="text-xs ml-2 flex-shrink-0">ON</Badge>}
        </Button>
        
        <Button
          size="sm"
          variant={showRelief ? "default" : "outline"}
          onClick={() => onReliefToggle(!showRelief)}
          className="w-full justify-between"
        >
          <div className="flex items-center">
            <Mountain className="h-3 w-3 mr-2" />
            <span className="truncate">Relevo (DEM)</span>
          </div>
          {showRelief && <Badge variant="secondary" className="text-xs ml-2 flex-shrink-0">ON</Badge>}
        </Button>
        
      </div>
    </div>
  );
}