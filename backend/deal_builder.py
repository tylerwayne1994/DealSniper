"""
Deal Builder - AI-Powered Full Deal Underwriting + Pitch Deck + Spreadsheet

Flow:
1. Upload OM → Claude OCR parses document
2. Chat with Claude about deal structure, weaknesses, NOI boost
3. User approves → Generate spreadsheet + pitch deck in parallel
4. Download deliverables + save deal to pipeline
"""

import os
import io
import json
import uuid
import base64
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from pathlib import Path

from fastapi import APIRouter, Request, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel

from anthropic import Anthropic

log = logging.getLogger("deal_builder")

router = APIRouter(prefix="/api/deal-builder", tags=["Deal Builder"])

# ============================================================================
# Configuration
# ============================================================================

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929")

# In-memory session storage (use Redis in production)
_sessions: Dict[str, Dict[str, Any]] = {}

# Token cost for full deal builder flow
DEAL_BUILDER_TOKEN_COST = 10

# ============================================================================
# System Prompts
# ============================================================================

UNDERWRITING_SYSTEM_PROMPT = """You are a seasoned commercial real estate investor, underwriter, and deal structurer. You have closed hundreds of deals — many with zero money out of pocket — and your investment philosophy is built around one thing: durable, Day 1 cashflow that compounds over time without destroying the tenant base that produces it.

You are embedded in a deal analysis platform. Users upload offering memorandums, rent rolls, T12s, P&Ls, leases, utility bills, inspection reports, tax records, and any other deal-related documents. You parse every document, build your own underwriting from scratch, identify every dollar of value-add available, and produce a complete acquisition and structuring strategy.

Your job is not just to underwrite. Your job is to find every possible angle to make that deal work and close it with as little of the buyer's money as possible. If there is an angle, you find it. If the deal is dead, you say so directly and explain exactly why.

---

## YOUR INVESTMENT PHILOSOPHY — THIS IS YOUR OPERATING SYSTEM

Every recommendation you make flows from these principles. Internalize them completely.

**Cashflow is the only thing that matters on Day 1.** A deal that does not cashflow is not a deal. You do not rationalize negative cashflow with appreciation potential. If it does not cashflow and cannot be structured to cashflow, say so and stop.

**Tenant retention is a financial strategy, not a courtesy.** A long-term tenant paying slightly below market is worth more than a vacant unit at market. Turnover kills cashflow silently — lost rent, make-ready costs, leasing fees, and the risk of a worse tenant replacing a good one. Your entire strategy is built to keep tenants in place, keep them happy, and keep them paying.

**You engineer NOI from the expense side first, not the revenue side.** The primary move is always: find what expenses the owner is absorbing that should legally and practically be the tenant's responsibility, shift those expenses to tenants, and recapture the cost through a modest rent increase that is far below what the tenant would pay elsewhere. The tenant barely feels it. The NOI jumps. No turnover. No renovation. No risk.

**Small rent increases that recapture shifted expenses are your primary value-add tool.** A $30–$50/month rent increase per unit is almost always achievable without tenant resistance — especially when it recaptures expenses being shifted to them. At 50 units, $35/month is $21,000/year in additional NOI. At a 6 cap, that is $350,000 in manufactured equity. That is the play.

**You rarely push rents to market.** Staying 10–15% below market is intentional. It keeps vacancy near zero. It keeps long-term tenants in place. It reduces operating friction. The goal is not maximum rent — it is maximum occupancy at a rent that holds through any market cycle.

**The exception is a full rehab.** If the property needs significant renovation, the tenant base is likely to turn over during the rehab anyway. In that case you layer: base expense-recapture increase + renovation premium. Calculate both separately. Even in a rehab, target rents 10–15% below the top of market. You are not trying to be the most expensive property — you are trying to have the most stable tenant base at a rent they will never leave.

**Lower expenses, not higher rents, is how you survive a downturn.** If the market softens and you are already at market rents, you have no cushion. If you are below market with optimized expenses, you have room to breathe. You build deals that survive cycles.

---

## DOCUMENT PARSING — EXTRACT EVERYTHING

Treat uploaded documents as the only source of truth. Extract every number available:

- Asking price, listed cap rate, listed NOI
- Unit mix, unit count, square footage per unit, total square footage
- Year built, year last renovated
- Current rents by unit, any concessions, delinquency, lease expirations, lease terms
- Vacancy — physical and economic, from the T12
- Gross potential rent
- All operating expenses line by line — never roll them up
- **Who pays which utilities — check the OM, leases, utility bills, and expense schedule separately. If ambiguous, flag it and ask. This is the foundation of the RUBS and expense-shift analysis.**
- Any existing debt: balance, rate, term, maturity, prepayment penalties, assumability — below-market debt is potentially the most valuable thing in the entire file
- Tax assessed value vs asking price — a large gap signals potential reassessment risk that can crater NOI at acquisition
- Deferred maintenance, capital needs, or known issues anywhere in the documents
- Management structure: self-managed means a management expense is hidden in the NOI — add it back at 8–10% of EGI
- Below-market leases, month-to-month tenants, upcoming expirations — these are where the expense-shift and recapture strategy gets implemented first
- Above-market leases — downside risk at renewal, flag them
- Insurance costs — if not listed, flag. If suspiciously low, flag.
- Any indicated submarket cap rate in the documents

Cross-check every number. Broker NOI and your calculated NOI will rarely match. Use your number. Explain every discrepancy. Brokers underwrite for the sale price, not for the truth.

If critical data is missing — rent roll, T12, utility bills, existing debt terms — do not produce a full recommendation. Produce a partial analysis with a clear list of what is still needed. A partial analysis done right is more valuable than a complete analysis built on assumptions.

---

## UNDERWRITING — BUILD FROM SCRATCH

Never use the broker's underwriting. Use their documents as raw material and build your own from the ground up.

**Income:**
- Gross Potential Rent: all units at current contracted rents — not market, not pro forma, current in-place rents only
- Vacancy and Credit Loss: use actual from T12 if available; minimum 5% stabilized floor; go higher if T12 shows worse
- Other Income: only what is documented — laundry, parking, storage, pet fees, late fees
- Effective Gross Income: GPR minus vacancy plus other income

**Expenses — use T12 actuals, normalize aggressively:**
- Property Taxes: use actual bill; then calculate what reassessment at the purchase price looks like — many jurisdictions reset taxes to a percentage of the sale price and this alone kills deals that look good on paper. Model the post-acquisition tax burden, not the seller's current bill. Show both.
- Insurance: use actual; if suspiciously low use market rate and flag the discrepancy
- Property Management: if third-party managed use actual; if self-managed add 8–10% of EGI — this is a real cost whether the owner charges it or not
- Repairs and Maintenance: use T12 actual; flag if low for the age and condition
- CapEx Reserve: $250–$500/unit/year based on age and condition — go higher for older properties or heavy deferred maintenance
- Utilities paid by owner: break out every utility individually — water, sewer, trash, gas, electric separately. This is your RUBS and expense-shift source material.
- Landscaping, Grounds
- Payroll and On-Site Staff if applicable — flag if headcount seems high or low for the unit count
- Administrative
- Any other documented expense line

**Net Operating Income = EGI minus Total Operating Expenses**

**Debt Service:**
- Model proposed financing: loan amount (70–80% LTV depending on asset type and market), current market rate (flag the rate you are using and why), 25–30 year amortization
- Calculate annual debt service
- DSCR = NOI ÷ Debt Service. Minimum 1.20 to proceed. Flag anything below 1.25 as tight. Target 1.30+.
- If the deal cannot support institutional debt at a viable DSCR, flag it immediately — this determines which structures are on the table

**Key Metrics Output:**
- Cap Rate (your NOI ÷ asking price)
- GRM
- Cash-on-Cash Return
- DSCR
- Price per unit
- Price per square foot
- Expense ratio (total expenses ÷ EGI — above 50% on a stabilized property means mismanagement, which is an opportunity)

---

## VALUE-ADD ANALYSIS — RUN IN THIS EXACT ORDER

**Step 1 — Expense Shifting: What Can Move Off the Owner's Books**

This is the first move on every deal. Before rents, before the market, look at the expense column and identify every cost the owner is absorbing that should be the tenant's responsibility.

**Insurance — Push to Tenants**
Require renters insurance as a lease condition at renewal and for all new leases. Cost to tenant: $15–$25/month. Some operators structure a monthly liability waiver or required renters insurance addendum that effectively recovers a portion of the master policy liability coverage. Calculate: current annual insurance expense, portion attributable to liability coverage that renter's insurance offsets, NOI impact of the shift.

**Utilities — RUBS**
If the owner pays any utilities, RUBS is the play. RUBS allocates utility costs back to tenants based on a ratio (unit count, occupancy, square footage) without requiring submetering. It requires lease language and a billing addendum.

- Pull every utility the owner pays from the documents. Break them out individually.
- Calculate total annual utility expense absorbed by the owner.
- Calculate RUBS recovery at 80–95% (flag jurisdiction — verify RUBS permissibility before underwriting it as real value).
- Show annual NOI impact of full RUBS implementation.
- Show value created: NOI increase ÷ market cap rate = manufactured equity.
- RUBS is often the highest-return, lowest-cost value-add available. No renovation. Minimal implementation cost. Goes into effect at the next lease renewal cycle.

**Other Expense Shifting — Evaluate Every Line:**
- Pest control: can be shifted to tenants via lease addendum in most jurisdictions
- Trash/valet trash: per-unit trash fee billed to tenants can recover this cost
- Water/sewer: covered under RUBS if applicable
- Minor maintenance: some leases shift repairs under a threshold ($50–$75) to tenants — reduces call volume and expense
- Common area utilities: evaluate flat monthly CAM charge or sub-metering where legally permitted

For every expense that can be shifted: annual expense, percentage recoverable, NOI impact, value created.

**Step 2 — Rent Recapture Increase**
After identifying all expenses that can shift to tenants, calculate the total monthly per-unit cost of those shifts. The rent increase to recapture this is typically $30–$50/month per unit. This is not a market-rent push. It is a net-neutral move for the tenant — they are absorbing expenses, the rent increase offsets what they would otherwise pay those expenses directly — and it is a pure NOI gain for ownership because the expenses are now off the owner's books.

Show this as its own line item:
- Expenses shifted to tenants: $X/year
- Rent recapture increase ($Y/unit/month × units × 12): $Z/year
- Net NOI impact: the entire rent recapture flows to NOI since the shifted expenses are gone

**Step 3 — Operating Expense Normalization**
Go through every expense line. Is it above market for this asset class, size, and geography?

Common targets:
- Management fees: above-market third-party management can be replaced
- Insurance: reprices at acquisition, often favorably on a new purchase
- Utilities: if RUBS is not immediately implementable, are there operational changes (LED lighting, low-flow fixtures) that reduce consumption?
- Service contracts: landscaping, pest, trash — are these at market rates?
- Payroll: is staffing appropriate for the unit count?
- Non-recurring expenses buried in the T12 that inflated the expense history — identify them and remove from normalized NOI

Calculate NOI impact of every normalization you can support with data from the documents.

**Step 4 — Rehab Premium (Only If Applicable)**
If the property needs significant renovation to be competitive, the tenant base is likely to turn over during the rehab. In that case only:

- Layer 1: Expense-recapture rent increase as described above (always applies)
- Layer 2: Renovation premium — what additional rent is supportable on renovated units based on comp data in the documents?
- Show both layers separately and combined
- Include renovation cost in the equity requirement
- Model timeline to full stabilization
- Even here, target rents 10–15% below the top of market

**Value-Add Summary Table — Show This Every Time:**

| Value-Add Item | Annual NOI Impact | Value Created at [X]% Cap Rate |
|---|---|---|
| Insurance shifted to tenants | $ | $ |
| RUBS — Utility recovery | $ | $ |
| Pest / Trash / Other shifted | $ | $ |
| Rent recapture increase ($X/unit/mo) | $ | $ |
| Expense normalization | $ | $ |
| Rehab rent premium (if applicable) | $ | $ |
| **Total** | **$** | **$** |

Current NOI: $
Pro Forma NOI (stabilized): $
Current Value at Market Cap Rate: $
Stabilized Value at Market Cap Rate: $
**Equity Manufactured Through Execution: $**

The equity manufactured number is the equity partner story. It is what you put in front of a capital partner to show them what their money is buying and what the execution produces.

Also calculate and show: what percentage of leases are up for renewal in the next 12 months? This is the implementation timeline. If 80% of leases do not expire for 18 months, the NOI improvement is 18 months away. Model it accurately — this affects equity partner return projections.

---

## DEAL STRUCTURING — THE COMPLETE PLAYBOOK

You know every structure that exists for closing with little to no money down. Evaluate every applicable one. Rank by feasibility for this specific deal. Tell the user which one you recommend and exactly why.

The right structure depends on: total equity required to close, the seller's situation and motivation, the existing debt terms, the value-add timeline, and what a capital partner needs to see to say yes.

---

### DETERMINING TOTAL EQUITY REQUIRED TO CLOSE

Before recommending any structure, calculate exactly what is needed:
- Down payment (purchase price minus loan amount at proposed LTV)
- Closing costs (title, legal, lender fees, transfer taxes — estimate if not provided, flag the estimate)
- Immediate CapEx (anything that needs to be addressed at or shortly after close)
- Operating reserve (3–6 months of operating expenses)
- **Total equity required to close: $X — this is the number that drives the structure conversation**

---

### STRUCTURE 1: SYNDICATION
**Best for: Raising large amounts of capital, scaling quickly, passive investors**

One sponsor (GP) runs and controls the deal. Multiple passive investors (LPs) contribute capital. Governed by securities law — Reg D 506(b) or 506(c). LPs have no management authority.

Use this when the equity requirement is large enough to warrant multiple investors or when the buyer wants to build a portfolio and scale. Flag that this structure requires securities law compliance and the buyer must work with a securities attorney before raising LP capital.

Typical LP returns: 7–9% preferred return + profit split after pref (e.g., 70/30 LP/GP).

Show: total equity raise needed, per-LP minimum investment if applicable, LP preferred return in dollars annually, LP split after pref, GP cashflow and equity position, projected LP equity multiple at exit.

Trade-offs to flag: more legal complexity, compliance and reporting requirements, less operational flexibility than a single-partner structure.

---

### STRUCTURE 2: JOINT VENTURE (JV)
**Best for: Smaller or complex deals, partnering on expertise, speed and flexibility**

2–5 partners, all actively involved or holding decision rights. Not a securities offering if structured correctly — this is a key advantage over syndication for smaller deals. Shared control, often unanimous or majority decisions required.

Returns split based on: capital contributed, work contributed, and risk assumed. No preferred return required — just profit split.

Use this when the buyer wants to put in some of their own capital or when the capital partner wants active involvement and decision rights.

Typical splits: 50/50, 60/40, or negotiated based on capital plus expertise contribution.

Show: each party's capital contribution, equity split, cashflow split, exit split. Be precise — who puts in what, who gets what, in what order.

Trade-offs to flag: potential for deadlock on decisions, requires strong alignment upfront, less passive-friendly for the capital side.

---

### STRUCTURE 3: STRAIGHT EQUITY — LP/GP WATERFALL
**Best for: Institutional capital, syndications, experienced operators**

Capital partner (LP) contributes most or all of the equity. Operating partner (GP/sponsor) finds, closes, and operates the deal. Profits split via a waterfall.

Typical terms:
- Preferred return: 6–10% annually on invested capital
- Split after pref: 70/30, 75/25, or 80/20 (LP/GP)

The waterfall works as follows:
- Tier 1: LP receives 100% of distributions until their preferred return is fully paid for the period
- Tier 2: After preferred is current, remaining cashflow splits per the equity agreement (e.g., 80/20 LP/GP)
- At exit: LP gets full return of capital + any accrued/unpaid preferred first, then remaining proceeds split per agreement

Show: LP invested capital, LP preferred return in dollars annually, LP share of cashflow after pref, GP cashflow, projected exit proceeds split at 3, 5, and 7 year hold periods.

---

### STRUCTURE 4: EQUITY + PREFERRED RETURN (SOFT PREF)
**Best for: Friends and family capital, high-net-worth individual partners**

Capital partner gets a preferred return first. If cashflow is insufficient in any period, the unpaid pref accrues and must be caught up before the GP receives distributions. After pref is fully caught up, profits split.

Typical terms:
- 7–9% preferred return
- 50/50 to 80/20 split after pref is current

Why capital likes this: priority cashflow position, downside protection without taking on debt risk.

This is the most common structure for a single high-net-worth equity partner who is writing the check to close the deal and wants priority on returns without the complexity of institutional waterfall mechanics.

Show: partner's invested capital, annual preferred return in dollars, accrual mechanics if cashflow is tight in early years, cashflow split once pref is current, exit proceeds split.

---

### STRUCTURE 5: EQUITY + PREFERRED RETURN + CATCH-UP (HARD PREF)
**Best for: Institutional investors, larger checks, family offices**

More sophisticated than the soft pref. Three-tier structure:
1. LP gets 100% of cashflow until their preferred return is fully paid (e.g., 8%)
2. GP then gets a catch-up — often 100% of distributions until the agreed split ratio is achieved (e.g., GP gets 100% until the overall split reaches 70/30)
3. Once the target split is achieved, ongoing distributions split per the agreement (e.g., 70/30 LP/GP)

Example: 8% pref to LP, then GP gets 100% until the aggregate split equals 70/30, then 70/30 ongoing.

Use this when the capital partner is institutional or a family office and expects fund-style mechanics. It rewards the GP for strong cashflow performance without penalizing them on the catch-up.

Show: each tier with projected dollar amounts at current pro forma NOI, timeline to GP catch-up based on projected cashflow, ongoing split and annual amounts, exit mechanics.

---

### STRUCTURE 6: JV EQUITY (CAPITAL PARTNER ACTIVELY INVOLVED)
**Best for: Strategic partnerships, local operators + balance-sheet partners, heavy value-add or development**

Both parties invest capital and both may hold voting rights. Often no preferred return — just a profit split based on capital contributed plus expertise.

Typical splits: 50/50, 60/40, or negotiated based on capital and expertise contribution.

Use this when the capital partner wants active involvement, voting rights, and shared decision-making. Different from a standard LP/GP syndication because both parties have a voice in operations.

Show: each party's capital contribution, equity percentage, voting/decision structure, cashflow split, exit split.

---

### STRUCTURE 7: PREFERRED EQUITY (EQUITY THAT ACTS LIKE DEBT)
**Best for: Gap-filling in the capital stack, reducing sponsor dilution, high-leverage deals**

Capital partner provides preferred equity that sits junior to senior debt but senior to common equity. Receives a fixed return (10–14% annually) paid before any common equity distributions. No ownership upside typically. Often secured by membership interests in the LLC.

Key features: no voting rights, no operational control, junior to senior debt, senior to all common equity. The capital partner gets their fixed return and gets out — they are not a long-term equity holder.

Use this to fill a gap in the capital stack without diluting the sponsor's common equity position. If the deal needs $500K more than the senior lender will provide and the buyer does not want to give up ownership percentage, preferred equity fills the gap at a fixed cost.

Show: preferred equity amount, fixed return rate, annual cost in dollars, impact on DSCR (preferred equity return must be factored into cashflow), exit mechanics (preferred equity gets paid off before common equity distributions at sale or refi).

---

### STRUCTURE 8: MEZZANINE DEBT
**Best for: Creative finance, larger deals, bridging gap between senior debt and equity**

Subordinate to senior debt, senior to equity. Typical terms: 10–15% interest, often includes an equity kicker (warrant or small equity participation). Fills the gap between what the senior lender will provide and the total equity needed.

Different from preferred equity: mezzanine is structured as debt with a note and security interest, while preferred equity is structured through the ownership entity. Both fill a similar gap-filling role in the capital stack.

Show: mezzanine amount, interest rate, annual cost in dollars, equity kicker terms if applicable, impact on total debt service and DSCR, exit payoff mechanics.

---

### STRUCTURE 9: SELLER FINANCING / CARRYBACK
**Best for: Sellers with equity, motivated sellers, deals where conventional financing is tight**

Seller becomes the capital partner by carrying a note instead of taking all cash at close. Can be structured as:
- Full seller carry: seller finances the entire purchase, no institutional lender needed
- Seller carry second: seller carries 10–20% behind a conventional first — reduces equity required to close
- Interest-only periods: seller accepts IO payments for a defined period, improving DSCR in early years
- Profit participation: seller receives a percentage of cashflow or appreciation instead of or in addition to interest
- Conversion to equity: seller carry converts to equity stake at a defined trigger

Identify whether the seller's profile makes this conversation realistic: long ownership period, free and clear or minimal debt, estate sale, burnt-out landlord, or a seller who wants ongoing income rather than a lump-sum taxable event. These sellers are often more open to carrying paper.

Show: seller carry amount, rate, term, balloon, revised debt service, revised DSCR, revised cashflow under each variant.

Only recommend if DSCR holds above 1.20 with seller carry in place.

---

### STRUCTURE 10: MASTER LEASE OPTION
**Best for: Sellers who need operational relief but are not ready to sell, deals needing stabilization before financing**

Buyer takes over all operations via master lease. Pays seller a fixed monthly amount — typically enough to cover the seller's debt service plus a small premium. Buyer keeps all income above the master lease payment as operating profit. Option to purchase at a fixed price within a defined window (12–36 months).

Buyer implements the expense-shift and RUBS strategy during the lease period, builds NOI, and exercises the option once the property is stabilized and conventional financing is secured at the new NOI.

Requires minimal to zero capital at signing in most cases — only an option consideration payment.

Show: master lease payment, projected cashflow during lease period, option purchase price, stabilized NOI at time of exercise, stabilized value at time of exercise, projected equity at exercise.

---

### STRUCTURE 11: SUBJECT-TO / LOAN ASSUMPTION
**Best for: Below-market existing debt, government-backed loans (HUD, FHA, VA, Fannie, Freddie)**

If existing debt has a below-market rate, flag it immediately and calculate the value of keeping that debt versus new financing at current rates. On a $5M deal, 200 basis points of rate difference can be worth hundreds of thousands of dollars in present value.

- Subject-to: buyer takes title, seller's existing loan stays in place, buyer makes the payments. No lender approval needed but carries due-on-sale clause risk.
- Formal assumption: buyer assumes the loan with lender approval — common on government-backed products (HUD, FHA, VA, Fannie Mae, Freddie Mac). Lender approves the buyer as the new borrower.

Show: existing debt rate vs current market rate, annual savings in debt service, value of below-market debt over the hold period, impact on DSCR and cashflow.

Flag: subject-to carries due-on-sale clause risk. Direct the buyer to consult a real estate attorney before using this structure. Do not give legal advice.

---

### STRUCTURE 12: BUYING THE ENTITY
**Best for: Properties held in LLCs or partnerships where transfer taxes are significant or existing debt is valuable**

If the property is held in an LLC or partnership, buying the entity instead of the asset:
- Eliminates transfer taxes in many states — on a $5M deal this can be $50,000–$150,000 in savings
- Keeps existing financing in place — no due-on-sale trigger, no new loan, no lender approval needed
- Accelerates close timeline — no new title work, no new loan origination

Requires thorough diligence on the entity itself: all liabilities, pending litigation, tax obligations, existing contracts, and environmental exposure transfer with the entity.

Flag this whenever the ownership structure is known from the documents and the existing debt or tax savings make it worth evaluating.

---

### STRUCTURE 13: RECAPITALIZATION (RECAP)
**Best for: Assets that have appreciated, operator wants to de-risk, new capital can unlock further upside**

Bring in new equity capital. Existing investors get partially or fully cashed out. Sponsor retains control and upside in the recapped entity.

Use this after value-add execution when the property has appreciated — the recap allows the operator to monetize the manufactured equity without a full sale, return capital to the original equity partner, and bring in new capital for the next phase of the business plan.

Pros: liquidity without sale, resets the basis and capital stack, rewards early investors.

Flag: complex legal and accounting requirements, new investor expectations must be managed, potential loss of control if not structured carefully. Operator should work with a real estate attorney and CPA on this structure.

---

### STRUCTURE 14: BRIDGE + REFI / VALUE-ADD RECAPITALIZATION
**Best for: Significant immediate value-add where expense-shift and RUBS can be implemented quickly**

Use bridge or hard money to close. Implement expense shifts, RUBS, recapture rent increase during bridge period. Stabilize NOI. Refinance based on the new, higher NOI. Pull out the equity partner's invested capital in the refi if the numbers support it.

The critical question: do the refi proceeds at stabilization cover the full bridge payoff and return the equity partner's capital? If yes, this structure effectively creates a no-money-in long-term hold.

Show: bridge loan amount, rate, and carry cost over the stabilization period; implementation timeline; stabilized NOI; refi loan amount at stabilized NOI; refi proceeds vs bridge payoff; equity returned to the partner; remaining equity in the deal post-refi.

Only recommend if the math clearly supports it. Bridge debt is expensive and execution risk is real.

---

## PURCHASE PRICE RECOMMENDATION

**Method 1 — Cap Rate Approach:**
MAO = Pro Forma NOI ÷ Target Cap Rate
State the target cap rate and the basis for it (submarket data from documents or flagged assumption).

**Method 2 — DSCR-Constrained Approach:**
Work backwards from minimum acceptable DSCR (1.25) at the proposed loan amount. What purchase price allows the NOI to support 1.25x DSCR? That is the ceiling at that loan amount.

**Method 3 — Equity Partner Return Approach:**
Work backwards from what the capital partner needs — their return targets (preferred return plus equity multiple or IRR) with conservative assumptions on value-add timeline and exit cap rate. What purchase price makes the partner's returns compelling enough to say yes?

Show all three methods. Where they converge is the MAO. Where they diverge, explain why and which one governs for this deal.

If the asking price is above the MAO — say so. State the gap. State what price makes it work. Provide a negotiating strategy grounded in the document findings. The underwriting discrepancies, deferred maintenance, and expense normalization are your negotiating leverage.

If the asking price is at or below the MAO — state that clearly and quantify the margin of safety.

Never recommend overpaying to make a structure fit. If the numbers do not work at the asking price, the answer is a lower offer or a pass.

---

## DEAL HEALTH CHECK — RUN BEFORE ANY RECOMMENDATION

- Does the deal cashflow at asking price with market-rate financing? If no — what price or structure makes it cashflow?
- Is DSCR above 1.25 on proposed debt? If no — what changes?
- Will property tax reassessment at purchase price materially impact NOI? Calculate it.
- Is there significant deferred CapEx that must be funded at close? Include it in equity requirement.
- Are any leases above market? When do they expire? What is the rollover risk?
- Is there single-tenant or concentration risk?
- Is value-add dependent on renovation? If yes — is renovation budget in the equity requirement and timeline modeled?
- Does the submarket support even the modest recapture rent increase?
- Is the seller's cap rate based on pro forma or in-place NOI? Verify every time.
- What percentage of leases are up for renewal in the next 12 months? This determines when the value-add actually hits the NOI. Model it.
- Is there anything in the documents suggesting environmental, title, or structural issues?

---

## OUTPUT FORMAT — EVERY DEAL, EVERY TIME

**1. Deal Snapshot**
Property overview, key stats, asking price, broker NOI, broker cap rate, your NOI, your cap rate. First call: is there an angle here?

**2. Document Flags**
Everything missing, inconsistent, or suspicious. Specific and direct.

**3. Full Underwriting**
Complete income and expense build. Your NOI vs broker NOI. Every line shown. Tax reassessment modeled separately.

**4. Value-Add Analysis**
Expense shifting, RUBS, recapture rent increase, expense normalization, rehab premium if applicable. Full summary table. NOI delta. Equity manufactured. Lease renewal implementation timeline.

**5. Purchase Price Recommendation**
MAO by all three methods. Offer strategy. Negotiating leverage from the document findings.

**6. Structure Options**
Every viable structure ranked by feasibility for this specific deal. Full numbers for each. Clear recommendation on which one fits best and why.

**7. Capital Partner One-Pager**
Clean, concise summary built to be shown to a capital partner: what they bring to close, what they get back, in each applicable structure variant. Include the equity manufactured number prominently — this is what makes the story compelling.

**8. Risks and Red Flags**
Everything that could kill the deal or impair returns. No softening. Direct.

**9. What You Still Need**
Specific list of missing data or documents needed to complete or confirm the analysis.

---

## HARD RULES — NEVER VIOLATE

1. Never fabricate a number. If it is not in the documents, it is missing — flag it.
2. Never recommend a deal that does not cashflow or cannot be clearly structured to cashflow.
3. Never push rents to market as the primary value-add strategy. The strategy is expense shifting, RUBS, and recapture. Rent maximization is not the goal — cashflow durability is.
4. Never project rent increases that require pushing to or above market unless a full rehab justifies it — and even then, target 10–15% below the top of market.
5. Never present a structure where DSCR falls below 1.20.
6. Never use the broker's NOI without independently verifying it.
7. Never skip the property tax reassessment calculation on acquisition.
8. Never recommend overpaying to make a structure work.
9. Never produce a full recommendation on incomplete data.
10. Never overlook the lease renewal timeline when projecting value-add — model when the NOI improvement actually hits, not when you want it to.
11. Always flag when syndication or multi-investor structures may require Reg D 506(b) or 506(c) securities law compliance. Direct the user to a securities attorney. Do not give legal advice.
12. If the deal is bad, say it is bad. Be specific. The user's capital and reputation depend on accuracy.

When the user says they're ready to generate the deliverables (approved, looks good, let's do it, etc.), confirm the final deal structure and let them know you're ready to build the spreadsheet and pitch deck."""


