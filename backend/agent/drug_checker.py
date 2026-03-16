"""
agent/drug_checker.py
Fetches first-line drug suggestions from OpenFDA and checks interactions via RxNorm.
"""
from __future__ import annotations

import asyncio
import re
from typing import List

import httpx

from models.schemas import DrugInfo

OPENFDA_URL = "https://api.fda.gov/drug/label.json"
RXNORM_SEARCH_URL = "https://rxnav.nlm.nih.gov/REST/approximateTerm.json"
RXNORM_INTERACTION_URL = "https://rxnav.nlm.nih.gov/REST/interaction/list.json"

_HTTP_TIMEOUT = 10.0


def _clean_text(text: str | None, max_len: int = 200) -> str | None:
    if not text:
        return None
    cleaned = re.sub(r"\s+", " ", text.strip())
    return cleaned[:max_len] + ("..." if len(cleaned) > max_len else "")


async def get_first_line_drugs(diagnosis: str) -> List[DrugInfo]:
    """Query OpenFDA for medications associated with a given diagnosis."""
    params = {
        "search": f'indications_and_usage:"{diagnosis}"',
        "limit": "5",
    }
    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            resp = await client.get(OPENFDA_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return []

    results = data.get("results", [])
    drugs: List[DrugInfo] = []
    seen: set[str] = set()

    for item in results:
        openfda = item.get("openfda", {})
        brand_names = openfda.get("brand_name", [])
        generic_names = openfda.get("generic_name", [])
        routes = openfda.get("route", [])
        warnings_raw = item.get("warnings", [""])[0] if item.get("warnings") else None

        name = brand_names[0] if brand_names else (generic_names[0] if generic_names else "Unknown")
        if name in seen:
            continue
        seen.add(name)

        drugs.append(DrugInfo(
            name=name,
            generic_name=generic_names[0] if generic_names else None,
            route=routes[0] if routes else None,
            warnings=_clean_text(warnings_raw),
        ))

    return drugs


async def _get_rxcui(drug_name: str) -> str | None:
    """Look up the RxCUI (RxNorm concept ID) for a drug name."""
    params = {"term": drug_name, "maxEntries": "1"}
    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            resp = await client.get(RXNORM_SEARCH_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return None
    candidates = data.get("approximateGroup", {}).get("candidate", [])
    return candidates[0].get("rxcui") if candidates else None


async def check_interactions(drug_names: List[str]) -> List[dict]:
    """Check interactions between multiple drugs using RxNorm."""
    if len(drug_names) < 2:
        return []

    rxcuis = await asyncio.gather(*[_get_rxcui(name) for name in drug_names])
    valid_cuis = [cui for cui in rxcuis if cui]

    if len(valid_cuis) < 2:
        return []

    params = {"rxcuis": " ".join(valid_cuis)}
    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            resp = await client.get(RXNORM_INTERACTION_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return []

    interactions = []
    for pair_list in data.get("fullInteractionTypeGroup", []):
        for pair in pair_list.get("fullInteractionType", []):
            for interaction in pair.get("interactionPair", []):
                interactions.append({
                    "severity": interaction.get("severity", "unknown"),
                    "description": interaction.get("description", ""),
                    "drugs": [c.get("minConceptItem", {}).get("name") for c in interaction.get("interactionConcept", [])],
                })

    return interactions
