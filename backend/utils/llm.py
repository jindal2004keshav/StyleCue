"""Anthropic SDK wrapper with lazy client initialization."""

import anthropic

from utils.logger import get_logger

logger = get_logger(__name__)
_client: anthropic.AsyncAnthropic | None = None


def get_client() -> anthropic.AsyncAnthropic:
    """Return the singleton Anthropic async client, initializing on first call."""
    global _client
    if _client is None:
        from config import settings
        logger.info("Initializing Anthropic client")
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


def clean_llm_json_response(text: str) -> str:
    """Normalize LLM output by removing leading json markers and trimming whitespace."""
    normalized = text.lstrip()
    if normalized.startswith("```"):
        first_newline = normalized.find("\n")
        if first_newline != -1:
            fence_header = normalized[:first_newline].strip().lower()
            if fence_header in {"```json", "```"}:
                normalized = normalized[first_newline + 1 :]
                fence_end = normalized.rfind("```")
                if fence_end != -1:
                    normalized = normalized[:fence_end]
                normalized = normalized.lstrip()

    if normalized.lower().startswith("json"):
        normalized = normalized[4:]
        normalized = normalized.lstrip()

    return normalized.strip()


async def call_llm(
    system: str,
    messages: list[dict],
    model_key: str = "response_model",
    max_tokens: int = 1024,
) -> str:
    """Send a message to Claude and return the text response.

    Args:
        system: System prompt string.
        messages: List of {"role": ..., "content": ...} dicts.
        model_key: Key in Settings — "query_model" or "response_model".
        max_tokens: Maximum tokens in the response.

    Returns:
        The assistant's text response as a string.
    """
    from config import settings

    model = getattr(settings, model_key)
    client = get_client()

    logger.info(
        "Calling LLM",
        extra={"model": model, "message_count": len(messages), "max_tokens": max_tokens},
    )
    try:
        response = await client.messages.create(
            model=model,
            system=system,
            messages=messages,
            max_tokens=max_tokens,
        )
    except Exception:
        logger.exception("LLM call failed")
        raise
    
    raw_text = response.content[0].text
    logger.info(raw_text)
    return clean_llm_json_response(raw_text)


async def embed_text(text: str) -> list[float]:
    """Placeholder: return a text embedding vector.

    TODO: Replace with a real embedding model call when available.
    The Anthropic API does not currently expose embeddings; use a
    compatible embedding service (e.g. voyage-ai or cohere).
    """
    raise NotImplementedError(
        "embed_text is not yet implemented. "
        "Integrate an embedding provider (e.g. voyage-ai) here."
    )
