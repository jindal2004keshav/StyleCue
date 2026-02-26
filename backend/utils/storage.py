"""Upload images to the Catalogix image service and return a hosted URL."""

import mimetypes
import uuid
import re

from utils.logger import get_logger

logger = get_logger(__name__)

_UPLOAD_ENDPOINT = "https://image-upload.catalogix.ai/"

def _slugify(filename: str) -> str:
    """Convert an original filename into a safe slug, keeping the extension."""
    stem, _, ext = filename.rpartition(".")
    stem = re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-") or "image"
    ext = ext.lower() if ext else "jpg"
    return f"{stem}-{uuid.uuid4().hex[:8]}.{ext}"


def save_image(raw: bytes, original_filename: str, base_url: str) -> tuple[str, str]:
    """Upload raw image bytes and return a hosted URL.

    Args:
        raw: Image bytes.
        original_filename: Original filename from the upload (used for content type).
        base_url: Unused; kept for API compatibility.

    Returns:
        (slug, url) where url is the hosted image URL.
    """
    import httpx

    content_type, _ = mimetypes.guess_type(original_filename)
    content_type = content_type or "application/octet-stream"
    filename = original_filename or _slugify("image.jpg")

    files = {
        "image_data": (filename, raw, content_type),
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(_UPLOAD_ENDPOINT, files=files)
            resp.raise_for_status()
    except Exception:
        logger.exception("Image upload failed")
        raise

    data = resp.json().get("data", {})
    url = data.get("cloudfront_url") or data.get("s3_link") or data.get("url")
    if not url:
        raise ValueError("Image upload succeeded but no URL was returned")

    slug = data.get("imageId") or _slugify(original_filename)
    logger.info("Uploaded image", extra={"slug": slug, "url": url})
    return slug, url
