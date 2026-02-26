from pydantic_settings import BaseSettings
from utils.logger import get_logger

logger = get_logger(__name__)


class Settings(BaseSettings):
    # LLM provider ("anthropic", "gemini", or "openai")
    llm_provider: str = "openai"
    # Anthropic
    anthropic_api_key: str = ""
    anthropic_analyst_model: str = "claude-sonnet-4-6"
    anthropic_response_model: str = "claude-sonnet-4-6"
    # Gemini
    gemini_api_key: str = ""
    gemini_analyst_model: str = "gemini-3.1"
    gemini_response_model: str = "gemini-3.1"
    # OpenAI
    openai_api_key: str = ""
    openai_analyst_model: str = "gpt-5.2"
    openai_response_model: str = "gpt-5.2"
    # Step 2: requirement analysis — needs reasoning capability
    analyst_model: str = "gpt-5.2"
    # Step 4: final response generation
    response_model: str = "gpt-5.2"

    # LLM pricing placeholders (USD per 1K tokens). Leave unset to skip cost estimates.
    llm_pricing_input_per_1k_usd: float | None = None
    llm_pricing_output_per_1k_usd: float | None = None

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
