"use client";

import { useState, useEffect, useRef } from "react";
import { Search, MapPin, Loader2, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAnalysis } from "./analysis-context";
import { analyzeAddress, transformAnalysisData } from "@/lib/analysis-api";

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
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { updateData, setIsLoading, setError, setSelectedAddress } = useAnalysis();

  // Função para buscar sugestões de endereços
  const fetchSuggestions = async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoadingSuggestions(true);
    try {
      // Detectar se contém número no início (ex: "123 rua", "456 av")
      const hasNumberAtStart = /^\d+\s/.test(query.trim());
      // Detectar se é apenas número (número da casa)
      const isJustNumber = /^\d+$/.test(query.trim());
      
      let searchQuery = query;
      if (isJustNumber) {
        // Se for apenas número, adicionar contexto brasileiro para melhorar resultados
        searchQuery = `${query}, Brasil`;
      }
      
      // Usar Nominatim (OpenStreetMap) para geocoding gratuito
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=10&countrycodes=br&q=${encodeURIComponent(searchQuery)}`,
        {
          headers: {
            'User-Agent': 'SolarAnalysis/1.0'
          }
        }
      );
      
      if (response.ok) {
        const data: AddressSuggestion[] = await response.json();
        
        let finalSuggestions = data;
        
        // Se digitou número + rua (ex: "123 rua"), priorizar endereços que começam com esse número
        if (hasNumberAtStart) {
          const numberMatch = query.match(/^(\d+)\s/);
          if (numberMatch) {
            const number = numberMatch[1];
            const prioritized = data.filter(item => {
              const displayName = item.display_name.toLowerCase();
              return displayName.startsWith(number + ' ') || displayName.includes(`, ${number} `);
            });
            const others = data.filter(item => {
              const displayName = item.display_name.toLowerCase();
              return !(displayName.startsWith(number + ' ') || displayName.includes(`, ${number} `));
            });
            finalSuggestions = [...prioritized, ...others];
          }
        }
        // Se for busca por número apenas, filtrar endereços que contenham esse número
        else if (isJustNumber) {
          const withNumber = data.filter(item => {
            const displayName = item.display_name.toLowerCase();
            // Verifica se o número aparece no início do endereço ou após vírgula/espaço
            const numberPattern = new RegExp(`(^|[,\\s])${query}(\\s|,|$)`, 'i');
            return numberPattern.test(displayName);
          });
          const withoutNumber = data.filter(item => {
            const displayName = item.display_name.toLowerCase();
            const numberPattern = new RegExp(`(^|[,\\s])${query}(\\s|,|$)`, 'i');
            return !numberPattern.test(displayName);
          });
          finalSuggestions = [...withNumber, ...withoutNumber.slice(0, 3)];
        }
        
        setSuggestions(finalSuggestions.slice(0, 8));
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

  const handleSuggestionClick = async (suggestion: AddressSuggestion) => {
    setSearchQuery(suggestion.display_name);
    setSelectedAddress(suggestion.display_name);
    setShowSuggestions(false);
    setSuggestions([]);
    
    // Update coordinates in analysis context
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);
    updateData({
      address: suggestion.display_name,
      coordinates: [lng, lat] as [number, number]
    });
  };


  const handleAddressConfirm = async () => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Detectar se é apenas número
      const isJustNumber = /^\d+$/.test(searchQuery.trim());
      let finalSearchQuery = searchQuery;
      
      if (isJustNumber) {
        finalSearchQuery = `${searchQuery}, Brasil`;
      }
      
      // Geocode the address
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=br&q=${encodeURIComponent(finalSearchQuery)}`,
        {
          headers: {
            'User-Agent': 'SolarAnalysis/1.0'
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          let result = data[0];
          
          // Se for busca por número, tentar encontrar o melhor resultado
          if (isJustNumber && data.length > 1) {
            const filtered = data.filter(item => {
              const displayName = item.display_name.toLowerCase();
              const numberPattern = new RegExp(`(^|[,\\s])${searchQuery}(\\s|,|$)`, 'i');
              return numberPattern.test(displayName);
            });
            if (filtered.length > 0) {
              result = filtered[0];
            }
          }
          
          const lat = parseFloat(result.lat);
          const lng = parseFloat(result.lon);
          
          setSelectedAddress(result.display_name);
          updateData({
            address: result.display_name,
            coordinates: [lng, lat] as [number, number]
          });
        } else {
          setError('Endereço não encontrado');
        }
      } else {
        setError('Erro ao buscar endereço');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      setError('Erro ao buscar endereço');
    } finally {
      setIsLoading(false);
    }
    
    setShowSuggestions(false);
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
      handleAddressConfirm();
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
            placeholder="Ex: 123 Rua das Flores, São Paulo..."
            value={searchQuery}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onKeyPress={handleKeyPress}
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
          onClick={handleAddressConfirm}
          disabled={!searchQuery.trim()}
          size="default"
          variant="outline"
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}