"""
agent/streamer.py
Async generator that runs the full 3-step pipeline and yields SSE events.

Event schema:
  {"event": "stage",             "stage": "extracting"|"graph_querying"|"verifying"}
  {"event": "extraction_done",   "data": ExtractionResult}
  {"event": "graph_done",        "data": GraphQueryResult}
  {"event": "verification_done", "data": VerificationDecision}
  {"event": "complete",          "data": PipelineResponse}
  {"event": "error",             "message": str}
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import AsyncGenerator

logger = logging.getLogger(__name__)

from agent.extractor import extract_symptoms
from agent.synthesizer import synthesize
from agent.verifier import verify_and_decide
from db.database import AsyncSessionLocal
from db import crud
from graph.traversal import query_graph
from models.schemas import GraphQueryResult
from rag.retriever import retrieve_context


def _sse(event: str, payload: dict) -> str:
    """Format a single SSE data line."""
    return f"data: {json.dumps({'event': event, **payload})}\n\n"


async def stream_pipeline(clinical_text: str, llm_config: dict | None = None) -> AsyncGenerator[str, None]:
    """
    Run the full pipeline and yield SSE events after each stage.
    Uses asyncio.to_thread so blocking LLM/graph calls don't block the event loop.
    """
    start_time = time.time()

    # ── RAG Context Retrieval ─────────────────────────────────────────────────
    rag_context = await asyncio.to_thread(retrieve_context, clinical_text, 3)

    # ── Stage 1: Neural Extraction ───────────────────────────────────────────
    yield _sse("stage", {"stage": "extracting"})
    await asyncio.sleep(0)  # flush to client

    try:
        extraction = await asyncio.to_thread(extract_symptoms, clinical_text, rag_context or None, llm_config)
    except ConnectionError as exc:
        yield _sse("error", {"message": f"LLM connection failed: {exc}"})
        return
    except Exception as exc:
        yield _sse("error", {"message": f"Extraction failed: {exc}"})
        return

    yield _sse("extraction_done", {"data": extraction.model_dump()})

    # ── Stage 2: Symbolic Graph Query ────────────────────────────────────────
    yield _sse("stage", {"stage": "graph_querying"})
    await asyncio.sleep(0)

    try:
        symptom_strings = [s.raw_text for s in extraction.symptoms]
        graph_raw = await asyncio.to_thread(query_graph, symptom_strings)
        graph_result = GraphQueryResult(**graph_raw)
    except Exception as exc:
        yield _sse("error", {"message": f"Graph query failed: {exc}"})
        return

    yield _sse("graph_done", {"data": graph_result.model_dump()})

    # ── Stage 3: Agentic Verification ────────────────────────────────────────
    yield _sse("stage", {"stage": "verifying"})
    await asyncio.sleep(0)

    try:
        verification = await asyncio.to_thread(verify_and_decide, extraction, graph_result)
    except Exception as exc:
        yield _sse("error", {"message": f"Verification failed: {exc}"})
        return

    yield _sse("verification_done", {"data": verification.model_dump()})

    # ── Synthesis ─────────────────────────────────────────────────────────────
    processing_time_ms = round((time.time() - start_time) * 1000)
    try:
        response = synthesize(extraction, graph_result, verification, processing_time_ms, rag_evidence=rag_context)
    except Exception as exc:
        yield _sse("error", {"message": f"Synthesis failed: {exc}"})
        return

    yield _sse("complete", {"data": response.model_dump()})

    # Auto-save case to DB after streaming completes (non-fatal)
    try:
        async with AsyncSessionLocal() as db:
            await crud.create_case(db, response, clinical_text)
    except Exception as exc:
        # Best-effort save; do not fail the stream — log for ops (e.g. missing DATABASE_URL / schema).
        logger.warning("SSE pipeline: could not persist case to DB: %s", exc)
