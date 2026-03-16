"""
These tests use mocking so they run without LM Studio active.
"""

from unittest.mock import patch

from agent.extractor import _parse_llm_response, extract_symptoms

MOCK_LLM_RESPONSE = """{
  "symptoms": [
    {"raw_text": "sharp lower right quadrant abdominal pain", "confidence": 0.95},
    {"raw_text": "mild fever", "confidence": 0.90},
    {"raw_text": "nausea", "confidence": 0.85}
  ],
  "patient_context": "Adult patient",
  "extraction_notes": null
}"""


def test_parse_clean_json():
    result = _parse_llm_response(MOCK_LLM_RESPONSE)
    assert len(result["symptoms"]) == 3


def test_parse_json_with_markdown_fences():
    fenced = f"```json\n{MOCK_LLM_RESPONSE}\n```"
    result = _parse_llm_response(fenced)
    assert len(result["symptoms"]) == 3


def test_parse_invalid_json_returns_empty():
    result = _parse_llm_response("This is not JSON at all")
    assert result["symptoms"] == []


@patch("agent.extractor._call_llm")
def test_extract_symptoms_returns_extraction_result(mock_llm):
    mock_llm.return_value = MOCK_LLM_RESPONSE
    result = extract_symptoms("Patient has right lower quadrant pain, fever, and nausea.")
    assert len(result.symptoms) == 3
    assert result.symptoms[0].raw_text == "sharp lower right quadrant abdominal pain"
    assert result.symptoms[0].confidence == 0.95


@patch("agent.extractor._call_llm")
def test_extract_symptoms_handles_empty_response(mock_llm):
    mock_llm.return_value = '{"symptoms": [], "extraction_notes": "No symptoms found"}'
    result = extract_symptoms("Normal physical examination.")
    assert len(result.symptoms) == 0
