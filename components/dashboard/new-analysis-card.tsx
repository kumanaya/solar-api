"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2, Zap } from "lucide-react";

export function NewAnalysisCard() {
  const [address, setAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!address.trim()) {
      setError("Por favor, insira um endereço válido");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Simular API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Aqui seria feita a chamada real para a API de análise
      console.log("Iniciando análise para:", address);
      
      // Limpar formulário após sucesso
      setAddress("");
      
      // Aqui você pode adicionar notificação de sucesso ou redirecionamento
      alert(`Análise iniciada para: ${address}`);
      
    } catch (error) {
      setError("Erro ao iniciar análise. Tente novamente.");
      console.error("Erro na análise:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="col-span-full lg:col-span-4">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Zap className="h-5 w-5 text-orange-500" />
          <span>Nova Análise Solar</span>
        </CardTitle>
        <CardDescription>
          Insira um endereço para analisar a viabilidade de instalação solar
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">Endereço</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="address"
                placeholder="Ex: Rua das Flores, 123, São Paulo - SP"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isLoading}
                className="pl-10"
              />
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              type="submit" 
              disabled={isLoading || !address.trim()}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Iniciar Análise
                </>
              )}
            </Button>
            
            <Button 
              type="button" 
              variant="outline"
              disabled={isLoading}
              onClick={() => {
                // Aqui poderia abrir um modal com opções avançadas
                console.log("Opções avançadas");
              }}
            >
              Opções Avançadas
            </Button>
          </div>
          
          <div className="text-xs text-muted-foreground">
            <p>💡 <strong>Dica:</strong> Use endereços completos para resultados mais precisos</p>
            <p>⚡ Cada análise consome 1 crédito do seu plano atual</p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}