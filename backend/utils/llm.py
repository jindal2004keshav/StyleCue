"""LLM SDK wrapper with lazy client initialization."""

import base64
import anthropic
from google import genai
from google.genai import types

from utils.logger import get_logger

logger = get_logger(__name__)
_client: anthropic.AsyncAnthropic | None = None
_gemini_client: genai.Client | None = None


def get_client() -> anthropic.AsyncAnthropic:
    """Return the singleton Anthropic async client, initializing on first call."""
    global _client
    if _client is None:
        from config import settings
        logger.info("Initializing Anthropic client")
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


def get_gemini_client() -> genai.Client:
    """Return the singleton Gemini client, initializing on first call."""
    global _gemini_client
    if _gemini_client is None:
        from config import settings
        logger.info("Initializing Gemini client")
        _gemini_client = genai.Client(api_key=settings.gemini_api_key)
    return _gemini_client


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


def _get_model_for_provider(model_key: str, provider: str) -> str:
    from config import settings

    if provider == "gemini":
        return getattr(settings, f"gemini_{model_key}", getattr(settings, model_key))
    if provider == "anthropic":
        return getattr(settings, f"anthropic_{model_key}", getattr(settings, model_key))
    return getattr(settings, model_key)


def _to_gemini_contents(messages: list[dict]) -> list[types.Content]:
    contents: list[types.Content] = []
    for message in messages:
        role = "model" if message.get("role") == "assistant" else "user"
        content = message.get("content", "")
        parts: list[types.Part] = []

        if isinstance(content, list):
            for item in content:
                if not isinstance(item, dict):
                    parts.append(types.Part.from_text(text=str(item)))
                    continue
                if item.get("type") == "text":
                    parts.append(types.Part.from_text(text=item.get("text", "")))
                    continue
                if item.get("type") == "image":
                    source = item.get("source", {})
                    data = source.get("data", "")
                    media_type = source.get("media_type", "image/jpeg")
                    if data:
                        parts.append(
                            types.Part.from_bytes(
                                data=base64.b64decode(data),
                                mime_type=media_type,
                            )
                        )
                    continue
                if "text" in item:
                    parts.append(types.Part.from_text(text=str(item.get("text", ""))))
                else:
                    parts.append(types.Part.from_text(text=str(item)))
        else:
            parts.append(types.Part.from_text(text=str(content)))

        contents.append(types.Content(role=role, parts=parts))

    return contents


async def call_llm(
    system: str,
    messages: list[dict],
    model_key: str = "response_model",
    max_tokens: int = 1024,
    llm_provider: str | None = None,
) -> str:
    """Send a message to the configured LLM and return the text response.

    Args:
        system: System prompt string.
        messages: List of {"role": ..., "content": ...} dicts.
        model_key: Key in Settings — "query_model" or "response_model".
        max_tokens: Maximum tokens in the response.

    Returns:
        The assistant's text response as a string.
    """
    from config import settings

    provider = (llm_provider or settings.llm_provider).lower().strip()
    model = _get_model_for_provider(model_key, provider)
    logger.info(
        "Calling LLM",
        extra={
            "provider": provider,
            "model": model,
            "message_count": len(messages),
            "max_tokens": max_tokens,
        },
    )
    try:
        if provider == "gemini":
            client = get_gemini_client()
            contents = _to_gemini_contents(messages)
            response = await client.aio.models.generate_content(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    max_output_tokens=max_tokens,
                ),
            )
            raw_text = response.text or ""
        else:
            client = get_client()
            response = await client.messages.create(
                model=model,
                system=system,
                messages=messages,
                max_tokens=max_tokens,
            )
            raw_text = response.content[0].text
    except Exception:
        logger.exception("LLM call failed")
        raise

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
