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

Interpretation rules:
- When images are present, use BOTH the text and the image metadata to understand style,
  colours, fit, and occasion. Assume the user wants outfits that work with the pictured items.
- When no images are present, rely entirely on the text "prompt" and "preferences" to infer
  what the user owns, likes, or needs.
- Be explicit in "reasoning" about how you used images vs text (e.g. "based on the uploaded
  graphic tee and the text about weekend casual...").

Your tasks:
1. Analyse the full request and any provided image metadata.
2. Decide whether external products from a search database are needed
   (requires_qdrant = true) or whether the user's uploaded items are sufficient.
3. If external products are needed, define one or more targeted search queries.

Respond with ONLY valid JSON matching this schema:
{
  "reasoning": "<clear explanation of what the user needs and why you chose these queries>",
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
    for img in processed.images:
        user_content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg", "data": img.base64},
        })

    raw = await call_llm(
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
        model_key="analyst_model",
        max_tokens=1024,
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
