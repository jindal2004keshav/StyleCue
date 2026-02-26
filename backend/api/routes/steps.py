"""POST /api/steps/* — isolated per-step endpoints for testing and debugging."""

import json
from fastapi import APIRouter, Form, Request, UploadFile, File
from pydantic import BaseModel

from utils.logger import get_logger

router = APIRouter(prefix="/steps")
logger = get_logger(__name__)
_ALLOWED_PROVIDERS = {"anthropic", "gemini"}


def _normalize_provider(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if normalized not in _ALLOWED_PROVIDERS:
        raise ValueError(f"Invalid llm_provider: {value}")
    return normalized


# ── Step 1: Process Input ─────────────────────────────────────────────────────

class ProcessInputResponse(BaseModel):
    department: str
    prompt: str
    preference_keys: list[str]
    images: list[dict]          # [{slug, meta, url}] — base64 omitted


@router.post("/process-input", response_model=ProcessInputResponse)
async def process_input_step(
    request: Request,
    department: str = Form(...),
    prompt: str | None = Form(None),
    message: str | None = Form(None),
    preferences: str = Form("{}"),
    llm_provider: str | None = Form(None),
    images: list[UploadFile] = File(default=[]),
) -> ProcessInputResponse:
    """Step 1: Normalize multimodal input. Returns structured summary (no base64)."""
    try:
        logger.info(
            "POST /api/steps/process-input start",
            extra={"department": department, "has_images": bool(images)},
        )
        from steps import process_input

        base_url = str(request.base_url).rstrip("/")
        image_uploads = [(await img.read(), img.filename or "image.jpg") for img in images]

        try:
            prefs: dict[str, str] = json.loads(preferences)
        except (json.JSONDecodeError, ValueError):
            prefs = {}

        resolved_prompt = (prompt or "").strip() or (message or "").strip()
        if not resolved_prompt:
            raise ValueError("Missing required prompt.")

        provider = _normalize_provider(llm_provider)

        processed = await process_input(
            department=department,
            prompt=resolved_prompt,
            image_uploads=image_uploads or None,
            preferences=prefs,
            base_url=base_url,
            llm_provider=provider,
        )

        return ProcessInputResponse(
            department=processed.department,
            prompt=processed.prompt,
            preference_keys=list(processed.preferences.keys()),
            images=[{"slug": img.slug, "meta": img.meta, "url": img.url} for img in processed.images],
        )
    except Exception:
        logger.exception(
            "Step 1 failed: /api/steps/process-input",
            extra={"department": department, "has_images": bool(images)},
        )
        raise


# ── Step 2: Requirement Analysis ──────────────────────────────────────────────

class AnalyseRequirementsResponse(BaseModel):
    reasoning: str
    requires_qdrant: bool
    queries: list[dict]


@router.post("/analyse-requirements", response_model=AnalyseRequirementsResponse)
async def analyse_requirements_step(body: dict) -> AnalyseRequirementsResponse:
    """Step 2: Intelligent LLM analyses requirements and produces Qdrant queries."""
    try:
        from steps.input_processor import ProcessedInput, ProcessedImage
        from steps import analyse_requirements

        department = body.get("department", "")
        prompt = body.get("prompt", "")
        preferences = body.get("preferences", {})
        # Accept either "image_metas" (intended shape) or "images" (from Step 1 response)
        image_metas = body.get("image_metas")
        if image_metas is None:
            image_metas = body.get("images", [])
        conversation_context = body.get("conversation_context", {})
        provider = _normalize_provider(body.get("llm_provider"))

        if not isinstance(preferences, dict):
            preferences = {}
        if not isinstance(image_metas, list):
            image_metas = []

        logger.info(
            "POST /api/steps/analyse-requirements start",
            extra={"department": department, "image_meta_count": len(image_metas)},
        )

        # Re-construct ProcessedInput without raw images (meta-only for isolated testing)
        images = [
            ProcessedImage(
                slug=m.get("slug", ""),
                meta=m.get("meta", {}),
                url=m.get("url", ""),
                base64="",   # not available in isolated test; LLM uses dict meta only
            )
            for m in image_metas
        ]

        processed = ProcessedInput(
            department=department,
            prompt=prompt,
            preferences=preferences,
            images=images,
        )

        analyst = await analyse_requirements(
            processed,
            conversation_context=conversation_context or None,
            llm_provider=provider,
        )

        return AnalyseRequirementsResponse(
            reasoning=analyst.reasoning,
            requires_qdrant=analyst.requires_qdrant,
            queries=[q.to_dict() for q in analyst.queries],
        )
    except Exception:
        logger.exception(
            "Step 2 failed: /api/steps/analyse-requirements",
            extra={"department": body.get("department"), "image_meta_count": len(body.get("image_metas") or body.get("images") or [])},
        )
        raise


# ── Step 3: Qdrant Search ─────────────────────────────────────────────────────

class SearchQdrantRequest(BaseModel):
    queries: list[dict]   # list of {text_query, filters, top_k}


@router.post("/search-qdrant")
async def search_qdrant_step(body: SearchQdrantRequest) -> list[dict]:
    """Step 3: Execute one or more Qdrant queries and return a deduplicated product list."""
    try:
        logger.info(
            "POST /api/steps/search-qdrant start",
            extra={"query_count": len(body.queries)},
        )
        from steps.requirement_analyst import QdrantQuery
        from steps import search_qdrant

        queries = [
            QdrantQuery(
                text_query=q["text_query"],
                filters=q.get("filters", {}),
                top_k=int(q.get("top_k", 10)),
            )
            for q in body.queries
        ]
        products = await search_qdrant(queries)
        return [p.to_dict() for p in products]
    except Exception:
        logger.exception(
            "Step 3 failed: /api/steps/search-qdrant",
            extra={"query_count": len(body.queries)},
        )
        raise


# ── Step 4: Final Response ────────────────────────────────────────────────────

class GenerateResponseRequest(BaseModel):
    department: str
    prompt: str
    preferences: dict[str, str] = {}
    reasoning: str
    requires_qdrant: bool = False
    products: list[dict] = []
    conversation_context: dict = {}
    llm_provider: str | None = None


class GenerateResponseResponse(BaseModel):
    outfits: list[dict]


@router.post("/generate-response", response_model=GenerateResponseResponse)
async def generate_response_step(body: GenerateResponseRequest) -> GenerateResponseResponse:
    """Step 4: Generate structured outfit recommendations from analyst reasoning + products."""
    try:
        logger.info(
            "POST /api/steps/generate-response start",
            extra={"department": body.department, "product_count": len(body.products)},
        )
        from steps.input_processor import ProcessedInput
        from steps.requirement_analyst import AnalystOutput
        from steps.qdrant_search import Product
        from steps import generate_response

        processed = ProcessedInput(
            department=body.department,
            prompt=body.prompt,
            preferences=body.preferences,
        )
        analyst = AnalystOutput(
            reasoning=body.reasoning,
            requires_qdrant=body.requires_qdrant,
            queries=[],
        )
        products = [
            Product(
                id=p.get("id", ""),
                name=p.get("name", ""),
                category=p.get("category", ""),
                price=float(p.get("price", 0.0)),
                image_url=p.get("image_url", ""),
                pdp_url=p.get("pdp_url", ""),
                description=p.get("description", ""),
                metadata=p.get("metadata", {}),
            )
            for p in body.products
        ]

        provider = _normalize_provider(body.llm_provider)
        outfits = await generate_response(
            processed,
            analyst,
            products,
            conversation_context=body.conversation_context or None,
            llm_provider=provider,
        )
        return GenerateResponseResponse(outfits=[o.to_dict() for o in outfits])
    except Exception:
        logger.exception(
            "Step 4 failed: /api/steps/generate-response",
            extra={"department": body.department, "product_count": len(body.products)},
        )
        raise