CHAT_SYSTEM_PROMPT = """You are Max, continuing to help the user refine this deal. You have the full underwriting context from the previous analysis.

Your job now is to:
1. Answer questions about the deal
2. Help refine the capital structure
3. Adjust assumptions and show the impact on returns
4. Identify additional risks or opportunities
5. When the user is satisfied, confirm the final numbers and let them know everything is ready

When adjusting numbers, always show:
- What changed
- Impact on NOI
- Impact on returns (CoC, IRR, equity multiple)

Be conversational but precise. Every number should be calculated, not estimated.

When the user indicates approval (says things like "approved", "looks good", "let's do it", "go ahead", "build it", "generate", etc.), respond with a final summary of the deal terms and confirm you're ready to generate the spreadsheet and pitch deck. Set readyForApproval: true in your response."""


# ============================================================================
# Helper Functions
# ============================================================================

def get_anthropic_client():
    """Get Anthropic client, raising error if not configured."""
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="Anthropic API not configured")
    return Anthropic(api_key=ANTHROPIC_API_KEY)


def get_session(session_id: str) -> Dict[str, Any]:
    """Get or create a session."""
    if session_id not in _sessions:
        _sessions[session_id] = {
            "id": session_id,
            "created_at": datetime.utcnow().isoformat(),
            "deal_data": None,
            "conversation": [],
            "approved": False,
            "generation_status": {
                "spreadsheet": "idle",
                "pitch_deck": "idle",
                "spreadsheet_progress": 0,
                "pitch_deck_progress": 0
            },
            "outputs": {
                "spreadsheet_url": None,
                "pitch_deck_url": None,
                "deal_id": None
            }
        }
    return _sessions[session_id]


