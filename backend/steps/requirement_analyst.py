"""Step 2: Intelligent LLM analyses requirements + defines Qdrant queries."""

import json
from dataclasses import dataclass, field

from steps.input_processor import ProcessedInput
from utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class QdrantQuery:
    text_query: str
    filters: dict[str, str | list[str]] = field(default_factory=dict)
    top_k: int = 10

    def to_dict(self) -> dict:
        return {
            "text_query": self.text_query,
            "filters": self.filters,
            "top_k": self.top_k,
        }


@dataclass
class AnalystOutput:
    reasoning: str                          # Why these queries were chosen
    requires_qdrant: bool                   # False when user's images already cover everything
    queries: list[QdrantQuery] = field(default_factory=list)


_SYSTEM_PROMPT = """You are an expert fashion stylist and search strategist.

You will receive a user's styling request as a JSON dict containing:
- "department": "men" or "women"
- "prompt": the user's request
- "preferences": optional dict of style preferences
- "image1" ... "imageN": optional images the user uploaded, each with slug/meta/url

Interpretation rules (PRIORITISE TEXT OVER IMAGES):
- The user's "prompt" and "preferences" are the primary source of truth for occasion,
  formality, category needs, and constraints. Never contradict explicit text instructions.
- Use image metadata and any visual clues SECONDARILY to refine colours, fit, and style,
  and to understand what the user already owns.
- If the prompt (especially the occasion or dress code) clearly conflicts with what is
  visible in an uploaded image (e.g. very casual shorts for a black-tie event), you MUST
  call out this contradiction clearly in "reasoning" instead of forcing the item to fit.
  In such cases, treat the prompt as correct and treat the conflicting image as not suitable
  for the described occasion.
- When no images are present, rely entirely on the text "prompt" and "preferences" to infer
  what the user owns, likes, or needs.
- Be explicit in "reasoning" about how you used prompt, preferences, and images
  (e.g. "based on the uploaded graphic tee but the text about a semi-formal dinner, the tee
  is too casual, so I look for smarter shirts and trousers").

Category and query design rules (CLOTH PREDICTOR BEHAVIOUR):
- Stay as close as possible to the garment types implied by the prompt and the uploaded
  images. Do NOT prioritise unrelated overlays like jackets unless the user explicitly
  asks for them or the occasion strongly requires them.
- When the user uploads multiple TOP images (e.g. shirts, T-shirts) and BOTTOM images
  (e.g. trousers, shorts), you MUST generate queries that cover BOTH tops AND bottoms so
  that the next step can build full outfits (at least one top and one bottom).
- Map broad garment roles to categories roughly as:
    * Tops   -> "Shirts", "T-Shirts"
    * Bottoms -> "Trousers", "Shorts"
    * Outerwear (only when requested) -> "Jackets"
- If the prompt or preferences specify particular categories, colours, or fits, reflect
  those directly in "text_query" and "filters".

Your tasks:
1. Analyse the full request and any provided image metadata.
2. Decide whether external products from a search database are needed
   (requires_qdrant = true) or whether the user's uploaded items are sufficient.
3. If external products are needed, define one or more targeted search queries.

Respond with ONLY valid JSON matching this schema:
{
  "reasoning": "<clear explanation of what the user needs, how you handled any prompt/image contradictions, and why you chose these queries>",
  "requires_qdrant": <true|false>,
  "queries": [
    {
      "text_query": "<short, keyword-rich search string>",
      "filters": { "<field>": "<value or list>" },
      "top_k": <5-20>
    }
  ]
}

If requires_qdrant is false, queries must be an empty array.

When defining filters, use ONLY these field names:
  - "categories"   : product category, e.g. "T-Shirts", "Trousers", "Jackets", "Shorts", "Shirts"
  - "departments"  : "Men" or "Women" (capitalised)
  - "colors"       : comma-separated colour names
  - "brands"       : brand name (optional)

Target categories are restricted to: Shirts, T-Shirts, Trousers, Shorts, Jackets."""


async def analyse_requirements(
    processed: ProcessedInput,
    conversation_context: dict | None = None,
    llm_provider: str | None = None,
) -> AnalystOutput:
    """Analyse user requirements and produce Qdrant queries with reasoning.

    Uses analyst_model (Sonnet) for multi-step reasoning over text + image metadata.

    Args:
        processed: Output from process_input().
        conversation_context: Optional prior-turn context so the analyst refines
            rather than restarts when the user sends a follow-up.

    Returns:
        AnalystOutput with reasoning, requires_qdrant flag, and list of QdrantQuery.
    """
    from utils.llm import call_llm

    logger.info(
        "Analysing requirements",
        extra={
            "department": processed.department,
            "image_count": len(processed.images),
            "has_context": bool(conversation_context),
        },
    )

    user_text = json.dumps(processed.to_dict(), indent=2)

    # Prepend prior session context for follow-up turns
    if conversation_context:
        initial = conversation_context.get("initial_request", {})
        last_outfits = conversation_context.get("last_outfits", [])
        if initial or last_outfits:
            lines = ["--- Prior session context ---"]
            if initial:
                lines.append(f"Initial request: {json.dumps(initial)}")
            if last_outfits:
                summaries = "; ".join(
                    f"{o.get('name', '?')}: {o.get('explanation', '')[:80]}"
                    for o in last_outfits
                )
                lines.append(f"Last outfits suggested: {summaries}")
            lines.append(f"User follow-up: {processed.prompt}")
            lines.append("--- End prior context ---\n")
            user_text = "\n".join(lines) + user_text

    # Build the user message: structured dict as text + embedded images for vision
    user_content: list[dict] = [{
        "type": "text",
        "text": user_text,
    }]

    # Also attach the raw images so the LLM can see them directly, not just the meta
    from utils.image import get_media_type_from_base64
    for img in processed.images:
        media_type = get_media_type_from_base64(img.base64)
        user_content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": media_type, "data": img.base64},
        })

    raw = await call_llm(
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
        model_key="analyst_model",
        max_tokens=1024,
        llm_provider=llm_provider,
    )

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.exception("Analyst output was not valid JSON")
        raise
    queries = [
        QdrantQuery(
            text_query=q["text_query"],
            filters=q.get("filters", {}),
            top_k=int(q.get("top_k", 10)),
        )
        for q in data.get("queries", [])
    ]

    return AnalystOutput(
        reasoning=data["reasoning"],
        requires_qdrant=bool(data.get("requires_qdrant", False)),
        queries=queries,
    )
