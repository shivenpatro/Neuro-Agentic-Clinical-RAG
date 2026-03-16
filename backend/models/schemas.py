from __future__ import annotations

from enum import Enum
from typing import Any, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


class UrgencyLevel(str, Enum):
    emergency = "emergency"
    urgent = "urgent"
    routine = "routine"
    non_urgent = "non_urgent"
    unknown = "unknown"


class ClinicalTextInput(BaseModel):
    text: str = Field(..., min_length=10, max_length=2000, description="Raw clinical note or patient-reported symptoms")
    llm_config: Optional[dict] = Field(None, description="Optional override for LLM config (base_url, api_key, model)")

    @field_validator("text")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class ExtractedSymptom(BaseModel):
    raw_text: str = Field(..., description="Exact phrase from clinical text")
    canonical_form: Optional[str] = Field(None, description="Normalized symptom ID (filled by graph layer)")
    confidence: float = Field(..., ge=0.0, le=1.0)


class ExtractionResult(BaseModel):
    symptoms: List[ExtractedSymptom]
    patient_context: Optional[str] = Field(None, description="Age, sex, or relevant context extracted from text")
    extraction_notes: Optional[str] = Field(None, description="LLM notes on ambiguous phrases")
    raw_llm_response: str


class GraphReasoning(BaseModel):
    step: str
    description: str
    status: str


class DiagnosisCandidate(BaseModel):
    disease_id: str
    disease_name: str
    icd10: Optional[str] = None
    urgency: UrgencyLevel
    score: float
    threshold: float
    status: str
    matched_symptoms: List[dict] = Field(default_factory=list)
    description: Optional[str] = None
    reasoning: List[dict] = Field(default_factory=list)


class GraphQueryResult(BaseModel):
    matched_symptoms: List[str]
    unknown_symptoms: List[str]
    candidates: List[DiagnosisCandidate]
    top_diagnoses: List[DiagnosisCandidate]
    graph_path: List[dict]
    graph_coverage: dict


class VerificationDecision(BaseModel):
    llm_proposed: Optional[str] = Field(None, description="What the LLM suggested (if anything)")
    graph_verdict: str
    final_diagnosis: Optional[str] = None
    rejection_reason: Optional[str] = None
    confidence_score: float


class PipelineResponse(BaseModel):
    status: Literal["success", "insufficient_data", "error"]
    extraction: ExtractionResult
    graph_result: GraphQueryResult
    verification: VerificationDecision
    primary_diagnosis: Optional[str] = None
    primary_icd10: Optional[str] = None
    urgency: UrgencyLevel
    confidence: float
    explanation: str
    reasoning_trail: List[dict]
    processing_time_ms: int
    rag_evidence: List[str] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    status: Literal["error"] = "error"
    message: str
    detail: Optional[str] = None


# ── Drug Check ────────────────────────────────────────────────────────────────

class DrugCheckRequest(BaseModel):
    diagnosis: str


class DrugInfo(BaseModel):
    name: str
    generic_name: Optional[str] = None
    route: Optional[str] = None
    warnings: Optional[str] = None


class DrugCheckResult(BaseModel):
    diagnosis: str
    suggested_drugs: List[DrugInfo]
    interactions: List[dict] = Field(default_factory=list)
    disclaimer: str = (
        "This information is for educational purposes only and does not constitute medical advice. "
        "Always consult a qualified healthcare professional before prescribing or administering medication."
    )
