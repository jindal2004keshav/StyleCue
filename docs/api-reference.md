# StyleCue API Reference (v2)

Base URL (development): `http://localhost:8000`

---

## Full Pipeline

### `POST /api/chat`

Runs all steps (1-4) in sequence. Accepts `multipart/form-data`.

**Form fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `department` | string | ✅ | `"men"` or `"women"` |
| `message` | string | ✅ | User's free-form styling request |
| `preferences` | string (JSON) | | e.g. `'{"Fit":"Slim","Occasion":"Formal"}'` |
| `conversation_context` | string (JSON) | | Follow-up context: `{ initial_request, last_outfits }` |
| `images` | file[] | | Outfit inspiration images |

**Response `200 OK`:**
```json
{
  "outfits": [
    {
      "id": "outfit-1",
      "name": "Weekend Casual",
      "explanation": "string",
      "products": [
        {
          "id": "string",
          "name": "string",
          "category": "string",
          "price": 0.0,
          "image_url": "string",
          "pdp_url": "string",
          "description": "string",
          "metadata": {}
        }
      ],
      "user_image_urls": ["http://localhost:8000/uploads/example.jpg"]
    }
  ],
  "reasoning": "analyst's explanation of requirements and query choices"
}
```

---

## Per-Step Endpoints

### `POST /api/steps/process-input`

Step 1: Normalize multimodal input. Accepts `multipart/form-data`.

Same form fields as `/api/chat`.

**Response:**
```json
{
  "department": "women",
  "prompt": "normalized user prompt",
  "preference_keys": ["Fit", "Occasion"],
  "images": [
    {
      "slug": "filename-abc12345.jpg",
      "meta": { "garment_type": "dress", "colors": ["blue"] },
      "url": "http://localhost:8000/uploads/filename-abc12345.jpg"
    }
  ]
}
```

---

### `POST /api/steps/analyse-requirements`

Step 2: Intelligent LLM analyses requirements + defines Qdrant queries.

Accepts `application/json`.

**Body:**
```json
{
  "department": "women",
  "prompt": "string",
  "preferences": { "Fit": "Relaxed" },
  "image_metas": [
    { "slug": "...", "meta": { "garment_type": "dress" }, "url": "..." }
  ],
  "conversation_context": {
    "initial_request": { "department": "women", "prompt": "...", "preferences": {} },
    "last_outfits": []
  }
}
```

**Response:**
```json
{
  "reasoning": "string",
  "requires_qdrant": true,
  "queries": [
    { "text_query": "floral dress women outdoor", "filters": {}, "top_k": 10 }
  ]
}
```

---

### `POST /api/steps/search-qdrant`

Step 3 (conditional): Execute one or more Qdrant queries.

Accepts `application/json`.

**Body:**
```json
{
  "queries": [
    { "text_query": "string", "filters": {}, "top_k": 10 }
  ]
}
```

**Response:** `array` of Product objects (see schema above), deduplicated across all queries.

---

### `POST /api/steps/generate-response`

Step 4: Generate the final outfit recommendation.

Accepts `application/json`.

**Body:**
```json
{
  "department": "women",
  "prompt": "string",
  "preferences": {},
  "reasoning": "analyst reasoning string from Step 2",
  "requires_qdrant": true,
  "products": [ { "id": "1", "name": "...", "pdp_url": "...", ... } ],
  "conversation_context": {
    "initial_request": { "department": "women", "prompt": "...", "preferences": {} },
    "last_outfits": []
  }
}
```

**Response:**
```json
{
  "outfits": [
    {
      "id": "outfit-1",
      "name": "Weekend Casual",
      "explanation": "string",
      "products": [ { "id": "1", "name": "...", "pdp_url": "...", ... } ],
      "user_image_urls": ["http://localhost:8000/uploads/example.jpg"]
    }
  ]
}
```

---

## Static Files

### `GET /uploads/{slug}`

Returns a previously uploaded image file. Used as the `url` field in image metadata.

---

## Health Check

### `GET /health`

```json
{ "status": "ok" }
```
