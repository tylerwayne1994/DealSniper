"""
AI Board of Advisors — deliberation engine.

Reads the advisor persona files from disk at runtime (backend/board_of_advisors/
advisors/*.md) — nothing about the advisors is hardcoded in this module, so
editing/adding/removing an advisor is just a file edit, no code change. The
Deal Brief is built strictly from the real scenarioData + calculateFullAnalysis
output the caller sends; any missing field is flagged, never invented.

Mode A (single orchestrated LLM call) is implemented, per
board_of_advisors/board-deliberation-engine.md.
"""
import os
import re
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from anthropic import Anthropic

log = logging.getLogger("board_of_advisors")

BOARD_DIR = Path(__file__).parent / "board_of_advisors"
ADVISORS_DIR = BOARD_DIR / "advisors"

ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929"
# Cheaper/faster model for the follow-up chat — answering a quick question to
# an already-convened advisor doesn't need the flagship model that ran the
# full 7-stage deliberation.
ANTHROPIC_MODEL_FAST = "claude-3-5-haiku-20241022"


def _get_client() -> Anthropic:
    api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY (or CLAUDE_API_KEY) not configured")
    return Anthropic(api_key=api_key)


def _advisor_files() -> List[Path]:
    if not ADVISORS_DIR.exists():
        return []
    return sorted(ADVISORS_DIR.glob("*.md"))


def _advisor_name_from_filename(path: Path) -> str:
    # "01-sam-zell.md" -> "Sam Zell"
    stem = re.sub(r"^\d+-", "", path.stem)
    return " ".join(w.capitalize() for w in stem.split("-"))


def load_all_advisors() -> Dict[str, str]:
    """{ advisor_name: full markdown persona text }"""
    advisors = {}
    for path in _advisor_files():
        try:
            advisors[_advisor_name_from_filename(path)] = path.read_text(encoding="utf-8")
        except Exception as e:
            log.warning(f"[Board] Failed to read advisor file {path}: {e}")
    return advisors


def _num(*vals):
    for v in vals:
        if v is None:
            continue
        try:
            n = float(v)
            if n == n:  # not NaN
                return n
        except (TypeError, ValueError):
            continue
    return None


