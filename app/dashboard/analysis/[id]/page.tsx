"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { AnalysisDetailProvider } from "@/components/analysis-detail/analysis-detail-context";
import { AnalysisHeader } from "@/components/analysis-detail/analysis-header";
import { DetailMapView } from "@/components/analysis-detail/detail-map-view";
import { TechnicalPanel } from "@/components/analysis-detail/technical-panel";
import { ActionPanel } from "@/components/analysis-detail/action-panel";
import { HistoryTimeline } from "@/components/analysis-detail/history-timeline";
import { ReprocessModal } from "@/components/analysis-detail/reprocess-modal";
import { MapLibreMapRef } from "@/components/analysis/maplibre-map";

export default function AnalysisDetailPage() {
  const params = useParams();
  const analysisId = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  
  // Shared map reference for PDF generation
  const mapRef = useRef<MapLibreMapRef>(null);

  useEffect(() => {
    // Simular carregamento dos dados da análise
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, [analysisId]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Carregando análise...</p>
        </div>
      </div>
    );
  }

  return (
    <AnalysisDetailProvider analysisId={analysisId}>
      {/* Layout Desktop */}
      <div className="hidden md:flex h-screen overflow-hidden">
        {/* Coluna principal */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <AnalysisHeader />
          
          {/* Conteúdo principal */}
          <div className="flex-1 flex overflow-hidden">
            {/* Mapa (65%) */}
            <div className="flex-1 w-[65%] relative">
              <DetailMapView ref={mapRef} />
            </div>
            
            {/* Painel técnico (35%) */}
            <div className="w-[35%] border-l bg-background overflow-y-auto">
              <TechnicalPanel />
            </div>
          </div>
          
          {/* Actions fixas na parte inferior */}
          <ActionPanel onToggleHistory={() => setShowHistory(!showHistory)} mapRef={mapRef} />
        </div>

        {/* Timeline lateral (quando ativa) */}
        {showHistory && (
          <div className="w-80 border-l bg-background">
            <HistoryTimeline onClose={() => setShowHistory(false)} />
          </div>
        )}
      </div>

      {/* Layout Mobile */}
      <div className="md:hidden flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <AnalysisHeader />
        
        {/* Mapa - parte superior */}
        <div className="flex-1 relative">
          <DetailMapView />
        </div>
        
        {/* Painel técnico - parte inferior */}
        <div className="flex-1 border-t bg-background overflow-y-auto">
          <TechnicalPanel />
        </div>
        
        {/* Actions fixas na parte inferior */}
        <ActionPanel onToggleHistory={() => setShowHistory(!showHistory)} mapRef={mapRef} />

        {/* Timeline em modal para mobile */}
        {showHistory && (
          <div className="absolute inset-0 bg-background z-50">
            <HistoryTimeline onClose={() => setShowHistory(false)} />
          </div>
        )}
      </div>

      {/* Modal de reprocessamento */}
      <ReprocessModal />
    </AnalysisDetailProvider>
  );
}