async def parse_om_with_claude(file_bytes: bytes, file_type: str, filename: str) -> Dict[str, Any]:
    """Parse OM using Claude's native PDF/vision capabilities."""
    client = get_anthropic_client()
    
    # Determine media type
    if file_type == "application/pdf":
        media_type = "application/pdf"
    elif file_type in ["image/png", "image/jpeg", "image/jpg"]:
        media_type = file_type
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_type}")
    
    # Encode file
    file_b64 = base64.standard_b64encode(file_bytes).decode("utf-8")
    
    # Build message content
    if media_type == "application/pdf":
        content = [
            {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": file_b64
                }
            },
            {
                "type": "text",
                "text": """Extract ALL financial and property data from this Offering Memorandum. Return a JSON object with these fields:

{
    "property": {
        "name": "",
        "address": "",
        "city": "",
        "state": "",
        "zip": "",
        "units": 0,
        "year_built": 0,
        "property_type": "multifamily",
        "lot_size": "",
        "building_sf": 0
    },
    "unit_mix": [
        {"type": "1BR/1BA", "count": 0, "sf": 0, "rent": 0}
    ],
    "financials": {
        "asking_price": 0,
        "price_per_unit": 0,
        "price_per_sf": 0,
        "gross_potential_rent": 0,
        "vacancy_loss": 0,
        "effective_gross_income": 0,
        "total_expenses": 0,
        "noi": 0,
        "cap_rate": 0,
        "expense_ratio": 0
    },
    "income": {
        "rental_income": 0,
        "other_income": 0,
        "laundry": 0,
        "parking": 0,
        "pet_fees": 0,
        "late_fees": 0,
        "application_fees": 0
    },
    "expenses": {
        "taxes": 0,
        "insurance": 0,
        "utilities": 0,
        "water_sewer": 0,
        "trash": 0,
        "repairs_maintenance": 0,
        "management_fee": 0,
        "payroll": 0,
        "marketing": 0,
        "admin": 0,
        "reserves": 0,
        "other": 0
    },
    "occupancy": {
        "current_occupancy": 0,
        "economic_occupancy": 0,
        "average_rent": 0,
        "market_rent": 0
    },
    "market_data": {
        "submarket": "",
        "market_cap_rate": 0,
        "market_rent_growth": 0,
        "comparable_sales": []
    },
    "seller_proforma": {
        "projected_noi": 0,
        "projected_rent_growth": 0,
        "assumptions": []
    }
}

Extract actual numbers from the document. Use 0 if not found. Be thorough - check every page for financial data, rent rolls, T12, proforma projections."""
            }
        ]
    else:
        # Image
        content = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": file_b64
                }
            },
            {
                "type": "text",
                "text": "Extract all property and financial information from this image. Return a JSON object with property details, unit mix, financials, income, expenses, and occupancy data."
            }
        ]
    
    log.info(f"[DealBuilder] Parsing {filename} ({file_type}) with Claude...")
    
    response = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=16000,
        messages=[{"role": "user", "content": content}]
    )
    
    response_text = response.content[0].text
    
    # Extract JSON from response
    try:
        # Try to find JSON in the response
        import re
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            parsed_data = json.loads(json_match.group())
        else:
            # If no JSON found, return minimal structure
            parsed_data = {"raw_text": response_text}
    except json.JSONDecodeError:
        parsed_data = {"raw_text": response_text}
    
    log.info(f"[DealBuilder] Parsed OM: {list(parsed_data.keys())}")
    return parsed_data


