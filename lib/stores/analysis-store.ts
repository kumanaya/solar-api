import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AnalysisSchema, Analysis } from '../types/analysis-schema';

interface AnalysisState {
  // Analysis data
  data: Analysis;
  updateData: (updates: Partial<Analysis>) => void;
  resetData: () => void;

  // UI state
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  hasCredits: boolean;
  setHasCredits: (credits: boolean) => void;
  selectedAddress: string;
  setSelectedAddress: (address: string) => void;
  drawingMode: boolean;
  setDrawingMode: (drawing: boolean) => void;
  currentPolygon: { 
    type: "Polygon"; 
    coordinates: number[][][]; 
    source?: "user-drawn" | "microsoft-footprint" | "google-footprint" 
  } | null;
  setCurrentPolygon: (polygon: { 
    type: "Polygon"; 
    coordinates: number[][][]; 
    source?: "user-drawn" | "microsoft-footprint" | "google-footprint" 
  } | null) => void;
  hasAnalysisResults: boolean;
  setHasAnalysisResults: (hasResults: boolean) => void;
  hasFootprintFromAction: boolean;
  setHasFootprintFromAction: (hasFootprint: boolean) => void;
}

// Default analysis data that passes schema validation
const defaultData: Analysis = {
  address: "",
  coordinates: [0, 0],
  coverage: {
    google: false,
    fallback: "Usando dados NASA SRTM"
  },
  confidence: "Baixa",
  usableArea: 0,
  areaSource: "manual",
  annualIrradiation: 0,
  irradiationSource: "PVGIS",
  shadingIndex: 0,
  shadingLoss: 0,
  estimatedProduction: 0,
  verdict: "Não apto",
  reasons: ["Dados insuficientes"],
  footprints: [],
  usageFactor: 0.75
};

export const useAnalysisStore = create<AnalysisState>()(
  devtools(
    (set) => ({
      // Analysis data
      data: defaultData,
      updateData: (updates) => set((state) => {
        // Validate updates against schema
        const newData = { ...state.data, ...updates };
        try {
          const validatedData = AnalysisSchema.parse(newData);
          return { data: validatedData };
        } catch (error) {
          console.error('Invalid analysis data:', error);
          return state;
        }
      }),
      resetData: () => set({ data: defaultData }),

      // UI state
      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),
      error: null,
      setError: (error) => set({ error }),
      hasCredits: true,
      setHasCredits: (credits) => set({ hasCredits: credits }),
      selectedAddress: "",
      setSelectedAddress: (address) => set({ selectedAddress: address }),
      drawingMode: false,
      setDrawingMode: (drawing) => set({ drawingMode: drawing }),
      currentPolygon: null,
      setCurrentPolygon: (polygon) => set({ currentPolygon: polygon }),
      hasAnalysisResults: false,
      setHasAnalysisResults: (hasResults) => set({ hasAnalysisResults: hasResults }),
      hasFootprintFromAction: false,
      setHasFootprintFromAction: (hasFootprint) => set({ hasFootprintFromAction: hasFootprint })
    }),
    { name: 'analysis-store' }
  )
);
