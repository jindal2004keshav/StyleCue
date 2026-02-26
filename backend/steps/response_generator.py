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
    total_cost: float = 0.0
    currency: str = "USD"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "explanation": self.explanation,
            "products": [p.to_dict() for p in self.products],
            "user_image_urls": self.user_image_urls,
            "total_cost": self.total_cost,
            "currency": self.currency,
        }


_SYSTEM_PROMPT = """You are StyleCue, an expert personal stylist.

You will receive:
- The user's department, prompt, and preferences
- The analyst's reasoning about what the user needs
- Retrieved products from the catalogue (if any), each with id, name, price, pdp_url, image,
  category, and metadata
- Any images the user uploaded (shown inline), each with a slug identifier and meta describing
  garment_type, colours, style, fit, and occasion hints.

Your task: compose one or more complete outfit suggestions, referencing specific catalogue
products and/or user-uploaded items.

PRIORITY OF INFORMATION:
- The user's prompt and preferences are ALWAYS the primary source of truth for occasion,
  formality, and high-level requirements. Never contradict explicit text instructions.
- Use images and product metadata SECONDARILY to understand what the user owns and their taste,
  and to refine colour, fit, and style within the user's stated constraints.
- If there is a clear conflict between the prompt (especially the occasion/dress code) and an
  uploaded item or catalogue product (e.g. beach shorts for a formal interview), you MUST say
  so directly in the outfit "explanation" instead of pretending the item is appropriate.
  In such cases, you may either avoid using the conflicting item or clearly mark it as
  "not suitable for this occasion" in the explanation.

OUTFIT COMPOSITION RULES (OUTFIT MATCHMAKER):
- Think in terms of garment roles: TOP, BOTTOM, OUTERWEAR, FOOTWEAR, ACCESSORY.
- Each individual outfit must contain AT MOST ONE primary TOP (e.g. shirt, T-shirt, blouse,
  knit, sweater) and AT MOST ONE primary BOTTOM (e.g. trousers, jeans, chinos, shorts, skirt)
  across both catalogue products and user-uploaded items.
- If you want to propose multiple alternative tops or bottoms, create separate outfits
  (e.g. "Outfit 1A - with white shirt", "Outfit 1B - with blue shirt") instead of putting
  2 shirts and 1 pant together in a single outfit.
- Layering is allowed (e.g. one shirt + one jacket + one trouser), but never stack multiple
  shirts/T-shirts as if they are worn simultaneously.
- Aim for complete, wearable looks: normally at least one TOP and one BOTTOM. If you cannot
  build a valid top+bottom combination from the available items, return at least one outfit
  whose "explanation" clearly tells the user what is missing (e.g. "I need a suitable bottom
  to complete this look") and keep product_ids/user_image_slugs limited to what actually fits.
- When you return multiple outfits, you MUST order the "outfits" array from MOST suitable and
  visually appealing (best match to the user's prompt, preferences, occasion, and styling
  goals) at the top, down to less ideal but still plausible combinations at the bottom. Do
  not randomise the order.

IMPORTANT — respond with ONLY valid JSON, no markdown, no commentary:
{
  "outfits": [
    {
      "id": "outfit-1",
      "name": "<short outfit name, e.g. Weekend Casual>",
      "explanation": "<why this outfit suits the request, how you handled any prompt/image conflicts, and how the items work together; 2-4 sentences>",
      "product_ids": ["<catalogue product id>"],
      "user_image_slugs": ["<ProcessedImage slug, e.g. my-shirt-a1b2c3.jpg>"]
    }
  ]
}

Rules:
- product_ids must reference ids from the catalogue products list provided.
- user_image_slugs must reference slugs from the user's uploaded images (if any).
- Both arrays may be empty if there is nothing to reference.
- Do not include products or user images that don't fit the outfit or the user's stated occasion.
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
    llm_provider: str | None = None,
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
        f"- id={p.id} [{p.name}]({p.pdp_url}) ({p.currency} {p.price:.2f}, {p.category}, {p.brand}): {p.description}"
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
        llm_provider=llm_provider,
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
        currency = "USD"
        for product in resolved_products:
            if product.currency:
                currency = product.currency
                break
        total_cost = sum(product.price for product in resolved_products)
        outfits.append(Outfit(
            id=raw_outfit.get("id", f"outfit-{len(outfits) + 1}"),
            name=raw_outfit.get("name", "Outfit"),
            explanation=raw_outfit.get("explanation", ""),
            products=resolved_products,
            user_image_urls=resolved_urls,
            total_cost=total_cost,
            currency=currency,
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
