"""
Deal Room investment narrative builder.
----------------------------------------
Grounds every generated sentence in real data: the deal's own parsed
property/financing/strategy data, the platform's own calculated returns, and
real local-market data (population, employment, migration, FMR, cap rates)
pulled from the same pipeline used by the Market Analysis tab
(market_analysis.py — Census API + client/public CSVs, with an LLM fallback
only where market_analysis.py itself already falls back).

Nothing here invents a number. The system prompt explicitly forbids
mentioning a data category that wasn't provided, and forbids applying a
fixed generic value-add playbook — it describes whatever strategy is
actually present in the deal's own data.
"""
import os
import json
import logging
from typing import Any, Dict, Optional

from anthropic import Anthropic

log = logging.getLogger("deal_room_narrative")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")


def _get_client() -> Anthropic:
    if not ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY not configured")
    return Anthropic(api_key=ANTHROPIC_API_KEY)


async def build_market_context(property_info: Dict[str, Any]) -> Dict[str, Any]:
    """Reuse the existing Market Analysis pipeline (real Census/FMR/migration
    data) for this deal's address. Returns {} if the address is incomplete
    or the lookup fails — callers must treat that as "no market data"."""
    address = property_info.get("address")
    city = property_info.get("city")
    state = property_info.get("state")
    zip_code = property_info.get("zip") or property_info.get("zipcode")

    if not all([address, city, state, zip_code]):
        log.info("[DealRoomNarrative] Incomplete address, skipping market context")
        return {}

    try:
        from market_analysis import market_analysis_endpoint, MarketAnalysisRequest, PropertyData
        req = MarketAnalysisRequest(
            property=PropertyData(address=address, city=city, state=state, zip=zip_code),
            drive_time_minutes=15,
        )
        result = await market_analysis_endpoint(req)
        return result if isinstance(result, dict) else {}
    except Exception as e:
        log.warning(f"[DealRoomNarrative] Market context lookup failed: {e}")
        return {}


NARRATIVE_SYSTEM_PROMPT = """You are a commercial real estate investment analyst writing the \
narrative sections of an investor-facing Deal Room document.

You will receive a JSON payload with whatever real data exists for this specific deal: parsed \
property/financing/income/expense data, the platform's own calculated returns, the deal's actual \
value-add/renovation/rent strategy (if any), and local-market statistics (population, employment, \
migration, Fair Market Rents, cap rates) for the property's location.

CRITICAL RULES:
1. Only reference data categories that are actually present in the payload. If population, \
   employment, migration, FMR, or any other market stat is missing, do NOT mention it at all — \
   never write "data not available" or similar; simply omit it, as if it were never a topic.
2. Do not apply a generic, fixed value-add playbook (e.g. don't assume RUBS + rent bump + \
   renovation just because that's common). Describe ONLY the strategy that is actually present in \
   the deal's own data — if the payload has no explicit value-add/renovation data, keep the "Why \
   This Asset" and "Upside Plays" sections focused on the deal's real in-place financials instead \
   of inventing a strategy.
3. Every number you cite must come directly from the payload. Never estimate, round to a "nicer" \
   number that wasn't given, or fabricate a data point.
4. Write in a confident, institutional tone — no marketing fluff, no exclamation points.

Return ONLY a JSON object with this shape (omit any key you have no real basis for):
{
  "whyMarket": ["paragraph 1", "paragraph 2"],
  "whyAsset": ["paragraph 1", "paragraph 2"],
  "upsidePlays": [
    {"title": "Short title of the real play found in the data", "paragraphs": ["..."]}
  ],
  "operationalPlan": [
    {"title": "Section title", "bullets": ["...", "..."]}
  ]
}
Return ONLY valid JSON — no markdown fences, no commentary."""


def _extract_json(content: str) -> str:
    content = content.strip()
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0]
    elif "```" in content:
        content = content.split("```")[1].split("```")[0]
    return content.strip()


