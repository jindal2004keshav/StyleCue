LLM History Streaming Endpoint Spec

  Endpoint

  - GET /api/llm-history/stream
  - Query params:
      - cycle_id (optional): filter stream to a single cycle. Recommended for UI.

  Protocol

  - Server-Sent Events (SSE), Content-Type: text/event-stream
  - Event types:
      - snapshot (first event)
      - llm_call (subsequent per-call updates)
      - ping (keepalive every ~15s)

  Event: snapshot

  - Sent immediately after connection.
  - Payload:

  {
    "type": "snapshot",
    "cycles": [
      {
        "cycle_id": "string",
        "started_at": "2026-02-26T12:34:56.789+00:00",
        "ended_at": "2026-02-26T12:34:58.123+00:00",
        "call_count": 2,
        "total_input_tokens": 1234,
        "total_output_tokens": 567,
        "total_tokens": 1801,
        "total_cost_estimate_usd": 0.0,
        "events": [
          {
            "id": "string",
            "cycle_id": "string",
            "step": "process_input|analyse_requirements|generate_response|null",
            "provider": "openai|anthropic|gemini",
            "model": "string",
            "started_at": "2026-02-26T12:34:56.789+00:00",
            "ended_at": "2026-02-26T12:34:56.999+00:00",
            "duration_ms": 210,
            "input_tokens": 100,
            "output_tokens": 50,
            "total_tokens": 150,
            "cost_estimate_usd": 0.0
          }
        ]
      }
    ]
  }

  Event: llm_call

  - Emitted per LLM call.
  - Payload:

  {
    "type": "llm_call",
    "event": {
      "id": "string",
      "cycle_id": "string",
      "step": "process_input|analyse_requirements|generate_response|null",
      "provider": "openai|anthropic|gemini",
      "model": "string",
      "started_at": "2026-02-26T12:34:56.789+00:00",
      "ended_at": "2026-02-26T12:34:56.999+00:00",
      "duration_ms": 210,
      "input_tokens": 100,
      "output_tokens": 50,
      "total_tokens": 150,
      "cost_estimate_usd": 0.0
    },
    "cycle": {
      "cycle_id": "string",
      "started_at": "2026-02-26T12:34:56.789+00:00",
      "ended_at": "2026-02-26T12:34:56.999+00:00",
      "call_count": 1,
      "total_input_tokens": 100,
      "total_output_tokens": 50,
      "total_tokens": 150,
      "total_cost_estimate_usd": 0.0
    }
  }

  Event: ping

  - Keepalive. Payload: {}

  Client Flow (recommended)

  1. POST /api/chat as usual.
  2. Read cycle_id from response body or X-Cycle-Id header.
  3. Open SSE:
      - new EventSource('/api/llm-history/stream?cycle_id=...')
  4. On snapshot, initialize UI state from totals + events.
  5. On llm_call, append event and update totals using cycle.
  6. Ignore ping.

  Null handling

  - Any of input_tokens, output_tokens, total_tokens, cost_estimate_usd can be null if provider didn’t return usage or pricing isn’t configured.

  Scope

  - In-memory history only; if backend restarts, history resets.