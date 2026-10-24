from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Server-only settings. SERVICE_ROLE_KEY and WORKER_SECRET never reach the browser."""

    model_config = SettingsConfigDict(env_file=(".env", "../../.env"), extra="ignore")

    supabase_url: str = "http://127.0.0.1:54321"
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = "super-secret-jwt-token-with-at-least-32-characters-long"
    # Pooler URL in production (transaction mode, port 6543); direct URL locally.
    supabase_db_url: str = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    storage_bucket: str = "documents"

    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "docupulse-dev"

    llm_provider: Literal["openai", "ollama", "fake"] = "openai"
    openai_api_key: str = ""
    openai_chat_model: str = "gpt-4o-mini"
    openai_embed_model: str = "text-embedding-3-small"
    ollama_base_url: str = "http://localhost:11434"
    ollama_chat_model: str = "llama3.1"
    ollama_embed_model: str = "nomic-embed-text"
    embed_dim: int = 1536

    worker_secret: str = "dev-worker-secret"
    worker_batch_size: int = 5
    worker_visibility_timeout: int = 240
    worker_max_attempts: int = 3

    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""
    rate_limit_per_minute: int = 30

    allowed_origins: str = "http://localhost:3000"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
