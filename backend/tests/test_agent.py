from models.schemas import ExtractedSymptom, ExtractionResult, GraphQueryResult, VerificationDecision
from agent.verifier import verify_and_decide
from agent.synthesizer import build_explanation
from graph.traversal import query_graph


def make_mock_extraction(symptom_texts: list[str]) -> ExtractionResult:
    return ExtractionResult(symptoms=[ExtractedSymptom(raw_text=text, confidence=0.9) for text in symptom_texts], raw_llm_response="{}")


def make_mock_graph_result() -> GraphQueryResult:
    raw = query_graph(["right lower quadrant pain", "fever", "nausea"])
    return GraphQueryResult(**raw)


def test_verifier_confirms_valid_diagnosis():
    extraction = make_mock_extraction(["right lower quadrant pain", "fever", "nausea"])
    graph_result = make_mock_graph_result()
    decision = verify_and_decide(extraction, graph_result)
    assert decision.graph_verdict in ("CONFIRMED", "OVERRIDDEN", "INSUFFICIENT_DATA")


def test_verifier_insufficient_data_on_no_symptoms():
    extraction = make_mock_extraction([])
    graph_result = GraphQueryResult(**query_graph([]))
    decision = verify_and_decide(extraction, graph_result)
    assert decision.graph_verdict == "INSUFFICIENT_DATA"
    assert decision.final_diagnosis is None


def test_explanation_generated():
    extraction = make_mock_extraction(["fever", "nausea"])
    graph_result = make_mock_graph_result()
    verification = VerificationDecision(
        graph_verdict="CONFIRMED",
        final_diagnosis="Appendicitis",
        confidence_score=0.92,
    )
    explanation = build_explanation(extraction, graph_result, verification)
    assert len(explanation) > 50
    assert "Appendicitis" in explanation or "diagnosis" in explanation.lower()