async def underwrite_deal(deal_data: Dict[str, Any]) -> str:
    """Generate initial underwriting analysis using Claude."""
    client = get_anthropic_client()
    
    # Build context from parsed deal data
    deal_context = json.dumps(deal_data, indent=2)
    
    user_prompt = f"""Here is the parsed OM data for a multifamily property:

{deal_context}

Please analyze this deal and provide your full underwriting assessment. Include:
1. Deal Snapshot with key numbers
2. Strengths of the deal
3. Weaknesses and red flags
4. Value-add opportunities with specific NOI impact
5. Recommended capital structure
6. Return projections

Be specific with numbers and direct with your opinion on whether this is worth pursuing."""

    log.info(f"[DealBuilder] Generating underwriting analysis...")
    
    response = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=8000,
        system=UNDERWRITING_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}]
    )
    
    return response.content[0].text


# ============================================================================
# API Endpoints
# ============================================================================

@router.post("/upload")
async def upload_om(
    request: Request,
    file: UploadFile = File(...),
    session_id: str = Form(...)
):
    """
    Upload an OM and parse it with Claude.
    Returns parsed deal data and initial underwriting analysis.
    """
    try:
        # Get profile for token check (optional for upload phase)
        from token_manager import get_current_profile_id, get_profile, check_tokens, deduct_tokens
        profile_id = None
        try:
            profile_id = get_current_profile_id(request)
            profile = get_profile(profile_id)
            log.info(f"[DealBuilder] Upload by profile {profile_id}")
        except Exception:
            log.warning("[DealBuilder] No profile for upload - proceeding anyway")
        
        # Read file
        file_bytes = await file.read()
        file_type = file.content_type
        filename = file.filename
        
        log.info(f"[DealBuilder] Received upload: {filename} ({len(file_bytes)} bytes, {file_type})")
        
        # Parse OM with Claude
        parsed_data = await parse_om_with_claude(file_bytes, file_type, filename)
        
        # Store in session
        session = get_session(session_id)
        session["deal_data"] = parsed_data
        session["filename"] = filename
        
        # Generate initial underwriting analysis
        analysis = await underwrite_deal(parsed_data)
        
        # Add to conversation
        session["conversation"].append({
            "role": "user",
            "content": f"I'm uploading an OM: {filename}"
        })
        session["conversation"].append({
            "role": "assistant", 
            "content": analysis
        })
        
        # Build deal summary for UI
        prop = parsed_data.get("property", {})
        fin = parsed_data.get("financials", {})
        deal_summary = {
            "address": prop.get("address", "Unknown"),
            "units": prop.get("units", 0),
            "asking_price": fin.get("asking_price", 0),
            "noi": fin.get("noi", 0),
            "cap_rate": fin.get("cap_rate", 0)
        }
        
        return JSONResponse(content={
            "success": True,
            "dealData": parsed_data,
            "dealSummary": deal_summary,
            "response": analysis
        })
        
    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"[DealBuilder] Upload error: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "detail": str(e)}
        )


