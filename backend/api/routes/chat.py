"""POST /api/chat — full v2 pipeline in a single request."""

import json

from fastapi import APIRouter, Form, Request, UploadFile, File, Response
from pydantic import BaseModel

from steps import process_input, analyse_requirements, search_qdrant, generate_response
from utils.logger import get_logger
from utils.llm_history import history_store, set_cycle_id, reset_cycle_id, set_step, reset_step

router = APIRouter()
logger = get_logger(__name__)
_ALLOWED_PROVIDERS = {"anthropic", "gemini", "openai"}


def _normalize_provider(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if normalized not in _ALLOWED_PROVIDERS:
        raise ValueError(f"Invalid llm_provider: {value}")
    return normalized


class ChatResponse(BaseModel):
    outfits: list[dict]
    reasoning: str
    cycle_id: str | None = None


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: Request,
    response: Response,
    department: str = Form(...),
    prompt: str | None = Form(None),
    message: str | None = Form(None),
    preferences: str = Form("{}"),            # JSON-encoded dict
    conversation_context: str = Form("{}"),   # JSON-encoded ConversationContext
    llm_provider: str | None = Form(None),
    images: list[UploadFile] = File(default=[]),
) -> ChatResponse:
    """Run the full StyleCue v2 pipeline.

    1. process_input       — normalize department/prompt/preferences/images → structured dict
    2. analyse_requirements — Sonnet LLM analyses requirements + defines Qdrant queries
    3. search_qdrant        — execute queries (skipped if requires_qdrant=False)
    4. generate_response    — Sonnet LLM returns structured list[Outfit]
    """
    logger.info(
        "POST /api/chat start",
        extra={"department": department, "has_images": bool(images)},
    )
    cycle_id = history_store.new_cycle_id()
    response.headers["X-Cycle-Id"] = cycle_id
    cycle_token = set_cycle_id(cycle_id)
    try:
        base_url = str(request.base_url).rstrip("/")

        image_uploads = [
            (await img.read(), img.filename or "image.jpg")
            for img in images
        ]

        try:
            prefs: dict[str, str] = json.loads(preferences)
        except (json.JSONDecodeError, ValueError):
            prefs = {}

        try:
            ctx: dict = json.loads(conversation_context)
        except (json.JSONDecodeError, ValueError):
            ctx = {}

        resolved_prompt = (prompt or "").strip() or (message or "").strip()
        if not resolved_prompt:
            raise ValueError("Missing required prompt.")

        provider = _normalize_provider(llm_provider)

        step_token = set_step("process_input")
        try:
            processed = await process_input(
                department=department,
                prompt=resolved_prompt,
                image_uploads=image_uploads or None,
                preferences=prefs,
                base_url=base_url,
                llm_provider=provider,
            )
        finally:
            reset_step(step_token)

        step_token = set_step("analyse_requirements")
        try:
            analyst = await analyse_requirements(
                processed,
                conversation_context=ctx or None,
                llm_provider=provider,
            )
        finally:
            reset_step(step_token)

        products = []
        if analyst.requires_qdrant and analyst.queries:
            products = await search_qdrant(analyst.queries)

        step_token = set_step("generate_response")
        try:
            outfits = await generate_response(
                processed,
                analyst,
                products,
                conversation_context=ctx or None,
                llm_provider=provider,
            )
        finally:
            reset_step(step_token)

        return ChatResponse(
            outfits=[o.to_dict() for o in outfits],
            reasoning=analyst.reasoning,
            cycle_id=cycle_id,
        )
    except Exception:
        logger.exception(
            "POST /api/chat failed",
            extra={"department": department, "has_images": bool(images)},
        )
        raise
    finally:
        reset_cycle_id(cycle_token)
