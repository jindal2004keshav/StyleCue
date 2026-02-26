# StyleCue

AI-powered personal styling assistant with a multi-step backend pipeline and a React frontend.

**Quick Links**
1. `artifacts/docs_ProjectStructure.md` — source of truth for architecture and data models
2. `docs/api-reference.md` — endpoint reference
3. `tests/` — step-by-step debug pages (open directly in a browser)

**Setup**
1. Backend dependencies
   ```bash
   cd backend
   pip install -r requirements.txt
   ```
2. Environment
   ```bash
   cp .env.example .env
   ```
   Fill `ANTHROPIC_API_KEY` and confirm `BRANDEYE_SEARCH_HOST` in `backend/.env`.
3. Start services (backend + frontend)
   ```bash
   bash scripts/dev.sh
   ```

**Test Individual Steps (No Frontend Build)**

Open these files directly in a browser and submit the forms:
1. `tests/step1_input_processing.html` — `POST /api/steps/process-input`
2. `tests/step2_requirement_analysis.html` — `POST /api/steps/analyse-requirements`
3. `tests/step3_qdrant_search.html` — `POST /api/steps/search-qdrant`
4. `tests/step4_final_response.html` — `POST /api/steps/generate-response`

Notes:
1. These pages rely on `tests/test_utils.js` for request helpers and rendering.
2. Step 2 and Step 4 accept optional `conversation_context` JSON for follow-ups.
3. Step 4 returns `{ outfits: [...] }` (structured), not a markdown string.

**End-to-End (Service) Test**
1. Start services with `bash scripts/dev.sh`.
2. Open the frontend at `http://localhost:5173`.
3. First turn:
   - Enter a prompt and submit.
   - Verify the assistant renders outfit cards inline.
4. Wishlist:
   - Click the heart icon on an outfit card.
   - Open the Wishlist panel and confirm the outfit appears.
   - Refresh the page; the wishlist should persist.
5. Follow-up:
   - Send a follow-up prompt (e.g., “make it more formal”).
   - Verify new outfits reflect refinement (conversation context is sent on turn 2+).
6. Image uploads:
   - Attach an image and submit.
   - Verify the outfit card image strip includes the uploaded image.

**Troubleshooting**
1. Backend health: `GET /health` should return `{ "status": "ok" }`.
2. If `tests/step*.html` cannot reach the API, confirm `bash scripts/dev.sh` is running.
