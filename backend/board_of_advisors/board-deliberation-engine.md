# Board of Advisors — Deliberation Engine

This is the core "skill" that turns the 8 advisor personas into a working board. It defines the workflow (convene → opening positions → argumentation → pre-mortem → synthesis with preserved dissent), the exact JSON the backend must return, and two build modes. The `MASTER-PROMPT-for-claude-code.md` file tells Claude Code how to wire this into your site; this file is the specification it implements.

---

## 0. Inputs (what the engine receives)

The engine is called with the deal's **real** data — never demo/synthetic data. From your V2 underwriter (`UnderwriteV2Page` → `ResultsPageV2`) that means:

- `scenarioData` — the verified deal object: `property`, `pricing_financing`, `pnl`, `expenses`, `financing`, `unit_mix`, `underwriting`, `income_details`.
- `analysis` — the output of `calculateFullAnalysis(scenarioData)`: `year1` (noi, capRate, dscr, cashOnCash, expenseRatio, debtYield), `returns` (leveredIRR, unleveredIRR, leveredEquityMultiple, exitCapRate, minDSCR, exitScenarios), `projections` (10-yr), `financing` (loanAmount, ltv, interestRate, ioYears, annualDebtService, totalEquityRequired), `acquisition` (pricePerUnit, pricePerSF), `exit`, `sourcesAndUses`.

The engine must build a compact **Deal Brief** from these — only real fields. Any missing/zero field is stated explicitly and treated as a risk, never invented.

---

## 1. Convening (select the relevant advisors)

Do not always run all 8. Pick the 4–6 most relevant to *this* deal so the debate stays sharp, plus always include at least one skeptic. Selection heuristics:

- **Value-add / heavy renovation** (large reno budget, big rent-premium assumptions) → Ken McElroy, Joe Fairless, Michael Blank.
- **Floating-rate / bridge debt, short IO, thin DSCR** → Joe Fairless (rate-cap scars), Sam Zell (liquidity/debt discipline), Barry Sternlicht (rates/macro).
- **Aggressive leverage / long-hold cash-flow thesis** → Grant Cardone (for), balanced by Sam Zell + Joe Fairless (against).
- **Market/submarket or supply questions** → Neal Bawa (data/demographics), Barry Sternlicht (macro/supply).
- **Operations / expense-ratio / scale** → Robert Faith, Ken McElroy.
- **Exit-cap or reversion risk** → Joe Fairless, Sam Zell, Barry Sternlicht.
- **Creative financing / seller-carry / low-down / balloon terms** → Christian Osgood (for structuring), balanced by Joe Fairless or Sam Zell on refi/balloon risk.
- **Smaller deals, self-management, realistic operating expenses / buy-right basis** → The Lumberjack Landlord (Matt Hawkins), Ken McElroy.

Always convene **Sam Zell OR Joe Fairless** as the resident skeptic. State a one-line reason each advisor was convened.

The advisor roster and their reasoning live in the persona files under `advisors/`. Load them from disk — never hardcode the list in code.

---

## 2. The deliberation workflow

1. **Opening positions.** Each convened advisor gives their initial read using their persona (sections 3–8 and their 5 non-negotiable questions), citing the actual Deal Brief numbers. Each ends with a `lean` (INVEST / PASS / INVEST WITH CONDITIONS) and the metric(s) that drove it.
2. **Argumentation.** At least one round where advisors challenge each other by name — e.g., Zell pushes back on Cardone's leverage; Bawa questions whether the submarket supports the rent-growth assumption; Faith argues the operator can fix an expense ratio others call a dealbreaker. Surface genuine disagreement; do not manufacture false consensus.
3. **Pre-mortem (18-month failure simulation).** Assume it is 18 months post-close and the deal is in trouble. Each failure mode gets: `cause`, the specific deal `driver` (tie to a real metric — e.g., "exit cap held flat at going-in; rates rose 100bps"), a rough `likelihood`, and a `mitigant`. This is where hidden risk surfaces.
4. **Synthesis.** A moderator voice produces a single recommendation with a confidence level and explicit `conditions` (if conditional). It must **preserve dissent** — the strongest opposing view is quoted, not smoothed over, because that dissent is usually the real blind spot.

---

## 3. Required output JSON (what the frontend renders)

The endpoint must return exactly this shape:

