"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, DollarSign, Save, Loader2 } from "lucide-react";
import { useAnalysis } from "./analysis-context";
import { PDFModal } from "./pdf-modal";

export function ActionButtons() {
  const { data } = useAnalysis();
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenPDFModal = () => {
    setIsPDFModalOpen(true);
  };

  const handleAddProposal = async () => {
    try {
      // Simular chamada para /pricing
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log("Proposta adicionada para:", data.address);
      alert("Proposta comercial adicionada ao laudo!");
    } catch (error) {
      console.error("Erro ao adicionar proposta:", error);
      alert("Erro ao adicionar proposta. Tente novamente.");
    }
  };

  const handleSaveAnalysis = async () => {
    setIsSaving(true);
    try {
      // Simular salvamento
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log("Análise salva:", data.address);
      alert("Análise salva com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar análise:", error);
      alert("Erro ao salvar análise. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-3">
        {/* Botão principal - Gerar PDF */}
        <Button 
          onClick={handleOpenPDFModal}
          className="w-full"
        >
          <FileText className="mr-2 h-4 w-4" />
          Gerar PDF do Laudo
        </Button>

      {/* Botões secundários */}
      <div className="grid grid-cols-2 gap-2">
        <Button 
          variant="outline" 
          onClick={handleAddProposal}
        >
          <DollarSign className="mr-2 h-4 w-4" />
          Add Proposta
        </Button>
        
        <Button 
          variant="outline" 
          onClick={handleSaveAnalysis}
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar
        </Button>
      </div>

        {/* Informações adicionais */}
        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          <p>O PDF incluirá todos os dados técnicos e o veredicto</p>
          <p>A proposta comercial será calculada automaticamente</p>
        </div>
      </div>

      {/* Modal do PDF */}
      <PDFModal 
        isOpen={isPDFModalOpen} 
        onClose={() => setIsPDFModalOpen(false)}
        analysisData={data}
      />
    </>
  );
}