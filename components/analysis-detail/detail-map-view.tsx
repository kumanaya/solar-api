"use client";

import { useAnalysisDetail } from "./analysis-detail-context";

export function DetailMapView() {
  const { analysis, isLoading } = useAnalysisDetail();

  if (isLoading || !analysis) {
    return (
      <div className="h-full w-full bg-gray-100 relative overflow-hidden">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-200 via-gray-100 to-gray-50" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-4 shadow-lg">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Carregando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-gray-100 relative overflow-hidden">
      {/* Mapa base simulado */}
      <div className="h-full w-full bg-gradient-to-br from-green-800 via-green-600 to-green-400">
        {/* Grid simulando imagem satelital */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
            `,
            backgroundSize: "20px 20px"
          }}
        />

        {/* Marcador de coordenadas */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="w-3 h-3 bg-red-500 rounded-full shadow-lg" />
          <div className="w-6 h-6 border-2 border-red-500 rounded-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
        </div>

        {/* Polígono salvo - destaque especial */}
        <div
          className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 cursor-default"
          style={{
            width: "140px",
            height: "90px",
            backgroundColor: "rgba(59, 130, 246, 0.4)",
            clipPath: "polygon(10% 0%, 90% 0%, 100% 100%, 0% 100%)",
            border: "3px solid #3b82f6",
            boxShadow: "0 0 0 2px rgba(59, 130, 246, 0.3)"
          }}
        >
          {/* Label do polígono */}
          <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-white px-3 py-2 rounded-lg shadow-lg border">
            <div className="text-center">
              <p className="text-sm font-medium text-blue-800">Polígono Salvo</p>
              <p className="text-xs text-muted-foreground">{analysis.polygon.area}m²</p>
            </div>
            {/* Seta apontando para o polígono */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white"></div>
          </div>
        </div>

        {/* Coordenadas no canto superior esquerdo */}
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
          <div className="text-xs space-y-1">
            <p className="font-medium">Coordenadas</p>
            <p className="text-muted-foreground">
              {analysis.coordinates[0].toFixed(6)}, {analysis.coordinates[1].toFixed(6)}
            </p>
          </div>
        </div>

        {/* Indicador de zoom no canto inferior direito */}
        <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
          <div className="text-xs space-y-2">
            <p className="font-medium text-center">Zoom</p>
            <div className="flex flex-col space-y-1">
              <button className="w-8 h-8 bg-white border rounded flex items-center justify-center hover:bg-gray-50">
                +
              </button>
              <button className="w-8 h-8 bg-white border rounded flex items-center justify-center hover:bg-gray-50">
                −
              </button>
            </div>
          </div>
        </div>

        {/* Legenda do polígono */}
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
          <div className="text-xs space-y-2">
            <p className="font-medium">Legenda</p>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-3 bg-blue-400 border-2 border-blue-600 rounded-sm"></div>
              <span className="text-muted-foreground">Área útil</span>
            </div>
            <div className="space-y-1 text-muted-foreground">
              <p>Área total: {analysis.polygon.area}m²</p>
              <p>Fator de uso: {(analysis.currentVersion.parameters.usageFactor * 100).toFixed(0)}%</p>
              <p>Área útil: {analysis.currentVersion.usableArea}m²</p>
            </div>
          </div>
        </div>

        {/* Overlay de "congelado" para indicar que não é editável */}
        <div className="absolute top-4 right-4 bg-yellow-50 border border-yellow-200 rounded-lg p-2 shadow-lg">
          <div className="flex items-center space-x-2 text-yellow-800">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <span className="text-xs font-medium">Visualização Somente Leitura</span>
          </div>
        </div>
      </div>
    </div>
  );
}