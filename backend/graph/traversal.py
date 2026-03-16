"""
graph/traversal.py
Core symbolic reasoning engine.
"""

from __future__ import annotations

from typing import Any, Dict, List

from graph.builder import build_knowledge_graph, normalize_symptom


def query_graph(raw_symptoms: List[str]) -> Dict[str, Any]:
    graph = build_knowledge_graph()
    graph_path: List[Dict[str, Any]] = []

    matched_symptoms: List[str] = []
    unknown_symptoms: List[str] = []

    for raw in raw_symptoms:
        canonical = normalize_symptom(raw, graph)
        if canonical:
            matched_symptoms.append(canonical)
            graph_path.append({"step": "normalize", "input": raw, "output": canonical, "status": "matched"})
        else:
            unknown_symptoms.append(raw)
            graph_path.append({"step": "normalize", "input": raw, "output": None, "status": "unmatched"})

    matched_symptoms = list(set(matched_symptoms))

    candidate_disease_ids = set()
    for symptom_id in matched_symptoms:
        if graph.has_node(symptom_id):
            for _, target, edge_data in graph.out_edges(symptom_id, data=True):
                if graph.nodes[target].get("node_type") == "disease":
                    candidate_disease_ids.add(target)

    candidates: List[Dict[str, Any]] = []
    for disease_id in candidate_disease_ids:
        disease_data = graph.nodes[disease_id]
        disease_name = disease_data["name"]
        reasoning: List[Dict[str, Any]] = []

        incoming_edges = {
            src: data
            for src, _, data in graph.in_edges(disease_id, data=True)
            if graph.nodes[src].get("node_type") == "symptom"
        }

        excluded = False
        for symptom_id in matched_symptoms:
            if symptom_id in incoming_edges and incoming_edges[symptom_id].get("edge_type") == "EXCLUDES":
                excluded = True
                reasoning.append(
                    {
                        "rule": "EXCLUSION",
                        "symptom": symptom_id,
                        "message": f"Symptom '{symptom_id.replace('_', ' ')}' hard-excludes {disease_name}",
                        "verdict": "REJECTED",
                    }
                )
                graph_path.append(
                    {
                        "step": "exclusion_check",
                        "disease": disease_name,
                        "symptom": symptom_id,
                        "verdict": "EXCLUDED",
                    }
                )
                break

        if excluded:
            candidates.append(
                {
                    "disease_id": disease_id,
                    "disease_name": disease_name,
                    "icd10": disease_data.get("icd10"),
                    "urgency": disease_data.get("urgency"),
                    "score": 0.0,
                    "threshold": disease_data.get("min_required_weight", 0.8),
                    "matched_symptoms": [],
                    "description": disease_data.get("description"),
                    "status": "excluded",
                    "reasoning": reasoning,
                }
            )
            continue

        missing_required = [src for src, edge_data in incoming_edges.items() if edge_data.get("required") and src not in matched_symptoms]
        if missing_required:
            for symptom in missing_required:
                reasoning.append(
                    {
                        "rule": "REQUIRED_MISSING",
                        "symptom": symptom,
                        "message": f"Required symptom '{symptom.replace('_', ' ')}' is absent",
                        "verdict": "REJECTED",
                    }
                )
            graph_path.append(
                {
                    "step": "required_check",
                    "disease": disease_name,
                    "missing": missing_required,
                    "verdict": "DISQUALIFIED",
                }
            )
            candidates.append(
                {
                    "disease_id": disease_id,
                    "disease_name": disease_name,
                    "icd10": disease_data.get("icd10"),
                    "urgency": disease_data.get("urgency"),
                    "score": 0.0,
                    "threshold": disease_data.get("min_required_weight", 0.8),
                    "matched_symptoms": [],
                    "description": disease_data.get("description"),
                    "status": "missing_required",
                    "reasoning": reasoning,
                }
            )
            continue

        total_weight = 0.0
        matched_edges = []
        for symptom_id in matched_symptoms:
            if symptom_id in incoming_edges:
                edge = incoming_edges[symptom_id]
                if edge.get("edge_type") in ("SUGGESTS", "REQUIRED_FOR"):
                    weight = edge.get("weight", 0.0)
                    total_weight += weight
                    matched_edges.append({"symptom": symptom_id, "weight": weight, "required": edge.get("required", False)})
                    reasoning.append(
                        {
                            "rule": "WEIGHT_ADD",
                            "symptom": symptom_id,
                            "message": f"'{symptom_id.replace('_', ' ')}' contributes {weight:.2f} to {disease_name}",
                            "verdict": "ACCEPTED",
                        }
                    )

        threshold = disease_data.get("min_required_weight", 0.8)
        passes_threshold = total_weight >= threshold
        graph_path.append(
            {
                "step": "scoring",
                "disease": disease_name,
                "score": round(total_weight, 3),
                "threshold": threshold,
                "verdict": "PASSES" if passes_threshold else "BELOW_THRESHOLD",
            }
        )

        candidates.append(
            {
                "disease_id": disease_id,
                "disease_name": disease_name,
                "icd10": disease_data.get("icd10"),
                "urgency": disease_data.get("urgency"),
                "description": disease_data.get("description"),
                "score": round(total_weight, 3),
                "threshold": threshold,
                "matched_symptoms": matched_edges,
                "status": "valid" if passes_threshold else "below_threshold",
                "reasoning": reasoning,
            }
        )

    top_diagnoses = sorted([item for item in candidates if item["status"] == "valid"], key=lambda item: item["score"], reverse=True)

    return {
        "matched_symptoms": matched_symptoms,
        "unknown_symptoms": unknown_symptoms,
        "candidates": candidates,
        "top_diagnoses": top_diagnoses,
        "graph_path": graph_path,
        "graph_coverage": {
            "symptoms_in_graph": len(matched_symptoms),
            "symptoms_not_found": len(unknown_symptoms),
            "diseases_evaluated": len(candidate_disease_ids),
            "diseases_accepted": len(top_diagnoses),
        },
    }
