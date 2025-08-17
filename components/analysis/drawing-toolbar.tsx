"use client";

import { Button } from "@/components/ui/button";
import { Pen, Undo, Trash2, Save, X } from "lucide-react";

interface DrawingToolbarProps {
  onExit: () => void;
}

export function DrawingToolbar({ onExit }: DrawingToolbarProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg border p-2 flex space-x-2">
      <Button size="sm" variant="outline">
        <Pen className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="outline">
        <Undo className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="outline">
        <Trash2 className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="default">
        <Save className="h-4 w-4" />
      </Button>
      <div className="w-px bg-border" />
      <Button size="sm" variant="ghost" onClick={onExit}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}