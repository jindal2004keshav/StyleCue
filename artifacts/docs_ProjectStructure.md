# StyleCue — Project Structure & Source of Truth

> This document is the canonical reference for requirements, architecture, data models, and implementation status. Update it whenever a significant decision changes.

---

## 1. Product Overview

StyleCue is an AI-powered personal styling assistant. Given the user's intent, optional style preferences, and optional images of existing wardrobe items, it recommends complete outfits by fetching shoppable products from a live catalogue (BrandEye / Scout).

---

## 2. Execution Flow

```
User Input (department + prompt + preferences? + images?)
    │                             ▲
    │              conversation_context (turn 2+):
    │              { initial_request, last_outfits }
    ▼
Step 1 — process_input
    • Save uploaded images to disk; serve at /uploads/{slug}
    • Extract fashion attributes from each image via LLM vision call
    • Emit structured ProcessedInput dict
    │
    ▼
Step 2 — analyse_requirements  [LLM: analyst_model]
    • Receives the ProcessedInput dict + raw images (vision)
    • If conversation_context present: prepends prior outfits summary
      so the analyst refines rather than restarts
    • Determines whether external products are needed (requires_qdrant bool)
    • If yes, emits one or more QdrantQuery objects (text_query + filters + top_k)
    • Always returns reasoning string explaining the decision
    │
    ├── requires_qdrant = false ──────────────────────────────────┐
    │                                                             │
    ▼                                                             │
Step 3 — search_qdrant  [CONDITIONAL]                            │
    • Runs each QdrantQuery against BrandEye image-similarity API │
    • Queries are TEXT-based (detailed description); no image sent│
    • Deduplicates results across queries by product id           │
    • Returns list[Product]                                       │
    │                                                             │
    └──────────────────────────────────────────────────────────── ┤
                                                                  │
    ▼                                                             │
Step 4 — generate_response  [LLM: response_model]               ◄┘
    • Receives: ProcessedInput + AnalystOutput + list[Product]
      + optional conversation_context
    • If conversation_context present: injects prior outfits as
      refinement context so follow-ups improve rather than restart
    • LLM outputs JSON {"outfits": [...]} — never plain markdown
    • Maps product_ids → Product objects, user_image_slugs → /uploads/ URLs
    • Returns list[Outfit] (structured, not a markdown string)
```

---

## 3. User Inputs

| Field | Type | Required | Notes |
|---|---|---|---|
| `department` | `"men" \| "women"` | Yes | Toggle in UI |
| `prompt` | string | Yes | Free-form styling intent |
| `preferences` | dict | No | Material, Fit, Occasion checkboxes (see LOVs below) |
| `images` | list[File] | No | Clothing/accessory images from wardrobe |

### Preference LOVs (fixed, multi-select checkboxes)

```
Occasion : casual, party, everyday, workwear, elevated
Fit      : regular, skinny, oversized, comfort, slim
Material : cotton, silk, polyester, nylon, linen
```

---

## 4. System Constraints

1. **Target categories** — Shirts, T-shirts, Trousers, Shorts, Jackets only.
2. **Image similarity search** — The BrandEye API accepts a single image OR text query. Since the pipeline doesn't know which image type to search for, Step 3 always uses **text-based queries** (detailed, specific descriptions from the analyst). No image is passed to the search API.
3. **Search results are not absolute** — Step 4 must re-evaluate retrieved products against the analyst's reasoning and only surface the best-matching outfits.
4. **LLM calls are backend-only** — The frontend only calls backend HTTP endpoints; it never calls Anthropic directly.
5. **Test pages use shared production utilities** — `tests/test_utils.js` is the shared JS helper. Step test pages (`.html`) must only add a thin UI wrapper; they must not duplicate business logic.

---

## 5. Project Structure