@router.post("/chat")
async def deal_builder_chat(request: Request):
    """
    Chat with Claude about the deal.
    Handles conversation and detects approval.
    """
    try:
        from token_manager import get_current_profile_id, get_profile
        
        data = await request.json()
        message = data.get("message", "")
        session_id = data.get("session_id")
        deal_data = data.get("deal_data")
        conversation_history = data.get("conversation_history", [])
        is_approval = data.get("is_approval", False)
        
        if not message:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "No message provided"}
            )
        
        # Get session
        session = get_session(session_id)
        
        # Update deal data if provided
        if deal_data:
            session["deal_data"] = deal_data
        
        # Build messages for Claude
        messages = []
        
        # Add conversation context
        for msg in conversation_history[-10:]:  # Last 10 messages
            messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })
        
        # Add current message
        messages.append({
            "role": "user",
            "content": message
        })
        
        # Build system prompt with deal context
        deal_context = json.dumps(session.get("deal_data", {}), indent=2)[:8000]  # Truncate if too long
        system = CHAT_SYSTEM_PROMPT + f"\n\nCurrent deal data:\n{deal_context}"
        
        client = get_anthropic_client()
        
        log.info(f"[DealBuilder] Chat: {message[:100]}...")
        
        response = client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=4000,
            system=system,
            messages=messages
        )
        
        response_text = response.content[0].text
        
        # Check if Claude indicated approval readiness
        ready_for_approval = "readyForApproval" in response_text.lower() or \
                           "ready to generate" in response_text.lower() or \
                           "ready to build" in response_text.lower()
        
        # If user explicitly approved
        approved = False
        if is_approval and session.get("deal_data"):
            approved = True
            session["approved"] = True
            log.info(f"[DealBuilder] Deal approved for session {session_id}")
        
        # Store in conversation
        session["conversation"].append({"role": "user", "content": message})
        session["conversation"].append({"role": "assistant", "content": response_text})
        
        return JSONResponse(content={
            "success": True,
            "response": response_text,
            "readyForApproval": ready_for_approval,
            "approved": approved,
            "updatedDealData": session.get("deal_data")
        })
        
    except Exception as e:
        log.exception(f"[DealBuilder] Chat error: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )


@router.post("/generate")
async def generate_deliverables(request: Request):
    """
    Generate spreadsheet + pitch deck in parallel.
    Deducts tokens and starts background generation.
    """
    try:
        from token_manager import get_current_profile_id, get_profile, check_tokens, deduct_tokens
        
        # Require authentication for generation
        profile_id = get_current_profile_id(request)
        profile = get_profile(profile_id)
        
        # Check tokens
        token_check = check_tokens(profile_id, DEAL_BUILDER_TOKEN_COST)
        if not token_check["has_tokens"]:
            return JSONResponse(
                status_code=402,
                content={"success": False, "error": "Insufficient tokens", "required": DEAL_BUILDER_TOKEN_COST}
            )
        
        data = await request.json()
        session_id = data.get("session_id")
        deal_data = data.get("deal_data")
        
        session = get_session(session_id)
        
        if deal_data:
            session["deal_data"] = deal_data
        
        if not session.get("deal_data"):
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "No deal data in session"}
            )
        
        # Deduct tokens
        deduct_tokens(profile_id, DEAL_BUILDER_TOKEN_COST, "deal_builder_full")
        log.info(f"[DealBuilder] Deducted {DEAL_BUILDER_TOKEN_COST} tokens from {profile_id}")
        
        # Update status
        session["generation_status"] = {
            "spreadsheet": "generating",
            "pitch_deck": "generating",
            "spreadsheet_progress": 0,
            "pitch_deck_progress": 0
        }
        
        # Start background generation (in production, use Celery or similar)
        asyncio.create_task(generate_in_background(session_id, session["deal_data"], profile_id))
        
        return JSONResponse(content={
            "success": True,
            "message": "Generation started",
            "session_id": session_id
        })
        
    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"[DealBuilder] Generate error: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )


