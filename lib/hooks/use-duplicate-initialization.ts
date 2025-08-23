import { useEffect } from 'react';
import { useAnalysisStore } from '@/lib/stores/analysis-store';

export function useDuplicateInitialization() {
  const initializeFromDuplicate = useAnalysisStore(state => state.initializeFromDuplicate);
  
  useEffect(() => {
    // Initialize from duplicate data when the component mounts
    initializeFromDuplicate();
  }, [initializeFromDuplicate]);
}