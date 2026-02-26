"""LLM SDK wrapper with lazy client initialization."""

import base64
import time
from datetime import datetime, timezone
from uuid import uuid4
import anthropic
from openai import AsyncOpenAI
from google import genai
from google.genai import types

from utils.logger import get_logger
from utils.llm_history import (
    history_store,
    get_cycle_id,
    get_step,
    LlmCallEvent,
)

logger = get_logger(__name__)
_client: anthropic.AsyncAnthropic | None = None
_gemini_client: genai.Client | None = None
_openai_client: AsyncOpenAI | None = None


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _extract_usage(provider: str, response: object) -> dict[str, int | None]:
    input_tokens = None
    output_tokens = None
    total_tokens = None

    usage = getattr(response, "usage", None)
    if usage is not None:
        input_tokens = getattr(usage, "input_tokens", None)
        output_tokens = getattr(usage, "output_tokens", None)
        total_tokens = getattr(usage, "total_tokens", None)

    if provider == "gemini" and usage is None:
        usage_meta = getattr(response, "usage_metadata", None)
        if usage_meta is not None:
            input_tokens = getattr(usage_meta, "prompt_token_count", None)
            output_tokens = getattr(usage_meta, "candidates_token_count", None)
            total_tokens = getattr(usage_meta, "total_token_count", None)

    if total_tokens is None and input_tokens is not None and output_tokens is not None:
        total_tokens = input_tokens + output_tokens

    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
    }


def _estimate_cost(usage: dict[str, int | None]) -> float | None:
    from config import settings

    input_rate = settings.llm_pricing_input_per_1k_usd
    output_rate = settings.llm_pricing_output_per_1k_usd
    if input_rate is None and output_rate is None:
        return None

    input_tokens = usage.get("input_tokens")
    output_tokens = usage.get("output_tokens")
    if input_tokens is None and output_tokens is None:
        return None

    total_cost = 0.0
    if input_rate is not None and input_tokens is not None:
        total_cost += (input_tokens / 1000.0) * input_rate
    if output_rate is not None and output_tokens is not None:
        total_cost += (output_tokens / 1000.0) * output_rate
    return total_cost


async def _record_llm_event(
    *,
    provider: str,
    model: str,
    started_ts: datetime,
    started_at: float,
    usage: dict[str, int | None],
) -> None:
    cycle_id = get_cycle_id() or history_store.new_cycle_id()
    step = get_step()
    ended_ts = _utc_now()
    duration_ms = int((time.perf_counter() - started_at) * 1000)
    cost_estimate = _estimate_cost(usage)

    event = LlmCallEvent(
        id=uuid4().hex,
        cycle_id=cycle_id,
        step=step,
        provider=provider,
        model=model,
        started_at=started_ts,
        ended_at=ended_ts,
        duration_ms=duration_ms,
        input_tokens=usage.get("input_tokens"),
        output_tokens=usage.get("output_tokens"),
        total_tokens=usage.get("total_tokens"),
        cost_estimate_usd=cost_estimate,
    )
    await history_store.add_event(event)


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


def get_openai_client() -> AsyncOpenAI:
    """Return the singleton OpenAI async client, initializing on first call."""
    global _openai_client
    if _openai_client is None:
        from config import settings
        logger.info("Initializing OpenAI client")
        _openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _openai_client


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
    if provider == "openai":
        return getattr(settings, f"openai_{model_key}", getattr(settings, model_key))
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


def _to_openai_input(messages: list[dict]) -> list[dict]:
    formatted: list[dict] = []
    for message in messages:
        role = "assistant" if message.get("role") == "assistant" else "user"
        content = message.get("content", "")
        parts: list[dict] = []

        if isinstance(content, list):
            for item in content:
                if not isinstance(item, dict):
                    parts.append({"type": "input_text", "text": str(item)})
                    continue
                if item.get("type") == "text":
                    parts.append({"type": "input_text", "text": item.get("text", "")})
                    continue
                if item.get("type") == "image":
                    source = item.get("source", {})
                    data = source.get("data", "")
                    media_type = source.get("media_type", "image/jpeg")
                    if data:
                        parts.append({
                            "type": "input_image",
                            "image_url": f"data:{media_type};base64,{data}",
                        })
                    continue
                if "text" in item:
                    parts.append({"type": "input_text", "text": str(item.get("text", ""))})
                else:
                    parts.append({"type": "input_text", "text": str(item)})
        else:
            parts.append({"type": "input_text", "text": str(content)})

        formatted.append({"role": role, "content": parts})

    return formatted


async def call_llm(
    system: str,
    messages: list[dict],
    model_key: str = "response_model",
    max_tokens: int = 1024,
    llm_provider: str | None = None,
    explicit_model: str | None = None,
) -> str:
    """Send a message to the configured LLM and return the text response.

    Args:
        system: System prompt string.
        messages: List of {"role": ..., "content": ...} dicts.
        model_key: Key in Settings — "query_model" or "response_model".
        max_tokens: Maximum tokens in the response.
        explicit_model: Optional model override to bypass Settings.

    Returns:
        The assistant's text response as a string.
    """
    from config import settings

    provider = (llm_provider or settings.llm_provider).lower().strip()
    model = explicit_model or _get_model_for_provider(model_key, provider)
    logger.info(
        "Calling LLM",
        extra={
            "provider": provider,
            "model": model,
            "message_count": len(messages),
            "max_tokens": max_tokens,
        },
    )
    started_at = time.perf_counter()
    started_ts = _utc_now()
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
                    # automatic_function_calling=False,
                ),
            )
            raw_text = response.text or ""
            usage = _extract_usage(provider, response)
        elif provider == "openai":
            client = get_openai_client()
            response = await client.responses.create(
                model=model,
                input=_to_openai_input(messages),
                max_output_tokens=max_tokens,
                instructions=system,
            )
            if getattr(response, "output_text", None):
                raw_text = response.output_text
            else:
                chunks: list[str] = []
                for item in getattr(response, "output", []) or []:
                    if getattr(item, "type", "") != "message":
                        continue
                    for piece in getattr(item, "content", []) or []:
                        text = getattr(piece, "text", None)
                        if text:
                            chunks.append(text)
                raw_text = "".join(chunks)
            usage = _extract_usage(provider, response)
        else:
            client = get_client()
            response = await client.messages.create(
                model=model,
                system=system,
                messages=messages,
                max_tokens=max_tokens,
            )
            raw_text = response.content[0].text
            usage = _extract_usage(provider, response)
    except Exception:
        logger.exception("LLM call failed")
        raise

    logger.info(raw_text)
    await _record_llm_event(
        provider=provider,
        model=model,
        started_ts=started_ts,
        started_at=started_at,
        usage=usage,
    )
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
