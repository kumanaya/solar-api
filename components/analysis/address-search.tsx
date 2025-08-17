"use client";

import { useState } from "react";
import { Search, MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAnalysis } from "./analysis-context";

export function AddressSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const { updateData, setIsLoading, setError } = useAnalysis();

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setIsLoading(true);
    setError(null);

    try {
      // Simular busca de endereço e análise
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock de dados de análise
      const mockData = {
        address: searchQuery,
        coordinates: [-23.550520, -46.633308] as [number, number],
        coverage: {
          google: Math.random() > 0.3,
          fallback: "Usando dados NASA SRTM"
        },
        confidence: Math.random() > 0.5 ? "Alta" : Math.random() > 0.3 ? "Média" : "Baixa",
        usableArea: Math.floor(Math.random() * 200) + 50,
        areaSource: "footprint" as const,
        annualIrradiation: Math.floor(Math.random() * 500) + 1400,
        irradiationSource: "PVGIS",
        shadingIndex: Math.random() * 0.3,
        shadingLoss: Math.floor(Math.random() * 15),
        estimatedProduction: Math.floor(Math.random() * 5000) + 2000,
        verdict: Math.random() > 0.3 ? "Apto" : Math.random() > 0.5 ? "Parcial" : "Não apto",
        reasons: ["Boa irradiação solar", "Área suficiente", "Baixo sombreamento"],
        footprints: [
          {
            id: "1",
            coordinates: [
              [-23.550520, -46.633308],
              [-23.550530, -46.633290],
              [-23.550540, -46.633310],
              [-23.550530, -46.633320]
            ] as [number, number][],
            area: Math.floor(Math.random() * 100) + 80,
            isActive: true
          }
        ]
      };

      updateData(mockData);
    } catch {
      setError("Erro ao buscar endereço. Tente novamente.");
    } finally {
      setIsSearching(false);
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="bg-background rounded-lg shadow-lg border p-3">
      <div className="flex space-x-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Digite o endereço para análise..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isSearching}
            className="pl-10"
          />
        </div>
        <Button 
          onClick={handleSearch}
          disabled={isSearching || !searchQuery.trim()}
          size="default"
        >
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}