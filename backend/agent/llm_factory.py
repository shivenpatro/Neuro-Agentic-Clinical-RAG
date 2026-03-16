"""
agent/llm_factory.py
Helper to create OpenAI clients dynamically based on request config.
"""
from __future__ import annotations

from typing import Optional

from openai import OpenAI

from config import settings


def get_llm_client(config: Optional[dict] = None) -> tuple[OpenAI, str]:
    """
    Returns (client, model_name) based on the optional config override.
    
    If config is provided (from frontend settings), it uses that.
    Otherwise, falls back to environment variables (Ollama).
    """
    if not config:
        # Default: Local Ollama from .env
        return (
            OpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key),
            settings.llm_model_name
        )

    provider = config.get("provider", "ollama")
    
    if provider == "groq":
        api_key = config.get("api_key")
        if not api_key:
            raise ValueError("Groq API Key is required")
        return (
            OpenAI(base_url="https://api.groq.com/openai/v1", api_key=api_key),
            "llama3-70b-8192"  # Default high-performance free model
        )
        
    if provider == "custom":
        base_url = config.get("base_url")
        api_key = config.get("api_key")
        model = config.get("model_name")
        if not base_url or not api_key or not model:
            raise ValueError("Custom provider requires Base URL, API Key, and Model Name")
        return (
            OpenAI(base_url=base_url, api_key=api_key),
            model
        )

    # Fallback to local
    return (
        OpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key),
        settings.llm_model_name
    )
