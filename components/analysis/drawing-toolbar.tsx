"use client";

import { Button } from "@/components/ui/button";
import { Pen, Undo, Trash2, X } from "lucide-react";

interface DrawingToolbarProps {
  onExit: () => void;
  drawingCoordinates: [number, number][];
  onUndoLastPoint: () => void;
  onClearDrawing: () => void;
}

export function DrawingToolbar({ 
  onExit, 
  drawingCoordinates, 
  onUndoLastPoint, 
  onClearDrawing 
}: DrawingToolbarProps) {
  return (
    <div className="bg-background rounded-lg shadow-lg border p-2 flex space-x-2">
      <Button 
        size="sm" 
        variant="default"
        title="Modo de desenho ativo"
      >
        <Pen className="h-4 w-4" />
      </Button>
      <Button 
        size="sm" 
        variant="outline"
        onClick={onUndoLastPoint}
        disabled={drawingCoordinates.length === 0}
        title="Desfazer último ponto"
      >
        <Undo className="h-4 w-4" />
      </Button>
      <Button 
        size="sm" 
        variant="outline"
        onClick={onClearDrawing}
        disabled={drawingCoordinates.length === 0}
        title="Limpar desenho"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <div className="w-px bg-border" />
      <Button 
        size="sm" 
        variant="ghost" 
        onClick={onExit}
        title="Sair do modo de desenho"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}