```json
{
  "deal": { "name": "string", "address": "string", "units": 0, "purchasePrice": 0 },
  "convened": [
    { "advisor": "Sam Zell", "reason": "why this advisor was picked for this deal" }
  ],
  "openingPositions": [
    {
      "advisor": "Sam Zell",
      "lean": "PASS",
      "position": "2-4 sentence opening read, grounded in the deal metrics",
      "metricsCited": ["going-in cap 5.1%", "exit cap 5.0%", "DSCR 1.18x"]
    }
  ],
  "debate": [
    {
      "round": 1,
      "exchanges": [
        { "advisor": "Sam Zell", "challengesTo": "Grant Cardone", "argument": "..." }
      ]
    }
  ],
  "preMortem": {
    "horizonMonths": 18,
    "failureModes": [
      { "cause": "...", "driver": "exit cap flat + 100bps rate move", "likelihood": "medium", "mitigant": "..." }
    ]
  },
  "synthesis": {
    "recommendation": "INVEST | PASS | INVEST WITH CONDITIONS",
    "confidence": "low | medium | high",
    "rationale": "the reasoned bottom line, referencing the deal's real numbers",
    "conditions": ["only if exit cap is re-underwritten at >= going-in + 50bps", "..."],
    "keyRisks": ["the 1-3 risks that matter most"]
  },
  "dissent": [
    { "advisor": "Grant Cardone", "objection": "the strongest preserved counter-view", "whyItMatters": "..." }
  ],
  "meta": {
    "advisorsConsidered": 8,
    "advisorsConvened": 5,
    "missingDealFields": ["exit_cap_rate", "..."],
    "disclaimer": "These are AI models of publicly documented investment philosophies, not the real individuals, and are not investment advice."
  }
}
```

Every advisor position must cite at least one **real** number from the Deal Brief. If key fields are missing, list them in `meta.missingDealFields` and let advisors flag the gap.

---

## 4. Two build modes (pick per your backend/cost tolerance)

**Mode A — Single orchestrated call (default, cheapest, fastest).**
One LLM call. The system prompt = the Orchestrator Prompt below + the full persona text of each convened advisor + the Deal Brief. The model simulates the whole board and returns the JSON. Simplest to integrate into your existing single-call pattern (like `/v2/deals/{id}/chat`).

**Mode B — Multi-agent (most faithful, higher cost).**
- One LLM call per convened advisor for **opening positions**, each using that advisor's own paste-ready SYSTEM PROMPT (bottom of each persona file).
- One call per advisor for a **rebuttal** round (given the others' openings).
- One **moderator** call (Orchestrator Prompt, no persona) to run the pre-mortem + synthesis + assemble JSON.

Both modes return the identical JSON schema, so the frontend is unchanged either way. Make the mode a config/env flag; default to Mode A.

---

## 5. Orchestrator Prompt (paste-ready)

Use this as the system prompt in Mode A, or as the moderator call in Mode B. Inject the pieces marked `{{ ... }}` at runtime — never hardcode them.

```
You are the moderator of an AI "board of advisors" reviewing a MULTIFAMILY real-estate deal for an experienced investor. Your job is to run a rigorous, honest deliberation and return a single JSON object — nothing else.

You are given:
1) DEAL BRIEF — the deal's real underwriting metrics. Use ONLY these numbers. Never invent a figure. If a needed field is missing or zero, say so and treat it as a risk; add it to meta.missingDealFields.
2) BOARD — the personas of the convened advisors (each with philosophy, how they read a deal, strengths, blind spots, and their non-negotiable questions).

Run this process:
- CONVENING: For each advisor in BOARD, give a one-line reason they are relevant to THIS deal.
- OPENING POSITIONS: Each advisor states an initial read IN THEIR OWN VOICE and philosophy, citing specific Deal Brief numbers, ending with lean = INVEST | PASS | INVEST WITH CONDITIONS and the metric(s) that drove it. Advisors must genuinely differ where their philosophies differ — do NOT force agreement.
- ARGUMENTATION: At least one round where advisors challenge each other BY NAME on the deal's real numbers. Preserve real disagreement.
- PRE-MORTEM: Assume it is {{horizonMonths|18}} months after closing and the deal is in trouble. List the concrete ways it failed, each tied to a specific deal driver/metric, with a rough likelihood and a mitigant.
- SYNTHESIS: Produce ONE recommendation (INVEST | PASS | INVEST WITH CONDITIONS) with a confidence level, a rationale grounded in the real numbers, explicit conditions if conditional, and the 1-3 key risks.
- DISSENT: Quote the single strongest opposing view. Never smooth it away — dissent is where the blind spots hide.

Rules:
- Ground every claim in the DEAL BRIEF. No fabricated numbers, no fabricated quotes from the real people.
- Be direct. If the deal is bad, say so plainly. No hedging filler.
- Return ONLY the JSON object matching the schema you were given. No prose outside the JSON.

DEAL BRIEF:
{{deal_brief_json}}

BOARD:
{{convened_advisor_personas}}

Return the JSON now.
```

---

## 6. Guardrails

- **No hardcoded deal data.** The Deal Brief is always built from the live `scenarioData` + `calculateFullAnalysis` output passed at call time.
- **No hardcoded advisor content in code.** Personas are read from the `advisors/` files so you can edit/add/remove advisors without touching code.
- **No hardcoded API keys.** Reuse the same server-side LLM client and env-var key handling your existing routes use.
- **Every position cites a real metric.** If it can't, the data is missing — flag it, don't fabricate.
- **Disclaimer travels with the output** (`meta.disclaimer`) and should render in the UI: these are AI models of documented philosophies, not the real individuals, and not investment advice.
