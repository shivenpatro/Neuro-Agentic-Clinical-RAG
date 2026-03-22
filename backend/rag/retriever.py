"""
rag/retriever.py
Retrieval for the extractor prompt — **no paid APIs required by default**.

Modes (env RAG_MODE):
- **keyword** (default): overlap scoring over disease passages from symptom_disease.json.
  Fully free, works on Render free tier (stdlib + existing JSON).
- **none**: disable retrieval.
- **pinecone**: optional vector RAG; requires extras in requirements-optional-pinecone.txt
  plus PINECONE_API_KEY and OPENAI_API_KEY (or HF + optional sentence-transformers).

Note: **Groq does not offer embedding APIs** — it cannot replace vector embeddings.
For $0 hosting, use **keyword** mode and Groq (free tier) for the LLM only.
"""
from __future__ import annotations

import json
import math
import os
import re
import time
from pathlib import Path
from typing import List, Optional, Tuple

from config import settings

# Keyword corpus: list of (document text, token set for scoring)
_keyword_corpus: list[tuple[str, frozenset]] = []
_vector_store = None  # Pinecone + LangChain, optional


def _kb_path() -> Path:
    return Path(os.environ.get("GRAPH_DATA_PATH", "./graph/data/symptom_disease.json"))


def _build_disease_passages() -> list[str]:
    """Plain-text disease passages (same content as former RAG docs)."""
    with _kb_path().open(encoding="utf-8") as f:
        data = json.load(f)
    out: list[str] = []
    for disease in data.get("diseases", []):
        name = disease["name"]
        desc = disease.get("description", "")
        urgency = disease.get("urgency", "unknown")
        symptoms = ", ".join(disease.get("symptoms", {}).keys())
        out.append(
            f"Disease: {name} (ICD-10: {disease.get('icd10', 'N/A')}). "
            f"Urgency: {urgency}. "
            f"Description: {desc} "
            f"Common symptoms: {symptoms}."
        )
    return out


def _tokenize_for_overlap(text: str) -> frozenset:
    from graph.builder import _keyword_set

    return _keyword_set(text)


def _load_keyword_corpus() -> None:
    global _keyword_corpus
    passages = _build_disease_passages()
    _keyword_corpus = [(p, _tokenize_for_overlap(p)) for p in passages]
    print(f"[RAG] Keyword corpus loaded: {len(_keyword_corpus)} disease passages (free / no embeddings)")


def _retrieve_keyword(query: str, n_results: int = 3) -> List[str]:
    if not _keyword_corpus:
        _load_keyword_corpus()
    q_tokens = _tokenize_for_overlap(query)
    if not q_tokens:
        # fall back to raw tokens if query is all stop words
        words = re.sub(r"[^a-z0-9 ]", " ", query.lower()).split()
        q_tokens = frozenset(w for w in words if len(w) > 2)

    scored: list[tuple[float, str]] = []
    for doc_text, doc_tokens in _keyword_corpus:
        inter = len(q_tokens & doc_tokens)
        if inter == 0:
            continue
        # cheap TF-style score: overlap normalized by sqrt lengths (cosine-ish on sets)
        denom = math.sqrt(len(q_tokens)) * math.sqrt(len(doc_tokens))
        score = inter / denom if denom else float(inter)
        scored.append((score, doc_text))

    scored.sort(key=lambda x: -x[0])
    return [t for _, t in scored[:n_results]]


def _make_embeddings_pinecone() -> Tuple[Optional[object], int, str]:
    if settings.openai_api_key:
        from langchain_openai import OpenAIEmbeddings

        emb = OpenAIEmbeddings(
            model="text-embedding-3-small",
            api_key=settings.openai_api_key,
        )
        return emb, 1536, "openai"
    try:
        from langchain_community.embeddings import HuggingFaceEmbeddings

        emb = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        return emb, 384, "huggingface"
    except Exception:
        return None, 0, "none"


def _init_pinecone() -> None:
    global _vector_store
    try:
        from pinecone import Pinecone, ServerlessSpec
        from langchain_pinecone import PineconeVectorStore
    except ImportError:
        print("[RAG] pinecone / langchain-pinecone not installed — install requirements-optional-pinecone.txt")
        return

    if not settings.pinecone_api_key:
        print("[RAG] PINECONE_API_KEY missing — Pinecone mode disabled.")
        return

    embeddings, embed_dim, mode = _make_embeddings_pinecone()
    if embeddings is None or embed_dim == 0:
        print("[RAG] Pinecone mode needs OPENAI_API_KEY or HuggingFace embeddings (see optional requirements).")
        return

    name = settings.pinecone_index_name
    try:
        print(f"[RAG] Initializing Pinecone index '{name}' (embeddings={mode}, dim={embed_dim})...")
        pc = Pinecone(api_key=settings.pinecone_api_key)
        existing = [i["name"] for i in pc.list_indexes()]
        if name not in existing:
            pc.create_index(
                name=name,
                dimension=embed_dim,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region=settings.pinecone_environment),
            )
            while not pc.describe_index(name).status["ready"]:
                time.sleep(1)
        else:
            desc = pc.describe_index(name)
            existing_dim = getattr(desc, "dimension", None)
            if existing_dim is not None and int(existing_dim) != embed_dim:
                print(
                    f"[RAG] Index dimension mismatch ({existing_dim} vs {embed_dim}). "
                    "Delete index or change PINECONE_INDEX_NAME."
                )
                return

        index = pc.Index(name)
        _vector_store = PineconeVectorStore(index=index, embedding=embeddings)
        stats = index.describe_index_stats()
        if stats.total_vector_count == 0:
            from langchain_core.documents import Document

            docs = [
                Document(page_content=p, metadata={"i": i})
                for i, p in enumerate(_build_disease_passages())
            ]
            _vector_store.add_documents(docs)
            print(f"[RAG] Indexed {len(docs)} documents into Pinecone")
        else:
            print(f"[RAG] Pinecone index has {stats.total_vector_count} vectors")
    except Exception as exc:
        print(f"[RAG] Pinecone init failed: {exc}")
        _vector_store = None


def initialize_rag() -> None:
    mode = (settings.rag_mode or "keyword").strip().lower()
    if mode == "none":
        print("[RAG] RAG_MODE=none — retrieval disabled.")
        return
    if mode == "pinecone":
        _init_pinecone()
        return
    # default keyword
    _load_keyword_corpus()


def retrieve_context(query: str, n_results: int = 3) -> List[str]:
    mode = (settings.rag_mode or "keyword").strip().lower()
    if mode == "none":
        return []
    if mode == "pinecone" and _vector_store is not None:
        try:
            results = _vector_store.similarity_search(query, k=n_results)
            return [d.page_content for d in results]
        except Exception as exc:
            print(f"[RAG] Pinecone query failed, falling back to keyword: {exc}")
    return _retrieve_keyword(query, n_results)