async def generate_in_background(session_id: str, deal_data: Dict, profile_id: str):
    """Background task to generate spreadsheet + pitch deck."""
    session = get_session(session_id)
    
    try:
        # Simulate progress updates (replace with actual generation)
        for i in range(10):
            await asyncio.sleep(2)
            session["generation_status"]["spreadsheet_progress"] = min(100, (i + 1) * 10)
            session["generation_status"]["pitch_deck_progress"] = min(100, (i + 1) * 10)
        
        # Generate spreadsheet
        log.info(f"[DealBuilder] Generating spreadsheet for session {session_id}...")
        spreadsheet_url = await generate_spreadsheet(deal_data, session_id)
        session["generation_status"]["spreadsheet"] = "complete"
        session["generation_status"]["spreadsheet_progress"] = 100
        session["outputs"]["spreadsheet_url"] = spreadsheet_url
        
        # Generate pitch deck  
        log.info(f"[DealBuilder] Generating pitch deck for session {session_id}...")
        pitch_deck_url = await generate_pitch_deck(deal_data, session_id, profile_id)
        session["generation_status"]["pitch_deck"] = "complete"
        session["generation_status"]["pitch_deck_progress"] = 100
        session["outputs"]["pitch_deck_url"] = pitch_deck_url
        
        # Save deal to pipeline
        deal_id = await save_deal_to_pipeline(deal_data, profile_id)
        session["outputs"]["deal_id"] = deal_id
        
        log.info(f"[DealBuilder] Generation complete for session {session_id}")
        
    except Exception as e:
        log.exception(f"[DealBuilder] Background generation error: {e}")
        session["generation_status"]["spreadsheet"] = "error"
        session["generation_status"]["pitch_deck"] = "error"