def build_deal_brief(scenario_data: Dict[str, Any], analysis: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Compact deal brief from ONLY real fields. Missing fields are listed
    separately so the LLM can flag them rather than invent them."""
    scenario_data = scenario_data or {}
    analysis = analysis or {}
    property_ = scenario_data.get("property", {}) or {}
    pricing = scenario_data.get("pricing_financing", {}) or {}

    year1 = analysis.get("year1", {}) or {}
    returns = analysis.get("returns", {}) or {}
    financing = analysis.get("financing", {}) or {}
    acquisition = analysis.get("acquisition", {}) or {}
    current = analysis.get("current", {}) or {}

    fields = {
        "propertyName": property_.get("property_name") or property_.get("name"),
        "address": property_.get("address"),
        "city": property_.get("city"),
        "state": property_.get("state"),
        "units": _num(property_.get("units"), property_.get("total_units")),
        "yearBuilt": property_.get("year_built"),
        "purchasePrice": _num(acquisition.get("purchasePrice"), pricing.get("purchase_price"), pricing.get("price")),
        "pricePerUnit": _num(acquisition.get("pricePerUnit")),
        "pricePerSF": _num(acquisition.get("pricePerSF")),
        "goingInCapRate": _num(year1.get("capRate"), current.get("capRate")),
        "exitCapRate": _num(returns.get("exitCapRate")),
        "dscr": _num(year1.get("dscr"), current.get("dscr")),
        "minDSCR": _num(returns.get("minDSCR")),
        "debtYield": _num(year1.get("debtYield")),
        "minDebtYield": _num(returns.get("minDebtYield")),
        "cashOnCashYear1": _num(year1.get("cashOnCash")),
        "avgCashOnCash": _num(returns.get("avgCashOnCash")),
        "leveredIRR": _num(returns.get("leveredIRR")),
        "unleveredIRR": _num(returns.get("unleveredIRR")),
        "leveredEquityMultiple": _num(returns.get("leveredEquityMultiple")),
        "expenseRatio": _num(year1.get("expenseRatio"), current.get("expenseRatio")),
        "ltv": _num(financing.get("ltv")),
        "interestRate": _num(financing.get("interestRate")),
        "ioYears": _num(financing.get("ioYears")),
        "amortYears": _num(financing.get("amortYears")),
        "loanAmount": _num(financing.get("loanAmount")),
        "annualDebtService": _num(financing.get("annualDebtService")),
        "totalEquityRequired": _num(financing.get("totalEquityRequired")),
        "holdingPeriodYears": _num(returns.get("holdingPeriod")),
        "noiYear1": _num(year1.get("noi"), current.get("noi")),
        "renovationBudget": _num(scenario_data.get("value_add", {}).get("renovation_budget") if isinstance(scenario_data.get("value_add"), dict) else None),
    }

    present = {k: v for k, v in fields.items() if v is not None and v != ""}
    missing = [k for k, v in fields.items() if v is None or v == ""]
    return {"fields": present, "missingFields": missing}


ADVISOR_SELECTION_KEYWORDS = {
    "Sam Zell": ["skeptic-default"],
    "Joe Fairless": ["skeptic-default", "io", "bridge", "floating"],
    "Ken Mcelroy": ["renovation", "value-add", "conservative-debt"],
    "Michael Blank": ["renovation", "value-add", "syndication"],
    "Robert Faith": ["operations", "expense", "scale"],
    "Grant Cardone": ["leverage", "long-hold"],
    "Neal Bawa": ["market", "submarket", "demographics"],
    "Barry Sternlicht": ["macro", "rates", "supply", "exit-cap"],
    "Christian Osgood": ["creative-financing", "seller-carry"],
    "Lumberjack Landlord": ["small-deal", "self-management"],
}


def select_advisors(deal_brief: Dict[str, Any], available: List[str], max_advisors: int = 6) -> List[Dict[str, str]]:
    """Heuristic convening per board-deliberation-engine.md §1. Always
    includes Sam Zell or Joe Fairless as the resident skeptic."""
    f = deal_brief.get("fields", {})
    convened: List[Tuple[str, str]] = []

    def add(name, reason):
        if name in available and name not in [c[0] for c in convened] and len(convened) < max_advisors:
            convened.append((name, reason))

    io_years = f.get("ioYears") or 0
    ltv = f.get("ltv") or 0
    dscr = f.get("dscr")
    cash_on_cash = f.get("cashOnCashYear1")
    renovation = f.get("renovationBudget")
    exit_cap = f.get("exitCapRate")
    going_in_cap = f.get("goingInCapRate")

    # Weak/negative day-one economics on conventional terms is exactly when
    # creative structuring (seller carry, rate-below-cap, graduated amort)
    # matters most — convene Osgood FIRST in that case, not last.
    doesnt_pencil_conventionally = (
        (cash_on_cash is not None and cash_on_cash <= 2)
        or (dscr is not None and dscr < 1.15)
    )
    if doesnt_pencil_conventionally:
        add("Christian Osgood", "Day-one cash flow is thin/negative on conventional terms — his seller-carry / rate-below-cap structuring lens can potentially make this deal work.")

    if renovation:
        add("Ken Mcelroy", "Hands-on value-add operator — this deal has a renovation budget to scrutinize.")
        add("Michael Blank", "Syndication economics on a value-add play.")
    if io_years and io_years > 0:
        add("Joe Fairless", "Interest-only period on the debt — his rate-cap scars are directly relevant.")
    if ltv and ltv >= 70:
        add("Sam Zell", "High leverage — his downside/liquidity discipline applies directly.")
    if dscr is not None and dscr < 1.3:
        add("Sam Zell", "Thin DSCR cushion — his carrying-capacity lens is the right stress test.")
    if exit_cap is not None and going_in_cap is not None and exit_cap <= going_in_cap:
        add("Sam Zell", "Exit cap at or below going-in — he's allergic to manufactured cap-rate compression returns.")
    add("Neal Bawa", "Data/demographics read on the market and submarket.")
    add("Robert Faith", "Operations and expense-ratio scrutiny at scale.")
    if not renovation and (f.get("units") or 0) and (f.get("units") or 0) < 50:
        add("Lumberjack Landlord", "Smaller, self-managed multifamily deal — his hands-on cash-flow-first lens fits.")
    add("Grant Cardone", "Aggressive leverage / long-hold cash-flow counterpoint.")
    add("Barry Sternlicht", "Macro, rates, and replacement-cost read.")
    add("Christian Osgood", "Creative-financing / seller-carry structuring lens.")

    # Always include a resident skeptic
    if not any(n in ("Sam Zell", "Joe Fairless") for n, _ in convened):
        if "Sam Zell" in available:
            convened.append(("Sam Zell", "Resident skeptic — downside and liquidity discipline, always convened."))
        elif "Joe Fairless" in available:
            convened.append(("Joe Fairless", "Resident skeptic — stress-tested value-add lens, always convened."))

    # Backfill to a reasonable minimum board size
    fillers = ["Ken Mcelroy", "Neal Bawa", "Robert Faith", "Joe Fairless", "Sam Zell", "Grant Cardone"]
    for name in fillers:
        if len(convened) >= 4:
            break
        add(name, "Rounding out the board for a balanced deliberation.")

    return [{"advisor": n, "reason": r} for n, r in convened[:max_advisors]]


ORCHESTRATOR_SYSTEM_PROMPT = """You are the moderator of an AI "board of advisors" reviewing a MULTIFAMILY real-estate deal for an experienced investor. Your job is to run a rigorous, honest deliberation and return a single JSON object — nothing else.

You are given:
1) DEAL BRIEF — the deal's real underwriting metrics. Use ONLY these numbers. Never invent a figure. If a needed field is missing, it is listed in missingFields — say so and treat it as a risk; add it to meta.missingDealFields.
2) BOARD — the full personas of the convened advisors (each with philosophy, how they read a deal, strengths, blind spots, and their non-negotiable questions).

