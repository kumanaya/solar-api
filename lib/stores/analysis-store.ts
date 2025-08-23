import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { AnalysisSchema, Analysis } from '../types/analysis-schema';

interface AnalysisState {
  // Analysis data
  data: Analysis;
  updateData: (updates: Partial<Analysis>) => void;
  resetData: () => void;

  // Duplicate data for analysis duplication
  duplicateData: {
    address: string;
    coordinates: [number, number];
    polygon: {
      type: "Polygon";
      coordinates: number[][][];
      source?: "user-drawn" | "microsoft-footprint" | "google-footprint";
    } | null;
    footprints: any[];
    timestamp: number;
  } | null;
  setDuplicateData: (data: AnalysisState['duplicateData']) => void;
  clearDuplicateData: () => void;
  initializeFromDuplicate: () => void;

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
  coordinates: [-46.6333, -23.5505], // São Paulo instead of [0,0] to avoid ocean
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
  persist(
    devtools(
      (set, get) => ({
        // Analysis data
        data: defaultData,
        updateData: (updates) => set((state) => {
          // Ensure coordinates is never null or undefined, use São Paulo as fallback
          const safeUpdates = {
            ...updates,
            coordinates: updates.coordinates || state.data.coordinates || [-46.6333, -23.5505]
          };
          
          // Validate updates against schema
          const newData = { ...state.data, ...safeUpdates };
          try {
            const validatedData = AnalysisSchema.parse(newData);
            return { data: validatedData };
          } catch (error) {
            console.error('Invalid analysis data:', error, 'Updates:', safeUpdates);
            return state;
          }
        }),
        resetData: () => set({ data: defaultData }),

        // Duplicate data management
        duplicateData: null,
        setDuplicateData: (data) => set({ duplicateData: data }),
        clearDuplicateData: () => set({ duplicateData: null }),
        initializeFromDuplicate: () => {
          const { duplicateData } = get();
          
          if (duplicateData) {
            // Check if data is recent (within 5 minutes)
            const isRecent = Date.now() - duplicateData.timestamp < 5 * 60 * 1000;
            
            if (isRecent && duplicateData.address && duplicateData.coordinates) {
              console.log('Initializing from duplicate data:', duplicateData);
              
              // Validate coordinates format
              const coordinates = Array.isArray(duplicateData.coordinates) && 
                                duplicateData.coordinates.length === 2 &&
                                typeof duplicateData.coordinates[0] === 'number' &&
                                typeof duplicateData.coordinates[1] === 'number'
                                ? duplicateData.coordinates 
                                : [-46.6333, -23.5505]; // São Paulo fallback
              
              // Set the address and coordinates
              set({ selectedAddress: duplicateData.address });
              
              // Update data with proper validation
              const updates = {
                address: duplicateData.address,
                coordinates,
                footprints: duplicateData.footprints || []
              };
              
              set((state) => {
                const newData = { ...state.data, ...updates };
                try {
                  const validatedData = AnalysisSchema.parse(newData);
                  return { data: validatedData };
                } catch (error) {
                  console.error('Failed to validate duplicate data:', error);
                  return state; // Don't update if validation fails
                }
              });
              
              // Set polygon if available
              if (duplicateData.polygon) {
                set({ currentPolygon: duplicateData.polygon });
              }
              
              // Set footprint flags if footprints exist
              if (duplicateData.footprints?.length > 0) {
                set({ hasFootprintFromAction: true });
              }
              
              // Clear the duplicate data after use
              set({ duplicateData: null });
            }
          }
        },

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
    ),
    { 
      name: 'analysis-storage',
      partialize: (state) => ({ duplicateData: state.duplicateData })
    }
  )
);