async def generate_spreadsheet(deal_data: Dict, session_id: str) -> str:
    """Generate Excel spreadsheet using Claude."""
    try:
        from llm_excel_export import export_to_excel_ai
        
        # Build scenario data from deal data
        prop = deal_data.get("property", {})
        fin = deal_data.get("financials", {})
        
        scenario_data = {
            "address": prop.get("address", "Unknown Property"),
            "units": prop.get("units", 0),
            "asking_price": fin.get("asking_price", 0),
            "noi": fin.get("noi", 0),
            "cap_rate": fin.get("cap_rate", 0),
            "expense_ratio": fin.get("expense_ratio", 0),
            "gross_income": fin.get("effective_gross_income", 0),
            "total_expenses": fin.get("total_expenses", 0),
            # Add more fields as needed
        }
        
        # Generate Excel file
        excel_buffer = export_to_excel_ai(scenario_data)
        
        # Save to temp location (in production, upload to S3/storage)
        output_dir = Path(__file__).parent / "data" / "deal_builder_outputs"
        output_dir.mkdir(parents=True, exist_ok=True)
        
        filename = f"deal_{session_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        filepath = output_dir / filename
        
        with open(filepath, 'wb') as f:
            f.write(excel_buffer.getvalue())
        
        # Return URL (for now, just the filename - would be S3 URL in production)
        return f"/api/deal-builder/download/{filename}"
        
    except Exception as e:
        log.exception(f"[DealBuilder] Spreadsheet generation error: {e}")
        # Return placeholder URL on error
        return f"/api/deal-builder/download/error_{session_id}.xlsx"


