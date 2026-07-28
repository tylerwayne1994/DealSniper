"""
Financial Due Diligence Auditor — calls Claude to find real irregularities,
anomalies, and red flags in T-12 operating statements, expense schedules,
and rent rolls. Returns structured JSON findings the frontend uses to
highlight the exact cell/row that triggered the flag.
"""

import os
import re
import json
import logging
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

log = logging.getLogger("financial_audit")

router = APIRouter(prefix="/api/underwrite", tags=["Financial Due Diligence"])

# ── Anthropic client (injected from App.py at startup, same pattern as red_flag_scanner) ──
ANTHROPIC_CLIENT = None
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929")

MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


class AuditRequest(BaseModel):
    section: str                       # "t12" | "expenses" | "rentroll"
    dealName: Optional[str] = None
    units: Optional[int] = None
    data: Dict[str, Any] = {}          # section-specific payload


class AuditFinding(BaseModel):
    rowKey: Optional[str] = None       # T-12/expense line key (e.g. "reTax", "payroll")
    month: Optional[int] = None        # 0-11 index into T-12 months, null if not month-specific
    unitId: Optional[str] = None       # rent roll unit identifier, if section == "rentroll"
    severity: str = "warning"          # "critical" | "warning"
    label: str
    detail: str


class AuditResponse(BaseModel):
    findings: List[AuditFinding]


SYSTEM_PROMPT = """You are a senior commercial real estate due-diligence analyst reviewing raw underwriting
data (T-12 operating statements, expense schedules, and rent rolls) for a multifamily acquisition.

Your job: find REAL irregularities — things a sharp analyst would flag before wiring earnest money.
Look for: unexplained spikes or drops in expense/income line items, suspicious credits/refunds in expense
lines, missing months, seasonality that doesn't make sense, expenses that are unusually low/high vs. per-unit
norms, below-market or above-market rents, concentration risk in lease expirations, month-to-month tenants,
delinquency patterns, or anything that looks like a broker/seller number that doesn't hold up to scrutiny.

Respond with ONLY valid JSON (no markdown fences, no commentary) in this exact shape:
{
  "findings": [
    {
      "rowKey": "reTax",
      "month": 4,
      "unitId": null,
      "severity": "critical",
      "label": "Real Estate Taxes",
      "detail": "One sentence, specific, cites the actual dollar figures and why it's a red flag."
    }
  ]
}

Rules:
- Return at most 12 findings, most severe first.
- "severity" must be "critical" or "warning".
- For T-12/expenses findings, "rowKey" MUST be one of the exact keys provided in the input data and "month"
  must be the 0-based month index that triggered the flag (or null if it's a full-year pattern).
- For rent roll findings, set "unitId" to the exact unit id/number provided and leave "rowKey"/"month" null.
- If you find nothing genuinely concerning, return {"findings": []}. Do not invent problems.
"""


def _build_user_message(req: AuditRequest) -> str:
    parts = [f"DEAL: {req.dealName or 'Unnamed Deal'}"]
    if req.units:
        parts.append(f"TOTAL UNITS: {req.units}")

    if req.section in ("t12", "expenses"):
        rows: Dict[str, List[float]] = req.data.get("rows", {})
        parts.append(f"\nSECTION: {'Expense Schedule' if req.section == 'expenses' else 'T-12 Operating Statement'} (monthly values, {MONTH_NAMES[0]}–{MONTH_NAMES[-1]})")
        for key, vals in rows.items():
            label = req.data.get("labels", {}).get(key, key)
            formatted = ", ".join(f"{MONTH_NAMES[i]}: ${v:,.0f}" for i, v in enumerate(vals))
            parts.append(f"- {key} ({label}): {formatted}")
    elif req.section == "rentroll":
        rows: List[Dict[str, Any]] = req.data.get("units", [])
        parts.append(f"\nSECTION: Rent Roll ({len(rows)} units shown)")
        for u in rows:
            parts.append(
                f"- Unit {u.get('unit')}: type={u.get('type')}, status={'Vacant' if u.get('vacant') else 'Occupied'}, "
                f"rent=${u.get('rent', 0):,.0f}, sf={u.get('sf')}, leaseStart={u.get('leaseStart')}, "
                f"leaseExp={u.get('leaseExp')}, tenureYears={u.get('tenureYears')}"
            )

    parts.append("\nAnalyze the data above and return your findings as JSON per the required schema.")
    return "\n".join(parts)


@router.post("/financial-audit", response_model=AuditResponse)
async def financial_audit(req: AuditRequest):
    if not ANTHROPIC_CLIENT:
        raise HTTPException(status_code=500, detail="AI analysis is not configured (missing ANTHROPIC_API_KEY).")

    if req.section not in ("t12", "expenses", "rentroll"):
        raise HTTPException(status_code=400, detail="section must be 't12', 'expenses', or 'rentroll'")

    user_message = _build_user_message(req)

    try:
        response = ANTHROPIC_CLIENT.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=2500,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
        raw_text = response.content[0].text.strip()
    except Exception as e:
        log.error(f"[FINANCIAL AUDIT] LLM error: {e}")
        raise HTTPException(status_code=500, detail="AI analysis failed. Please try again.")

    try:
        cleaned = re.sub(r'^```(?:json)?\s*', '', raw_text)
        cleaned = re.sub(r'\s*```$', '', cleaned)
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r'\{[\s\S]*\}', raw_text)
        if match:
            try:
                data = json.loads(match.group())
            except Exception:
                log.error(f"[FINANCIAL AUDIT] JSON parse failed. Raw: {raw_text[:500]}")
                raise HTTPException(status_code=500, detail="Failed to parse AI analysis. Please try again.")
        else:
            log.error(f"[FINANCIAL AUDIT] No JSON in response. Raw: {raw_text[:500]}")
            raise HTTPException(status_code=500, detail="AI returned invalid analysis. Please try again.")

    findings_raw = data.get("findings", []) or []
    findings = []
    for f in findings_raw[:12]:
        try:
            findings.append(AuditFinding(
                rowKey=f.get("rowKey"),
                month=f.get("month"),
                unitId=str(f.get("unitId")) if f.get("unitId") is not None else None,
                severity=f.get("severity") if f.get("severity") in ("critical", "warning") else "warning",
                label=f.get("label") or f.get("rowKey") or "Finding",
                detail=f.get("detail") or "",
            ))
        except Exception:
            continue

    return AuditResponse(findings=findings)
