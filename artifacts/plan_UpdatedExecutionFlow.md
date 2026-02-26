# Outfit-Card Response + Conversation Continuity

## Context

Currently the pipeline returns `reply: str` (markdown) + a flat `products` list. The
frontend renders the reply as raw text and shows products in a static strip at the bottom.

The new behavior:
1. **Step 4 returns structured outfit groups** — each outfit bundles catalogue products +
   user-uploaded images + an explanation. Rendered as interactive outfit cards inline in the
   chat, not as a text blob.
2. **Outfits are wishlistable** — saved to localStorage, accessible at any time via a
   Wishlist panel.
3. **Follow-up conversations** — subsequent turns pass `{initial_request, last_outfits}` as
   context so Steps 2 and 4 refine rather than restart.
4. **`docs_ProjectStructure.md` updated** to reflect all the above.

---

## New Data Model

### `Outfit` (backend — lives in `backend/steps/response_generator.py`)

```python
@dataclass
class Outfit:
    id: str                        # "outfit-1", "outfit-2" …
    name: str                      # e.g. "Weekend Casual"
    explanation: str               # why this outfit suits the user's request
    products: list[Product]        # catalogue products (from Step 3)
    user_image_urls: list[str]     # /uploads/{slug} URLs of user images in this outfit

    def to_dict(self) -> dict: ...
```

### LLM output schema (Step 4 system prompt)

The LLM is instructed to output **only** valid JSON:
```json
{
  "outfits": [
    {
      "id": "outfit-1",
      "name": "Weekend Casual",
      "explanation": "...",
      "product_ids": ["<BrandEye point_id>"],
      "user_image_slugs": ["<ProcessedImage.slug>"]
    }
  ]
}
```
Backend maps `product_ids` → `Product` objects and `user_image_slugs` → `/uploads/` URLs.

### Conversation context (frontend → backend, optional)

```json
{
  "initial_request": { "department": "women", "prompt": "...", "preferences": {...} },
  "last_outfits": [ { ...OutfitDict... } ]
}
```
Passed as a JSON-encoded string field `conversation_context` in the `/api/chat` form body.
First turn: omit or send `"{}"`. Subsequent turns: always send.

---

## Backend Changes

### 1. `backend/steps/response_generator.py`
- Add `Outfit` dataclass (imports `Product` from `qdrant_search.py`).
- Change `generate_response()` signature:
  ```python
  async def generate_response(
      processed: ProcessedInput,
      analyst: AnalystOutput,
      products: list[Product],
      conversation_context: dict | None = None,
  ) -> list[Outfit]:
  ```
- Update system prompt: instruct LLM to output JSON `{"outfits": [...]}`, include
  conversation context block when present (prior outfits names + explanations + user feedback).
- After LLM call: parse JSON → resolve `product_ids` and `user_image_slugs` → return
  `list[Outfit]`. Invalid IDs silently skipped.

### 2. `backend/steps/requirement_analyst.py`
- Add optional `conversation_context: dict | None = None` parameter to
  `analyse_requirements()`.
- When context is present, prepend a block to the user message text:
  ```
  --- Prior session context ---
  Initial request: <initial_request>
  Last outfits suggested: <outfit names + explanations>
  User follow-up: <current prompt>
  ```
  This keeps the analyst grounded on what was already recommended.

### 3. `backend/api/routes/chat.py`
- Add `conversation_context: str = Form("{}")` parameter.
- Parse it as JSON (fallback to `{}`).
- Pass to both `analyse_requirements()` and `generate_response()`.
- New `ChatResponse`:
  ```python
  class ChatResponse(BaseModel):
      outfits: list[dict]
      reasoning: str
  ```
  (No more `reply: str` or top-level `products`.)

### 4. `backend/api/routes/steps.py`
- `AnalyseRequirementsRequest`: add `conversation_context: dict = {}`.
- `GenerateResponseRequest`: add `conversation_context: dict = {}`; change `products` field
  to remain as `list[dict]` (unchanged).
- `GenerateResponseResponse`: change `reply: str` → `outfits: list[dict]`.
- Update handler logic accordingly.

---

## Frontend Changes

### 5. `frontend/src/utils/api.ts`
- Add `Outfit` and `ConversationContext` interfaces:
  ```ts
  export interface Outfit {
    id: string;
    name: string;
    explanation: string;
    products: Product[];
    user_image_urls: string[];
  }
  export interface ConversationContext {
    initial_request: { department: string; prompt: string; preferences: Record<string, string> };
    last_outfits: Outfit[];
  }
  ```
