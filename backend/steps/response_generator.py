"""Step 4: Generate structured outfit recommendations from analyst reasoning + products."""

import json
from dataclasses import dataclass, field

from steps.input_processor import ProcessedInput
from steps.requirement_analyst import AnalystOutput
from steps.qdrant_search import Product
from utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class Outfit:
    id: str                      # "outfit-1", "outfit-2" …
    name: str                    # e.g. "Weekend Casual"
    explanation: str             # why this outfit suits the user's request
    products: list[Product] = field(default_factory=list)
    user_image_urls: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "explanation": self.explanation,
            "products": [p.to_dict() for p in self.products],
            "user_image_urls": self.user_image_urls,
        }


_SYSTEM_PROMPT = """You are StyleCue, an expert personal stylist.

You will receive:
- The user's department, prompt, and preferences
- The analyst's reasoning about what the user needs
- Retrieved products from the catalogue (if any), each with id, name, price, pdp_url, and image
- Any images the user uploaded (shown inline), each with a slug identifier

Your task: compose one or more complete outfit suggestions, referencing specific catalogue
products and/or user-uploaded items.

IMPORTANT — respond with ONLY valid JSON, no markdown, no commentary:
{
  "outfits": [
    {
      "id": "outfit-1",
      "name": "<short outfit name, e.g. Weekend Casual>",
      "explanation": "<why this outfit suits the request; 2-4 sentences>",
      "product_ids": ["<catalogue product id>"],
      "user_image_slugs": ["<ProcessedImage slug, e.g. my-shirt-a1b2c3.jpg>"]
    }
  ]
}

Rules:
- product_ids must reference ids from the catalogue products list provided.
- user_image_slugs must reference slugs from the user's uploaded images (if any).
- Both arrays may be empty if there is nothing to reference.
- Do not include products or user images that don't fit the outfit.
- Output only the JSON object — no text before or after."""


def _build_conversation_context_block(conversation_context: dict) -> str:
    """Render conversation context as a text block for the system prompt."""
    initial = conversation_context.get("initial_request", {})
    last_outfits = conversation_context.get("last_outfits", [])
    if not initial and not last_outfits:
        return ""

    lines = ["--- Prior session context ---"]
    if initial:
        lines.append(f"Initial request: {json.dumps(initial)}")
    if last_outfits:
        outfit_summaries = "; ".join(
            f"{o.get('name', '?')}: {o.get('explanation', '')[:80]}"
            for o in last_outfits
        )
        lines.append(f"Last outfits suggested: {outfit_summaries}")
    lines.append("--- End prior context ---")
    return "\n".join(lines)


async def generate_response(
    processed: ProcessedInput,
    analyst: AnalystOutput,
    products: list[Product],
    conversation_context: dict | None = None,
) -> list[Outfit]:
    """Generate structured outfit recommendations.

    Uses response_model (Sonnet) for high-quality, grounded output.

    Args:
        processed: Normalized user input with prompt, preferences, and images.
        analyst: Step 2 output — reasoning and Qdrant query context.
        products: Step 3 output — retrieved catalogue products (may be empty).
        conversation_context: Optional prior-turn context for follow-up refinement.

    Returns:
        list[Outfit] with products resolved from product_ids and
        user_image_urls resolved from user_image_slugs.
    """
    from utils.llm import call_llm

    logger.info(
        "Generating response",
        extra={
            "department": processed.department,
            "product_count": len(products),
            "image_count": len(processed.images),
            "has_context": bool(conversation_context),
        },
    )

    product_lines = "\n".join(
        f"- id={p.id} [{p.name}]({p.pdp_url}) (${p.price:.2f}, {p.category}): {p.description}"
        for p in products
    ) or "None — work only with the user's uploaded items."

    context_text = (
        f"Department: {processed.department}\n"
        f"User prompt: {processed.prompt}\n"
    )
    if processed.preferences:
        pref_lines = "\n".join(f"  {k}: {v}" for k, v in processed.preferences.items())
        context_text += f"Preferences:\n{pref_lines}\n"

    context_text += f"\nAnalyst reasoning:\n{analyst.reasoning}\n"
    context_text += f"\nCatalogue products retrieved:\n{product_lines}"

    if processed.images:
        slug_lines = "\n".join(f"  slug={img.slug}" for img in processed.images)
        context_text += f"\nUser uploaded image slugs:\n{slug_lines}"

    if conversation_context:
        ctx_block = _build_conversation_context_block(conversation_context)
        if ctx_block:
            context_text = ctx_block + "\n\n" + context_text

    user_content: list[dict] = [{"type": "text", "text": context_text}]

    # Attach user-uploaded images so the LLM can see them directly
    for img in processed.images:
        user_content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg", "data": img.base64},
        })

    raw = await call_llm(
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
        model_key="response_model",
        max_tokens=2048,
    )

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.exception("Response generator output was not valid JSON")
        raise

    # Build lookup maps for resolution
    products_by_id: dict[str, Product] = {p.id: p for p in products}
    slug_to_url: dict[str, str] = {img.slug: img.url for img in processed.images}

    outfits: list[Outfit] = []
    for raw_outfit in data.get("outfits", []):
        resolved_products = [
            products_by_id[pid]
            for pid in raw_outfit.get("product_ids", [])
            if pid in products_by_id
        ]
        resolved_urls = [
            slug_to_url[slug]
            for slug in raw_outfit.get("user_image_slugs", [])
            if slug in slug_to_url
        ]
        outfits.append(Outfit(
            id=raw_outfit.get("id", f"outfit-{len(outfits) + 1}"),
            name=raw_outfit.get("name", "Outfit"),
            explanation=raw_outfit.get("explanation", ""),
            products=resolved_products,
            user_image_urls=resolved_urls,
        ))

    valid_outfits = [
        outfit
        for outfit in outfits
        if (len(outfit.products) + len(outfit.user_image_urls)) >= 2
    ]

    if not valid_outfits:
        return [Outfit(
            id="outfit-1",
            name="Suggestion",
            explanation=(
                "I need at least two items to build a complete outfit. "
                "Try adding another piece you like or describing an extra item "
                "you're looking for, and I can complete the look."
            ),
            products=[],
            user_image_urls=[],
        )]

    return valid_outfits
