"""
rag/retriever.py
Pinecone-based vector store for medical knowledge retrieval.

Production (e.g. Render free tier): uses OpenAI text-embedding-3-small — no PyTorch / sentence-transformers
(those packages pull ~2GB+ and often OOM during pip install on small builders).

Local optional: install backend/requirements-optional.txt to use HuggingFace MiniLM without OpenAI.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import List, Optional, Tuple

from langchain_core.documents import Document
from config import settings

_COLLECTION_NAME = settings.pinecone_index_name

# Module-level singletons — initialized lazily
_vector_store = None


def _get_knowledge_documents() -> list[Document]:
    """Load disease + symptom descriptions from the JSON knowledge base."""
    kb_path = Path(os.environ.get("GRAPH_DATA_PATH", "./graph/data/symptom_disease.json"))
    with kb_path.open(encoding="utf-8") as f:
        data = json.load(f)

    docs: list[Document] = []

    for disease in data.get("diseases", []):
        did = disease["id"]
        name = disease["name"]
        desc = disease.get("description", "")
        urgency = disease.get("urgency", "unknown")
        symptoms = ", ".join(disease.get("symptoms", {}).keys())

        doc_content = (
            f"Disease: {name} (ICD-10: {disease.get('icd10', 'N/A')}). "
            f"Urgency: {urgency}. "
            f"Description: {desc} "
            f"Common symptoms: {symptoms}."
        )
        docs.append(
            Document(page_content=doc_content, metadata={"id": f"disease_{did}", "name": name})
        )

    return docs


def _make_embeddings() -> Tuple[Optional[object], int, str]:
    """
    Returns (embeddings_obj, vector_dimension, mode_label).
    """
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


def initialize_rag() -> None:
    """Build the Pinecone index from the knowledge base. Called once on startup."""
    global _vector_store

    try:
        from pinecone import Pinecone, ServerlessSpec
        from langchain_pinecone import PineconeVectorStore
    except ImportError:
        print("[RAG] pinecone-client or langchain-pinecone not installed — RAG disabled.")
        return

    if not settings.pinecone_api_key:
        print("[RAG] PINECONE_API_KEY is not set. RAG disabled.")
        return

    embeddings, embed_dim, mode = _make_embeddings()
    if embeddings is None or embed_dim == 0:
        print(
            "[RAG] No embedding backend: set OPENAI_API_KEY (recommended for cloud) "
            "or `pip install -r requirements-optional.txt` for local HuggingFace embeddings."
        )
        return

    try:
        print(f"[RAG] Initializing Pinecone index '{_COLLECTION_NAME}' (embeddings={mode}, dim={embed_dim})...")
        pc = Pinecone(api_key=settings.pinecone_api_key)

        existing_indexes = [index_info["name"] for index_info in pc.list_indexes()]
        if _COLLECTION_NAME not in existing_indexes:
            print(f"[RAG] Creating new Pinecone index '{_COLLECTION_NAME}'...")
            pc.create_index(
                name=_COLLECTION_NAME,
                dimension=embed_dim,
                metric="cosine",
                spec=ServerlessSpec(
                    cloud="aws",
                    region=settings.pinecone_environment,
                ),
            )
            while not pc.describe_index(_COLLECTION_NAME).status["ready"]:
                time.sleep(1)
            print("[RAG] Index created successfully.")
        else:
            # Index already exists — dimension must match embedding model.
            desc = pc.describe_index(_COLLECTION_NAME)
            existing_dim = getattr(desc, "dimension", None)
            if existing_dim is not None and int(existing_dim) != embed_dim:
                print(
                    f"[RAG] Index '{_COLLECTION_NAME}' has dimension {existing_dim} but "
                    f"current embeddings need {embed_dim}. Delete the index in Pinecone or set "
                    "PINECONE_INDEX_NAME to a new name (e.g. medical-knowledge-v2)."
                )
                return

        index = pc.Index(_COLLECTION_NAME)
        _vector_store = PineconeVectorStore(index=index, embedding=embeddings)

        stats = index.describe_index_stats()
        if stats.total_vector_count == 0:
            docs = _get_knowledge_documents()
            _vector_store.add_documents(docs)
            print(f"[RAG] Indexed {len(docs)} documents into Pinecone")
        else:
            print(f"[RAG] Pinecone index already contains {stats.total_vector_count} documents")

    except Exception as exc:
        print(f"[RAG] Initialization failed (non-fatal): {exc}")
        _vector_store = None


def retrieve_context(query: str, n_results: int = 3) -> List[str]:
    """Return the top-k most relevant passages for the given clinical query."""
    if _vector_store is None:
        return []
    try:
        results = _vector_store.similarity_search(query, k=n_results)
        return [doc.page_content for doc in results]
    except Exception as exc:
        print(f"[RAG] Query failed (non-fatal): {exc}")
        return []
