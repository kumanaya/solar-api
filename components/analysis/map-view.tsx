"use client";

import { useAnalysis } from "./analysis-context";

interface MapViewProps {
  layer: "satellite" | "streets";
  showShadow: boolean;
  showRelief: boolean;
  isDrawingMode: boolean;
}

export function MapView({ layer, showShadow, showRelief, isDrawingMode }: MapViewProps) {
  const { data } = useAnalysis();

  return (
    <div className="h-full w-full bg-gray-100 relative overflow-hidden">
      {/* Mapa simulado */}
      <div 
        className={`h-full w-full transition-all duration-300 ${
          layer === "satellite" 
            ? "bg-gradient-to-br from-green-800 via-green-600 to-green-400" 
            : "bg-gradient-to-br from-gray-200 via-gray-100 to-white"
        }`}
      >
        {/* Grid simulando ruas */}
        {layer === "streets" && (
          <div className="absolute inset-0">
            <div className="h-full w-full opacity-20" 
                 style={{
                   backgroundImage: `
                     linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
                     linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
                   `,
                   backgroundSize: "50px 50px"
                 }}
            />
          </div>
        )}

        {/* Overlay de sombra (NDVI) */}
        {showShadow && (
          <div className="absolute inset-0 bg-gradient-radial from-transparent via-green-500/20 to-green-800/40" />
        )}

        {/* Overlay de relevo (DEM) */}
        {showRelief && (
          <div className="absolute inset-0 bg-gradient-to-br from-orange-200/30 via-yellow-200/20 to-red-200/30" />
        )}

        {/* Marcador de coordenadas */}
        {data.coordinates && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="w-3 h-3 bg-red-500 rounded-full shadow-lg animate-pulse" />
            <div className="w-6 h-6 border-2 border-red-500 rounded-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
        )}

        {/* Footprints simulados */}
        {data.footprints.map((footprint) => (
          <div
            key={footprint.id}
            className={`absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all ${
              footprint.isActive 
                ? "ring-4 ring-blue-500 ring-opacity-75" 
                : "hover:ring-2 hover:ring-blue-300"
            }`}
            style={{
              width: "120px",
              height: "80px",
              backgroundColor: footprint.isActive ? "rgba(59, 130, 246, 0.3)" : "rgba(59, 130, 246, 0.2)",
              clipPath: "polygon(10% 0%, 90% 0%, 100% 100%, 0% 100%)"
            }}
          >
            {footprint.isActive && (
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-white px-2 py-1 rounded text-xs shadow-lg">
                {footprint.area}m² (ativo)
              </div>
            )}
          </div>
        ))}

        {/* Cursor de desenho */}
        {isDrawingMode && (
          <div className="absolute inset-0 cursor-crosshair" />
        )}

        {/* Indicador de loading no centro */}
        {data.address && !data.coordinates && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-4 shadow-lg">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Localizando...</p>
          </div>
        )}
      </div>
    </div>
  );
}