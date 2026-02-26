"""Step 1: Normalize multimodal user input into the v2 structured dict."""

import json
from dataclasses import dataclass, field

from utils.logger import get_logger

logger = get_logger(__name__)

@dataclass
class ProcessedImage:
    slug: str
    meta: dict          # LLM-extracted fashion attributes
    url: str            # hosted URL for the uploaded image
    base64: str         # kept in-memory for LLM vision calls; not in output dict


@dataclass
class ProcessedInput:
    department: str                          # "men" | "women"
    prompt: str
    preferences: dict[str, str]             # Material, Fit, Occasion, etc.
    images: list[ProcessedImage] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Return the v2 input dict passed to the requirement analyst.

        With images:
            { "prompt": ..., "preferences": {...},
              "image1": {"slug": ..., "meta": {...}, "url": ...}, ... }

        Without images:
            { "prompt": ..., "preferences": {...} }
        """
        result: dict = {
            "department": self.department,
            "prompt": self.prompt,
            "preferences": self.preferences,
        }
        for i, img in enumerate(self.images, 1):
            result[f"image{i}"] = {
                "slug": img.slug,
                "meta": img.meta,
                "url": img.url,
            }
        return result


_IMAGE_META_SYSTEM = """You are a fashion product analyst. Examine the clothing or
accessories in this image and return ONLY valid JSON with these keys:
{
  "garment_type": "<e.g. dress, jeans, sneakers>",
  "colors": ["<primary>", "<secondary>"],
  "pattern": "<e.g. solid, striped, floral, plaid>",
  "style": "<e.g. casual, formal, boho, streetwear>",
  "visible_material": "<e.g. cotton, denim, leather, unknown>",
  "fit": "<e.g. slim, relaxed, oversized, unknown>",
  "occasion_hints": ["<e.g. outdoor, office, party>"]
}
Return only the JSON object, no prose."""


async def _extract_image_meta(base64: str) -> dict:
    """Call the analyst LLM to extract fashion attributes from an image."""
    from utils.llm import call_llm

    raw = await call_llm(
        system=_IMAGE_META_SYSTEM,
        messages=[{
            "role": "user",
            "content": [{
                "type": "image",
                "source": {"type": "base64", "media_type": "image/jpeg", "data": base64},
            }],
        }],
        model_key="analyst_model",
        max_tokens=256,
    )
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.error("Image meta extraction returned invalid JSON")
        return {"raw": raw}


async def process_input(
    department: str,
    prompt: str,
    image_uploads: list[tuple[bytes, str]] | None = None,
    preferences: dict[str, str] | None = None,
    base_url: str = "http://localhost:8000",
) -> ProcessedInput:
    """Normalize raw user inputs into a ProcessedInput.

    Args:
        department: "men" or "women".
        prompt: Free-form user styling request.
        image_uploads: List of (raw_bytes, original_filename) pairs.
        preferences: Optional preference dict (Material, Fit, Occasion, etc.).
        base_url: Unused for hosted uploads; kept for compatibility.

    Returns:
        ProcessedInput whose .to_dict() matches the v2 input spec.
    """
    from utils.image import bytes_to_base64
    from utils.storage import save_image

    logger.info(
        "Processing input",
        extra={
            "department": department,
            "has_images": bool(image_uploads),
            "image_count": len(image_uploads or []),
        },
    )

    processed_images: list[ProcessedImage] = []
    for raw, filename in (image_uploads or []):
        b64 = bytes_to_base64(raw)
        slug, url = save_image(raw, filename, base_url)
        meta = await _extract_image_meta(b64)
        processed_images.append(ProcessedImage(slug=slug, meta=meta, url=url, base64=b64))

    return ProcessedInput(
        department=department.lower().strip(),
        prompt=prompt.strip(),
        preferences=preferences or {},
        images=processed_images,
    )
