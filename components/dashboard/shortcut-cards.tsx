"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Play, 
  Upload, 
  Download, 
  Clock, 
  CheckCircle,
  AlertCircle,
  ExternalLink
} from "lucide-react";

export function ShortcutCards() {
  const [isUploadingCSV, setIsUploadingCSV] = useState(false);

  const handleLastReport = () => {
    // Aqui seria implementada a lógica para abrir o último laudo
    console.log("Abrindo último laudo...");
    // Simular redirecionamento ou modal
    alert("Abrindo último laudo: Rua das Flores, 123 - SP");
  };

  const handleTutorial = () => {
    // Aqui seria implementada a lógica para abrir o tutorial
    console.log("Iniciando tutorial...");
    // Simular abertura de modal ou nova aba
    alert("Iniciando tutorial de 2 minutos...");
  };

  const handleCSVUpload = async () => {
    setIsUploadingCSV(true);
    
    try {
      // Simular upload de arquivo
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log("Arquivo CSV processado");
      alert("Lista CSV importada com sucesso! 15 endereços adicionados à fila.");
    } catch (error) {
      console.error("Erro no upload:", error);
      alert("Erro ao importar arquivo CSV. Tente novamente.");
    } finally {
      setIsUploadingCSV(false);
    }
  };

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
      {/* Card Último Laudo */}
      <Card className="hover:shadow-md transition-shadow cursor-pointer group">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-blue-500" />
              <span>Último Laudo</span>
            </div>
            <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
          </CardTitle>
          <CardDescription className="text-sm">
            Acesso rápido ao seu relatório mais recente
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Rua das Flores, 123</span>
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                Viável
              </Badge>
            </div>
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>17/08/2025</span>
              <span>95% confiança</span>
            </div>
          </div>
          <Button 
            onClick={handleLastReport}
            variant="outline" 
            size="sm" 
            className="w-full"
          >
            <Download className="mr-2 h-3 w-3" />
            Baixar PDF
          </Button>
        </CardContent>
      </Card>

      {/* Card Tutorial */}
      <Card className="hover:shadow-md transition-shadow cursor-pointer group">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center space-x-2">
              <Play className="h-4 w-4 text-purple-500" />
              <span>Tutorial Rápido</span>
            </div>
            <Clock className="h-3 w-3 text-muted-foreground" />
          </CardTitle>
          <CardDescription className="text-sm">
            Aprenda a usar a plataforma em 2 minutos
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span className="text-sm">Como fazer análises</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span className="text-sm">Interpretar resultados</span>
            </div>
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-3 w-3 text-orange-500" />
              <span className="text-sm">Dicas avançadas</span>
            </div>
          </div>
          <Button 
            onClick={handleTutorial}
            className="w-full"
          >
            <Play className="mr-2 h-3 w-3" />
            Assistir Agora
          </Button>
        </CardContent>
      </Card>

      {/* Card Importar CSV */}
      <Card className="hover:shadow-md transition-shadow cursor-pointer group">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center space-x-2">
              <Upload className="h-4 w-4 text-orange-500" />
              <span>Importar Lista</span>
            </div>
            <Badge variant="outline" className="text-xs">
              CSV
            </Badge>
          </CardTitle>
          <CardDescription className="text-sm">
            Analise múltiplos endereços de uma vez
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Formato aceito:</span>
              <span className="font-medium">.csv</span>
            </div>
            <div className="flex justify-between">
              <span>Máximo por upload:</span>
              <span className="font-medium">100 endereços</span>
            </div>
            <div className="flex justify-between">
              <span>Créditos necessários:</span>
              <span className="font-medium">1 por endereço</span>
            </div>
          </div>
          <Button 
            onClick={handleCSVUpload}
            variant="outline" 
            size="sm" 
            className="w-full"
            disabled={isUploadingCSV}
          >
            {isUploadingCSV ? (
              <>
                <div className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Processando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-3 w-3" />
                Selecionar Arquivo
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}