"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layers, Satellite, Map, Eye, Mountain, Grid3X3, Image, MapPin, Sun, Calendar, AlertTriangle } from "lucide-react";

// Pre-defined data layers structure
const DATA_LAYERS = {
  dsmUrl: {
    key: 'dsmUrl',
    title: 'Modelo Digital de Superfície',
    description: 'Elevação da superfície incluindo edifícios e vegetação',
    type: 'elevation',
    icon: Mountain
  },
  rgbUrl: {
    key: 'rgbUrl',
    title: 'Imagem de Satélite',
    description: 'Imagem aérea de alta resolução da área',
    type: 'imagery',
    icon: Image
  },
  maskUrl: {
    key: 'maskUrl',
    title: 'Máscara de Área',
    description: 'Áreas adequadas para instalação solar',
    type: 'mask',
    icon: MapPin
  },
  annualFluxUrl: {
    key: 'annualFluxUrl',
    title: 'Fluxo Solar Anual',
    description: 'Irradiação solar total anual (kWh/kW)',
    type: 'solar_flux',
    icon: Sun
  },
  monthlyFluxUrl: {
    key: 'monthlyFluxUrl',
    title: 'Fluxo Solar Mensal',
    description: 'Variação mensal da irradiação solar',
    type: 'solar_flux',
    icon: Calendar
  }
};

const HOURLY_SHADE_HOURS = [6, 8, 10, 12, 14, 16, 18];

interface LayerTogglesProps {
  mapLayer: "satellite" | "streets";
  onMapLayerChange: (layer: "satellite" | "streets") => void;
  showShadow: boolean;
  onShadowToggle: (show: boolean) => void;
  showRelief: boolean;
  onReliefToggle: (show: boolean) => void;
  showDataLayers: boolean;
  onDataLayersToggle: (show: boolean) => void;
  selectedDataLayer?: string;
  onDataLayerSelect?: (layerKey: string) => void;
  hasPin?: boolean;
}

export function LayerToggles({
  mapLayer,
  onMapLayerChange,
  showShadow,
  onShadowToggle,
  showRelief,
  onReliefToggle,
  showDataLayers,
  onDataLayersToggle,
  selectedDataLayer: _selectedDataLayer,
  onDataLayerSelect: _onDataLayerSelect,
  hasPin = false
}: LayerTogglesProps) {
  
  const handleLayerClick = (layerKey: string) => {
    alert(`Camada "${DATA_LAYERS[layerKey as keyof typeof DATA_LAYERS]?.title}" não está disponível no momento. Esta funcionalidade será implementada em breve.`);
  };

  const handleHourlyShadeClick = (hour: number) => {
    alert(`Análise de sombreamento às ${hour}:00h não está disponível no momento. Esta funcionalidade será implementada em breve.`);
  };
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
        
        <Button
          size="sm"
          variant={showDataLayers ? "default" : "outline"}
          onClick={() => onDataLayersToggle(!showDataLayers)}
          className="w-full justify-between"
        >
          <div className="flex items-center">
            <Grid3X3 className="h-3 w-3 mr-2" />
            <span className="truncate">Camadas de Dados</span>
          </div>
          {showDataLayers && <Badge variant="secondary" className="text-xs ml-2 flex-shrink-0">ON</Badge>}
        </Button>
        
        {/* Data layers warning when no pin */}
        {showDataLayers && !hasPin && (
          <div className="space-y-1 mt-2 pt-2 border-t border-border">
            <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400">
              <MapPin className="h-3 w-3" />
              <p className="text-xs">Coloque um pin no mapa primeiro</p>
            </div>
          </div>
        )}

        {/* Data Layer Selection */}
        {showDataLayers && hasPin && (
          <div className="space-y-2 mt-2 pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">Camadas de Dados</p>
            {Object.entries(DATA_LAYERS).map(([key, layer]) => {
              const LayerIcon = layer.icon;
              
              return (
                <Button
                  key={key}
                  size="sm"
                  variant="outline"
                  onClick={() => handleLayerClick(key)}
                  className="w-full justify-start text-left"
                  title={layer.description}
                >
                  <LayerIcon className="h-3 w-3 mr-2 flex-shrink-0" />
                  <span className="truncate text-xs">{layer.title}</span>
                  <AlertTriangle className="h-3 w-3 ml-auto text-muted-foreground" />
                </Button>
              );
            })}
            
            {/* Hourly Shade Layers */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Sombreamento por Hora</p>
              <div className="grid grid-cols-2 gap-1">
                {HOURLY_SHADE_HOURS.map((hour) => (
                  <Button
                    key={`shade-${hour}`}
                    size="sm"
                    variant="outline"
                    onClick={() => handleHourlyShadeClick(hour)}
                    className="text-xs px-2"
                    title={`Análise de sombreamento às ${hour}:00 horas`}
                  >
                    <Calendar className="h-3 w-3 mr-1" />
                    {hour}h
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}