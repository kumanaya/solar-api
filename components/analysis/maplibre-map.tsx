"use client";

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useAnalysis } from "./analysis-context";
import { Info, X } from "lucide-react";
interface MapLibreMapProps {
  layer: "satellite" | "streets";
  showShadow?: boolean;
  showRelief?: boolean;
  showDataLayers?: boolean;
  selectedDataLayer?: string;
  isDrawingMode: boolean;
  onDrawingCoordinatesChange?: (coordinates: [number, number][]) => void;
  onDataLayersDataChange?: (data: unknown, loading: boolean) => void;
}

export interface MapLibreMapRef {
  undoLastPoint: () => void;
  clearDrawing: () => void;
  getDrawingCoordinates: () => [number, number][];
  reopenPolygon: () => void;
  clearPin: () => void;
  captureMapImage?: () => Promise<string | null>;
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

export const MapLibreMap = forwardRef<MapLibreMapRef, MapLibreMapProps>(({ layer, showShadow = false, showRelief = false, showDataLayers = false, selectedDataLayer, isDrawingMode, onDrawingCoordinatesChange, onDataLayersDataChange }, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const { data, updateData, setSelectedAddress, drawingMode, setCurrentPolygon, setHasFootprintFromAction, currentPolygon } = useAnalysis();
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [currentLayer, setCurrentLayer] = useState<string>(layer);
  const [showAttribution, setShowAttribution] = useState(false);
  const currentMarkerRef = useRef<maplibregl.Marker | null>(null);
  const currentPopupRef = useRef<maplibregl.Popup | null>(null);
  
  // Polygon drawing state (back to local state)
  const [drawingCoordinates, setDrawingCoordinates] = useState<[number, number][]>([]);
  const drawingCoordinatesRef = useRef<[number, number][]>([]);
  
  // Track previous coordinates to avoid unnecessary flyTo calls
  const prevCoordinatesRef = useRef<[number, number] | null>(null);
  
  // Keep ref in sync with state
  useEffect(() => {
    drawingCoordinatesRef.current = drawingCoordinates;
  }, [drawingCoordinates]);


  // Helper function to manage popup (ensure only one exists at a time)
  const showPopup = (lngLat: [number, number] | maplibregl.LngLatLike, content: string) => {
    if (!map.current) return;
    
    // Close existing popup if any
    if (currentPopupRef.current) {
      currentPopupRef.current.remove();
      currentPopupRef.current = null;
    }
    
    // Create new popup
    currentPopupRef.current = new maplibregl.Popup()
      .setLngLat(lngLat)
      .setHTML(content)
      .addTo(map.current);
  };

  // Expose functions to parent via ref
  useImperativeHandle(ref, () => ({
    undoLastPoint: () => {
      // Clear any finished polygon when editing
      clearFinishedPolygonVisualization();
      
      setDrawingCoordinates(prev => {
        if (prev.length > 0) {
          const newCoords = prev.slice(0, -1);
          updateDrawingVisualization(newCoords);
          setTimeout(() => onDrawingCoordinatesChange?.(newCoords), 0);
          return newCoords;
        }
        return prev;
      });
    },
    clearDrawing: () => {
      // Clear both drawing visualization and finished polygon
      clearDrawingVisualization();
      clearFinishedPolygonVisualization();
      
      setDrawingCoordinates([]);
      setTimeout(() => onDrawingCoordinatesChange?.([]), 0);
    },
    reopenPolygon: () => {
      // Check if there's a finished polygon to reopen
      if (data.footprints.length > 0 && data.areaSource === 'manual') {
        const lastFootprint = data.footprints[data.footprints.length - 1];
        if (lastFootprint.coordinates && lastFootprint.coordinates.length > 0) {
          // Get coordinates without the closing point
          const coords = lastFootprint.coordinates.slice(0, -1); // Remove last point (which closes the polygon)
          
          // Clear finished polygon visualization
          clearFinishedPolygonVisualization();
          
          // Set drawing coordinates and update with a small delay
          setDrawingCoordinates(coords);
          setTimeout(() => {
            updateDrawingVisualization(coords);
            setTimeout(() => onDrawingCoordinatesChange?.(coords), 0);
          }, 50);
          
          // Clear polygon data to allow editing
          updateData({
            footprints: [],
            areaSource: 'manual' as const,
            usableArea: 0
          });
          setCurrentPolygon(null);
          setHasFootprintFromAction(false);
        }
      }
    },
    getDrawingCoordinates: () => drawingCoordinates,
    clearPin: () => {
      console.log('clearPin called, currentMarkerRef:', currentMarkerRef.current);
      
      // Remove current marker from map
      if (currentMarkerRef.current) {
        try {
          currentMarkerRef.current.remove();
          console.log('Marker removed successfully');
        } catch (error) {
          console.error('Error removing marker:', error);
        }
        currentMarkerRef.current = null;
      }
      
      // Close any open popup
      if (currentPopupRef.current) {
        try {
          currentPopupRef.current.remove();
        } catch (error) {
          console.error('Error removing popup:', error);
        }
        currentPopupRef.current = null;
      }
      
      // Clear marker state
      console.log('Marker state cleared');
      
      // Clear selected address and reset analysis context
      setSelectedAddress('');
      updateData({
        address: '',
        coordinates: undefined,
        footprints: [],
        usableArea: 0,
        areaSource: 'manual' as const
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const style = getMapStyle(layer);

    // Function to initialize map with given center
    const initializeMap = (center: [number, number], zoom: number = 12) => {
      if (!mapContainer.current) return;
      
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: style,
        center: center,
        zoom: zoom,
        attributionControl: false // We'll add our own attribution control
      });

      map.current.on('load', () => {
        setIsMapLoaded(true);
      });
    };

    // Check if coordinates are the default São Paulo coordinates (not user-set)
    const isDefaultCoordinates = Array.isArray(data.coordinates) ? 
      data.coordinates[0] === -46.6333 && data.coordinates[1] === -23.5505 :
      data.coordinates?.lng === -46.6333 && data.coordinates?.lat === -23.5505;

    // Try to get user's geolocation first if coordinates are still default
    if (navigator.geolocation && isDefaultCoordinates) {
      console.log('Attempting to get user location...');
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          console.log('User location obtained:', { latitude, longitude });
          
          // Just initialize map with user location, don't save to store yet
          initializeMap([longitude, latitude], 15); // Higher zoom for user location
        },
        (error) => {
          console.log('Geolocation failed:', error.message, 'Using default location');
          initializeMap([-46.6333, -23.5505]); // São Paulo default
        },
        {
          timeout: 5000,
          enableHighAccuracy: false,
          maximumAge: 300000 // 5 minutes cache
        }
      );
    } else {
      // Use existing coordinates (either user-set or default São Paulo)
      const center: [number, number] = Array.isArray(data.coordinates) ? 
        [data.coordinates[0], data.coordinates[1]] :
        [data.coordinates?.lng ?? -46.6333, data.coordinates?.lat ?? -23.5505];
      initializeMap(center);
    }

    // Don't add navigation controls (zoom and compass) - removed per user request
    // Don't add default attribution control - we'll create a custom one

    return () => {
      if (map.current) {
        // Clean up all custom layers before removing map
        clearDrawingVisualization();
        clearFinishedPolygonVisualization();
        clearAutomaticFootprints();
        removeNDVILayer();
        removeDEMLayer();
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

  // Function to calculate polygon bounds and center
  const getPolygonBounds = (polygon: { coordinates: number[][][] }) => {
    const coords = polygon.coordinates[0]; // First ring
    let minLng = coords[0][0], maxLng = coords[0][0];
    let minLat = coords[0][1], maxLat = coords[0][1];
    
    coords.forEach(([lng, lat]) => {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    });
    
    const center = [(minLng + maxLng) / 2, (minLat + maxLat) / 2] as [number, number];
    return { bounds: [minLng, minLat, maxLng, maxLat], center };
  };

  // Navigate to polygon or coordinates with priority for polygon
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;
    
    // Priority 1: If we have a drawn polygon, focus on it
    if (currentPolygon && currentPolygon.coordinates?.[0]?.length > 0) {
      const { bounds, center } = getPolygonBounds(currentPolygon);
      console.log('Navigation effect triggered - fitting to polygon bounds:', bounds);
      
      // Fit to polygon bounds with padding
      map.current.fitBounds(bounds as [number, number, number, number], {
        padding: 50,
        duration: 2000
      });
      
      // Update previous coordinates to prevent address navigation
      prevCoordinatesRef.current = center;
      return;
    }
    
    // Priority 2: Navigate to address coordinates if no polygon
    if (!data.coordinates) return;
    
    const lng = Array.isArray(data.coordinates) ? data.coordinates[0] : data.coordinates?.lng;
    const lat = Array.isArray(data.coordinates) ? data.coordinates[1] : data.coordinates?.lat;
    if (isNaN(lng) || isNaN(lat)) return;
    
    // Skip if coordinates are the default São Paulo coordinates (not user-generated)
    if (lng === -46.6333 && lat === -23.5505) {
      console.log('Skipping flyTo for default São Paulo coordinates');
      return;
    }
    
    // Skip if coordinates are the same as previous coordinates
    const prevCoords = prevCoordinatesRef.current;
    if (prevCoords && prevCoords[0] === lng && prevCoords[1] === lat) {
      return;
    }
    
    console.log('Navigation effect triggered - flying to address coordinates:', [lng, lat]);
    
    // Update the previous coordinates reference
    prevCoordinatesRef.current = [lng, lat];
    
    // Fly to the location
    map.current.flyTo({
      center: [lng, lat],
      zoom: 18,
      duration: 2000
    });
      
  }, [data.coordinates, isMapLoaded, currentPolygon]);

  // This effect is now handled by the navigation effect above

  // Handle footprints
  useEffect(() => {
    if (!map.current || !isMapLoaded || !data.footprints.length) return;
    
    // Don't show automatic footprints if we have a manually drawn polygon
    const hasManualDrawing = data.areaSource === 'manual';
    if (hasManualDrawing) return;

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
          const popupContent = `
            <div style="
              background: hsl(var(--background));
              color: hsl(var(--foreground));
              border: 1px solid hsl(var(--border));
              border-radius: 6px;
              padding: 8px 12px;
              font-size: 13px;
            ">
              <span style="font-weight: 500; color: hsl(var(--foreground));">Área:</span> ${area}m²
            </div>
          `;
          showPopup(e.lngLat, popupContent);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.footprints, isMapLoaded]);

  // Handle drawing and pin modes
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    if (drawingMode || isDrawingMode) {
      map.current.getCanvas().style.cursor = 'crosshair';
    } else {
      map.current.getCanvas().style.cursor = '';
    }
  }, [drawingMode, isDrawingMode, isMapLoaded]);


  // Mock data layer management functions
  const processAndAddDataLayer = async (layerKey: string) => {
    // Mock function - does nothing, just logs
    console.log('Mock data layer request:', layerKey);
    onDataLayersDataChange?.({ mockLayer: layerKey }, false);
  };

  const removeDataLayer = () => {
    // Mock function - does nothing
  };



  // Handle NDVI layer visibility
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    if (showShadow) {
      addNDVILayer();
    } else {
      removeNDVILayer();
    }
  }, [showShadow, isMapLoaded]);