```
StyleCue/
├── backend/
│   ├── main.py                        # FastAPI app, CORS, /uploads static mount
│   ├── config.py                      # Pydantic Settings (env vars, model names, URLs)
│   ├── requirements.txt               # Python deps
│   ├── .env.example                   # Template — copy to .env and fill secrets
│   │
│   ├── steps/                         # Pipeline steps — single source of truth
│   │   ├── __init__.py                # Re-exports: process_input, analyse_requirements,
│   │   │                              #   search_qdrant, generate_response
│   │   ├── input_processor.py         # Step 1: ProcessedInput, ProcessedImage, process_input()
│   │   ├── requirement_analyst.py     # Step 2: AnalystOutput, QdrantQuery, analyse_requirements()
│   │   ├── qdrant_search.py           # Step 3: Product, search_qdrant(list[QdrantQuery])
│   │   └── response_generator.py     # Step 4: generate_response(processed, analyst, products)
│   │
│   ├── api/
│   │   └── routes/
│   │       ├── chat.py                # POST /api/chat — full pipeline, single request
│   │       └── steps.py               # POST /api/steps/* — per-step endpoints for testing
│   │
│   └── utils/
│       ├── llm.py                     # Anthropic SDK wrapper; call_llm(); embed_text() STUB
│       ├── qdrant.py                  # Qdrant client singleton (local, for future use)
│       ├── qdrant_image_similarity.py # BrandEye API request builder (payload + query params)
│       ├── image.py                   # bytes_to_base64(), base64_to_bytes()
│       └── storage.py                 # save_image() → (slug, url) for /uploads/
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts                 # Proxy /api → http://localhost:8000
│   ├── tsconfig.json / tsconfig.node.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                    # Root layout; renders <ChatWindow />
│       ├── components/
│       │   ├── ChatWindow.tsx         # Department toggle, Preferences, messages, input bar
│       │   ├── MessageBubble.tsx      # User / assistant message rendering
│       │   ├── OutfitCard.tsx         # Inline outfit card (images, explanation, products)
│       │   ├── Preferences.tsx        # Occasion / Fit / Material LOV pill checkboxes
│       │   └── WishlistPanel.tsx      # Drawer showing saved outfits
│       ├── hooks/
│       │   └── useWishlist.ts         # localStorage-backed wishlist hook
│       └── utils/
│           └── api.ts                 # sendChat() + stepProcessInput/AnalyseReqs/etc helpers
│
├── tests/                             # Step-by-step debug/test pages (open directly in browser)
│   ├── test_utils.js                  # Shared helpers: apiPost(), apiPostForm(), showResult()
│   ├── step1_input_processing.html
│   ├── step2_requirement_analysis.html
│   ├── step3_qdrant_search.html
│   └── step4_final_response.html
│
├── docs/
│   ├── api-reference.md               # Endpoint reference
│   └── architecture.md                # Architecture narrative
│
├── artifacts/                         # Agent guides, reference docs (not shipped)
│   ├── docs_ProjectStructure.md       # ← THIS FILE
│   ├── docs_ImageSimilaritySearch.txt # BrandEye API contract (authoritative)
│   └── prompt_*.md                    # Prompt templates used to build features
│
├── scripts/
│   └── dev.sh                         # Starts uvicorn + vite concurrently
│
├── CLAUDE.md                          # Coding guidelines for Claude Code
└── AGENTS.md                          # Agent guidelines
```

---

## 6. Backend — Data Models

### Step 1 Output: `ProcessedInput` / `ProcessedImage`

```python
@dataclass
class ProcessedImage:
    slug: str        # filename-safe slug, e.g. "my-tshirt-a1b2c3d4.jpg"
    meta: dict       # LLM-extracted: garment_type, colors, pattern, style, fit, occasion_hints
    url: str         # downloadable: http://localhost:8000/uploads/{slug}
    base64: str      # in-memory only; not serialised to API or dict output

@dataclass
class ProcessedInput:
    department: str                    # "men" | "women"
    prompt: str
    preferences: dict[str, str]        # e.g. {"Occasion": "casual", "Fit": "slim"}
    images: list[ProcessedImage]

    def to_dict(self) -> dict:
        # With images:   { "department", "prompt", "preferences", "image1": {...}, ... }
        # Without images: { "department", "prompt", "preferences" }
```

### Step 2 Output: `AnalystOutput` / `QdrantQuery`

```python
@dataclass
class QdrantQuery:
    text_query: str                     # rich description for BrandEye text search
    filters: dict[str, str | list[str]] # e.g. {"categories": "T-Shirts", "departments": "Men"}
    top_k: int = 10

@dataclass
class AnalystOutput:
    reasoning: str          # why these queries; used in Step 4 prompt
    requires_qdrant: bool   # False → skip Step 3 entirely
    queries: list[QdrantQuery]
```

### Step 3 Output: `Product`

```python
@dataclass
class Product:
    id: str
    name: str
    category: str           # e.g. "T-Shirts"
    price: float
    image_url: str          # product image (from catalogue)
    pdp_url: str            # product detail page link (shoppable)
    description: str
    metadata: dict          # all other payload fields from BrandEye
```

