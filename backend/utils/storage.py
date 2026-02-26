"""Persist uploaded images to disk and return a downloadable URL."""

import os
import uuid
import re
from pathlib import Path


def _slugify(filename: str) -> str:
    """Convert an original filename into a safe slug, keeping the extension."""
    stem, _, ext = filename.rpartition(".")
    stem = re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-") or "image"
    ext = ext.lower() if ext else "jpg"
    return f"{stem}-{uuid.uuid4().hex[:8]}.{ext}"


def save_image(raw: bytes, original_filename: str, base_url: str) -> tuple[str, str]:
    """Save raw image bytes to the uploads directory.

    Args:
        raw: Image bytes.
        original_filename: Original filename from the upload (used to derive slug).
        base_url: Server base URL, e.g. "http://localhost:8000".

    Returns:
        (slug, url) where url is a downloadable link to the saved file.
    """
    from config import settings

    uploads_dir = Path(settings.uploads_dir)
    uploads_dir.mkdir(parents=True, exist_ok=True)

    slug = _slugify(original_filename)
    (uploads_dir / slug).write_bytes(raw)

    url = f"{base_url.rstrip('/')}/uploads/{slug}"
    return slug, url
