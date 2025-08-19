"use client";

import { useState, useEffect, useRef } from "react";
import { Search, MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAnalysis, ConfidenceLevel, Verdict } from "./analysis-context";

interface AddressSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  place_id: string;
}

export function AddressSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { updateData, setIsLoading, setError } = useAnalysis();

  // Função para buscar sugestões de endereços
  const fetchSuggestions = async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoadingSuggestions(true);
    try {
      // Usar Nominatim (OpenStreetMap) para geocoding gratuito
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=br&q=${encodeURIComponent(query)}`,
        {
          headers: {
            'User-Agent': 'SolarAnalysis/1.0'
          }
        }
      );
      
      if (response.ok) {
        const data: AddressSuggestion[] = await response.json();
        setSuggestions(data);
      }
    } catch (error) {
      console.error('Erro ao buscar sugestões:', error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Debounce para evitar muitas requisições
  useEffect(() => {
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
    }

    if (searchQuery.trim()) {
      suggestionTimeoutRef.current = setTimeout(() => {
        fetchSuggestions(searchQuery);
      }, 300);
    } else {
      setSuggestions([]);
    }

    return () => {
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleSuggestionClick = (suggestion: AddressSuggestion) => {
    setSearchQuery(suggestion.display_name);
    setShowSuggestions(false);
    setSuggestions([]);
    // Automaticamente iniciar a análise
    performAnalysis(suggestion.display_name, suggestion.lat, suggestion.lon);
  };

  const performAnalysis = async (address: string, lat?: string, lon?: string) => {
    setIsSearching(true);
    setIsLoading(true);
    setError(null);
    setShowSuggestions(false);

    try {
      // Simular busca de endereço e análise
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Usar coordenadas da sugestão se disponíveis
      const coordinates = lat && lon 
        ? [parseFloat(lon), parseFloat(lat)] as [number, number]
        : [-23.550520, -46.633308] as [number, number];

      // Mock de dados de análise
      const mockData = {
        address,
        coordinates: `${coordinates[0]},${coordinates[1]}`,
        coverage: {
          google: Math.random() > 0.3,
          fallback: "Usando dados NASA SRTM"
        },
        confidence: (Math.random() > 0.5 ? "Alta" : Math.random() > 0.3 ? "Média" : "Baixa") as ConfidenceLevel,
        usableArea: Math.floor(Math.random() * 200) + 50,
        areaSource: "footprint" as const,
        annualIrradiation: Math.floor(Math.random() * 500) + 1400,
        irradiationSource: "PVGIS",
        shadingIndex: Math.random() * 0.3,
        shadingLoss: Math.floor(Math.random() * 15),
        estimatedProduction: Math.floor(Math.random() * 5000) + 2000,
        verdict: (Math.random() > 0.3 ? "Apto" : Math.random() > 0.5 ? "Parcial" : "Não apto") as Verdict,
        reasons: ["Boa irradiação solar", "Área suficiente", "Baixo sombreamento"],
        footprints: [
          {
            id: "1",
            coordinates: [
              [coordinates[0], coordinates[1]],
              [coordinates[0] + 0.001, coordinates[1]],
              [coordinates[0] + 0.001, coordinates[1] + 0.001],
              [coordinates[0], coordinates[1] + 0.001]
            ] as [number, number][],
            area: Math.floor(Math.random() * 100) + 80,
            isActive: true
          }
        ],
        usageFactor: 0.75
      };

      updateData(mockData);
    } catch {
      setError("Erro ao buscar endereço. Tente novamente.");
    } finally {
      setIsSearching(false);
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    performAnalysis(searchQuery);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setShowSuggestions(true);
  };

  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = () => {
    // Pequeno delay para permitir clique na sugestão
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
    if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="bg-background rounded-lg shadow-lg border p-3">
      <div className="flex space-x-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
          <Input
            ref={inputRef}
            placeholder="Digite o endereço para análise..."
            value={searchQuery}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onKeyPress={handleKeyPress}
            disabled={isSearching}
            className="pl-10"
          />
          
          {/* Dropdown de sugestões */}
          {showSuggestions && (suggestions.length > 0 || isLoadingSuggestions) && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-20 max-h-60 overflow-y-auto">
              {isLoadingSuggestions ? (
                <div className="p-3 text-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                  Buscando endereços...
                </div>
              ) : (
                suggestions.map((suggestion) => (
                  <div
                    key={suggestion.place_id}
                    className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0 text-sm"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <div className="flex items-start space-x-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-foreground">
                          {suggestion.display_name}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
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