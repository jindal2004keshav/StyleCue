"""Image utility helpers."""

import base64


def bytes_to_base64(data: bytes) -> str:
    """Encode raw image bytes to a base64 string."""
    return base64.b64encode(data).decode("utf-8")


def base64_to_bytes(encoded: str) -> bytes:
    """Decode a base64 string back to raw bytes."""
    return base64.b64decode(encoded)
