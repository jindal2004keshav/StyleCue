"""POST /api/chat — full v2 pipeline in a single request."""

import json

from fastapi import APIRouter, Form, Request, UploadFile, File
from pydantic import BaseModel

from steps import process_input, analyse_requirements, search_qdrant, generate_response
from utils.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


class ChatResponse(BaseModel):
    outfits: list[dict]
    reasoning: str


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: Request,
    department: str = Form(...),
    message: str = Form(...),
    preferences: str = Form("{}"),            # JSON-encoded dict
    conversation_context: str = Form("{}"),   # JSON-encoded ConversationContext
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

        processed = await process_input(
            department=department,
            prompt=message,
            image_uploads=image_uploads or None,
            preferences=prefs,
            base_url=base_url,
        )

        analyst = await analyse_requirements(processed, conversation_context=ctx or None)

        products = []
        if analyst.requires_qdrant and analyst.queries:
            products = await search_qdrant(analyst.queries)

        outfits = await generate_response(
            processed, analyst, products, conversation_context=ctx or None
        )

        return ChatResponse(
            outfits=[o.to_dict() for o in outfits],
            reasoning=analyst.reasoning,
        )
    except Exception:
        logger.exception(
            "POST /api/chat failed",
            extra={"department": department, "has_images": bool(images)},
        )
        raise
