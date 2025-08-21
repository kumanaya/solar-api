"use client";

import { useRouter } from "next/navigation";
import { AnalysesList } from "./analyses-list";
import { AnalysisProvider, useAnalysis, type AnalysisData } from "@/components/analysis/analysis-context";

function AnalysesListWithContext() {
  const router = useRouter();
  const { updateData } = useAnalysis();

  const handleAnalysisSelect = (analysis: AnalysisData) => {
    // Update the analysis context with the loaded analysis
    updateData(analysis);
    
    // Navigate to the analysis page
    router.push('/dashboard/analysis');
  };

  return <AnalysesList onAnalysisSelect={handleAnalysisSelect} />;
}

export function DashboardAnalysesWrapper() {
  return (
    <AnalysisProvider>
      <AnalysesListWithContext />
    </AnalysisProvider>
  );
}