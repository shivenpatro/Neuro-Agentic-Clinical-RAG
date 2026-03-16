from graph.builder import build_knowledge_graph, get_graph_stats, normalize_symptom
from graph.traversal import query_graph


def test_graph_builds_successfully():
    graph = build_knowledge_graph()
    assert graph.number_of_nodes() > 0
    assert graph.number_of_edges() > 0


def test_disease_nodes_exist():
    graph = build_knowledge_graph()
    diseases = [node for node, data in graph.nodes(data=True) if data.get("node_type") == "disease"]
    assert "appendicitis" in diseases
    assert "pneumonia" in diseases


def test_symptom_normalization():
    graph = build_knowledge_graph()
    assert normalize_symptom("rlq pain", graph) == "right_lower_quadrant_pain"
    assert normalize_symptom("throwing up", graph) == "vomiting"
    assert normalize_symptom("nonexistent_symptom_xyz", graph) is None


def test_appendicitis_correctly_diagnosed():
    result = query_graph(["right lower quadrant pain", "fever", "nausea"])
    top = result["top_diagnoses"]
    assert len(top) > 0
    assert top[0]["disease_id"] == "appendicitis"


def test_exclusion_rule_applied():
    result = query_graph(["right lower quadrant pain", "productive cough", "wheezing"])
    candidates = {candidate["disease_id"]: candidate for candidate in result["candidates"]}
    if "appendicitis" in candidates:
        assert candidates["appendicitis"]["status"] == "excluded"


def test_graph_stats():
    graph = build_knowledge_graph()
    stats = get_graph_stats(graph)
    assert stats["total_diseases"] >= 8
    assert stats["total_symptoms"] > 0
