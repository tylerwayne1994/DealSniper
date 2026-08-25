# AI Board of Advisors — Multifamily Deal Review

A ready-to-install "board of advisors" for your underwriting site. Eight iconic multifamily investors, each modeled as a source-cited persona, deliberate over a deal in your pipeline and hand back a recommendation with the dissent preserved.

## Claude Skill

The packaged Claude skill lives at `backend/board-of-advisors-skill-workflow.skill`.
It contains a separate, ready-to-run ten-advisor research workflow, including
market and syndication references. It is intended for Claude/agent deliberations;
the live DealSniper API continues to load the personas in this folder at runtime.
This separation keeps API behavior tied to the application's real deal data and
allows the skill package to evolve without changing production board responses.

## What's in this package

```
board_of_advisors/
├── README.md                          ← you are here
├── MASTER-PROMPT-for-claude-code.md   ← paste THIS into Claude Code to wire it into your site
├── board-deliberation-engine.md       ← the deliberation logic + required output JSON (the "skill")
└── advisors/                          ← one source-cited persona/prompt file per advisor
    ├── 01-sam-zell.md
    ├── 02-robert-faith.md
    ├── 03-grant-cardone.md
    ├── 04-ken-mcelroy.md
    ├── 05-joe-fairless.md
    ├── 06-neal-bawa.md
    ├── 07-barry-sternlicht.md
    ├── 08-michael-blank.md
    ├── 09-christian-osgood.md
    └── 10-lumberjack-landlord.md
```

## The board

| # | Advisor | Lens they bring | Sources |
|---|---------|-----------------|---------|
| 1 | Sam Zell | Contrarian, cycle-timing, liquidity & debt discipline (Equity Residential). Modeled from public record; he passed in 2023. | 8 |
| 2 | Robert Faith | Operations & scale (Greystar, world's largest apartment operator). | 8 |
| 3 | Grant Cardone | Aggressive leverage, long-hold cash flow (Cardone Capital). Includes the criticisms. | 10 |
| 4 | Ken McElroy | Hands-on value-add, conservative fixed-rate debt (MC Companies). | 9 |
| 5 | Joe Fairless | Stress-tested value-add syndication; rate-cap scars (Ashcroft Capital). | 8 |
| 6 | Neal Bawa | Data/demographics-driven market & submarket selection. | 8 |
| 7 | Barry Sternlicht | Macro, rates, replacement cost, capital markets (Starwood). | 8 |
| 8 | Michael Blank | Syndication economics & investor-return discipline (Nighthawk). | 9 |
| 9 | Christian Osgood | Creative financing / seller-carry deal structuring (Multifamily Strategy). | 8 |
| 10 | The Lumberjack Landlord (Matt Hawkins) | Hands-on, cash-flow-first, self-managing small-multifamily operator (New Hampshire). | 7 |

Each file has the same shape: snapshot, sourced track record, philosophy, **how they read a deal mapped to your app's actual metrics**, risk approach, frameworks, strengths, blind spots, voice, their 5 non-negotiable questions, sources, and a **paste-ready system prompt** at the bottom.

## How to install it (the short version)

1. Copy this whole `board_of_advisors/` folder into your project repo (root is fine).
2. Open Claude Code in that repo.
3. Paste the contents of `MASTER-PROMPT-for-claude-code.md` into Claude Code and let it run. It will inspect your real backend (the FastAPI `/v2/deals/{id}/chat` + financial-audit routes), match your existing LLM client and env-based key handling, add a `POST /v2/deals/{id}/board` endpoint, and drop a "Board of Advisors" button onto `ResultsPageV2`.
4. Click the button on a real deal. The board convenes, debates, runs an 18-month pre-mortem, and returns a recommendation with dissent.

## How it works

When you click the button, the site sends the deal's **real** numbers (`scenarioData` + the `calculateFullAnalysis` output) to the backend. The engine picks the 4–6 most relevant advisors for that specific deal, has them state opening positions, argue with each other by name, run a pre-mortem ("it's 18 months later and this failed — why?"), and synthesize a single recommendation while quoting the strongest opposing view. Everything is grounded in the actual deal metrics — see `board-deliberation-engine.md` for the exact workflow and output JSON.

## Ground rules baked in

- **No hardcoding.** Deal data comes from the live deal; advisor content is read from these files at runtime; the API key/model come from your existing env config. Edit an advisor = edit a file, no code change.
- **No fabricated data or quotes.** Every advisor position must cite a real number from the deal; missing fields are flagged, not invented. Personas reason in each investor's *documented* style — they are AI models of public philosophy, not the real people, and not investment advice. That disclaimer travels in the output.

## Swapping advisors

Don't like one of the eight? Delete or edit that file in `advisors/`, or add a new one following the same structure (copy an existing file as the template). The convening logic reads whatever files are in the folder — no code change needed. Want me to research and write a replacement persona for someone specific, just say the name.