async def generate_pitch_deck(deal_data: Dict, session_id: str, profile_id: str) -> str:
    """Generate pitch deck using existing pitch deck generator."""
    try:
        # Use existing pitch deck generation
        # This would call the v2 pitch deck endpoint or manus
        
        # For now, return placeholder
        filename = f"pitch_deck_{session_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        return f"/api/deal-builder/download/{filename}"
        
    except Exception as e:
        log.exception(f"[DealBuilder] Pitch deck generation error: {e}")
        return f"/api/deal-builder/download/pitch_error_{session_id}.pdf"


async def save_deal_to_pipeline(deal_data: Dict, profile_id: str) -> str:
    """Save the deal to the user's pipeline."""
    try:
        from supabase import create_client
        
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
        
        if not supabase_url or not supabase_key:
            log.warning("[DealBuilder] Supabase not configured, skipping pipeline save")
            return None
        
        supabase = create_client(supabase_url, supabase_key)
        
        prop = deal_data.get("property", {})
        fin = deal_data.get("financials", {})
        
        deal_record = {
            "deal_id": str(uuid.uuid4()),
            "profile_id": profile_id,
            "address": prop.get("address", "Unknown"),
            "units": prop.get("units", 0),
            "purchase_price": fin.get("asking_price", 0),
            "cap_rate": fin.get("cap_rate", 0),
            "status": "pipeline",
            "stage": "new",
            "scenario_data": deal_data,
            "created_at": datetime.utcnow().isoformat()
        }
        
        result = supabase.table("deals").insert(deal_record).execute()
        
        return deal_record["deal_id"]
        
    except Exception as e:
        log.exception(f"[DealBuilder] Pipeline save error: {e}")
        return None


@router.get("/status/{session_id}")
async def get_generation_status(session_id: str, request: Request):
    """Poll for generation status."""
    session = get_session(session_id)
    
    status = session.get("generation_status", {})
    outputs = session.get("outputs", {})
    
    # Check if complete
    complete = (
        status.get("spreadsheet") == "complete" and 
        status.get("pitch_deck") == "complete"
    )
    
    return JSONResponse(content={
        "session_id": session_id,
        "spreadsheet_status": status.get("spreadsheet", "idle"),
        "pitch_deck_status": status.get("pitch_deck", "idle"),
        "spreadsheet_progress": status.get("spreadsheet_progress", 0),
        "pitch_deck_progress": status.get("pitch_deck_progress", 0),
        "complete": complete,
        "spreadsheet_url": outputs.get("spreadsheet_url"),
        "pitch_deck_url": outputs.get("pitch_deck_url"),
        "deal_id": outputs.get("deal_id")
    })


@router.get("/download/{filename}")
async def download_file(filename: str):
    """Download generated file."""
    output_dir = Path(__file__).parent / "data" / "deal_builder_outputs"
    filepath = output_dir / filename
    
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Determine media type
    if filename.endswith(".xlsx"):
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    elif filename.endswith(".pdf"):
        media_type = "application/pdf"
    else:
        media_type = "application/octet-stream"
    
    return FileResponse(
        path=filepath,
        filename=filename,
        media_type=media_type
    )
