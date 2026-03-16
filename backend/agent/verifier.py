"""
agent/verifier.py
Symbolic guardrail layer that decides final verdict.
"""

from __future__ import annotations

from typing import Optional

from models.schemas import ExtractionResult, GraphQueryResult, VerificationDecision


CONFIDENCE_THRESHOLD = 0.70


def verify_and_decide(
    extraction: ExtractionResult,
    graph_result: GraphQueryResult,
    llm_proposed: Optional[str] = None,
) -> VerificationDecision:
    top = graph_result.top_diagnoses

    if not graph_result.matched_symptoms and not top:
        return VerificationDecision(
            llm_proposed=llm_proposed,
            graph_verdict="INSUFFICIENT_DATA",
            final_diagnosis=None,
            rejection_reason="No symptoms from the clinical text matched the medical knowledge graph.",
            confidence_score=0.0,
        )

    if not top:
        excluded = [candidate for candidate in graph_result.candidates if candidate.status == "excluded"]
        missing = [candidate for candidate in graph_result.candidates if candidate.status == "missing_required"]
        reason = "Symptoms present but no diagnosis meets confidence threshold. "
        if excluded:
            reason += f"{len(excluded)} candidate(s) were excluded by hard rules. "
        if missing:
            reason += f"{len(missing)} candidate(s) had missing required symptoms."
        return VerificationDecision(
            llm_proposed=llm_proposed,
            graph_verdict="INSUFFICIENT_DATA",
            final_diagnosis=None,
            rejection_reason=reason.strip(),
            confidence_score=0.0,
        )

    best = top[0]
    if llm_proposed:
        top_ids = [diagnosis.disease_id for diagnosis in top]
        proposed_id = llm_proposed.lower().replace(" ", "_")
        if proposed_id not in top_ids:
            normalized = round(min(best.score / best.threshold, 1.0), 3) if best.threshold else 0.0
            return VerificationDecision(
                llm_proposed=llm_proposed,
                graph_verdict="OVERRIDDEN",
                final_diagnosis=best.disease_name,
                rejection_reason=(
                    f"LLM proposed '{llm_proposed}' which is not supported by the symptom-disease graph. "
                    f"Graph overrides with '{best.disease_name}' (score: {best.score})."
                ),
                confidence_score=normalized,
            )

    normalized_score = round(min(best.score / best.threshold, 1.0), 3) if best.threshold else 0.0
    return VerificationDecision(
        llm_proposed=llm_proposed,
        graph_verdict="CONFIRMED",
        final_diagnosis=best.disease_name,
        rejection_reason=None,
        confidence_score=normalized_score,
    )
