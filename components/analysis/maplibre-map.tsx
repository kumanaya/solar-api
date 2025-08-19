"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useAnalysis } from "./analysis-context";

interface MapLibreMapProps {
  layer: "satellite" | "streets";
  showShadow?: boolean; // Optional since handled by parent
  showRelief?: boolean; // Optional since handled by parent
  isDrawingMode: boolean;
}

// Move function outside component to avoid re-creation
const getMapStyle = (layerType: "satellite" | "streets"): maplibregl.StyleSpecification => {
  if (layerType === "satellite") {
    return {
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
    };
  } else {
    return {
      version: 8,
      sources: {
        'osm': {
          type: 'raster',
          tiles: [
            'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors'
        }
      },
      layers: [
        {
          id: 'osm',
          type: 'raster',
          source: 'osm'
        }
      ]
    };
  }
};

export function MapLibreMap({ layer, isDrawingMode }: MapLibreMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const { data } = useAnalysis();
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [currentLayer, setCurrentLayer] = useState<string>(layer);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const style = getMapStyle(layer);

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: style,
      center: [-46.6333, -23.5505], // São Paulo default
      zoom: 12,
      attributionControl: false // We'll add our own attribution control
    });

    map.current.on('load', () => {
      setIsMapLoaded(true);
    });

    // Add navigation controls
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    
    // Add attribution control
    map.current.addControl(new maplibregl.AttributionControl({
      compact: true
    }), 'bottom-right');

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        setIsMapLoaded(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array is intentional - only run on mount/unmount

  // Handle layer changes
  useEffect(() => {
    if (!map.current || !isMapLoaded || currentLayer === layer) return;

    const newStyle = getMapStyle(layer);
    
    map.current.setStyle(newStyle);
    setCurrentLayer(layer);
    
    // Wait for style to load before allowing other operations
    const onStyleLoad = () => {
      // Style loaded, ready for operations
    };
    
    map.current.once('styledata', onStyleLoad);
    
  }, [layer, isMapLoaded, currentLayer]);

  // Handle coordinates marker
  useEffect(() => {
    if (!map.current || !isMapLoaded || !data.coordinates) return;

    // Ensure coordinates is a string before splitting
    const coordsStr = typeof data.coordinates === 'string' ? data.coordinates : String(data.coordinates);
    const coords = coordsStr.split(',');
    if (coords.length !== 2) return;
    
    const [lng, lat] = coords.map(Number);
    if (isNaN(lng) || isNaN(lat)) return;
    
    // Remove existing marker
    const existingMarker = document.querySelector('.analysis-marker');
    if (existingMarker) {
      existingMarker.remove();
    }

    // Add new marker
    const markerElement = document.createElement('div');
    markerElement.className = 'analysis-marker';
    markerElement.style.cssText = `
      width: 12px;
      height: 12px;
      background-color: #ef4444;
      border: 2px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      animation: pulse 2s infinite;
    `;

    new maplibregl.Marker(markerElement)
      .setLngLat([lng, lat])
      .addTo(map.current);

    // Center map on coordinates
    map.current.flyTo({
      center: [lng, lat],
      zoom: 18,
      duration: 1000
    });
  }, [data.coordinates, isMapLoaded]);

  // Handle footprints
  useEffect(() => {
    if (!map.current || !isMapLoaded || !data.footprints.length) return;

    // Wait a bit to ensure map is fully ready after style changes
    const addFootprints = () => {
      if (!map.current || !map.current.isStyleLoaded()) return;

      // Remove existing footprint layers
      if (map.current.getLayer('footprints-fill')) {
        map.current.removeLayer('footprints-fill');
      }
      if (map.current.getLayer('footprints-outline')) {
        map.current.removeLayer('footprints-outline');
      }
      if (map.current.getSource('footprints')) {
        map.current.removeSource('footprints');
      }

      // Create GeoJSON for footprints
    const footprintFeatures = data.footprints.map((footprint) => ({
      type: 'Feature',
      properties: {
        id: footprint.id,
        area: footprint.area,
        isActive: footprint.isActive
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          // Simple rectangle around the center (in real app, use actual coordinates)
          [-46.6330, -23.5500],
          [-46.6325, -23.5500],
          [-46.6325, -23.5510],
          [-46.6330, -23.5510],
          [-46.6330, -23.5500]
        ]]
      }
    }));

    const footprintsGeoJSON = {
      type: 'FeatureCollection',
      features: footprintFeatures
    };

    // Add source and layers
    map.current.addSource('footprints', {
      type: 'geojson',
      data: footprintsGeoJSON as maplibregl.GeoJSONSourceSpecification['data']
    });

    // Fill layer
    map.current.addLayer({
      id: 'footprints-fill',
      type: 'fill',
      source: 'footprints',
      paint: {
        'fill-color': [
          'case',
          ['get', 'isActive'],
          'rgba(59, 130, 246, 0.3)',
          'rgba(59, 130, 246, 0.2)'
        ],
        'fill-opacity': 0.8
      }
    });

    // Outline layer
    map.current.addLayer({
      id: 'footprints-outline',
      type: 'line',
      source: 'footprints',
      paint: {
        'line-color': [
          'case',
          ['get', 'isActive'],
          '#3b82f6',
          '#60a5fa'
        ],
        'line-width': [
          'case',
          ['get', 'isActive'],
          3,
          2
        ]
      }
    });

      // Add click handler
      map.current.on('click', 'footprints-fill', (e) => {
        if (e.features && e.features[0]) {
          const feature = e.features[0];
          const area = feature.properties?.area;
          new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`<div class="p-2"><strong>Área:</strong> ${area}m²</div>`)
            .addTo(map.current!);
        }
      });

      // Change cursor on hover
      map.current.on('mouseenter', 'footprints-fill', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = 'pointer';
        }
      });

      map.current.on('mouseleave', 'footprints-fill', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = '';
        }
      });
    };

    // Try to add footprints immediately, or wait for style to load
    if (map.current.isStyleLoaded()) {
      addFootprints();
    } else {
      map.current.once('styledata', addFootprints);
    }
  }, [data.footprints, isMapLoaded]);

  // Handle drawing mode
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    if (isDrawingMode) {
      map.current.getCanvas().style.cursor = 'crosshair';
    } else {
      map.current.getCanvas().style.cursor = '';
    }
  }, [isDrawingMode, isMapLoaded]);

  return (
    <div className="h-full w-full relative">
      <div
        ref={mapContainer}
        className="h-full w-full"
        style={{ 
          fontFamily: 'inherit'
        }}
      />
      
      {/* Loading indicator */}
      {!isMapLoaded && (
        <div className="absolute inset-0 bg-muted flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground">Carregando mapa...</p>
          </div>
        </div>
      )}

      {/* Address loading overlay */}
      {data.address && !data.coordinates && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-background rounded-lg p-4 shadow-lg border z-10">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Localizando...</p>
        </div>
      )}

      {/* CSS for marker animation */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  );
}