  // Handle DEM layer visibility
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    if (showRelief) {
      addDEMLayer();
    } else {
      removeDEMLayer();
    }
  }, [showRelief, isMapLoaded]);

  // Handle data layer visibility - clear when disabled
  useEffect(() => {
    if (!showDataLayers) {
      removeDataLayer();
    }
  }, [showDataLayers]);

  // Handle selected data layer visualization
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    if (selectedDataLayer && selectedDataLayer !== '' && data.coordinates) {
      processAndAddDataLayer(selectedDataLayer);
    } else {
      // Remove layer when none selected
      removeDataLayer();
    }
  }, [selectedDataLayer, isMapLoaded, data.coordinates]);

  // Handle polygon drawing
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    const handleDrawingClick = (e: maplibregl.MapMouseEvent) => {
      if (!drawingMode && !isDrawingMode) return;
      
      // Check if clicked on the first drawing point (red circle) to close polygon
      let drawingPointFeatures: maplibregl.MapGeoJSONFeature[] = [];
      let otherFeatures: maplibregl.MapGeoJSONFeature[] = [];
      
      try {
        // Check if clicked on drawing points (including first point)
        if (map.current!.getLayer('drawing-points')) {
          drawingPointFeatures = map.current!.queryRenderedFeatures(e.point, {
            layers: ['drawing-points']
          });
        }
        
        // Check if clicked on other layers (footprints or drawn polygon)
        const otherLayers = [];
        if (map.current!.getLayer('footprints-fill')) {
          otherLayers.push('footprints-fill');
        }
        if (map.current!.getLayer('drawn-polygon-fill')) {
          otherLayers.push('drawn-polygon-fill');
        }
        
        if (otherLayers.length > 0) {
          otherFeatures = map.current!.queryRenderedFeatures(e.point, {
            layers: otherLayers
          });
        }
      } catch (error) {
        console.log('Error querying features:', error);
        drawingPointFeatures = [];
        otherFeatures = [];
      }

      // If clicked on other layers (not drawing points), don't add a drawing point
      if (otherFeatures.length > 0) {
        console.log('Clicked on layer, not adding drawing point');
        return;
      }

      // Check if clicked on the first point specifically
      const currentCoords = drawingCoordinatesRef.current;
      if (drawingPointFeatures.length > 0 && currentCoords.length >= 3) {
        const clickedPoint = drawingPointFeatures[0];
        
        if (clickedPoint.properties?.isFirst === true) {
          console.log('SUCCESS: Clicked on first point - closing polygon');
          console.log('Current drawing coordinates:', currentCoords);
          // Use setTimeout to ensure this happens after all other processing
          setTimeout(() => {
            finishDrawing(currentCoords);
            setDrawingCoordinates([]);
          }, 0);
          return;
        }
        // If clicked on other drawing points, don't add new point
        console.log('Clicked on existing drawing point (not first), not adding new point');
        return;
      }

      const { lng, lat } = e.lngLat;
      const newCoord: [number, number] = [lng, lat];

      setDrawingCoordinates(prev => {

        const newCoords = [...prev, newCoord];
        
        // Update drawing visualization
        updateDrawingVisualization(newCoords);
        
        // Notify parent component after render
        setTimeout(() => onDrawingCoordinatesChange?.(newCoords), 0);
        
        return newCoords;
      });
    };

    const handleDrawingMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (!drawingMode && !isDrawingMode) return;
      if (drawingCoordinatesRef.current.length < 3) return;

      try {
        // Check if hovering over the first drawing point (red circle)
        let drawingPointFeatures: maplibregl.MapGeoJSONFeature[] = [];
        
        if (map.current!.getLayer('drawing-points')) {
          drawingPointFeatures = map.current!.queryRenderedFeatures(e.point, {
            layers: ['drawing-points']
          });
        }

        // Check if hovering over the first point specifically
        const isOverFirstPoint = drawingPointFeatures.some(feature => 
          feature.properties?.isFirst === true
        );

        if (isOverFirstPoint) {
          map.current!.getCanvas().style.cursor = 'pointer';
          map.current!.getCanvas().title = 'Clique no ponto vermelho para fechar o polígono';
        } else {
          map.current!.getCanvas().style.cursor = 'crosshair';
          map.current!.getCanvas().title = '';
        }
      } catch {
        // Fallback to default cursor if there's an error
        map.current!.getCanvas().style.cursor = drawingMode ? 'crosshair' : 'default';
        map.current!.getCanvas().title = '';
      }
    };

    const handleDrawingDoubleClick = (e: maplibregl.MapMouseEvent) => {
      if (!isDrawingMode || drawingCoordinates.length < 3) return;
      
      e.preventDefault();
      finishDrawing(drawingCoordinates);
      setDrawingCoordinates([]);
    };

    const finishDrawing = (coords: [number, number][]) => {
      if (coords.length < 3) return;
      
      // Always close the polygon by adding first point at the end
      const closedCoords = [...coords];
      // Only add closing point if not already closed
      const first = closedCoords[0];
      const last = closedCoords[closedCoords.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        closedCoords.push([first[0], first[1]]);
      }
      
      // Calculate area
      const area = calculatePolygonArea(closedCoords);
      
      // Update context with drawn polygon
      updateData({
        footprints: [{
          id: `drawn-${Date.now()}`,
          coordinates: closedCoords,
          area: Math.round(area),
          isActive: true
        }],
        areaSource: 'manual' as const,
        usableArea: Math.round(area * 0.75), // Apply usage factor
        confidence: 'Média' as const
      });
      
      // Mark that footprint came from manual action (drawing)
      setHasFootprintFromAction(true);
      
      // Set polygon for analysis API (coordinates are already in [lng,lat] format)
      const userPolygon = {
        type: "Polygon" as const,
        coordinates: [closedCoords],
        source: "user-drawn" as const
      };
      setCurrentPolygon(userPolygon);
      
      // Note: Session storage for user-drawn polygon removed with PIN functionality
      
      // Clear drawing visualization
      clearDrawingVisualization();
      
      // Clear any existing automatic footprints since we have a manual drawing
      clearAutomaticFootprints();
      
      // Add the finished polygon visualization
      addFinishedPolygonVisualization(closedCoords, Math.round(area));
    };

    if (drawingMode || isDrawingMode) {
      // Check if we should reopen an existing polygon
      if (drawingCoordinates.length === 0 && data.footprints.length > 0 && data.areaSource === 'manual') {
        const lastFootprint = data.footprints[data.footprints.length - 1];
        if (lastFootprint.coordinates && lastFootprint.coordinates.length > 0) {
          // Reopen the polygon for editing
          const coords = lastFootprint.coordinates.slice(0, -1); // Remove closing point
          setDrawingCoordinates(coords);
          
          // Clear finished polygon visualization
          clearFinishedPolygonVisualization();
          
          // Small delay to ensure map layers are cleared before updating
          setTimeout(() => {
            updateDrawingVisualization(coords);
            setTimeout(() => onDrawingCoordinatesChange?.(coords), 0);
          }, 50);
          
          // Clear polygon data to allow editing
          updateData({
            footprints: [],
            areaSource: 'manual' as const,
            usableArea: 0
          });
          setCurrentPolygon(null);
          setHasFootprintFromAction(false);
        }
      } else {
        // Clear any previous drawn polygon when starting new drawing
        clearFinishedPolygonVisualization();
      }
      
      map.current.on('click', handleDrawingClick);
      map.current.on('dblclick', handleDrawingDoubleClick);
      map.current.on('mousemove', handleDrawingMouseMove);
    } else {
      setDrawingCoordinates([]);
      clearDrawingVisualization();
    }

    return () => {
      if (map.current) {
        map.current.off('click', handleDrawingClick);
        map.current.off('dblclick', handleDrawingDoubleClick);
        map.current.off('mousemove', handleDrawingMouseMove);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawingMode, isDrawingMode, isMapLoaded]);

  // Helper function to calculate distance between two points in degrees

  // Helper function to calculate polygon area
  const calculatePolygonArea = (coords: [number, number][]): number => {
    if (coords.length < 3) return 0;
    
    const toXY = (lng: number, lat: number) => {
      const x = (lng * Math.cos((lat * Math.PI) / 180)) * 111_000;
      const y = lat * 111_000;
      return { x, y };
    };
    
    let area = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      const [lng1, lat1] = coords[i];
      const [lng2, lat2] = coords[i + 1];
      const a = toXY(lng1, lat1);
      const b = toXY(lng2, lat2);
      area += a.x * b.y - b.x * a.y;
    }
    return Math.abs(area / 2);
  };

  // Helper function to update drawing visualization
  const updateDrawingVisualization = (coords: [number, number][]) => {
    if (!map.current || !map.current.isStyleLoaded() || coords.length === 0) return;

    // Remove existing drawing layers
    clearDrawingVisualization();

    // Add points
    if (coords.length > 0) {
      const pointsGeoJSON = {
        type: 'FeatureCollection',
        features: coords.map((coord, index) => ({
          type: 'Feature',
          properties: { 
            index,
            isFirst: index === 0
          },
          geometry: {
            type: 'Point',
            coordinates: coord
          }
        }))
      };

      map.current.addSource('drawing-points', {
        type: 'geojson',
        data: pointsGeoJSON as maplibregl.GeoJSONSourceSpecification['data']
      });

      map.current.addLayer({
        id: 'drawing-points',
        type: 'circle',
        source: 'drawing-points',
        paint: {
          'circle-radius': [
            'case',
            ['get', 'isFirst'],
            8, // Primeiro ponto maior
            6  // Outros pontos normais
          ],
          'circle-color': [
            'case',
            ['get', 'isFirst'],
            '#ef4444', // Primeiro ponto vermelho
            '#3b82f6'  // Outros pontos azuis
          ],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2
        }
      });
    }

    // Add lines
    if (coords.length > 1) {
      const lineGeoJSON = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: coords
        }
      };

      map.current.addSource('drawing-line', {
        type: 'geojson',
        data: lineGeoJSON as maplibregl.GeoJSONSourceSpecification['data']
      });

      map.current.addLayer({
        id: 'drawing-line',
        type: 'line',
        source: 'drawing-line',
        paint: {
          'line-color': '#3b82f6',
          'line-width': 2,
          'line-dasharray': [5, 5]
        }
      });
    }

    // Add closing line preview if we have 3+ points
    if (coords.length >= 3) {
      const closingLineGeoJSON = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [coords[coords.length - 1], coords[0]]
        }
      };

      map.current.addSource('drawing-closing-line', {
        type: 'geojson',
        data: closingLineGeoJSON as maplibregl.GeoJSONSourceSpecification['data']
      });

      map.current.addLayer({
        id: 'drawing-closing-line',
        type: 'line',
        source: 'drawing-closing-line',
        paint: {
          'line-color': '#ef4444',
          'line-width': 1,
          'line-dasharray': [3, 3],
          'line-opacity': 0.7
        }
      });
    }
  };

  // Helper function to clear drawing visualization
  const clearDrawingVisualization = () => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    ['drawing-points', 'drawing-line', 'drawing-closing-line'].forEach(layerId => {
      if (map.current!.getLayer(layerId)) {
        map.current!.removeLayer(layerId);
      }
      if (map.current!.getSource(layerId)) {
        map.current!.removeSource(layerId);
      }
    });
  };

  // Helper function to add finished polygon visualization
  const addFinishedPolygonVisualization = (coords: [number, number][], area: number) => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    // Remove existing drawn polygon layers
    clearFinishedPolygonVisualization();

    const polygonGeoJSON = {
      type: 'Feature',
      properties: {
        area: area,
        source: 'manual'
      },
      geometry: {
        type: 'Polygon',
        coordinates: [coords]
      }
    };

    // Add source
    map.current.addSource('drawn-polygon', {
      type: 'geojson',
      data: polygonGeoJSON as maplibregl.GeoJSONSourceSpecification['data']
    });

    // Add fill layer
    map.current.addLayer({
      id: 'drawn-polygon-fill',
      type: 'fill',
      source: 'drawn-polygon',
      paint: {
        'fill-color': 'rgba(34, 197, 94, 0.3)', // Verde semi-transparente
        'fill-opacity': 0.8
      }
    });

    // Add outline layer
    map.current.addLayer({
      id: 'drawn-polygon-outline',
      type: 'line',
      source: 'drawn-polygon',
      paint: {
        'line-color': '#22c55e', // Verde
        'line-width': 3
      }
    });

    // Add click handler to show area info
    map.current.on('click', 'drawn-polygon-fill', (e) => {
      if (e.features && e.features[0]) {
        const feature = e.features[0];
        const area = feature.properties?.area;
        const popupContent = `
          <div style="
            background: hsl(var(--background));
            color: hsl(var(--foreground));
            border: 1px solid hsl(var(--border));
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            min-width: 200px;
          ">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: hsl(var(--foreground));">
              Área Desenhada
            </div>
            <div style="font-size: 13px; color: hsl(var(--muted-foreground));">
              <div style="margin-bottom: 4px;">
                <span style="font-weight: 500; color: hsl(var(--foreground));">Área:</span> ${area}m²
              </div>
              <div>
                <span style="font-weight: 500; color: hsl(var(--foreground));">Fonte:</span> Desenho manual
              </div>
            </div>
          </div>
        `;
        showPopup(e.lngLat, popupContent);
      }
    });

    // Change cursor on hover
    map.current.on('mouseenter', 'drawn-polygon-fill', () => {
      if (map.current) {
        map.current.getCanvas().style.cursor = 'pointer';
      }
    });

    map.current.on('mouseleave', 'drawn-polygon-fill', () => {
      if (map.current) {
        map.current.getCanvas().style.cursor = '';
      }
    });
  };

  // Helper function to clear finished polygon visualization
  const clearFinishedPolygonVisualization = () => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    // Remove layers first
    ['drawn-polygon-fill', 'drawn-polygon-outline'].forEach(layerId => {
      try {
        if (map.current!.getLayer(layerId)) {
          map.current!.removeLayer(layerId);
        }
      } catch {
        console.log(`Layer ${layerId} already removed or doesn't exist`);
      }
    });
    
    // Then remove source
    try {
      if (map.current.getSource('drawn-polygon')) {
        map.current.removeSource('drawn-polygon');
      }
    } catch {
      console.log('Source drawn-polygon already removed or doesn\'t exist');
    }
  };

  // Helper function to clear automatic footprints
  const clearAutomaticFootprints = () => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    ['footprints-fill', 'footprints-outline'].forEach(layerId => {
      if (map.current!.getLayer(layerId)) {
        map.current!.removeLayer(layerId);
      }
    });
    
    if (map.current.getSource('footprints')) {
      map.current.removeSource('footprints');
    }
  };

  // Helper function to add NDVI layer (vegetation visualization)
  const addNDVILayer = () => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    // Remove existing NDVI layer if it exists
    if (map.current.getLayer('ndvi-layer')) {
      map.current.removeLayer('ndvi-layer');
    }
    if (map.current.getSource('ndvi-source')) {
      map.current.removeSource('ndvi-source');
    }

    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!accessToken) {
      console.warn('Mapbox access token not found for NDVI layer');
      return;
    }

    // Add NDVI data source using Mapbox Satellite imagery with vegetation processing
    // This uses Mapbox's enhanced satellite imagery which can show vegetation health
    map.current.addSource('ndvi-source', {
      type: 'raster',
      tiles: [
        `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token=${accessToken}`
      ],
      tileSize: 512,
      attribution: '© Mapbox © Maxar'
    });

    // Add NDVI layer with vegetation-focused styling
    map.current.addLayer({
      id: 'ndvi-layer',
      type: 'raster',
      source: 'ndvi-source',
      paint: {
        'raster-opacity': 0.6,
        'raster-hue-rotate': 60, // Enhance green/vegetation
        'raster-saturation': 1.0, // Maximum saturation value
        'raster-contrast': 0.3, // Increase contrast
        'raster-brightness-min': 0.2,
        'raster-brightness-max': 0.9
      }
    });
  };

  // Helper function to add DEM layer (elevation visualization)
  const addDEMLayer = () => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    // Remove existing DEM layer if it exists
    if (map.current.getLayer('dem-layer')) {
      map.current.removeLayer('dem-layer');
    }
    if (map.current.getSource('dem-source')) {
      map.current.removeSource('dem-source');
    }

    // Use AWS terrain tiles (free global DEM data)
    map.current.addSource('dem-source', {
      type: 'raster-dem',
      tiles: [
        'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      maxzoom: 15,
      encoding: 'terrarium'
    });

    // Configure terrain for 3D elevation
    map.current.setTerrain({
      source: 'dem-source',
      exaggeration: 1.2
    });

    // Add hillshade layer for elevation visualization with 2025 performance improvements
    map.current.addLayer({
      id: 'dem-layer',
      type: 'hillshade',
      source: 'dem-source',
      paint: {
        'hillshade-illumination-direction': 335,
        'hillshade-exaggeration': 0.8,
        'hillshade-shadow-color': 'rgba(0, 0, 0, 0.5)',
        'hillshade-highlight-color': 'rgba(255, 255, 255, 0.4)',
        'hillshade-accent-color': 'rgba(56, 44, 20, 0.2)' // Subtle terrain coloring
      }
    });

  };

  // Helper function to remove NDVI layer
  const removeNDVILayer = () => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    if (map.current.getLayer('ndvi-layer')) {
      map.current.removeLayer('ndvi-layer');
    }
    if (map.current.getSource('ndvi-source')) {
      map.current.removeSource('ndvi-source');
    }
  };

  // Helper function to remove DEM layer
  const removeDEMLayer = () => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    // Remove terrain first
    map.current.setTerrain(null);
    // Remove hillshade layer
    if (map.current.getLayer('dem-layer')) {
      map.current.removeLayer('dem-layer');
    }
    // Remove source
    if (map.current.getSource('dem-source')) {
      map.current.removeSource('dem-source');
    }
  };


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


      {/* Drawing mode instructions */}
      {(drawingMode || isDrawingMode) && (
        <div className="absolute bottom-2 md:bottom-4 left-1/2 transform -translate-x-1/2 bg-background/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border z-20 max-w-sm">
          <div className="text-center">
            <div className="text-sm font-medium text-foreground mb-1">
              Modo de Desenho Ativo
            </div>
            <div className="text-xs text-muted-foreground">
              {drawingCoordinates.length === 0 && "Clique no mapa para começar a desenhar o telhado"}
              {drawingCoordinates.length === 1 && "Continue clicando para definir os cantos"}
              {drawingCoordinates.length === 2 && "Adicione mais pontos para continuar"}
              {drawingCoordinates.length >= 3 && "Clique no ponto vermelho para fechar o polígono ou dê duplo-clique"}
            </div>
            {drawingCoordinates.length > 0 && (
              <div className="text-xs text-blue-600 mt-1">
                {drawingCoordinates.length} pontos adicionados
              </div>
            )}
          </div>
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
        
        /* Customize MapLibre popup to follow theme */
        .maplibregl-popup-content {
          background: hsl(var(--background)) !important;
          color: hsl(var(--foreground)) !important;
          border: 1px solid hsl(var(--border)) !important;
          border-radius: 8px !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
          padding: 0 !important;
        }
        
        .maplibregl-popup-tip {
          border-top-color: hsl(var(--background)) !important;
        }
        
        .maplibregl-popup-close-button {
          color: hsl(var(--muted-foreground)) !important;
          font-size: 16px !important;
          right: 8px !important;
          top: 8px !important;
        }
        
        .maplibregl-popup-close-button:hover {
          color: hsl(var(--foreground)) !important;
          background: hsl(var(--muted)) !important;
          border-radius: 4px !important;
        }
      `}</style>
    </div>
  );
});

MapLibreMap.displayName = 'MapLibreMap';