def build_investment_narrative(payload: Dict[str, Any]) -> Dict[str, Any]:
    """One Claude call: real deal data + real market data in, grounded
    narrative JSON out. Returns {} (not an error) if generation fails, so
    the frontend can simply not render the section rather than show junk."""
    try:
        client = _get_client()
        response = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=3000,
            system=NARRATIVE_SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": "Write the Deal Room narrative sections from this deal data:\n\n" + json.dumps(payload, indent=2, default=str),
            }],
        )
        content = response.content[0].text if response.content else "{}"
        narrative = json.loads(_extract_json(content))
        return narrative
    except Exception as e:
        log.error(f"[DealRoomNarrative] Narrative generation failed: {e}")
        return {}


def build_narrative_payload(
    scenario_data: Dict[str, Any],
    calculations: Optional[Dict[str, Any]] = None,
    market_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Assemble only the real, present fields into the payload sent to Claude."""
    property_info = scenario_data.get("property", {}) or {}
    pricing = scenario_data.get("pricing_financing", {}) or {}
    unit_mix = scenario_data.get("unit_mix", []) or []
    value_add = scenario_data.get("value_add") or scenario_data.get("valueAdd") or {}

    payload: Dict[str, Any] = {"property": property_info}
    if pricing:
        payload["pricing_financing"] = pricing
    if unit_mix:
        payload["unit_mix"] = unit_mix
    if value_add:
        payload["value_add_strategy"] = value_add
    if calculations:
        payload["calculations"] = calculations
    if market_context:
        # Only forward the real sub-sections, never the whole raw geometry blob.
        trimmed = {}
        for key in ("county_data", "zip_data", "msa_data", "fmr", "market_cap_rate", "zip_renter_owner", "area_classification"):
            if market_context.get(key):
                trimmed[key] = market_context[key]
        if trimmed:
            payload["market_data"] = trimmed
    return payload


DEAL_CHAT_SYSTEM_PROMPT = """You are a knowledgeable real estate investment analyst answering \
questions about a specific multifamily deal for the sponsor reviewing it.

You will receive a JSON payload with whatever real data exists for this deal: parsed property/\
financing/income/expense data, the platform's own calculated returns, the deal's value-add/\
renovation strategy (if any), and real local-market statistics (population, employment, migration, \
Fair Market Rents, cap rates) for the property's location.

CRITICAL RULES:
1. Answer ONLY using the data in the payload and the conversation so far. Never invent a number \
   that isn't present. If something isn't in the payload, say you don't have that data point rather \
   than guessing or estimating.
2. When asked about "the market" or "current market conditions," ground your answer in the \
   market_data section of the payload (population, employment, migration, FMR, cap rate, area \
   classification) — do not speak in vague generalities if real data is available, and say so \
   plainly if it isn't.
3. Be direct and concise — a few sentences or a short list, not a wall of text, unless the user \
   explicitly asks for a deep breakdown.
4. You are not a calculator — don't recompute the deal's numbers, just read and explain the ones \
   given in "calculations".

Respond conversationally in plain text (no JSON, no markdown code fences)."""


def chat_about_deal(payload: Dict[str, Any], message: str, history: Optional[list] = None) -> str:
    """One Claude call: answer a free-form question about this deal and its
    real local market data. `history` is the prior turns of this
    conversation as [{role: 'user'|'assistant', content: str}, ...] — the
    full deal+market payload is re-sent every turn since the API itself is
    stateless between requests."""
    if not message or not message.strip():
        raise ValueError("message is required")

    history_text = ""
    if history:
        lines = []
        for turn in history[-16:]:
            role = turn.get("role", "user")
            content = turn.get("content", "")
            if not content:
                continue
            lines.append(f"{'Investor' if role == 'user' else 'Analyst'}: {content}")
        history_text = "\n".join(lines)

    user_content = (
        "DEAL + MARKET DATA (JSON, read-only):\n" + json.dumps(payload, indent=2, default=str) +
        (("\n\nCONVERSATION SO FAR:\n" + history_text) if history_text else "") +
        f"\n\nInvestor's new question: {message}\n\nRespond now."
    )

    client = _get_client()
    response = client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=1200,
        system=DEAL_CHAT_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    )
    return response.content[0].text if response.content else "Sorry, I couldn't generate a response."
