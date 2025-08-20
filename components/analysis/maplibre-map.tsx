"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useAnalysis } from "./analysis-context";
import { Info, X } from "lucide-react";

interface MapLibreMapProps {
  layer: "satellite" | "streets";
  showShadow?: boolean; // Optional since handled by parent
  showRelief?: boolean; // Optional since handled by parent
  isDrawingMode: boolean;
  isPinMode?: boolean;
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

export function MapLibreMap({ layer, isDrawingMode, isPinMode = false }: MapLibreMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const { data, selectedAddress, updateData, setSelectedAddress } = useAnalysis();
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [currentLayer, setCurrentLayer] = useState<string>(layer);
  const [showAttribution, setShowAttribution] = useState(false);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const pinMarkerRef = useRef<maplibregl.Marker | null>(null);

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

    // Don't add navigation controls (zoom and compass) - removed per user request
    // Don't add default attribution control - we'll create a custom one

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

  // Navigate to coordinates (removed duplicate geocoding)
  useEffect(() => {
    if (!map.current || !isMapLoaded || !data.coordinates) return;
    
    const [lng, lat] = data.coordinates;
    if (isNaN(lng) || isNaN(lat)) return;
    
    // Fly to the location
    map.current.flyTo({
      center: [lng, lat],
      zoom: 18,
      duration: 2000
    });
    
    // Remove existing marker
    if (markerRef.current) {
      markerRef.current.remove();
    }
    
    // Add new marker
    markerRef.current = new maplibregl.Marker({
      color: '#3b82f6'
    })
      .setLngLat([lng, lat])
      .addTo(map.current!);
      
  }, [data.coordinates, isMapLoaded]);

  // This effect is now handled by the navigation effect above

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

  // Handle drawing and pin modes
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    if (isDrawingMode) {
      map.current.getCanvas().style.cursor = 'crosshair';
    } else if (isPinMode) {
      map.current.getCanvas().style.cursor = 'copy';
    } else {
      map.current.getCanvas().style.cursor = '';
    }
  }, [isDrawingMode, isPinMode, isMapLoaded]);

  // Handle pin placement
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    const handleMapClick = async (e: maplibregl.MapMouseEvent) => {
      if (!isPinMode) return;

      const { lng, lat } = e.lngLat;
      
      // Remove existing pin marker
      if (pinMarkerRef.current) {
        pinMarkerRef.current.remove();
      }
      
      // Add new pin marker
      pinMarkerRef.current = new maplibregl.Marker({
        color: '#ef4444'
      })
        .setLngLat([lng, lat])
        .addTo(map.current!);
      
      // Reverse geocode to get address
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
          {
            headers: {
              'User-Agent': 'SolarAnalysis/1.0'
            }
          }
        );
        
        if (response.ok) {
          const result = await response.json();
          const address = result.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          
          // Update analysis context
          setSelectedAddress(address);
          updateData({
            address: address,
            coordinates: [lng, lat] as [number, number]
          });
        }
      } catch (error) {
        console.error('Reverse geocoding error:', error);
        // Fallback to coordinates
        const address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        setSelectedAddress(address);
        updateData({
          address: address,
          coordinates: [lng, lat] as [number, number]
        });
      }
    };

    if (isPinMode) {
      map.current.on('click', handleMapClick);
    }

    return () => {
      if (map.current) {
        map.current.off('click', handleMapClick);
      }
    };
  }, [isPinMode, isMapLoaded, updateData, setSelectedAddress]);

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

      {/* Custom Attribution Control */}
      <div className="absolute bottom-2 right-2 z-20">
        {/* Attribution toggle button */}
        <button
          onClick={() => setShowAttribution(!showAttribution)}
          className="bg-background/80 backdrop-blur-sm border rounded p-1.5 shadow-sm hover:bg-background transition-colors"
          title="Informações do mapa"
        >
          {showAttribution ? (
            <X className="h-3 w-3 text-muted-foreground" />
          ) : (
            <Info className="h-3 w-3 text-muted-foreground" />
          )}
        </button>

        {/* Attribution panel */}
        {showAttribution && (
          <div className="absolute bottom-full right-0 mb-2 bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg max-w-sm">
            <div className="text-xs text-muted-foreground leading-relaxed">
              {layer === "satellite" ? (
                <>
                  <strong>Imagens de satélite:</strong><br />
                  © Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community
                </>
              ) : (
                <>
                  <strong>Dados do mapa:</strong><br />
                  © OpenStreetMap contributors
                </>
              )}
              <br /><br />
              <strong>Tecnologia:</strong><br />
              MapLibre GL JS
            </div>
          </div>
        )}
      </div>

      {/* CSS for marker animation and attribution styling */}
      <style jsx global>{`
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
        
        /* Hide all MapLibre controls */
        .maplibregl-ctrl-top-right,
        .maplibregl-ctrl-top-left,
        .maplibregl-ctrl-bottom-right,
        .maplibregl-ctrl-bottom-left {
          display: none !important;
        }
        
        .maplibregl-ctrl-nav,
        .maplibregl-ctrl-zoom,
        .maplibregl-ctrl-compass,
        .maplibregl-ctrl-logo,
        .maplibregl-ctrl-attrib {
          display: none !important;
        }
      `}</style>
    </div>
  );
}