### Step 4 Output: `Outfit`

```python
@dataclass
class Outfit:
    id: str                         # "outfit-1", "outfit-2" …
    name: str                       # e.g. "Weekend Casual"
    explanation: str                # why this outfit suits the user's request
    products: list[Product]         # catalogue products (from Step 3)
    user_image_urls: list[str]      # /uploads/{slug} URLs of user images in this outfit

    def to_dict(self) -> dict: ...
```

### Conversation Context (frontend → backend)

```json
{
  "initial_request": { "department": "women", "prompt": "...", "preferences": {...} },
  "last_outfits": [ { ...OutfitDict... } ]
}
```

#### BrandEye → Product field mapping

| Product field | BrandEye `point` key | Notes |
|---|---|---|
| `id` | `point_id` (top-level result) | String; may be int in response |
| `name` | `title` | |
| `category` | `category` | |
| `price` | `selling_price` | Defaults to 0.0 if absent |
| `image_url` | `image_url` | Defaults to "" if absent |
| `pdp_url` | `pdp_url` → fallback `url` | Defaults to "" if absent |
| `description` | `description` | Defaults to "" if absent |
| `metadata` | all other `point` keys | Includes `brand`, `Department`, `Color`, `trending_score`, etc. |

> Note: `selling_price`, `image_url`, `pdp_url`, `description` are not shown in the contract
> example payload. They may be present in the actual catalogue data; `.get()` defaults handle
> their absence gracefully.

---

## 7. Backend — API Endpoints

### `POST /api/chat` — Full pipeline

Accepts `multipart/form-data`:

| Field | Type | Required |
|---|---|---|
| `department` | string | Yes |
| `message` | string | Yes |
| `preferences` | JSON string | No (default `{}`) |
| `conversation_context` | JSON string | No (default `{}`) |
| `images` | list[UploadFile] | No |

Response:
```json
{
  "outfits": [ { "id", "name", "explanation", "products": [...], "user_image_urls": [...] } ],
  "reasoning": "<analyst reasoning from Step 2>"
}
```

### `POST /api/steps/process-input`

`multipart/form-data` — same fields as `/api/chat`.
Returns: `{ department, prompt, preference_keys, images: [{slug, meta, url}] }`

### `POST /api/steps/analyse-requirements`

JSON body: `{ department, prompt, preferences, image_metas: [{slug, meta, url}], conversation_context }`
Returns: `{ reasoning, requires_qdrant, queries: [{text_query, filters, top_k}] }`

### `POST /api/steps/search-qdrant`

JSON body: `{ queries: [{text_query, filters, top_k}] }`
Returns: `list[Product dict]`

### `POST /api/steps/generate-response`

JSON body: `{ department, prompt, preferences, reasoning, requires_qdrant, products, conversation_context }`
Returns: `{ outfits: [...] }`

### `GET /health`

Returns: `{ "status": "ok" }`

### `GET /uploads/{slug}`

Static file serve — uploaded user images.

---

## 8. Backend — Configuration (`backend/.env`)

| Env var | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Required for all LLM calls |
| `ANALYST_MODEL` | `claude-sonnet-4-6` | Step 2 model |
| `RESPONSE_MODEL` | `claude-sonnet-4-6` | Step 4 model |
| `QDRANT_URL` | `http://localhost:6333` | Local Qdrant (future use) |
| `QDRANT_API_KEY` | — | Optional |
| `QDRANT_COLLECTION` | `products` | Collection name |
| `APP_ENV` | `development` | |
| `CORS_ORIGINS` | `["http://localhost:5173"]` | Allowed origins |
| `UPLOADS_DIR` | `uploads` | Relative to `backend/` |
| `BRANDEYE_SEARCH_HOST` | `https://ai-search-brandeye.blr.streamoid.com` | BrandEye API host |

---

## 9. External Integration — BrandEye Product Search API

**Contract reference**: `artifacts/docs_ImageSimilaritySearch.txt`

- **Endpoint**: `POST {BRANDEYE_SEARCH_HOST}/brandeye/image_similarity_search`
- **Content-Type**: `multipart/form-data`
- **Auth**: none

> All requests must use `Content-Type: multipart/form-data` per the contract (even text-only
> queries). In httpx this requires `files=` not `data=`.

