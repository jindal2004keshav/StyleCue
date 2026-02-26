"""Image utility helpers."""

import base64

from utils.logger import get_logger

logger = get_logger(__name__)


def get_media_type_from_base64(b64: str) -> str:
    """Detect image media type from base64 data using magic bytes. Defaults to image/jpeg."""
    if not b64:
        return "image/jpeg"
    try:
        # Decode first 24 base64 chars (~18 bytes) to read magic bytes
        raw = base64.b64decode(b64[:24] + "=" * (-len(b64[:24]) % 4))
    except Exception:
        return "image/jpeg"
    if len(raw) >= 8 and raw[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if len(raw) >= 3 and raw[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if len(raw) >= 6 and raw[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if len(raw) >= 12 and raw[8:12] == b"WEBP":
        return "image/webp"
    return "image/jpeg"


def bytes_to_base64(data: bytes) -> str:
    """Encode raw image bytes to a base64 string."""
    return base64.b64encode(data).decode("utf-8")


def base64_to_bytes(encoded: str) -> bytes:
    """Decode a base64 string back to raw bytes."""
    return base64.b64decode(encoded)
