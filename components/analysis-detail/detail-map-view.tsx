"use client";

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useAnalysisDetail } from "./analysis-detail-context";
import { MapLibreMapRef } from "../analysis/maplibre-map";

// MapLibre style configuration
const getMapStyle = (): maplibregl.StyleSpecification => ({
  version: 8,
  sources: {
    'satellite': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      attribution: '© Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community'
    }
  },
  layers: [
    {
      id: 'satellite',
      type: 'raster',
      source: 'satellite'
    }
  ]
});

export const DetailMapView = forwardRef<MapLibreMapRef>((_, ref) => {
  const { analysis, isLoading } = useAnalysisDetail();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Implementar as funções necessárias para MapLibreMapRef
  useImperativeHandle(ref, () => ({
    undoLastPoint: () => {
      console.warn('undoLastPoint não implementado no DetailMapView');
    },
    clearDrawing: () => {
      console.warn('clearDrawing não implementado no DetailMapView');
    },
    getDrawingCoordinates: () => {
      console.warn('getDrawingCoordinates não implementado no DetailMapView');
      return [];
    },
    reopenPolygon: () => {
      console.warn('reopenPolygon não implementado no DetailMapView');
    },
    clearPin: () => {
      console.warn('clearPin não implementado no DetailMapView');
    },
    captureMapImage: async (): Promise<string | null> => {
      if (!map.current) return null;

      try {
        // Forçar renderização e aguardar um frame
        map.current.triggerRepaint();
        await new Promise(requestAnimationFrame);
        
        // Pegar o canvas do mapa
        const mapCanvas = map.current.getCanvas();
        
        // Criar um novo canvas com fundo branco
        const canvas = document.createElement('canvas');
        canvas.width = mapCanvas.width;
        canvas.height = mapCanvas.height;
        
        const ctx = canvas.getContext('2d', {
          alpha: false // Desabilitar alpha para garantir fundo sólido
        });
        
        if (!ctx) return null;

        // Preencher com fundo branco
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Desenhar o mapa sobre o fundo branco
        ctx.drawImage(mapCanvas, 0, 0);
        
        // Converter para JPEG (sem transparência) com qualidade máxima
        return canvas.toDataURL('image/jpeg', 1.0);
      } catch (error) {
        console.error('Erro ao capturar mapa:', error);
        return null;
      }
    }
  }), []);

  useEffect(() => {
    if (!analysis || !mapContainer.current || map.current) return;

    console.log('Initializing map with analysis:', {
      id: analysis.id,
      coordinates: analysis.coordinates,
      footprints: analysis.footprints,
      polygon: analysis.polygon
    });

    // Get center coordinates from footprint or fallback to address coordinates
    let centerCoordinates = [analysis.coordinates[1], analysis.coordinates[0]]; // [lng, lat]
    let initialZoom = 18;

    // If we have footprints, use them to calculate center and zoom
    if (analysis.footprints && analysis.footprints.length > 0) {
      const activeFootprint = analysis.footprints.find(fp => fp.isActive) || analysis.footprints[0];
      const coords = activeFootprint.coordinates;
      
      console.log('Active footprint coords:', coords);
      
      // Coordinates are already in [lng, lat] format from database
      const lngs = coords.map(coord => coord[0]);
      const lats = coords.map(coord => coord[1]);
      
      const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
      const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      
      console.log('Calculated center:', [centerLng, centerLat]);
      
      centerCoordinates = [centerLng, centerLat];
      initialZoom = 17; // Moderate zoom to avoid "map data not yet available"
    } else if (analysis.polygon.coordinates.length > 0) {
      // Fallback to polygon data (assuming [lat, lng] format for backward compatibility)
      const coords = analysis.polygon.coordinates;
      const lngs = coords.map(coord => coord[1]);
      const lats = coords.map(coord => coord[0]);
      
      const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
      const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      
      centerCoordinates = [centerLng, centerLat];
      initialZoom = 17;
    }

    console.log('Final center coordinates:', centerCoordinates);

    // Initialize map
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: getMapStyle(),
      center: centerCoordinates,
      zoom: initialZoom,
      preserveDrawingBuffer: true, // Necessário para captura de imagem
      antialias: true,
      attributionControl: false
    });

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [analysis]);

  useEffect(() => {
    if (!map.current || !mapLoaded || !analysis) return;

    // Ensure style is fully loaded before adding sources/layers
    if (!map.current.isStyleLoaded()) {
      // Wait for style to load
      map.current.once('styledata', () => {
        // Retry this effect after style loads
        if (map.current && mapLoaded && analysis) {
          addAnalysisDataToMap();
        }
      });
      return;
    }

    addAnalysisDataToMap();

    function addAnalysisDataToMap() {
      if (!map.current || !analysis) return;

      console.log('Analysis data for map:', {
        id: analysis.id,
        coordinates: analysis.coordinates,
        footprints: analysis.footprints,
        polygon: analysis.polygon
      });

      // Add marker for the address
      new maplibregl.Marker({ color: '#ef4444' })
        .setLngLat([analysis.coordinates[1], analysis.coordinates[0]])
        .addTo(map.current);

      // Add all footprints from the analysis data
      if (analysis.footprints && analysis.footprints.length > 0) {
        console.log('Adding footprints to map:', analysis.footprints);
        
        analysis.footprints.forEach((footprint, index) => {
          // Coordinates are already in [lng, lat] format from database
          const coordinates = footprint.coordinates;
          
          console.log(`Adding footprint ${index}:`, {
            id: footprint.id,
            coordinates,
            isActive: footprint.isActive,
            area: footprint.area
          });
          
          // Add source for this footprint
          map.current!.addSource(`footprint-${index}`, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {
              id: footprint.id,
              area: footprint.area,
              source: footprint.source,
              isActive: footprint.isActive
            },
            geometry: {
              type: 'Polygon',
              coordinates: [coordinates]
            }
          }
        });

        // Style based on whether it's active and source type
        const fillColor = footprint.isActive ? '#3b82f6' : '#6b7280';
        const fillOpacity = footprint.isActive ? 0.4 : 0.2;
        const lineColor = footprint.isActive ? '#3b82f6' : '#6b7280';
        const lineWidth = footprint.isActive ? 3 : 2;

        // Add fill layer
        map.current!.addLayer({
          id: `footprint-fill-${index}`,
          type: 'fill',
          source: `footprint-${index}`,
          paint: {
            'fill-color': fillColor,
            'fill-opacity': fillOpacity
          }
        });

        // Add outline layer
        map.current!.addLayer({
          id: `footprint-outline-${index}`,
          type: 'line',
          source: `footprint-${index}`,
          paint: {
            'line-color': lineColor,
            'line-width': lineWidth
          }
        });
      });

      // Fit map to show all footprints
      const bounds = new maplibregl.LngLatBounds();
      analysis.footprints.forEach(footprint => {
        footprint.coordinates.forEach(coord => {
          bounds.extend(coord); // Already in [lng, lat] format
        });
      });
      
      if (!bounds.isEmpty()) {
        map.current.fitBounds(bounds, { padding: 100, maxZoom: 17 });
      }
    } else if (analysis.polygon.coordinates.length > 0) {
      // Fallback to polygon data if no footprints
      const coordinates = analysis.polygon.coordinates.map(coord => [coord[1], coord[0]]);
      
      map.current.addSource('polygon', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [coordinates]
          }
        }
      });

      map.current.addLayer({
        id: 'polygon-fill',
        type: 'fill',
        source: 'polygon',
        paint: {
          'fill-color': '#3b82f6',
          'fill-opacity': 0.4
        }
      });

      map.current.addLayer({
        id: 'polygon-outline',
        type: 'line',
        source: 'polygon',
        paint: {
          'line-color': '#3b82f6',
          'line-width': 3
        }
      });

      const bounds = new maplibregl.LngLatBounds();
      coordinates.forEach(coord => bounds.extend(coord));
      map.current.fitBounds(bounds, { padding: 50 });
    }
    }
  }, [mapLoaded, analysis]);

  if (isLoading || !analysis) {
    return (
      <div className="h-full w-full bg-muted relative overflow-hidden">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted via-muted/80 to-muted/60" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-background rounded-lg p-4 shadow-lg border">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Carregando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      {/* MapLibre container */}
      <div ref={mapContainer} className="h-full w-full" />

      {/* Coordenadas no canto superior esquerdo */}
      <div className="absolute top-2 md:top-4 left-2 md:left-4 bg-background/90 backdrop-blur-sm rounded-lg p-2 md:p-3 shadow-lg border z-10">
        <div className="text-xs space-y-1">
          <p className="font-medium">Coordenadas</p>
          <p className="text-muted-foreground">
            {analysis.coordinates[0].toFixed(6)}, {analysis.coordinates[1].toFixed(6)}
          </p>
        </div>
      </div>

      {/* Legenda dos footprints */}
      {((analysis.footprints && analysis.footprints.length > 0) || analysis.polygon.coordinates.length > 0) && (
        <div className="absolute bottom-2 md:bottom-4 left-2 md:left-4 bg-background/90 backdrop-blur-sm rounded-lg p-2 md:p-3 shadow-lg border z-10">
          <div className="text-xs space-y-2">
            <p className="font-medium">Área Analisada</p>
            
            {/* Active footprint legend */}
            <div className="flex items-center space-x-2">
              <div className="w-4 h-3 bg-blue-400 border-2 border-blue-600 rounded-sm"></div>
              <span className="text-muted-foreground">Footprint ativo</span>
            </div>
            
            {/* Inactive footprint legend if there are multiple */}
            {analysis.footprints && analysis.footprints.length > 1 && (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-3 bg-gray-400 border-2 border-gray-600 rounded-sm"></div>
                <span className="text-muted-foreground">Outros footprints</span>
              </div>
            )}
            
            <div className="space-y-1 text-muted-foreground">
              {analysis.footprints && analysis.footprints.length > 0 ? (
                <>
                  <p>Footprints: {analysis.footprints.length}</p>
                  <p>Área total: {analysis.footprints.find(fp => fp.isActive)?.area || analysis.polygon.area}m²</p>
                </>
              ) : (
                <p>Área total: {analysis.polygon.area}m²</p>
              )}
              <p>Fator de uso: {(analysis.currentVersion.parameters.usageFactor * 100).toFixed(0)}%</p>
              <p>Área útil: {analysis.currentVersion.usableArea}m²</p>
            </div>
          </div>
        </div>
      )}

      {/* Overlay de "congelado" para indicar que não é editável */}
      <div className="absolute top-2 md:top-4 right-2 md:right-4 bg-muted/90 border border-border rounded-lg p-2 shadow-lg z-10">
        <div className="flex items-center space-x-2 text-muted-foreground">
          <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
          <span className="text-xs font-medium">Visualização Somente Leitura</span>
        </div>
      </div>
    </div>
  );
});

DetailMapView.displayName = 'DetailMapView';