Run this process:
- OPENING POSITIONS: Each advisor states an initial read IN THEIR OWN VOICE and philosophy, citing specific Deal Brief numbers, ending with lean = INVEST | PASS | INVEST WITH CONDITIONS and the metric(s) that drove it. Advisors must genuinely differ where their philosophies differ — do NOT force agreement.
- ARGUMENTATION: At least one round where advisors challenge each other BY NAME on the deal's real numbers. Preserve real disagreement.
- CREATIVE STRUCTURING: If Christian Osgood is convened, OR if the deal doesn't cleanly pencil on conventional bank terms (thin/negative day-one cash flow, thin DSCR, high leverage), propose 1-3 concrete alternative deal structures that could change the outcome — e.g. seller-carry terms, a negotiated note rate below the going-in cap rate to create positive leverage, graduated/reverse amortization, or a different down payment / partner structure. Each idea must be concrete (a rate, a down payment, a term, or a structure) and state what it changes about the deal's numbers. If the deal already works fine conventionally and no advisor's philosophy calls for restructuring, return an empty list — do not invent structuring ideas that aren't warranted.
- PRE-MORTEM: Assume it is 18 months after closing and the deal is in trouble. List the concrete ways it failed, each tied to a specific deal driver/metric, with a rough likelihood and a mitigant.
- SYNTHESIS: Produce ONE recommendation (INVEST | PASS | INVEST WITH CONDITIONS) with a confidence level, a rationale grounded in the real numbers, explicit conditions if conditional, and the 1-3 key risks.
- DISSENT: Quote the single strongest opposing view. Never smooth it away.

