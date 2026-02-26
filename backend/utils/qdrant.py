"""Qdrant client wrapper with lazy initialization."""

from qdrant_client import QdrantClient

_client: QdrantClient | None = None


def get_qdrant_client() -> QdrantClient:
    """Return the singleton Qdrant client, initializing on first call."""
    global _client
    if _client is None:
        from config import settings
        _client = QdrantClient(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key or None,
        )
    return _client
