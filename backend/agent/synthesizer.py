"""
agent/synthesizer.py
Assembles final response and reasoning trail.
"""

from __future__ import annotations

from typing import Any, Dict, List

from models.schemas import ExtractionResult, GraphQueryResult, PipelineResponse, UrgencyLevel, VerificationDecision


def build_explanation(
    extraction: ExtractionResult,
    graph_result: GraphQueryResult,
    verification: VerificationDecision,
) -> str:
    if not verification.final_diagnosis:
        return (
            f"The system could not determine a diagnosis. "
            f"Reason: {verification.rejection_reason or 'Insufficient symptom data.'} "
            f"Please provide more detailed clinical information or consult a physician."
        )

    best = graph_result.top_diagnoses[0] if graph_result.top_diagnoses else None
    symptom_list = ", ".join([item.raw_text for item in extraction.symptoms[:5]])
    graph_path_summary = f"{len(graph_result.graph_path)} reasoning steps"
    matched = len(graph_result.matched_symptoms)

    explanation = (
        f"Based on the presented symptoms ({symptom_list}), the system identified {matched} matching clinical "
        f"indicators in the medical knowledge graph. After {graph_path_summary} and applying strict diagnostic "
        f"rules, the most likely diagnosis is {verification.final_diagnosis}"
    )
    if best and best.description:
        explanation += f". {best.description}"
    if verification.confidence_score:
        explanation += f" Diagnostic confidence: {round(verification.confidence_score * 100)}%."
    if verification.graph_verdict == "OVERRIDDEN" and verification.rejection_reason:
        explanation += f" Note: The AI's initial suggestion was overridden by the knowledge graph. Reason: {verification.rejection_reason}"
    return explanation


def build_reasoning_trail(
    extraction: ExtractionResult,
    graph_result: GraphQueryResult,
    verification: VerificationDecision,
) -> List[Dict[str, Any]]:
    excluded_count = len([candidate for candidate in graph_result.candidates if candidate.status == "excluded"])
    disqualified_count = len(
        [candidate for candidate in graph_result.candidates if candidate.status in ("missing_required", "below_threshold")]
    )
    return [
        {
            "phase": 1,
            "phase_name": "Neural Extraction",
            "icon": "brain",
            "status": "completed",
            "summary": f"Extracted {len(extraction.symptoms)} symptoms from clinical text",
            "details": [{"label": item.raw_text, "value": f"{round(item.confidence * 100)}% confidence"} for item in extraction.symptoms],
        },
        {
            "phase": 2,
            "phase_name": "Symbolic Verification",
            "icon": "network",
            "status": "completed",
            "summary": (
                f"Graph evaluated {len(graph_result.candidates)} candidate diagnoses. "
                f"{excluded_count} excluded, {disqualified_count} disqualified, {len(graph_result.top_diagnoses)} confirmed."
            ),
            "details": [
                {
                    "label": step.get("disease", step.get("input", "Step")),
                    "value": step.get("verdict", step.get("status", "")),
                }
                for step in graph_result.graph_path[:10]
            ],
        },
        {
            "phase": 3,
            "phase_name": "Agentic Synthesis",
            "icon": "check-circle",
            "status": "completed",
            "summary": f"Verdict: {verification.graph_verdict}",
            "details": [
                {"label": "Graph Verdict", "value": verification.graph_verdict},
                {"label": "Final Diagnosis", "value": verification.final_diagnosis or "None"},
                {"label": "Confidence", "value": f"{round(verification.confidence_score * 100)}%"},
            ]
            + ([{"label": "Override Reason", "value": verification.rejection_reason}] if verification.rejection_reason else []),
        },
    ]


def synthesize(
    extraction: ExtractionResult,
    graph_result: GraphQueryResult,
    verification: VerificationDecision,
    processing_time_ms: int,
    rag_evidence: list[str] | None = None,
) -> PipelineResponse:
    best = graph_result.top_diagnoses[0] if graph_result.top_diagnoses else None
    urgency = UrgencyLevel.unknown
    if best:
        try:
            urgency = UrgencyLevel(best.urgency.value if hasattr(best.urgency, "value") else best.urgency)
        except ValueError:
            urgency = UrgencyLevel.unknown

    trail = build_reasoning_trail(extraction, graph_result, verification)

    # Append a RAG Evidence phase if context was retrieved
    if rag_evidence:
        trail.append({
            "phase": 4,
            "phase_name": "RAG Evidence",
            "icon": "database",
            "status": "completed",
            "summary": f"{len(rag_evidence)} relevant passage(s) retrieved from the medical knowledge base",
            "details": [{"label": f"Doc {i + 1}", "value": doc[:120] + "..."} for i, doc in enumerate(rag_evidence)],
        })

    return PipelineResponse(
        status="success" if verification.final_diagnosis else "insufficient_data",
        extraction=extraction,
        graph_result=graph_result,
        verification=verification,
        primary_diagnosis=verification.final_diagnosis,
        primary_icd10=best.icd10 if best else None,
        urgency=urgency,
        confidence=verification.confidence_score,
        explanation=build_explanation(extraction, graph_result, verification),
        reasoning_trail=trail,
        processing_time_ms=processing_time_ms,
        rag_evidence=rag_evidence or [],
    )