Rules:
- Ground every claim in the DEAL BRIEF. No fabricated numbers, no fabricated quotes from the real people.
- Be direct. If the deal is bad, say so plainly. No hedging filler.
- Every sentence must be a clean, final statement — no visible reasoning process, no "let me think", no meta-commentary about what you are doing. Only the finished positions/arguments themselves.
- Return ONLY a JSON object matching this exact shape, no markdown fences, no prose outside the JSON:
{
  "deal": { "name": "string", "address": "string", "units": 0, "purchasePrice": 0 },
  "convened": [ { "advisor": "Sam Zell", "reason": "why this advisor was picked for this deal" } ],
  "openingPositions": [ { "advisor": "Sam Zell", "lean": "PASS", "position": "2-4 sentence opening read, grounded in the deal metrics", "metricsCited": ["going-in cap 5.1%"] } ],
  "debate": [ { "round": 1, "exchanges": [ { "advisor": "Sam Zell", "challengesTo": "Grant Cardone", "argument": "..." } ] } ],
  "creativeStructuring": [ { "advisor": "Christian Osgood", "idea": "short label, e.g. 'Seller-carry at 6% vs 7.5% conventional'", "mechanics": "concrete terms — down payment, rate, amortization/term, or structure", "impact": "what this changes about DSCR/cash-on-cash/IRR, grounded in the deal's real numbers" } ],
  "preMortem": { "horizonMonths": 18, "failureModes": [ { "cause": "...", "driver": "...", "likelihood": "medium", "mitigant": "..." } ] },
  "synthesis": { "recommendation": "INVEST | PASS | INVEST WITH CONDITIONS", "confidence": "low | medium | high", "rationale": "...", "conditions": ["..."], "keyRisks": ["..."] },
  "dissent": [ { "advisor": "Grant Cardone", "objection": "...", "whyItMatters": "..." } ],
  "meta": { "advisorsConsidered": 0, "advisorsConvened": 0, "missingDealFields": ["..."], "disclaimer": "These are AI models of publicly documented investment philosophies, not the real individuals, and are not investment advice." }
}"""


def _extract_json(content: str) -> str:
    content = content.strip()
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0]
    elif "```" in content:
        content = content.split("```")[1].split("```")[0]
    content = content.strip()
    # Fallback: if there's stray prose around the JSON, take the outermost {...} span.
    if content[:1] != "{" or content[-1:] != "}":
        start = content.find("{")
        end = content.rfind("}")
        if start != -1 and end != -1 and end > start:
            content = content[start:end + 1]
    return content.strip()


def run_board_deliberation(scenario_data: Dict[str, Any], analysis: Optional[Dict[str, Any]], max_advisors: int = 4) -> Dict[str, Any]:
    all_advisors = load_all_advisors()
    if not all_advisors:
        raise RuntimeError("No advisor persona files found on disk")

    deal_brief = build_deal_brief(scenario_data, analysis)
    convened = select_advisors(deal_brief, list(all_advisors.keys()), max_advisors=max_advisors)
    if not convened:
        convened = [{"advisor": n, "reason": "Default board member."} for n in list(all_advisors.keys())[:4]]

    board_text = "\n\n---\n\n".join(
        all_advisors[c["advisor"]] for c in convened if c["advisor"] in all_advisors
    )

    user_content = (
        "DEAL BRIEF:\n" + json.dumps(deal_brief, indent=2, default=str) +
        "\n\nCONVENED ADVISORS (reasons):\n" + json.dumps(convened, indent=2) +
        "\n\nBOARD (full persona text for each convened advisor):\n" + board_text +
        "\n\nReturn the JSON now. Keep every position/argument/failure-mode to 1-2 short sentences "
        "so the full response fits comfortably within the output budget."
    )

    client = _get_client()
    response = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=8000,
        system=ORCHESTRATOR_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    )
    content = response.content[0].text if response.content else "{}"

    try:
        result = json.loads(_extract_json(content))
    except json.JSONDecodeError:
        log.warning("[Board] First parse failed, retrying once...")
        response2 = client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=8000,
            system=ORCHESTRATOR_SYSTEM_PROMPT + "\n\nIMPORTANT: your previous response was not valid JSON. Return ONLY the JSON object, nothing else. Keep every text field short (1-2 sentences) to stay within the output budget.",
            messages=[{"role": "user", "content": user_content}],
        )
        content2 = response2.content[0].text if response2.content else "{}"
        result = json.loads(_extract_json(content2))


    result.setdefault("meta", {})
    result["meta"].setdefault("advisorsConsidered", len(all_advisors))
    result["meta"].setdefault("advisorsConvened", len(convened))
    result["meta"].setdefault("missingDealFields", deal_brief.get("missingFields", []))
    result["meta"].setdefault(
        "disclaimer",
        "These are AI models of publicly documented investment philosophies, not the real individuals, and are not investment advice.",
    )
    return result


CHAT_SYSTEM_PROMPT_TEMPLATE = """You are continuing a live conversation as the AI board advisor(s) named below: {names}. The investor already saw your initial deliberation on this deal and now has a follow-up question.

