"""
rag/retriever.py
Pinecone-based vector store for medical knowledge retrieval.

Documents are built from symptom_disease.json on startup and embedded with
all-MiniLM-L6-v2.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import List

from langchain_core.documents import Document
from config import settings

_COLLECTION_NAME = settings.pinecone_index_name
_EMBED_MODEL = "all-MiniLM-L6-v2"

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
        docs.append(Document(page_content=doc_content, metadata={"id": f"disease_{did}", "name": name}))

    return docs

def initialize_rag() -> None:
    """Build the Pinecone index from the knowledge base. Called once on startup."""
    global _vector_store

    try:
        from pinecone import Pinecone, ServerlessSpec
        from langchain_pinecone import PineconeVectorStore
        from langchain_community.embeddings import HuggingFaceEmbeddings
    except ImportError:
        print("[RAG] pinecone-client or langchain-pinecone not installed — RAG disabled.")
        return

    if not settings.pinecone_api_key:
        print("[RAG] PINECONE_API_KEY is not set. RAG disabled.")
        return

    try:
        print(f"[RAG] Initializing Pinecone index '{_COLLECTION_NAME}'...")
        pc = Pinecone(api_key=settings.pinecone_api_key)
        
        # Check if index exists, create if not
        existing_indexes = [index_info["name"] for index_info in pc.list_indexes()]
        if _COLLECTION_NAME not in existing_indexes:
            print(f"[RAG] Creating new Pinecone index '{_COLLECTION_NAME}'...")
            pc.create_index(
                name=_COLLECTION_NAME,
                dimension=384, # dimension for all-MiniLM-L6-v2
                metric="cosine",
                spec=ServerlessSpec(
                    cloud="aws",
                    region=settings.pinecone_environment
                )
            )
            # Wait for index to be ready
            while not pc.describe_index(_COLLECTION_NAME).status['ready']:
                time.sleep(1)
            print("[RAG] Index created successfully.")

        index = pc.Index(_COLLECTION_NAME)
        embeddings = HuggingFaceEmbeddings(model_name=_EMBED_MODEL)
        
        _vector_store = PineconeVectorStore(index=index, embedding=embeddings)

        # Check if index is empty
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