Key fields the pipeline uses for Step 3 (text-only queries):

| Field | Value |
|---|---|
| `query_text` | Detailed product description from analyst |
| `departments` | Comma-separated, e.g. `"Women"` |
| `categories` | e.g. `"T-Shirts"` (restricted to target categories) |
| `colors` | Comma-separated colour names (optional) |
| `brands` | Brand name filter (optional) |
| `limit` | Maps to `QdrantQuery.top_k` |
| `sort_flag` | `"popularity"` (default) |

Response shape:
```json
{
  "image_similarity": {
    "results": [
      { "point": { "title", "brand", "category", "Department", "Color", ... },
        "point_id": "...", "score": 0.92, "source": "image_embeddings_refined" }
    ],
    "next_token": null
  }
}
```

**Request builder utility**: `backend/utils/qdrant_image_similarity.py`
- `ImageSimilarityFilters` — dataclass for all filter fields
- `ImageSimilaritySearchParams` — wraps query_text, image, filters, pagination
- `build_image_similarity_payload()` → form fields dict
- `build_image_similarity_query_params()` → URL query params dict
- `get_image_similarity_url()` → full endpoint URL from settings

---

## 10. Frontend — Component Tree

```
App
└── ChatWindow
    ├── Department toggle ("Women" / "Men")
    ├── Preferences          ← Occasion / Fit / Material LOV pill checkboxes
    ├── MessageBubble[]      ← user + assistant turns
    │   └── OutfitCard[]      ← structured outfits rendered inline
    ├── WishlistPanel        ← saved outfits drawer
    └── Input bar
        ├── Attachment button (📎) + hidden <input type="file" multiple>
        ├── Textarea (Enter to send, Shift+Enter for newline)
        └── Send button
```

### `sendChat()` in `frontend/src/utils/api.ts`

Posts `multipart/form-data` to `/api/chat`. Returns `{ outfits, reasoning }`.
Also exports per-step helpers (`stepProcessInput`, `stepAnalyseRequirements`, `stepSearchQdrant`, `stepGenerateResponse`) which mirror the `/api/steps/*` endpoints.

---

## 11. Test Pages (`tests/`)

Each HTML page tests one pipeline step in isolation. They share `tests/test_utils.js` (imported via `<script src>`), which provides:
- `apiPost(path, body)` — JSON POST
- `apiPostForm(path, formData)` — multipart POST
- `showResult(data)` / `showError(err)` — render response into `#result` div
- `SHARED_STYLES` — CSS string for consistent styling

| File | Tests |
|---|---|
| `step1_input_processing.html` | `POST /api/steps/process-input` |
| `step2_requirement_analysis.html` | `POST /api/steps/analyse-requirements` |
| `step3_qdrant_search.html` | `POST /api/steps/search-qdrant` |
| `step4_final_response.html` | `POST /api/steps/generate-response` |

Open directly in a browser (no build step needed).

---

## 12. Dev Setup

```bash
# 1. Backend
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env: fill ANTHROPIC_API_KEY, set BRANDEYE_SEARCH_HOST if different

# 2. Start both services
bash scripts/dev.sh

# URLs
# API + Swagger : http://localhost:8000/docs
# Frontend      : http://localhost:5173
# Test pages    : open tests/step*.html directly in browser
```

---

## 13. Implementation Status & Known Gaps

### Done

- [x] Step 1: `process_input()` — image upload, LLM vision meta extraction, structured output
- [x] Step 2: `analyse_requirements()` — LLM requirement analysis, conditional Qdrant decision
- [x] Step 3: `search_qdrant()` — BrandEye API integration; response unwrapped from `image_similarity.results`; `point` payload mapped to `Product`; deduplication by product id
- [x] Step 4: `generate_response()` — LLM outputs JSON outfits; products + user images resolved
- [x] `/api/chat` — full pipeline endpoint
- [x] `/api/steps/*` — per-step debug endpoints
- [x] `utils/qdrant_image_similarity.py` — BrandEye API request builder
- [x] Frontend: ChatWindow, Department toggle, Preferences (LOV pill checkboxes), MessageBubble, OutfitCard
- [x] Wishlist: localStorage persistence + WishlistPanel drawer
- [x] Conversation context: follow-up turns refine prior outfits
- [x] Test pages for all 4 steps
- [x] Step 2 system prompt: BrandEye filter field names + target category constraint

### Needs Implementation

None — all known gaps resolved.
