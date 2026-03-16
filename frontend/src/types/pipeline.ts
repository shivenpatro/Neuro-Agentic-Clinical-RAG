export type UrgencyLevel = "emergency" | "urgent" | "routine" | "non_urgent" | "unknown";

export interface ExtractedSymptom {
  raw_text: string;
  canonical_form: string | null;
  confidence: number;
}

export interface ExtractionResult {
  symptoms: ExtractedSymptom[];
  patient_context: string | null;
  extraction_notes: string | null;
  raw_llm_response: string;
}

export interface DiagnosisCandidate {
  disease_id: string;
  disease_name: string;
  icd10: string | null;
  urgency: UrgencyLevel;
  score: number;
  threshold: number;
  status: "valid" | "excluded" | "missing_required" | "below_threshold";
  matched_symptoms: Array<{ symptom: string; weight: number; required: boolean }>;
  description: string | null;
  reasoning: Array<{ rule: string; symptom?: string; message: string; verdict: string }>;
}

export interface GraphQueryResult {
  matched_symptoms: string[];
  unknown_symptoms: string[];
  candidates: DiagnosisCandidate[];
  top_diagnoses: DiagnosisCandidate[];
  graph_path: Array<Record<string, unknown>>;
  graph_coverage: {
    symptoms_in_graph: number;
    symptoms_not_found: number;
    diseases_evaluated: number;
    diseases_accepted: number;
  };
}

export interface VerificationDecision {
  llm_proposed: string | null;
  graph_verdict: "CONFIRMED" | "OVERRIDDEN" | "INSUFFICIENT_DATA";
  final_diagnosis: string | null;
  rejection_reason: string | null;
  confidence_score: number;
}

export interface ReasoningStep {
  phase: number;
  phase_name: string;
  icon: string;
  status: "completed" | "failed" | "processing";
  summary: string;
  details: Array<{ label: string; value: string }>;
}

export interface PipelineResponse {
  status: "success" | "insufficient_data" | "error";
  extraction: ExtractionResult;
  graph_result: GraphQueryResult;
  verification: VerificationDecision;
  primary_diagnosis: string | null;
  primary_icd10: string | null;
  urgency: UrgencyLevel;
  confidence: number;
  explanation: string;
  reasoning_trail: ReasoningStep[];
  processing_time_ms: number;
  rag_evidence: string[];
}

export type PipelineStage = "idle" | "extracting" | "graph_querying" | "verifying" | "complete" | "error";
