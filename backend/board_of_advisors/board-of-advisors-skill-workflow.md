> **Status note (added when this file was dropped into the project):** DealSniper's Board of
> Advisors is already fully built and live — see `board-deliberation-engine.md`, `advisors/*.md`,
> and the runtime implementation in `backend/board_of_advisors_engine.py`
> (`POST /v2/deals/{deal_id}/board` + `/board/chat`). Our implementation already runs all 7
> deliberation stages this workflow calls for — Convene → Read → Opening Positions → The
> Argument → (Creative Structuring) → Mandatory Pre-Mortem → Synthesis → Dissent on Record —
> as ONE orchestrated Claude API call per deliberation (`ORCHESTRATOR_SYSTEM_PROMPT` in
> `board_of_advisors_engine.py`), not via Claude Code sub-agent spawning as described below.
>
> This file is kept as **reference methodology** for one specific future use case: adding a
> NEW advisor to the board (see "Prompt 5 — Add a New Board Member" below). When that's asked
> for, the workflow here — deep-research a real practitioner's philosophy/risk framework/quotes,
> write a sourced dossier in the same shape as the existing `advisors/*.md` files, add them to
> `ADVISOR_SELECTION_KEYWORDS` and `select_advisors()` in `board_of_advisors_engine.py` — is the
> process to follow, minus the sub-agent-spawning step (do the research directly instead).

---

# Board of Advisors Skill Workflow

Research the 10 greatest minds in your CRE niche using Claude sub-agents.
Package their philosophies, risk frameworks, and quote-rich profiles into a
deliberation skill that argues through your decisions — with opening positions,
argument, mandatory pre-mortem, and final recommendation with dissent preserved.

## The Core Idea

You can't afford Warren Buffett as an advisor. But you can study him deeply enough
that Claude can reason in his framework when you ask a question. This workflow does
that for the 10 greatest practitioners in your specific CRE niche — retail,
industrial, multifamily, brokerage, whatever you do.

The result: a board that deliberates with you on any decision. The bull argues.
The risk manager cautions. The operator asks about local knowledge. The synthesis
preserves the winning recommendation AND the legitimate dissent.

---

## Required Inputs

Before running, confirm:
- [ ] Claude Code Desktop active — sub-agent spawning requires Code (not Chat)
- [ ] Your specific CRE niche defined precisely: "retail REIT investing" is better than "real estate"
- [ ] Decide: living advisors only, or all-time iconic (deceased and retired included — all-time recommended for more depth)
- [ ] Decide: strict niche definition or allow adjacent expertise

---

## Processing Pipeline

### Step 1: Define Your Niche and Get the Board Roster

```
I want to build a board of advisors for myself. My focus is {{SPECIFIC CRE NICHE}}.
Who are the top 10 greatest practitioners, investors, and thinkers in this space —
going back 50 years? Include iconic historical figures even if deceased or retired.
Keep it strictly within {{NICHE}} — not adjacent fields.

Ask me questions before finalizing the roster.
```

### Step 2: Spawn 10 Sub-Agents for Deep Research

```
My goal is to ultimately create a board of advisors skill where these people
deliberate on my decisions. Before we build the skill, I need very comprehensive
research on each individual.

Spawn sub-agents — one per person — to do the deepest possible research on each
of these 10 individuals. For each person I want to understand:
- Investment philosophy and framework
- How they think about risk
- Strengths and weaknesses as an investor/operator
- Famous quotes and documented stances
- Signature deals and what they reveal about their thinking
- What they would argue FOR in a deliberation
- What they would argue AGAINST
- What they would always want to know before making a decision

Write a full dossier for each person. Come back after all 10 are complete.
```

### Step 3: Review the Consolidated Research

Review the consolidated readout, paying attention to the tension points and opposing
viewpoints identified — that tension is what makes a deliberation worth running.

### Step 4: Build (or extend) the Board Skill

```
Now let's build the board of advisors skill. The board should deliberate with one
another, argue, collaborate, and share ideas — with the sole intention of coming up
with the best possible answer grounded in data and the experience encoded in their
dossiers. Ask me questions before getting started.
```

### Step 5: The 7-Stage Deliberation Flow

1. **Convene** — identify the question and which 3-5 board members are most relevant
2. **Read** — load the relevant dossier sections for the selected advisors
3. **Opening Positions** — each selected advisor states their initial lean and why
4. **The Argument** — advisors challenge each other directly, in voice
5. **Mandatory Pre-Mortem** — "It's 18 months later and this blew up. Walk us through how."
6. **Synthesis** — board convener synthesizes the most defensible recommendation
7. **Dissent on Record** — any advisor who disagrees with the final recommendation is quoted

### Step 6: Trigger the Skill on a Real Decision

```
Board convene — I'm considering a shopping center acquisition in Phoenix, Arizona.
This is a market I've never operated in. How should I be thinking about this?
```

---

## Prompt Templates

### Prompt 5 — Add a New Board Member
```
Add {{PERSON NAME}} to the board. Spawn a sub-agent to research them with the
same depth as the existing members. Update the skill to include their profile
and voice in future deliberations.
```

### Prompt 6 — Focused Deliberation Mode
```
Board convene, quick mode — {{BRIEF QUESTION}}. I just want the key tensions
and final recommendation, not the full argument.
```

---

## Tips & Common Mistakes

**DO:**
- Define your niche as precisely as possible — "retail REIT investing" beats "commercial real estate"
- Include deceased and retired icons — they often have the richest documented philosophies
- Test the board on a real decision you're actually chewing on — dummy questions produce weaker output
- Preserve dissent in the final output — the minority view is often the risk flag you need

**DON'T:**
- Don't rush the research phase — the quality of the dossiers is the quality of the deliberation
- Don't build a generic board of "smart investors" — specificity to your niche is what makes it useful
- Don't accept a board that all agrees — if there's no tension built into the roster, rebuild it with more opposing worldviews
- Don't skip the pre-mortem step — it's the most valuable moment in the deliberation

---

## Use Cases by Role and Niche

| Role / Niche | Board Examples |
|---|---|
| 💰 Retail CRE Investor | DeBartolo Sr., Milton Cooper, David Simon, Rick Caruso, Buxbaum family |
| 💰 Multifamily Investor | Sam Zell, Ken McElroy, real legends in your market |
| 🏗️ Ground-Up Developer | Board of greatest residential and commercial developers of the last 50 years |
| 🏢 Investment Sales Broker | Board of the most influential dealmakers and capital markets minds in your asset class |
| 📊 Asset Manager | Board focused on operational excellence, portfolio construction, and exit timing |
