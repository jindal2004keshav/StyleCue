from pydantic_settings import BaseSettings
from utils.logger import get_logger

logger = get_logger(__name__)


class Settings(BaseSettings):
    # LLM provider ("anthropic" or "gemini")
    llm_provider: str = "gemini"
    # Anthropic
    anthropic_api_key: str = ""
    anthropic_analyst_model: str = "claude-sonnet-4-6"
    anthropic_response_model: str = "claude-sonnet-4-6"
    # Gemini
    gemini_api_key: str = ""
    gemini_analyst_model: str = "gemini-3.1"
    gemini_response_model: str = "gemini-3.1"
    # Step 2: requirement analysis — needs reasoning capability
    analyst_model: str = "claude-sonnet-4-6"
    # Step 4: final response generation
    response_model: str = "claude-sonnet-4-6"

    # App
    app_env: str = "development"
    # "null" origin is for file:// pages (tests/*.html opened directly).
    cors_origins: list[str] = ["http://localhost:5173", "null"]
    uploads_dir: str = "uploads"
    brandeye_search_host: str = "https://ai-search-brandeye.blr.streamoid.com"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
