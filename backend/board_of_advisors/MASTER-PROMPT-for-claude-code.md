# MASTER PROMPT — paste this into Claude Code (run it from your project root)

> Copy everything inside the fenced block below into Claude Code. It assumes the `board_of_advisors/` folder from this package has been copied into your repo root (or tell Claude Code where you put it). It is written to make Claude Code READ your existing code and match it — not invent a new stack.

```
You are adding an "AI Board of Advisors" feature to my existing multifamily underwriting web app. Follow these instructions exactly. Do NOT hardcode anything (no deal data, no API keys, no advisor lists baked into code). When you create a new file, write the whole file. Match my existing code style, framework, and patterns — discover them first, don't assume.

=== CONTEXT: WHAT MY APP ALREADY IS ===
- Frontend: React (Create React App). The base API URL is `process.env.REACT_APP_API_URL || "http://localhost:8010"`.
- The real underwriting flow is the V2 underwriter: an upload/parse/verify wizard that ends on a results page component `ResultsPageV2` (search the repo for `ResultsPageV2`). That component receives props including `dealId`, `scenarioData`, and `calculations`. `calculations.fullAnalysis` is the output of `calculateFullAnalysis(scenarioData)` (find it in a file like `utils/realEstateCalculations`). `scenarioData` contains: property, pricing_financing, pnl, expenses, financing, unit_mix, underwriting, income_details.
- Backend: FastAPI (errors returned as `{ "detail": ... }`, dev port 8010). It ALREADY calls LLMs server-side. Find these existing routes and study them before writing anything: `POST /v2/deals/{deal_id}/chat` (loads a deal by id and calls an LLM), the financial-audit endpoint used for Due Diligence, and `/api/claude-chat/draft`. Note which LLM client(s) they use, how the API key is read (env var), how a deal is loaded by id, and how routes/routers are registered.

=== STEP 0: DISCOVER (do this first, report back before coding) ===
1. Locate and read: the FastAPI app entrypoint + router registration; the `/v2/deals/{deal_id}/chat` route; the financial-audit route; the LLM client wrapper(s) (OpenAI and/or Anthropic) and how the key comes from env; how a deal is loaded by `deal_id`.
2. Locate and read: `ResultsPageV2` and confirm exactly what deal data it has in scope (`scenarioData`, `calculations`/`calculations.fullAnalysis`, `dealId`), and where its action buttons / header live.
3. Read the files in `board_of_advisors/`: `board-deliberation-engine.md` (the spec you will implement) and `advisors/*.md` (8 persona files, each ends with a paste-ready SYSTEM PROMPT).
Report a short plan of the exact files you will add/edit, and which existing LLM client + deal-loader you will reuse. Then proceed.

=== STEP 1: PLACE THE BOARD CONTENT IN THE BACKEND ===
- Copy the `board_of_advisors/advisors/` markdown files and `board_of_advisors/board-deliberation-engine.md` into a backend-served location (e.g. `backend/board/advisors/` and `backend/board/`). The backend must READ these from disk at runtime — do not paste their text into code. This lets me edit/add/remove advisors by editing files, no redeploy of logic.

=== STEP 2: ADD THE BACKEND ENDPOINT ===
Add `POST /v2/deals/{deal_id}/board` (mirror the structure of the existing `/v2/deals/{deal_id}/chat` route: same router, same deal-loading, same LLM client + env key handling, same error style).
- Request body: `{ "scenarioData": {...}, "analysis": {...}, "mode": "single" | "multi" (optional), "maxAdvisors": number (optional) }`. If the client doesn't send `scenarioData`/`analysis`, fall back to loading the deal by `deal_id` the same way `/chat` does.
- Build a compact DEAL BRIEF from the REAL scenarioData + analysis only (purchase price, price/unit, units, market/submarket, going-in cap, exit/terminal cap, DSCR, min DSCR, debt yield, cash-on-cash, levered & unlevered IRR, equity multiple, expense ratio, breakeven occupancy, rent-growth & vacancy assumptions, LTV, interest-only years, hold period, loan amount, annual debt service, total equity). Any missing/zero field: include it in `meta.missingDealFields`; never fabricate a value.
- CONVENE 4–6 advisors using the selection heuristics in `board-deliberation-engine.md` (always include Sam Zell OR Joe Fairless as skeptic). Load the convened advisors' persona text from the `advisors/` files.
- Implement Mode A (single orchestrated LLM call) as the default, using the "Orchestrator Prompt" from `board-deliberation-engine.md` with the convened personas + DEAL BRIEF injected. Also implement Mode B (per-advisor calls using each file's paste-ready SYSTEM PROMPT, then a moderator synthesis call) behind the `mode` flag / an env default. Keep cost sane: default Mode A.
- Force structured output: the LLM must return ONLY the JSON object defined in `board-deliberation-engine.md` (§3). Parse it robustly; if parsing fails, retry once, then return a clean `detail` error. Attach `meta.disclaimer`.
- Reuse my existing model config (read model name + key from env exactly like the chat/audit routes; do NOT introduce a new hardcoded key or model string — if a new env var is needed, add it to `.env.example` and read it via the same config mechanism).

=== STEP 3: ADD THE FRONTEND BUTTON + PANEL ===
- Add a self-contained component `BoardOfAdvisors` (new file, written in full, matching my component style) that:
  - Renders a "Board of Advisors" button. Mount it on `ResultsPageV2` next to the existing actions/chat.
  - On click, POSTs to `${API_BASE}/v2/deals/${dealId}/board` with `{ scenarioData, analysis: calculations?.fullAnalysis ?? calculations }` from the props already in `ResultsPageV2` scope. No hardcoded deal values.
  - Shows a loading state while deliberating, and an error state on failure (read `detail`).
  - Renders the returned JSON as a readable panel/modal with sections in this order: Convened advisors (with reasons) → Opening Positions (advisor, color-coded lean, cited metrics) → Debate (round-by-round, "X challenges Y") → Pre-Mortem (18-month failure modes with likelihood + mitigant) → Synthesis (big recommendation, confidence, conditions, key risks) → Dissent (highlighted — this is the most important box) → the `meta.disclaimer` in small print.
- Match my existing UI (reuse existing styles/utility classes; don't add a new design system). Keep it responsive and readable.

=== STEP 4: CONFIG & SAFETY ===
- Add any new env var(s) to `.env.example` with comments. Never commit a real key.
- Guard the endpoint the same way other `/v2/deals` routes are guarded.
- If the deal is missing critical fields, still return a result but make the advisors flag the gaps (from `meta.missingDealFields`).

=== STEP 5: VERIFY ===
- Run the backend and frontend. From a real parsed deal on the results page, click the button and confirm: the request sends real scenarioData/analysis, the response matches the JSON schema, and every opening position cites a real number from the deal. Fix until it works end to end. Show me the final file list and the new endpoint's request/response.

=== HARD RULES (repeat) ===
- No hardcoded deal data, API keys, model names, or advisor text in code. Deal data comes from the request/loaded deal; advisors come from the `advisors/` files; keys/models come from env exactly like my existing routes.
- Reuse my existing LLM client and deal-loading code — do not spin up a parallel one.
- Write whole files when creating new ones; make minimal, clean edits when touching existing ones (`ResultsPageV2`, the router).
- If anything about my stack is ambiguous, inspect the code and match it — ask me only if you truly cannot determine it.
```
