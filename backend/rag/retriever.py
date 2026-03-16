"""
rag/retriever.py
ChromaDB-based vector store for medical knowledge retrieval.

Documents are built from symptom_disease.json on startup and embedded with
all-MiniLM-L6-v2 (runs entirely locally, no internet needed after first download).
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import List

_COLLECTION_NAME = "medical_knowledge"
_EMBED_MODEL = "all-MiniLM-L6-v2"

# Module-level singletons — initialized lazily
_chroma_client = None
_collection = None
_embedding_fn = None


def _get_knowledge_documents() -> tuple[list[str], list[str]]:
    """Load disease + symptom descriptions from the JSON knowledge base."""
    kb_path = Path(os.environ.get("GRAPH_DATA_PATH", "./graph/data/symptom_disease.json"))
    with kb_path.open(encoding="utf-8") as f:
        data = json.load(f)

    docs: list[str] = []
    ids: list[str] = []

    for disease in data.get("diseases", []):
        did = disease["id"]
        name = disease["name"]
        desc = disease.get("description", "")
        urgency = disease.get("urgency", "unknown")
        symptoms = ", ".join(disease.get("symptoms", {}).keys())

        doc = (
            f"Disease: {name} (ICD-10: {disease.get('icd10', 'N/A')}). "
            f"Urgency: {urgency}. "
            f"Description: {desc} "
            f"Common symptoms: {symptoms}."
        )
        docs.append(doc)
        ids.append(f"disease_{did}")

    return docs, ids


def initialize_rag() -> None:
    """Build the ChromaDB collection from the knowledge base. Called once on startup."""
    global _chroma_client, _collection, _embedding_fn

    try:
        import chromadb
        from chromadb.utils import embedding_functions
    except ImportError:
        print("[RAG] chromadb not installed — RAG disabled.")
        return

    try:
        _embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=_EMBED_MODEL
        )
        _chroma_client = chromadb.Client()  # In-memory, resets on restart
        _collection = _chroma_client.get_or_create_collection(
            name=_COLLECTION_NAME,
            embedding_function=_embedding_fn,
        )

        # Populate only if empty
        if _collection.count() == 0:
            docs, ids = _get_knowledge_documents()
            _collection.add(documents=docs, ids=ids)
            print(f"[RAG] Indexed {len(docs)} documents into ChromaDB")
        else:
            print(f"[RAG] Collection already contains {_collection.count()} documents")

    except Exception as exc:
        print(f"[RAG] Initialization failed (non-fatal): {exc}")
        _collection = None


def retrieve_context(query: str, n_results: int = 3) -> List[str]:
    """Return the top-k most relevant passages for the given clinical query."""
    if _collection is None:
        return []
    try:
        results = _collection.query(query_texts=[query], n_results=n_results)
        documents = results.get("documents", [[]])[0]
        return [d for d in documents if d]
    except Exception as exc:
        print(f"[RAG] Query failed (non-fatal): {exc}")
        return []
