"""
main.py — FastAPI application entry point.
"""

from __future__ import annotations

import json
import sys
import time
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from rich.console import Console
from sqlalchemy.ext.asyncio import AsyncSession

from agent.drug_checker import check_interactions, get_first_line_drugs
from agent.extractor import extract_symptoms
from agent.streamer import stream_pipeline
from agent.synthesizer import synthesize
from agent.verifier import verify_and_decide
from auth import router as auth_router
from auth.jwt import require_current_user
from config import get_cors_origins, settings
from db import crud
from db.database import get_db, init_db
from graph.builder import build_knowledge_graph, get_graph_stats
from graph.traversal import query_graph
from models.schemas import ClinicalTextInput, DrugCheckRequest, DrugCheckResult, GraphQueryResult, PipelineResponse
from rag.retriever import initialize_rag, retrieve_context

console = Console(legacy_windows=False)


@asynccontextmanager
async def lifespan(app: FastAPI):
    console.print("[bold green]Starting Neuro-Agentic Clinical RAG...[/bold green]")
    try:
        graph = build_knowledge_graph()
        stats = get_graph_stats(graph)
        console.print(
            f"[green]Knowledge graph loaded: {stats['total_diseases']} diseases, {stats['total_symptoms']} symptoms[/green]"
        )
    except Exception as exc:
        console.print(f"[bold red]Failed to build knowledge graph: {exc}[/bold red]")
        sys.exit(1)

    await init_db()
    console.print("[green]Database initialized[/green]")

    import asyncio
    await asyncio.to_thread(initialize_rag)
    console.print("[green]RAG retrieval ready[/green]")

    yield
    console.print("[yellow]Shutting down...[/yellow]")


app = FastAPI(
    title="Neuro-Agentic Clinical RAG",
    description="Neurosymbolic clinical decision support with explainable reasoning",
    version="2.0.0",
    lifespan=lifespan,
)

_cors_origins = get_cors_origins()
# Browsers forbid credentials with Access-Control-Allow-Origin: * — disable credentials if wildcard.
_cors_credentials = not any((o.strip() == "*" for o in _cors_origins))
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=_cors_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount auth router
app.include_router(auth_router.router)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health_check():
    try:
        graph = build_knowledge_graph()
        stats = get_graph_stats(graph)
        return {
            "status": "healthy",
            "graph_loaded": True,
            "graph_stats": stats,
            "llm_endpoint": settings.llm_base_url,
            "llm_model": settings.llm_model_name,
        }
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Graph not loaded: {exc}") from exc


# ── Graph Endpoints ───────────────────────────────────────────────────────────

@app.get("/api/graph/stats")
async def graph_stats():
    graph = build_knowledge_graph()
    return get_graph_stats(graph)


@app.get("/api/graph/topology")
async def graph_topology():
    """Return full graph topology in D3-compatible node/link format."""
    graph = build_knowledge_graph()
    nodes = []
    for node_id, data in graph.nodes(data=True):
        node_type = data.get("node_type", "symptom")
        nodes.append({
            "id": node_id,
            "label": data.get("name", node_id.replace("_", " ").title()),
            "type": node_type,
            "icd10": data.get("icd10"),
            "urgency": data.get("urgency"),
            "description": data.get("description"),
        })
    links = []
    for src, tgt, data in graph.edges(data=True):
        links.append({
            "source": src,
            "target": tgt,
            "type": data.get("edge_type", "SUGGESTS"),
            "weight": data.get("weight", 0.5),
        })
    return {"nodes": nodes, "links": links}


# ── Analysis Endpoints ────────────────────────────────────────────────────────