- Update `ChatResponse`: `outfits: Outfit[]; reasoning: string` (remove `reply`, `products`).
- Add `conversationContext?: ConversationContext` to `ChatPayload`.
- Update `sendChat()` to append `conversation_context` JSON field to FormData when present.

### 6. `frontend/src/hooks/useWishlist.ts` *(new file)*
- Custom hook reading/writing `stylecue_wishlist` in localStorage.
- Returns `{ wishlist: Outfit[], addOutfit, removeOutfit, isWishlisted }`.
- `addOutfit` deduplicates by `outfit.id`.

### 7. `frontend/src/components/OutfitCard.tsx` *(new file)*
- Props: `outfit: Outfit; isWishlisted: boolean; onWishlist: () => void`.
- Layout:
  - Header: outfit name + wishlist button (heart icon, filled vs outline state).
  - Horizontal image strip: `user_image_urls` followed by `products[].image_url`.
  - Explanation text block.
  - Product list: name, category, price; each item links to `pdp_url`.

### 8. `frontend/src/components/WishlistPanel.tsx` *(new file)*
- Props: `isOpen: boolean; onClose: () => void`.
- Renders saved `Outfit[]` from `useWishlist()` as `OutfitCard` components.
- Clicking heart on a saved card removes it from the wishlist.
- Rendered as a right-side overlay drawer inside `ChatWindow`.
- Empty state: "No outfits saved yet."

### 9. `frontend/src/components/MessageBubble.tsx`
- Extend `Message` interface:
  ```ts
  export interface Message {
    role: "user" | "assistant";
    content: string;
    outfits?: Outfit[];
  }
  ```
- When `message.outfits` is present, render `OutfitCard[]` below the text content.

### 10. `frontend/src/components/ChatWindow.tsx`
- Add state: `conversationContext: ConversationContext | null` (null until first response).
- After each successful response: build/update `conversationContext` with
  `initial_request` (from current department/message/preferences) and
  `last_outfits` (from new response).
- Pass `conversationContext` to `sendChat()` on turn 2+.
- Render assistant messages with `outfits` array; remove the bottom product strip.
- Add "Wishlist" button in top bar → toggles `WishlistPanel`.
- Import and render `WishlistPanel` + `useWishlist` hook.

---

## Files NOT Changed

| File | Reason |
|---|---|
| `backend/steps/input_processor.py` | Step 1 unchanged |
| `backend/steps/qdrant_search.py` | `Product` and `search_qdrant()` unchanged |
| `backend/utils/*` | No changes |
| `frontend/src/App.tsx` | WishlistPanel lives inside ChatWindow |
| `frontend/src/components/Preferences.tsx` | No changes |

---

## `artifacts/docs_ProjectStructure.md` Updates

- **§2 Execution Flow**: Add conversation context input arrow; note follow-up turns inject
  `initial_request + last_outfits` into Steps 2 and 4.
- **§6 Data Models**: Add `Outfit` dataclass; add `ConversationContext`; update
  `ChatResponse` (remove `reply`/`products`, add `outfits`); note `generate_response()`
  now returns `list[Outfit]`.
- **§7 API Endpoints**: `/api/chat` — add `conversation_context` form field; change response
  schema. `/api/steps/generate-response` — update request/response.
- **§10 Frontend Component Tree**: Add `OutfitCard`, `WishlistPanel`, `useWishlist` hook.
- **§13 Implementation Status**: Mark new items as done after implementation.

---

## Verification

1. **First turn**: Send a prompt (no context). Confirm `/api/chat` returns `{ outfits: [...], reasoning }` with structured outfit objects.
2. **Outfit cards render** inline in the chat: image strip + explanation + product list + heart button.
3. **Wishlist**: Click heart → outfit appears in WishlistPanel. Refresh page → outfit persists (localStorage). Click again → removed.
4. **Follow-up turn**: Send "make it more formal". Confirm `conversation_context` is in the request (check network tab). Confirm new outfits reflect refinement.
5. **Image uploads**: Upload a photo, confirm `user_image_urls` appears in the outfit card image strip.
6. **No-products case** (`requires_qdrant=false`): Outfits still render with only `user_image_urls` and empty `products`.
7. **`tests/step4_final_response.html`**: Update to expect `outfits` array in response.
