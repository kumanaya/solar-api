"use client";

import { ReactNode } from "react";
import { useAnalysisStore } from "@/lib/stores/analysis-store";

export function AnalysisProvider({ children }: { children: ReactNode }) {
  return children;
}

export function useAnalysis() {
  const store = useAnalysisStore();
  return store;
}