@app.post("/api/analyze/stream")
async def analyze_stream(payload: ClinicalTextInput):
    """SSE endpoint: emits one JSON event per pipeline stage as each completes."""
    return StreamingResponse(
        stream_pipeline(payload.text, payload.llm_config),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/analyze", response_model=PipelineResponse)
async def analyze_clinical_text(
    payload: ClinicalTextInput,
    db: AsyncSession = Depends(get_db),
):
    start_time = time.time()
    try:
        # RAG: retrieve relevant medical context for the clinical text
        rag_context = retrieve_context(payload.text, n_results=3)

        console.print("\n[bold cyan]STEP 1: Neural Extraction[/bold cyan]")
        extraction = extract_symptoms(payload.text, rag_context=rag_context if rag_context else None, llm_config=payload.llm_config)
        console.print(f"  Extracted {len(extraction.symptoms)} symptoms: {[item.raw_text for item in extraction.symptoms]}")

        console.print("\n[bold cyan]STEP 2: Symbolic Graph Query[/bold cyan]")
        symptom_strings = [item.raw_text for item in extraction.symptoms]
        graph_raw = query_graph(symptom_strings)
        graph_result = GraphQueryResult(**graph_raw)
        console.print(
            f"  Graph matched {len(graph_result.matched_symptoms)} symptoms, found {len(graph_result.top_diagnoses)} valid diagnoses"
        )

        console.print("\n[bold cyan]STEP 3: Agentic Verification[/bold cyan]")
        verification = verify_and_decide(extraction, graph_result)
        console.print(f"  Verdict: {verification.graph_verdict} -> {verification.final_diagnosis}")

        processing_time_ms = round((time.time() - start_time) * 1000)
        response = synthesize(extraction, graph_result, verification, processing_time_ms, rag_evidence=rag_context)
        console.print(f"\n[bold green]Pipeline complete in {processing_time_ms}ms[/bold green]\n")

        # Auto-save case to DB
        try:
            await crud.create_case(db, response, payload.text)
        except Exception as db_exc:
            console.print(f"[yellow]Warning: Failed to save case to DB: {db_exc}[/yellow]")

        return response
    except ConnectionError as exc:
        raise HTTPException(status_code=503, detail=f"LLM connection failed: {exc}") from exc
    except Exception as exc:
        console.print(f"[bold red]Pipeline error: {exc}[/bold red]")
        raise HTTPException(status_code=500, detail=f"Internal pipeline error: {exc}") from exc


# ── History Endpoints ─────────────────────────────────────────────────────────

@app.get("/api/history")
async def get_history(
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_current_user),
):
    cases = await crud.get_cases(db, limit=limit, offset=offset)
    return [
        {
            "id": c.id,
            "primary_diagnosis": c.primary_diagnosis,
            "primary_icd10": c.primary_icd10,
            "urgency": c.urgency,
            "confidence": c.confidence,
            "status": c.status,
            "created_at": c.created_at.isoformat(),
            "input_preview": c.input_text[:120] + ("..." if len(c.input_text) > 120 else ""),
        }
        for c in cases
    ]


@app.get("/api/history/{case_id}")
async def get_case(
    case_id: int,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_current_user),
):
    case = await crud.get_case(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return {
        "id": case.id,
        "input_text": case.input_text,
        "primary_diagnosis": case.primary_diagnosis,
        "primary_icd10": case.primary_icd10,
        "urgency": case.urgency,
        "confidence": case.confidence,
        "status": case.status,
        "created_at": case.created_at.isoformat(),
        "full_response": json.loads(case.full_response_json),
    }


@app.delete("/api/history/{case_id}")
async def delete_case(
    case_id: int,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_current_user),
):
    deleted = await crud.delete_case(db, case_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"message": "Case deleted"}


# ── Drug Check ────────────────────────────────────────────────────────────────

@app.post("/api/drugs/check", response_model=DrugCheckResult)
async def drugs_check(payload: DrugCheckRequest):
    """Fetch first-line medications and check interactions for a given diagnosis."""
    drugs = await get_first_line_drugs(payload.diagnosis)
    drug_names = [d.name for d in drugs if d.name and d.name != "Unknown"]
    interactions = await check_interactions(drug_names) if len(drug_names) >= 2 else []
    return DrugCheckResult(
        diagnosis=payload.diagnosis,
        suggested_drugs=drugs,
        interactions=interactions,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
        log_level=settings.log_level.lower(),
    )
