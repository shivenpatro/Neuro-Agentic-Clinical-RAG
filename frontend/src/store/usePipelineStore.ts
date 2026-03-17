import { create } from "zustand";
import type {
  ExtractionResult,
  GraphQueryResult,
  PipelineResponse,
  PipelineStage,
  VerificationDecision,
} from "@/types/pipeline";

interface PipelineState {
  clinicalText: string;
  setClinicalText: (text: string) => void;

  stage: PipelineStage;
  setStage: (stage: PipelineStage) => void;

  result: PipelineResponse | null;
  setResult: (result: PipelineResponse | null) => void;

  // Partial results from SSE stream
  partialExtraction: ExtractionResult | null;
  setPartialExtraction: (e: ExtractionResult | null) => void;
  partialGraphResult: GraphQueryResult | null;
  setPartialGraphResult: (g: GraphQueryResult | null) => void;
  partialVerification: VerificationDecision | null;
  setPartialVerification: (v: VerificationDecision | null) => void;

  // Settings
  llmProvider: "ollama" | "groq" | "custom";
  setLlmProvider: (p: "ollama" | "groq" | "custom") => void;
  apiKey: string;
  setApiKey: (k: string) => void;
  customBaseUrl: string;
  setCustomBaseUrl: (u: string) => void;
  customModelName: string;
  setCustomModelName: (m: string) => void;
  groqModelName: string;
  setGroqModelName: (m: string) => void;

  error: string | null;
  setError: (error: string | null) => void;

  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  reset: () => void;
}

export const usePipelineStore = create<PipelineState>((set) => ({
  clinicalText: "",
  setClinicalText: (text) => set({ clinicalText: text }),

  stage: "idle",
  setStage: (stage) => set({ stage }),

  result: null,
  setResult: (result) => set({ result }),

  partialExtraction: null,
  setPartialExtraction: (partialExtraction) => set({ partialExtraction }),
  partialGraphResult: null,
  setPartialGraphResult: (partialGraphResult) => set({ partialGraphResult }),
  partialVerification: null,
  setPartialVerification: (partialVerification) => set({ partialVerification }),

  llmProvider: "ollama",
  setLlmProvider: (llmProvider) => set({ llmProvider }),
  apiKey: "",
  setApiKey: (apiKey) => set({ apiKey }),
  customBaseUrl: "",
  setCustomBaseUrl: (customBaseUrl) => set({ customBaseUrl }),
  customModelName: "",
  setCustomModelName: (customModelName) => set({ customModelName }),
  groqModelName: "llama-3.1-70b-versatile",
  setGroqModelName: (groqModelName) => set({ groqModelName }),

  error: null,
  setError: (error) => set({ error }),

  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),

  reset: () =>
    set({
      stage: "idle",
      result: null,
      error: null,
      isLoading: false,
      clinicalText: "",
      partialExtraction: null,
      partialGraphResult: null,
      partialVerification: null,
      // Don't reset settings
    }),
}));