You are given the DEAL BRIEF (the deal's real underwriting numbers — use ONLY these, never invent a figure) and the full persona(s) for {names}.

Answer the investor's question directly, in each advisor's own documented voice and philosophy, grounded in the deal's real numbers. Keep each advisor's reply to 2-4 sentences — clean, final statements only. No visible reasoning process, no "let me think", no meta-commentary about what you are doing. If a needed number isn't in the DEAL BRIEF, say so plainly instead of guessing. If multiple advisors are named, they may agree or disagree with each other honestly — do not force consensus.

Return ONLY a JSON object of this exact shape, no markdown fences, no prose outside the JSON:
{{
  "replies": [
    {{ "advisor": "Name", "reply": "2-4 sentence direct answer in their voice, grounded in the deal brief" }}
  ]
}}"""


def chat_with_advisors(
    scenario_data: Dict[str, Any],
    analysis: Optional[Dict[str, Any]],
    convened_names: List[str],
    target: str,
    message: str,
    history: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Follow-up chat with one convened advisor or all of them ("All").
    Grounded in the same Deal Brief as the initial deliberation; never
    re-invents deal data or fabricates advisor quotes."""
    all_advisors = load_all_advisors()
    if not message or not message.strip():
        raise ValueError("message is required")

    if target == "All":
        names = [n for n in convened_names if n in all_advisors]
    else:
        names = [target] if target in all_advisors else []
    if not names:
        raise ValueError(f"No matching convened advisor found for target '{target}'")

    deal_brief = build_deal_brief(scenario_data, analysis)
    persona_text = "\n\n---\n\n".join(all_advisors[n] for n in names)

    history_text = ""
    if history:
        lines = []
        for turn in history[-12:]:
            role = turn.get("role", "user")
            if role == "user":
                lines.append(f"Investor: {turn.get('content', '')}")
            else:
                for r in turn.get("replies", []):
                    lines.append(f"{r.get('advisor', 'Board')}: {r.get('reply', '')}")
        history_text = "\n".join(lines)

    system_prompt = CHAT_SYSTEM_PROMPT_TEMPLATE.format(names=", ".join(names))
    user_content = (
        "DEAL BRIEF:\n" + json.dumps(deal_brief, indent=2, default=str) +
        "\n\nADVISOR PERSONA(S):\n" + persona_text +
        (("\n\nCONVERSATION SO FAR:\n" + history_text) if history_text else "") +
        f"\n\nInvestor's new question: {message}\n\nRespond now."
    )

    client = _get_client()
    response = client.messages.create(
        model=ANTHROPIC_MODEL_FAST,
        max_tokens=1500,
        system=system_prompt,
        messages=[{"role": "user", "content": user_content}],
    )
    content = response.content[0].text if response.content else "{}"

    try:
        result = json.loads(_extract_json(content))
    except json.JSONDecodeError:
        response2 = client.messages.create(
            model=ANTHROPIC_MODEL_FAST,
            max_tokens=1500,
            system=system_prompt + "\n\nIMPORTANT: your previous response was not valid JSON. Return ONLY the JSON object, nothing else.",
            messages=[{"role": "user", "content": user_content}],
        )
        content2 = response2.content[0].text if response2.content else "{}"
        result = json.loads(_extract_json(content2))

    result.setdefault("replies", [])
    return result
