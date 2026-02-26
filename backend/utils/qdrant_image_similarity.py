"""Utilities for BrandEye image similarity search API."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

from fastapi import UploadFile

from config import settings
from utils.logger import get_logger

logger = get_logger(__name__)


@dataclass(frozen=True)
class ImageSimilarityFilters:
    departments: Iterable[str] | str | None = None
    categories: Iterable[str] | str | None = None
    colors: Iterable[str] | str | None = None
    types: Iterable[str] | str | None = None
    store_uuid: Iterable[str] | str | None = None
    brands: Iterable[str] | str | None = None
    source: Iterable[str] | str | None = None
    trend_times: Iterable[str] | str | None = None
    discount_range: Iterable[str | int | float] | str | int | float | None = None
    selling_price_range: Iterable[str | int | float] | str | int | float | None = None


@dataclass(frozen=True)
class ImageSimilaritySearchParams:
    query_text: str | None = None
    image: UploadFile | None = None
    sort_flag: str | None = None
    offset: int | None = None
    limit: int | None = None
    scroll_token: str | None = None
    filters: ImageSimilarityFilters = field(default_factory=ImageSimilarityFilters)


def _normalize_comma_string(value: str) -> str:
    return ",".join(part.strip() for part in value.split(","))


def _normalize_iterable(values: Iterable[str | int | float]) -> str:
    parts: list[str] = []
    for item in values:
        if isinstance(item, str):
            parts.append(item.strip())
        else:
            parts.append(str(item))
    return ",".join(parts)


def _append_comma_list(payload: dict[str, str], key: str, value: Iterable[str] | str | None) -> None:
    if value is None:
        return
    if isinstance(value, str):
        payload[key] = _normalize_comma_string(value)
        return
    payload[key] = _normalize_iterable(value)


def _append_range(
    payload: dict[str, str],
    key: str,
    value: Iterable[str | int | float] | str | int | float | None,
) -> None:
    if value is None:
        return
    if isinstance(value, str):
        payload[key] = _normalize_comma_string(value)
        return
    if isinstance(value, (int, float)):
        payload[key] = str(value)
        return
    payload[key] = _normalize_iterable(value)


def _append_store_uuid(
    payload: dict[str, str],
    key: str,
    value: Iterable[str] | str | None,
) -> None:
    if value is None:
        return
    if isinstance(value, str):
        payload[key] = _normalize_comma_string(value)
        return
    payload[key] = _normalize_iterable(value)


def build_image_similarity_payload(params: ImageSimilaritySearchParams) -> dict[str, str]:
    """Build multipart form fields for the image similarity search request.

    Note: The `image` field of ImageSimilaritySearchParams is intentionally NOT included
    in the returned dict. Image upload requires httpx `files=` with binary content, which
    callers must handle separately. Step 3 is text-only by design (per §4 of
    docs_ProjectStructure.md — the pipeline doesn't know which image type to search for).
    """
    payload: dict[str, str] = {}
    if params.query_text:
        payload["query_text"] = params.query_text
    if params.sort_flag:
        payload["sort_flag"] = params.sort_flag

    filters = params.filters
    _append_comma_list(payload, "departments", filters.departments)
    _append_comma_list(payload, "categories", filters.categories)
    _append_comma_list(payload, "colors", filters.colors)
    _append_comma_list(payload, "types", filters.types)
    _append_comma_list(payload, "brands", filters.brands)
    _append_comma_list(payload, "source", filters.source)
    _append_comma_list(payload, "trend_times", filters.trend_times)
    _append_store_uuid(payload, "store_uuid", filters.store_uuid)
    _append_range(payload, "discount_range", filters.discount_range)
    _append_range(payload, "selling_price_range", filters.selling_price_range)
    return payload


def build_image_similarity_query_params(params: ImageSimilaritySearchParams) -> dict[str, str]:
    """Build query parameters for the image similarity search request."""
    query: dict[str, str] = {}
    if params.offset is not None:
        query["offset"] = str(params.offset)
    if params.limit is not None:
        query["limit"] = str(params.limit)
    if params.scroll_token:
        query["scroll_token"] = params.scroll_token
    return query


def get_image_similarity_url() -> str:
    """Return the base URL for the image similarity search endpoint."""
    url = f"{settings.brandeye_search_host}/brandeye/image_similarity_search"
    logger.info("Resolved BrandEye URL", extra={"url": url})
    return url
