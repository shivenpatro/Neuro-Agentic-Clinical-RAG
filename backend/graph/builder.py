"""
graph/builder.py
Loads symptom_disease.json and constructs a directed NetworkX graph.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Optional

import networkx as nx

from config import settings


def load_knowledge_base(path: Optional[str] = None) -> dict:
    data_path = Path(path or settings.graph_data_path)
    if not data_path.exists():
        raise FileNotFoundError(f"Knowledge base not found at {data_path.resolve()}")
    with data_path.open("r", encoding="utf-8") as file:
        return json.load(file)


@lru_cache(maxsize=1)
def build_knowledge_graph(path: Optional[str] = None) -> nx.DiGraph:
    data = load_knowledge_base(path)
    graph = nx.DiGraph()

    aliases: dict = data.get("symptom_aliases", {})

    for disease in data["diseases"]:
        disease_id = disease["id"]
        graph.add_node(
            disease_id,
            node_type="disease",
            name=disease["name"],
            icd10=disease["icd10"],
            urgency=disease["urgency"],
            description=disease["description"],
            min_required_weight=disease["min_required_weight"],
        )

        for symptom_id, symptom_data in disease["symptoms"].items():
            if not graph.has_node(symptom_id):
                graph.add_node(symptom_id, node_type="symptom", name=symptom_id.replace("_", " ").title())
            edge_type = "REQUIRED_FOR" if symptom_data["required"] else "SUGGESTS"
            graph.add_edge(
                symptom_id,
                disease_id,
                edge_type=edge_type,
                weight=symptom_data["weight"],
                required=symptom_data["required"],
            )

        for exclusion_symptom in disease.get("exclusion_symptoms", []):
            if not graph.has_node(exclusion_symptom):
                graph.add_node(
                    exclusion_symptom,
                    node_type="symptom",
                    name=exclusion_symptom.replace("_", " ").title(),
                )
            graph.add_edge(
                exclusion_symptom,
                disease_id,
                edge_type="EXCLUDES",
                weight=-1.0,
                required=False,
            )

    graph.graph["aliases"] = aliases
    graph.graph["total_diseases"] = len(data["diseases"])
    graph.graph["total_symptoms"] = len(
        [node for node, node_data in graph.nodes(data=True) if node_data.get("node_type") == "symptom"]
    )
    return graph


_STOP_WORDS = frozenset({"a", "an", "the", "of", "in", "with", "and", "or", "for", "to", "mild", "severe", "sharp", "dull", "slight", "moderate", "acute", "chronic"})


def _keyword_set(text: str) -> frozenset:
    """Return meaningful words from a phrase, removing stop words and short tokens."""
    words = re.sub(r"[^a-z0-9 ]", " ", text.lower()).split()
    return frozenset(w for w in words if len(w) > 2 and w not in _STOP_WORDS)


def normalize_symptom(symptom: str, graph: nx.DiGraph) -> Optional[str]:
    aliases = graph.graph.get("aliases", {})
    lowered = symptom.lower().strip()

    # 1. Exact alias lookup
    if lowered in aliases:
        return aliases[lowered]

    # 2. Exact node ID match (after underscore normalization)
    normalized = lowered.replace(" ", "_")
    if normalized in graph.nodes:
        return normalized

    # 3. Substring containment (original logic)
    for node_id, node_data in graph.nodes(data=True):
        if node_data.get("node_type") != "symptom":
            continue
        node_phrase = node_id.replace("_", " ")
        if lowered in node_phrase or node_phrase in lowered:
            return node_id

    # 4. Keyword overlap: find the node whose keywords best overlap with the symptom's keywords.
    symptom_keys = _keyword_set(lowered)
    if not symptom_keys:
        return None

    best_node: Optional[str] = None
    best_score = 0.0
    for node_id, node_data in graph.nodes(data=True):
        if node_data.get("node_type") != "symptom":
            continue
        node_keys = _keyword_set(node_id)
        if not node_keys:
            continue
        overlap = len(symptom_keys & node_keys)
        if overlap == 0:
            continue
        # Jaccard-style: overlap / union, but weight heavily toward node coverage
        score = overlap / len(node_keys)  # how much of the node's keywords are in the symptom
        if score > best_score:
            best_score = score
            best_node = node_id

    # Only accept if ≥50% of the node's defining keywords appear in the symptom
    if best_score >= 0.5:
        return best_node

    return None


def get_graph_stats(graph: nx.DiGraph) -> dict:
    return {
        "total_nodes": graph.number_of_nodes(),
        "total_edges": graph.number_of_edges(),
        "total_diseases": graph.graph.get("total_diseases", 0),
        "total_symptoms": graph.graph.get("total_symptoms", 0),
        "diseases": [
            {"id": node, "name": node_data["name"], "urgency": node_data["urgency"]}
            for node, node_data in graph.nodes(data=True)
            if node_data.get("node_type") == "disease"
        ],
    }
