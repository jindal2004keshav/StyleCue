"""In-memory LLM call history with per-cycle aggregation and SSE streaming."""

from __future__ import annotations

import asyncio
from collections import deque
from contextvars import ContextVar, Token
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from utils.logger import get_logger

logger = get_logger(__name__)

_cycle_id_ctx: ContextVar[str | None] = ContextVar("llm_cycle_id", default=None)
_step_ctx: ContextVar[str | None] = ContextVar("llm_step", default=None)


def get_cycle_id() -> str | None:
    return _cycle_id_ctx.get()


def set_cycle_id(cycle_id: str) -> Token:
    return _cycle_id_ctx.set(cycle_id)


def reset_cycle_id(token: Token) -> None:
    _cycle_id_ctx.reset(token)


def get_step() -> str | None:
    return _step_ctx.get()


def set_step(step: str | None) -> Token:
    return _step_ctx.set(step)


def reset_step(token: Token) -> None:
    _step_ctx.reset(token)

def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


@dataclass
class LlmCallEvent:
    id: str
    cycle_id: str
    step: str | None
    provider: str
    model: str
    started_at: datetime
    ended_at: datetime
    duration_ms: int
    input_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None
    cost_estimate_usd: float | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "cycle_id": self.cycle_id,
            "step": self.step,
            "provider": self.provider,
            "model": self.model,
            "started_at": _iso(self.started_at),
            "ended_at": _iso(self.ended_at),
            "duration_ms": self.duration_ms,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.total_tokens,
            "cost_estimate_usd": self.cost_estimate_usd,
        }


@dataclass
class CycleSummary:
    cycle_id: str
    started_at: datetime
    ended_at: datetime | None = None
    call_count: int = 0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_tokens: int = 0
    total_cost_estimate_usd: float = 0.0
    events: list[LlmCallEvent] = field(default_factory=list)

    def add_event(self, event: LlmCallEvent) -> None:
        self.events.append(event)
        self.call_count += 1
        if event.input_tokens is not None:
            self.total_input_tokens += event.input_tokens
        if event.output_tokens is not None:
            self.total_output_tokens += event.output_tokens
        if event.total_tokens is not None:
            self.total_tokens += event.total_tokens
        if event.cost_estimate_usd is not None:
            self.total_cost_estimate_usd += event.cost_estimate_usd
        self.ended_at = event.ended_at

    def to_dict(self, include_events: bool = True) -> dict[str, Any]:
        data: dict[str, Any] = {
            "cycle_id": self.cycle_id,
            "started_at": _iso(self.started_at),
            "ended_at": _iso(self.ended_at),
            "call_count": self.call_count,
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "total_tokens": self.total_tokens,
            "total_cost_estimate_usd": self.total_cost_estimate_usd,
        }
        if include_events:
            data["events"] = [event.to_dict() for event in self.events]
        return data


class LlmHistoryStore:
    def __init__(self, max_cycles: int = 100, max_events: int = 1000) -> None:
        self._max_cycles = max_cycles
        self._max_events = max_events
        self._cycles: dict[str, CycleSummary] = {}
        self._cycle_order: deque[str] = deque()
        self._event_count = 0
        self._lock = asyncio.Lock()
        self._subscribers: list[tuple[asyncio.Queue[dict[str, Any]], str | None]] = []

    def new_cycle_id(self) -> str:
        return uuid4().hex

    async def add_event(self, event: LlmCallEvent) -> CycleSummary:
        async with self._lock:
            cycle = self._cycles.get(event.cycle_id)
            if cycle is None:
                cycle = CycleSummary(cycle_id=event.cycle_id, started_at=event.started_at)
                self._cycles[event.cycle_id] = cycle
                self._cycle_order.append(event.cycle_id)
            cycle.add_event(event)
            self._event_count += 1

            await self._evict_if_needed()

            payload = {
                "type": "llm_call",
                "event": event.to_dict(),
                "cycle": cycle.to_dict(include_events=False),
            }
            await self._broadcast(payload)
            return cycle

    async def _evict_if_needed(self) -> None:
        while len(self._cycle_order) > self._max_cycles or self._event_count > self._max_events:
            if not self._cycle_order:
                break
            oldest_id = self._cycle_order.popleft()
            oldest = self._cycles.pop(oldest_id, None)
            if oldest:
                self._event_count -= len(oldest.events)

    async def _broadcast(self, payload: dict[str, Any]) -> None:
        if not self._subscribers:
            return
        for queue, cycle_id in list(self._subscribers):
            if cycle_id is None or payload.get("event", {}).get("cycle_id") == cycle_id:
                try:
                    queue.put_nowait(payload)
                except asyncio.QueueFull:
                    logger.warning("LLM history subscriber queue full; dropping event")

    async def snapshot(self, cycle_id: str | None = None) -> dict[str, Any]:
        async with self._lock:
            if cycle_id:
                cycle = self._cycles.get(cycle_id)
                cycles = [cycle.to_dict(include_events=True)] if cycle else []
            else:
                cycles = [self._cycles[cid].to_dict(include_events=True) for cid in self._cycle_order]
            return {
                "type": "snapshot",
                "cycles": cycles,
            }

    def subscribe(self, cycle_id: str | None = None) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=200)
        self._subscribers.append((queue, cycle_id))
        return queue

    def unsubscribe(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        self._subscribers = [item for item in self._subscribers if item[0] is not queue]


history_store = LlmHistoryStore()
