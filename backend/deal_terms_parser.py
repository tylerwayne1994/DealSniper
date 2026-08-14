"""
Freeform "type out your deal terms" parser for the Upload page.

Lets a user type something like "6% interest, 30 year am, 20% down, I have
an investor coming in with the 20% down" in plain English instead of hunting
through the financing wizard fields one at a time. Uses forced tool-calling
(not freeform text parsing) so the output is guaranteed-valid structured
JSON that maps directly onto the same `financing` object shape
UnderwriteV2Page.jsx already builds from the wizard/template defaults.
"""

import os
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from anthropic import Anthropic

log = logging.getLogger("deal_terms_parser")

router = APIRouter(prefix="/api", tags=["Deal Terms Parser"])

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
# Cheap/fast model — this is a short, low-stakes extraction task, not the
# heavy document parsing/analysis work that needs the flagship model.
ANTHROPIC_MODEL_FAST = os.getenv("ANTHROPIC_MODEL_FAST", "claude-3-5-haiku-20241022")

DEAL_TERMS_TOOL = {
    "name": "submit_deal_terms",
    "description": "Extract structured financing/deal terms from a sponsor's freeform description of how they want to structure a deal.",
    "input_schema": {
        "type": "object",
        "properties": {
            "interest_rate": {"type": ["number", "null"], "description": "Annual interest rate as a percentage, e.g. 6.5 for 6.5%. Null if not mentioned."},
            "amortization_years": {"type": ["integer", "null"], "description": "Amortization period in years, e.g. 30. Null if not mentioned."},
            "loan_term_years": {"type": ["integer", "null"], "description": "Loan term in years, e.g. 10. Null if not mentioned."},
            "ltv": {"type": ["number", "null"], "description": "Loan-to-value as a percentage, e.g. 80 for 80% LTV. If the user gave a down payment % instead, compute ltv = 100 - down_payment_pct."},
            "down_payment_pct": {"type": ["number", "null"], "description": "Down payment as a percentage, e.g. 20 for 20% down. Null if not mentioned."},
            "io_years": {"type": ["number", "null"], "description": "Interest-only period in years (convert months to years if stated in months). Null if not mentioned."},
            "loan_fees_percent": {"type": ["number", "null"], "description": "Loan/origination fees as a percentage. Null if not mentioned."},
            "exit_cap_rate": {"type": ["number", "null"], "description": "Exit/disposition cap rate as a percentage. Null if not mentioned."},
            "holding_period_years": {"type": ["integer", "null"], "description": "Intended hold period in years. Null if not mentioned."},
            "equity_notes": {"type": "string", "description": "Verbatim-ish summary of anything about equity sources, investors, or partners mentioned (e.g. 'Investor is funding the 20% down payment'). Empty string if none mentioned."},
            "unrecognized": {"type": "string", "description": "Anything meaningful the user said that doesn't map to the fields above. Empty string if everything was captured."},
        },
        "required": [],
    },
}

SYSTEM_PROMPT = """You extract structured commercial real estate financing terms from a sponsor's short, informal description of how they want to underwrite a deal. Only extract what's actually stated -- never invent or assume a number that wasn't mentioned or clearly implied (e.g. "20% down" clearly implies 80% LTV, that's fine to compute). Always call the submit_deal_terms tool exactly once."""


class DealTermsRequest(BaseModel):
    text: str


@router.post("/parse-deal-terms")
async def parse_deal_terms(body: DealTermsRequest):
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="No text provided")
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="Deal terms parsing is not configured on this server")

    client = Anthropic(api_key=ANTHROPIC_API_KEY)
    try:
        resp = client.messages.create(
            model=ANTHROPIC_MODEL_FAST,
            max_tokens=500,
            system=SYSTEM_PROMPT,
            tools=[DEAL_TERMS_TOOL],
            tool_choice={"type": "tool", "name": "submit_deal_terms"},
            messages=[{"role": "user", "content": text}],
        )
    except Exception as e:
        log.exception("parse_deal_terms Claude call failed")
        raise HTTPException(status_code=502, detail=f"Failed to parse deal terms: {e}")

    tool_use = next((b for b in resp.content if getattr(b, "type", None) == "tool_use"), None)
    if not tool_use:
        raise HTTPException(status_code=502, detail="Claude did not return structured deal terms")

    terms = dict(tool_use.input or {})
    # Fill in the complementary LTV/down-payment field so the frontend never
    # has to guess which one the user actually said.
    if terms.get("ltv") is None and terms.get("down_payment_pct") is not None:
        terms["ltv"] = round(100 - float(terms["down_payment_pct"]), 2)
    if terms.get("down_payment_pct") is None and terms.get("ltv") is not None:
        terms["down_payment_pct"] = round(100 - float(terms["ltv"]), 2)

    return {"success": True, "terms": terms}
