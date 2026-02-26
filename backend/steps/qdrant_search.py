"""Step 3 (conditional): Execute one or more QdrantQueries and return products."""

from dataclasses import dataclass, field

from steps.requirement_analyst import QdrantQuery
from utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class Product:
    id: str
    name: str
    category: str
    price: float
    image_url: str
    pdp_url: str        # product detail page URL
    description: str
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "price": self.price,
            "image_url": self.image_url,
            "pdp_url": self.pdp_url,
            "description": self.description,
            "metadata": self.metadata,
        }


async def _run_single_query(query: QdrantQuery) -> list[Product]:
    """Execute a single BrandEye image-similarity search and map results to Products."""
    import httpx
    from utils.qdrant_image_similarity import (
        ImageSimilarityFilters,
        ImageSimilaritySearchParams,
        build_image_similarity_payload,
        build_image_similarity_query_params,
        get_image_similarity_url,
    )

    def _lower_departments(value: str | list[str] | None) -> str | list[str] | None:
        if value is None:
            return None
        if isinstance(value, str):
            return value.lower()
        return [v.lower() for v in value]

    filters = ImageSimilarityFilters(
        categories=query.filters.get("categories"),
        departments=_lower_departments(query.filters.get("departments")),
        colors=query.filters.get("colors"),
        types=query.filters.get("types"),
        store_uuid=query.filters.get("store_uuid"),
        brands=query.filters.get("brands"),
        source=query.filters.get("source"),
        trend_times=query.filters.get("trend_times"),
        discount_range=query.filters.get("discount_range"),
        selling_price_range=query.filters.get("selling_price_range"),
    )
    params = ImageSimilaritySearchParams(
        query_text=query.text_query,
        limit=query.top_k,
        sort_flag="popularity",
        filters=filters,
    )

    payload = build_image_similarity_payload(params)
    logger.info(f"payload: {payload}")
    # httpx uses multipart/form-data only when `files=` is present.
    # Text fields are sent as (None, value) tuples (no filename, no content-type).
    multipart_fields = {k: (None, v) for k, v in payload.items()}

    logger.info(
        "Running BrandEye query",
        extra={"top_k": query.top_k, "has_filters": bool(query.filters)},
    )
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                get_image_similarity_url(),
                files=multipart_fields,
                params=build_image_similarity_query_params(params),
            )
            logger.info(resp.content)
            resp.raise_for_status()
    except Exception:
        logger.exception("BrandEye search request failed")
        raise

    raw_results: list[dict] = resp.json()["image_similarity"]["results"]

    # Fields consumed explicitly; everything else goes into metadata
    _known_point = {"title", "category", "selling_price", "image_url", "pdp_url", "url", "description"}
    products: list[Product] = []
    for result in raw_results:
        point: dict = result.get("point") or {}
        products.append(Product(
            id=str(result.get("point_id", "")),
            name=point.get("title", ""),
            category=point.get("category", ""),
            price=float(point.get("selling_price", 0.0)),
            image_url=point.get("image_url", ""),
            pdp_url=point.get("pdp_url", point.get("url", "")),
            description=point.get("description", ""),
            metadata={k: v for k, v in point.items() if k not in _known_point},
        ))
    return products


async def search_qdrant(queries: list[QdrantQuery]) -> list[Product]:
    """Run all queries against Qdrant and return a deduplicated product list.

    Args:
        queries: One or more QdrantQuery objects from AnalystOutput.

    Returns:
        Deduplicated list of Product objects across all queries.
    """
    seen_ids: set[str] = set()
    all_products: list[Product] = []

    logger.info("Searching qdrant", extra={"query_count": len(queries)})
    for query in queries:
        for product in await _run_single_query(query):
            if product.id not in seen_ids:
                seen_ids.add(product.id)
                all_products.append(product)

    return all_products
