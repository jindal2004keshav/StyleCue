from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Anthropic
    anthropic_api_key: str = ""
    # Step 2: requirement analysis — needs reasoning capability
    analyst_model: str = "claude-sonnet-4-6"
    # Step 4: final response generation
    response_model: str = "claude-sonnet-4-6"

    # Qdrant
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str = ""
    qdrant_collection: str = "products"

    # App
    app_env: str = "development"
    cors_origins: list[str] = ["http://localhost:5173"]
    uploads_dir: str = "uploads"
    brandeye_search_host: str = "https://ai-search-brandeye.blr.streamoid.com"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
