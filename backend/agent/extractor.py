"""
agent/extractor.py
Neural extraction layer using Ollama's OpenAI-compatible endpoint.
"""

from __future__ import annotations

import json
import re
import time
from typing import Any, Dict

from openai import OpenAI
from rich.console import Console

from config import settings
from agent.llm_factory import get_llm_client
from models.schemas import ExtractedSymptom, ExtractionResult

console = Console(legacy_windows=False)

SYSTEM_PROMPT = """You are a medical entity extraction engine. Your ONLY job is to extract clinical symptoms from patient text.

IMPORTANT: Do NOT use <think> blocks or any reasoning output. Respond ONLY with the raw JSON object below and nothing else.

JSON format to return:
{
  "symptoms": [
    {"raw_text": "<exact phrase from input>", "confidence": <0.0 to 1.0>},
    ...
  ],
  "patient_context": "<optional: age/sex/relevant background if mentioned>",
  "extraction_notes": "<optional: note any ambiguous phrases>"
}

Rules:
1. Extract ONLY symptoms, signs, and clinical findings. Do NOT extract diagnoses.
2. Keep raw_text as close to the original phrasing as possible.
3. If a phrase is a diagnosis (e.g. "appendicitis"), do NOT include it.
4. Include confidence based on how clearly something is a symptom (1.0 = certain, 0.5 = ambiguous).
5. Do not invent symptoms not present in the text.
6. Return at least 1 symptom or return {"symptoms": [], "extraction_notes": "No symptoms found"}.
"""


def _call_llm(clinical_text: str, rag_context: list[str] | None = None, llm_config: dict | None = None) -> str:
    client, model_name = get_llm_client(llm_config)

    user_content = ""
    if rag_context:
        context_block = "\n".join(f"- {c}" for c in rag_context)
        user_content += f"Relevant medical context:\n{context_block}\n\n"
    user_content += f"Extract symptoms from this clinical text:\n\n{clinical_text}"

    response = client.chat.completions.create(
        model=model_name,
        temperature=settings.llm_temperature,
        max_tokens=settings.llm_max_tokens,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
    )
    content = response.choices[0].message.content
    return content.strip() if content else '{"symptoms": [], "extraction_notes": "No content from model"}'


def _strip_think_blocks(text: str) -> str:
    """Remove <think>...</think> reasoning blocks emitted by Qwen/DeepSeek thinking models."""
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


def _recover_symptoms_from_truncated(text: str) -> Dict[str, Any]:
    """
    Last-resort: extract individual symptom objects from a truncated JSON stream.
    Handles cases where max_tokens cuts off the closing brackets.
    """
    symptom_pattern = re.compile(
        r'\{"raw_text"\s*:\s*"([^"]+)"\s*,\s*"confidence"\s*:\s*([0-9.]+)\}',
        re.DOTALL,
    )
    symptoms = [
        {"raw_text": m.group(1), "confidence": float(m.group(2))}
        for m in symptom_pattern.finditer(text)
    ]
    if symptoms:
        return {"symptoms": symptoms, "extraction_notes": "Recovered from truncated output"}
    return {"symptoms": [], "extraction_notes": "JSON parse failure - could not recover symptoms"}


def _parse_llm_response(raw_response: str) -> Dict[str, Any]:
    # 1. Strip thinking-model reasoning blocks first
    text = _strip_think_blocks(raw_response)
    # 2. Strip markdown code fences
    cleaned = re.sub(r"```(?:json)?\s*", "", text).strip().rstrip("```").strip()

    # 3. Try clean parse
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # 4. Try to find the outermost JSON object
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    # 5. Output may be truncated (e.g. max_tokens hit mid-stream) — salvage symptoms
    recovered = _recover_symptoms_from_truncated(cleaned)
    if recovered["symptoms"]:
        console.print("[yellow]Warning: JSON was truncated; recovered symptoms via regex.[/yellow]")
        return recovered

    console.print("[yellow]Warning: Could not parse LLM response as JSON.[/yellow]")
    return {"symptoms": [], "extraction_notes": "JSON parse failure - LLM returned unparseable output"}


def extract_symptoms(clinical_text: str, rag_context: list[str] | None = None, llm_config: dict | None = None) -> ExtractionResult:
    console.print("[cyan]Calling LLM for symptom extraction...[/cyan]")
    if rag_context:
        console.print(f"[blue]RAG context: {len(rag_context)} document(s) injected[/blue]")
    start = time.time()
    try:
        raw = _call_llm(clinical_text, rag_context=rag_context, llm_config=llm_config)
    except Exception as exc:  # pragma: no cover
        # Simplified error message since we support multiple providers now
        raise ConnectionError(f"LLM connection failed. Error: {exc}") from exc

    elapsed = round((time.time() - start) * 1000)
    console.print(f"[green]LLM responded in {elapsed}ms[/green]")

    parsed = _parse_llm_response(raw)
    symptoms = []
    for item in parsed.get("symptoms", []):
        if isinstance(item, dict) and "raw_text" in item:
            symptoms.append(
                ExtractedSymptom(
                    raw_text=str(item.get("raw_text", "")).strip(),
                    confidence=float(item.get("confidence", 0.8)),
                )
            )

    return ExtractionResult(
        symptoms=symptoms,
        patient_context=parsed.get("patient_context"),
        extraction_notes=parsed.get("extraction_notes"),
        raw_llm_response=raw,
    )
