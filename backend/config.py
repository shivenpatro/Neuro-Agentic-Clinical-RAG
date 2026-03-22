import secrets
from typing import List, Union

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    llm_base_url: str = "http://localhost:11434/v1"
    llm_api_key: str = "ollama"
    llm_model_name: str = "llama3.2-clinical:latest"
    llm_temperature: float = 0.0
    llm_max_tokens: int = 1024

    graph_data_path: str = "./graph/data/symptom_disease.json"
    log_level: str = "INFO"

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: Union[str, List[str]] = "http://localhost:3000"

    # Database
    database_url: str = "sqlite+aiosqlite:///./clinical_rag.db"

    # Pinecone
    pinecone_api_key: str = ""
    pinecone_index_name: str = "medical-knowledge"
    pinecone_environment: str = "us-east-1"

    # Optional: Pinecone + paid/OpenAI embeddings (see requirements-optional-pinecone.txt)
    openai_api_key: str = ""

    # RAG: keyword (default, $0) | none | pinecone (optional vector DB)
    rag_mode: str = "keyword"

    # JWT Auth
    jwt_secret: str = secrets.token_urlsafe(32)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # Admin bootstrap credentials (used to log in without DB registration)
    admin_username: str = "admin"
    admin_password: str = "changeme"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()


def get_cors_origins() -> List[str]:
    if isinstance(settings.cors_origins, list):
        return settings.cors_origins
    return [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
