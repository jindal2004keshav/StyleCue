"""POST /api/steps/* — isolated per-step endpoints for testing and debugging."""

import json
from fastapi import APIRouter, Form, Request, UploadFile, File
from pydantic import BaseModel

router = APIRouter(prefix="/steps")


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
    message: str = Form(...),
    preferences: str = Form("{}"),
    images: list[UploadFile] = File(default=[]),
) -> ProcessInputResponse:
    """Step 1: Normalize multimodal input. Returns structured summary (no base64)."""
    from steps import process_input

    base_url = str(request.base_url).rstrip("/")
    image_uploads = [(await img.read(), img.filename or "image.jpg") for img in images]

    try:
        prefs: dict[str, str] = json.loads(preferences)
    except (json.JSONDecodeError, ValueError):
        prefs = {}

    processed = await process_input(
        department=department,
        prompt=message,
        image_uploads=image_uploads or None,
        preferences=prefs,
        base_url=base_url,
    )

    return ProcessInputResponse(
        department=processed.department,
        prompt=processed.prompt,
        preference_keys=list(processed.preferences.keys()),
        images=[{"slug": img.slug, "meta": img.meta, "url": img.url} for img in processed.images],
    )


# ── Step 2: Requirement Analysis ──────────────────────────────────────────────

class AnalyseRequirementsRequest(BaseModel):
    department: str
    prompt: str
    preferences: dict[str, str] = {}
    # Images are passed as their dict form (slug/meta/url) since we can't re-upload
    image_metas: list[dict] = []
    conversation_context: dict = {}


class AnalyseRequirementsResponse(BaseModel):
    reasoning: str
    requires_qdrant: bool
    queries: list[dict]


@router.post("/analyse-requirements", response_model=AnalyseRequirementsResponse)
async def analyse_requirements_step(body: AnalyseRequirementsRequest) -> AnalyseRequirementsResponse:
    """Step 2: Intelligent LLM analyses requirements and produces Qdrant queries."""
    from steps.input_processor import ProcessedInput, ProcessedImage
    from steps import analyse_requirements

    # Re-construct ProcessedInput without raw images (meta-only for isolated testing)
    images = [
        ProcessedImage(
            slug=m.get("slug", ""),
            meta=m.get("meta", {}),
            url=m.get("url", ""),
            base64="",   # not available in isolated test; LLM uses dict meta only
        )
        for m in body.image_metas
    ]

    processed = ProcessedInput(
        department=body.department,
        prompt=body.prompt,
        preferences=body.preferences,
        images=images,
    )

    analyst = await analyse_requirements(
        processed,
        conversation_context=body.conversation_context or None,
    )

    return AnalyseRequirementsResponse(
        reasoning=analyst.reasoning,
        requires_qdrant=analyst.requires_qdrant,
        queries=[q.to_dict() for q in analyst.queries],
    )


# ── Step 3: Qdrant Search ─────────────────────────────────────────────────────

class SearchQdrantRequest(BaseModel):
    queries: list[dict]   # list of {text_query, filters, top_k}


@router.post("/search-qdrant")
async def search_qdrant_step(body: SearchQdrantRequest) -> list[dict]:
    """Step 3: Execute one or more Qdrant queries and return a deduplicated product list."""
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


# ── Step 4: Final Response ────────────────────────────────────────────────────

class GenerateResponseRequest(BaseModel):
    department: str
    prompt: str
    preferences: dict[str, str] = {}
    reasoning: str
    requires_qdrant: bool = False
    products: list[dict] = []
    conversation_context: dict = {}


class GenerateResponseResponse(BaseModel):
    outfits: list[dict]


@router.post("/generate-response", response_model=GenerateResponseResponse)
async def generate_response_step(body: GenerateResponseRequest) -> GenerateResponseResponse:
    """Step 4: Generate structured outfit recommendations from analyst reasoning + products."""
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

    outfits = await generate_response(
        processed, analyst, products,
        conversation_context=body.conversation_context or None,
    )
    return GenerateResponseResponse(outfits=[o.to_dict() for o in outfits])
