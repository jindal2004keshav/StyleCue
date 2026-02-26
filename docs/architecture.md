# StyleCue Architecture (v2)

## Pipeline Overview

```
User Input
  department (men/women)
  prompt (text)
  preferences (optional dict: Material, Fit, Occasion, …)
  images (optional file uploads)
  conversation_context (optional; initial_request + last_outfits)
        │
        ▼
┌────────────────────────┐
│  Step 1                │  input_processor.py
│  Process Input         │  Save images → /uploads/{slug}
│                        │  LLM vision → extract image meta (per image)
│                        │  Output: ProcessedInput + to_dict()
└──────────┬─────────────┘
           │ ProcessedInput.to_dict()
           │  { department, prompt, preferences,
           │    image1: {slug, meta, url}, … }
           ▼
┌────────────────────────┐
│  Step 2                │  requirement_analyst.py
│  Analyse Requirements  │  Sonnet LLM sees input dict + raw images
│                        │  + conversation_context (if present)
│                        │  Output: AnalystOutput
│                        │    .reasoning (why + what queries)
│                        │    .requires_qdrant (bool)
│                        │    .queries (list[QdrantQuery])
└──────────┬─────────────┘
           │ requires_qdrant?
           ├── No  ──────────────────────────────────────────┐
           │                                                  │
           │ Yes                                              │
           ▼                                                  │
┌────────────────────────┐                                   │
│  Step 3 (conditional)  │  qdrant_search.py                 │
│  Search Qdrant         │  Run all queries, deduplicate      │
│                        │  Output: list[Product]             │
│                        │  (each has pdp_url, image, meta)  │
└──────────┬─────────────┘                                   │
           │                                                  │
           └──────────────────────┬───────────────────────────┘
                                  │
                                  ▼
                    ┌────────────────────────┐
                    │  Step 4                │  response_generator.py
                    │  Generate Response     │  Sonnet LLM:
                    │                        │  user context
                    │                        │  + analyst reasoning
                    │                        │  + retrieved products
                    │                        │  + user images (vision)
                    │                        │  + conversation_context (if present)
                    │                        │  → structured outfits (JSON)
                    └────────────────────────┘
```

## Design Decisions

### Input dict as the handoff between Step 1 and Step 2
`ProcessedInput.to_dict()` produces the canonical v2 dict spec passed to the analyst:
- **With images:** `{ department, prompt, preferences, image1: {slug, meta, url}, … }`
- **Without images:** `{ department, prompt, preferences }`

### Image processing in Step 1 (not Step 2)
Each uploaded image is persisted to `backend/uploads/` (served as `/uploads/{slug}`)
and its fashion attributes are extracted by an LLM vision call before the analyst runs.
The analyst therefore receives both the structured meta dict AND the raw image for direct visual reasoning.

### Qdrant search is conditional
The analyst explicitly decides `requires_qdrant: true|false`. When the user's uploaded
items already fully cover the outfit, no search is performed.

### Multiple Qdrant queries per request
The analyst may return several targeted queries (e.g. "slim fit chinos men formal" +
"oxford shoes men brown"). `search_qdrant()` runs them all and deduplicates by product ID.

### Conversation continuity
Follow-up turns include `conversation_context` with the initial request and the last outfits
so Steps 2 and 4 refine rather than restart.

### Both analysis models use Sonnet
`analyst_model` and `response_model` are both Sonnet by default (configurable in `.env`).
The old Haiku fast-path from v1 is removed — v2 prioritises reasoning quality over latency.

## Directory Layout

```
backend/
  main.py                   FastAPI app + /uploads static mount
  config.py                 Pydantic Settings (analyst_model, response_model, uploads_dir)
  steps/
    input_processor.py      Step 1: ProcessedInput, ProcessedImage, process_input()
    requirement_analyst.py  Step 2: AnalystOutput, QdrantQuery, analyse_requirements()
    qdrant_search.py        Step 3: Product (+ pdp_url), search_qdrant(queries)
    response_generator.py   Step 4: generate_response(processed, analyst, products)
  utils/
    llm.py                  Anthropic async client wrapper
    qdrant.py               Qdrant client wrapper
    image.py                bytes_to_base64 / base64_to_bytes
    storage.py              Save uploads to disk + return slug + URL
  api/routes/
    chat.py                 POST /api/chat — full pipeline
    steps.py                POST /api/steps/{process-input, analyse-requirements,
                                             search-qdrant, generate-response}

frontend/src/
  App.tsx                   Header + ChatWindow
  components/
    ChatWindow.tsx           Department toggle + Preferences + messages + input bar
    Preferences.tsx          Free-form key-value preference rows (replaces Questionnaire)
    MessageBubble.tsx        User/assistant message renderer
    OutfitCard.tsx           Structured outfit card (images + explanation + products)
    WishlistPanel.tsx        Saved outfits drawer
  hooks/
    useWishlist.ts           localStorage-backed wishlist
  utils/api.ts               Typed fetch helpers for all endpoints

tests/
  test_utils.js                         Shared helpers
  step1_input_processing.html           Test Step 1
  step2_requirement_analysis.html       Test Step 2
  step3_qdrant_search.html              Test Step 3 (multi-query array)
  step4_final_response.html             Test Step 4 (with reasoning field)
```
