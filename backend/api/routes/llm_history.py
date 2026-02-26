"""LLM call history streaming endpoint (SSE)."""

import asyncio
import json
from typing import AsyncGenerator

from fastapi import APIRouter, Request
from starlette.responses import StreamingResponse

from utils.llm_history import history_store
from utils.logger import get_logger

router = APIRouter(prefix="/llm-history")
logger = get_logger(__name__)


def _format_sse(event: str, payload: dict) -> str:
    data = json.dumps(payload)
    return f"event: {event}\ndata: {data}\n\n"


@router.get("/stream")
async def stream_llm_history(
    request: Request,
    cycle_id: str | None = None,
) -> StreamingResponse:
    """Stream LLM call history updates as Server-Sent Events."""
    queue = history_store.subscribe(cycle_id=cycle_id)
    snapshot = await history_store.snapshot(cycle_id=cycle_id)

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            yield _format_sse("snapshot", snapshot)
            while True:
                if await request.is_disconnected():
                    break
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=15.0)
                except asyncio.TimeoutError:
                    yield "event: ping\ndata: {}\n\n"
                    continue
                event_type = payload.get("type", "llm_call")
                yield _format_sse(event_type, payload)
        finally:
            history_store.unsubscribe(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
