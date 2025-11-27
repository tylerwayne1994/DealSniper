# app.py  — Underwriting backend w/ financing modes + comprehensive metrics
# Python 3.10+  |  uvicorn app:app --host 127.0.0.1 --port 8010 --reload

import os, io, json, base64, re
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from cors_config import install_cors

from pypdf import PdfReader, PdfWriter
from dotenv import load_dotenv

from mistralai import Mistral
from anthropic import Anthropic

# from protected_routes import router as protected_router  # Moved to after startup
# Optional local parsers (kept for compatibility; not required)
# try:
#     from parser_v4 import parse_om as PARSER_V4_PARSE_OM
#     HAS_PARSER_V4 = True
# except Exception:
#     PARSER_V4_PARSE_OM = None
#     HAS_PARSER_V4 = False

PARSER_V4_PARSE_OM = None
HAS_PARSER_V4 = False

load_dotenv()

# Configurable Anthropic model name (set ANTHROPIC_MODEL in env to override)
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-haiku-20240307")

# ---------------- Config / Keys ----------------
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
# support both env names
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")

MISTRAL = None
ANTHROPIC = None

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://terra-investai.com"
]
MAX_BYTES = 50 * 1024 * 1024
OCR_MODEL = "mistral-ocr-latest"


# ---- CORS allowed origins ----
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    # add your prod domain here when you deploy
    "https://terra-investai.com",
]

ALLOWED_DOC_MIMES = {
    "application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp",
}
ALLOWED_SHEET_MIMES = {
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
ALLOWED_UPLOAD_MIMES = set(ALLOWED_DOC_MIMES) | set(ALLOWED_SHEET_MIMES)

PARSER_STRATEGY_DEFAULT = (os.getenv("PARSER_STRATEGY") or "claude").strip().lower()


app = FastAPI(title="Underwriting Backend", version="9.0.0")
install_cors(app)

import logging
log = logging.getLogger("app")
logging.basicConfig(level=logging.INFO)


def _preview(key: str, length: int = 8) -> str:
    if not key:
        return "None"
    return f"{key[:length]}..."


log.info("[ENV] Stripe key prefix: %s", _preview(os.getenv("STRIPE_SECRET_KEY")))
log.info("[ENV] Frontend URL: %s", os.getenv("FRONTEND_URL"))
log.info("[ENV] Stripe webhook secret prefix: %s", _preview(os.getenv("STRIPE_WEBHOOK_SECRET")))

@app.on_event("startup")
async def _init_clients():
    global MISTRAL, ANTHROPIC

    if MISTRAL_API_KEY:
        try:
            MISTRAL = Mistral(api_key=MISTRAL_API_KEY)
        except Exception as e:
            log.exception("Failed to init Mistral: %s", e)
    else:
        log.warning("MISTRAL_API_KEY missing")

    if ANTHROPIC_API_KEY:
        try:
            ANTHROPIC = Anthropic(api_key=ANTHROPIC_API_KEY)
        except Exception as e:
            log.exception("Failed to init Anthropic: %s", e)
    else:
        log.warning("ANTHROPIC_API_KEY/CLAUDE_API_KEY missing")

# ---------------- Utils ----------------
def _to_data_url(file_bytes: bytes, mime: str) -> str:
    return f"data:{mime};base64,{base64.b64encode(file_bytes).decode('utf-8')}"

def _parse_pages_string(pages: str, total_pages: int) -> List[int]:
    pages = (pages or "").replace(" ", "")
    if not pages:
        return []
    result = set()
    for chunk in pages.split(","):
        if "-" in chunk:
            a, b = chunk.split("-", 1)
            start, end = int(a), int(b)
            if start < 1 or end > total_pages or start > end:
                raise ValueError(f"Bad range '{chunk}' (doc has {total_pages} pages)")
            for p in range(start, end + 1):
                result.add(p - 1)
        else:
            p = int(chunk)
            if p < 1 or p > total_pages:
                raise ValueError(f"Bad page '{chunk}'")
            result.add(p - 1)
    return sorted(result)

def _slice_pdf(pdf_bytes: bytes, pages_spec: str) -> bytes:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    idxs = _parse_pages_string(pages_spec, len(reader.pages))
    if not idxs:
        return pdf_bytes
    writer = PdfWriter()
    for i in idxs:
        writer.add_page(reader.pages[i])
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()

def _num(v) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    if not s:
        return None
    neg = s.startswith("(") and s.endswith(")")
    s = s.replace("$", "").replace(",", "").replace("%", "").replace("(", "").replace(")", "")
    try:
        x = float(s)
        return -x if neg else x
    except:
        return None

def _as_number(v):
    try:
        return float(v) if v is not None else None
    except Exception:
        return None

# ---------------- OCR + Claude ----------------
def _call_mistral_ocr(doc_bytes: bytes, mime: str) -> dict:
    if MISTRAL is None:
        raise HTTPException(status_code=503, detail="Mistral not configured")
    
    try:
        resp = MISTRAL.ocr.process(
            model=OCR_MODEL,
            document={"type": "document_url", "document_url": _to_data_url(doc_bytes, mime)},
            include_image_base64=False,
        )
        return json.loads(resp.model_dump_json())
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Mistral OCR call failed: {e}")

def _call_claude_parse_from_markdown(ocr_text: str, financing_params: Optional[Dict] = None) -> Dict[str, Any]:
    financing_lines = []
    if financing_params:
        financing_lines.append("USER FINANCING (use when applicable):")
        for k, v in financing_params.items():
            financing_lines.append(f"- {k}: {v}")
    financing_context = "\n".join(financing_lines)

    schema_block = """
Return ONLY JSON. Extract EVERYTHING into this schema.

{
  "property": {
    "address": "", "city": "", "state": "", "zip": "",
    "units": 0, "year_built": 0, "rba_sqft": 0, "land_area_acres": 0,
    "property_type": "", "property_class": "", "parking_spaces": 0
  },
  "pricing_financing": {
    "price": 0, "price_per_unit": 0, "price_per_sf": 0,
    "loan_amount": 0, "down_payment": 0, "interest_rate": 0, "ltv": 0,
    "term_years": 0, "amortization_years": 0, "io_period_years": 0,
    "monthly_payment": 0, "annual_debt_service": 0, "debt_type": "",
    "balloon_amount": 0
  },
  "pnl": {
    "gross_potential_rent": 0, "other_income": 0,
    "vacancy_rate": 0, "vacancy_amount": 0,
    "effective_gross_income": 0,
    "operating_expenses": 0, "noi": 0, "cap_rate": 0, "expense_ratio": 0
  },
  "expenses": {
    "taxes": 0, "insurance": 0, "utilities": 0, "repairs_maintenance": 0,
    "management": 0, "payroll": 0, "admin": 0, "marketing": 0, "other": 0, "total": 0
  },
  "unit_mix": [{"type":"", "units":0, "unit_sf":0, "rent_current":0, "rent_market":0}],
  "underwriting": {"dscr":0, "cap_rate":0, "cash_on_cash":0, "irr":0},
  "deal_analysis": {}, "suggested_financing": {}, "time_periods": {},
  "data_quality": {"confidence":0.0, "missing_fields":[], "assumptions":[]}
}
""".strip()

    prompt = (
        "You are an expert underwriter. Parse ALL financial and property data.\n\n"
        "OCR TEXT\n--------\n" + ocr_text + "\n\n" + schema_block + "\n\n" + financing_context
    )

    if ANTHROPIC is None:
        raise HTTPException(status_code=503, detail="Anthropic/Claude not configured")

    try:
        res = ANTHROPIC.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=4000,
            temperature=0,
            messages=[{"role": "user", "content": prompt}],
        )
        txt = res.content[0].text.strip().replace("```json", "").replace("```", "")
        m = re.search(r"\{.*\}\s*$", txt, re.DOTALL)
        return json.loads(m.group(0) if m else txt)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"Claude JSON parse failed: {e}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Claude API error: {e}")

# ---------------- Deterministic Extractors ----------------
CITY_STATE_ZIP_RE = re.compile(r"([A-Za-z .'\-]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)")

def _extract_address(md: str) -> Dict[str, str]:
    out = {"address": "", "city": "", "state": "", "zip": ""}
    lines = [l.strip() for l in (md or "").splitlines()]
    for i, ln in enumerate(lines):
        m = CITY_STATE_ZIP_RE.search(ln)
        if m:
            out["city"], out["state"], out["zip"] = m.group(1).strip(), m.group(2), m.group(3)
            for j in range(i - 1, max(-1, i - 5), -1):
                prev = lines[j].strip()
                if prev and any(ch.isdigit() for ch in prev):
                    out["address"] = prev
                    break
            break
    return out

def _extract_unit_mix_from_markdown(md: str) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    in_mix = False
    for raw in (md or "").splitlines():
        ln = raw.strip()
        lnl = ln.lower()
        if ("unit mix" in lnl) or ("rent roll" in lnl):
            in_mix = True
            continue
        if in_mix and (not ln or lnl.startswith("operating") or lnl.startswith("income")):
            if rows:
                break
        if not in_mix:
            continue
        cols = [c for c in re.split(r"\s{2,}|\t", ln) if c.strip()]
        if len(cols) >= 4 and (("bed" in cols[0].lower()) or ("studio" in cols[0].lower()) or re.search(r"\dbr", cols[0].lower())):
            u = _num(cols[1]); sf = _num(cols[2]); rc = _num(cols[3]); rm = _num(cols[4]) if len(cols) >= 5 else rc
            if u is not None:
                rows.append({
                    "type": cols[0].replace("–", "-"),
                    "units": int(u or 0),
                    "unit_sf": float(sf or 0),
                    "rent_current": float(rc or 0),
                    "rent_market": float(rm or (rc or 0)),
                })
    return rows

_PRICING_BLOCK_RE = re.compile(r"\bPRICING DETAIL\b(?:.|\n){0,2000}", re.IGNORECASE)
_PRICE_LINE_RE   = re.compile(r"\b(List|Asking|Offer(?:ing)?) Price\b[: ]*\$?\(?([\d,]+(?:\.\d+)?)\)?", re.IGNORECASE)
_UNITS_LINE_RE   = re.compile(r"\b(Number of Units|Total Units)\b[: ]*([\d,]+)", re.IGNORECASE)
_PPU_LINE_RE     = re.compile(r"\bPrice per Unit\b[: ]*\$?\(?([\d,]+(?:\.\d+)?)\)?", re.IGNORECASE)
_RSF_LINE_RE     = re.compile(r"\b(Rentable(?:\s+Square\s+Foot)?|Rentable SF|RBA|Building SF)\b[: ]*([\d,]+)", re.IGNORECASE)
_PSF_LINE_RE     = re.compile(r"\bPrice per Square Foot\b[: ]*\$?\(?([\d,]+(?:\.\d+)?)\)?", re.IGNORECASE)
_LOTSZ_SF_RE     = re.compile(r"\b(Lot Size|Site Area)\b[: ]*([\d,]+)\s*SF\b", re.IGNORECASE)
_LOTSZ_AC_RE     = re.compile(r"\b(Lot Size|Site Area)\b[: ]*([\d\.]+)\s*acres?\b", re.IGNORECASE)

def _extract_pricing_detail_from_markdown(md: str) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    block = (_PRICING_BLOCK_RE.search(md or "") or re.search(r"\bPRICING\b(?:.|\n){0,2000}", md or "", re.IGNORECASE))
    text = block.group(0) if block else (md or "")
    m = _PRICE_LINE_RE.search(text); out["price"] = _num(m.group(2)) if m else None
    m = _UNITS_LINE_RE.search(text); out["units"] = _num(m.group(2)) if m else None
    m = _PPU_LINE_RE.search(text);   out["price_per_unit"] = _num(m.group(1)) if m else None
    m = _RSF_LINE_RE.search(text);   out["rba_sqft"] = _num(m.group(2)) if m else None
    m = _PSF_LINE_RE.search(text);   out["price_per_sf"] = _num(m.group(1)) if m else None
    m = _LOTSZ_SF_RE.search(text)
    if m: out["land_area_sf"] = _num(m.group(2))
    m = _LOTSZ_AC_RE.search(text)
    if m: out["land_area_acres"] = _num(m.group(2))
    return out

_OP_SUM_RE = re.compile(r"\b(OPERATING SUMMARY|INCOME STATEMENT)\b(?:.|\n){0,3500}", re.IGNORECASE)
_LABEL_MAP = {
    "GROSS POTENTIAL RE": "gross_potential_rent",
    "GROSS POTENTIAL RENT": "gross_potential_rent",
    "TOTAL ECONOMIC LOSSES": "vacancy_amount",
    "VACANCY": "vacancy_amount",
    "OTHER INCOME": "other_income",
    "EFFECTIVE GROSS INCOME": "effective_gross_income",
    "REAL ESTATE TAXES": "taxes",
    "INSURANCE": "insurance",
    "GENERAL & ADMINISTRATIVE": "admin",
    "GENERAL AND ADMINISTRATIVE": "admin",
    "REPAIRS, MAINTENANCE, & CONTRACT SERVICES": "repairs_maintenance",
    "REPAIRS, MAINTENANCE. & CONTRACT SERVICES": "repairs_maintenance",
    "REPAIRS & MAINTENANCE": "repairs_maintenance",
    "REPAIRS": "repairs_maintenance",
    "UTILITIES": "utilities",
    "TURNOVER & MARKETING": "marketing",
    "MARKETING": "marketing",
    "MANAGEMENT & LEASING": "management",
    "MANAGEMENT": "management",
    "RESERVES": "other",
    "TOTAL OPERATING EXPENSES": "operating_expenses",
    "NET OPERATING INCOME": "noi",
}
def _extract_operating_summary_from_markdown(md: str) -> Dict[str, Any]:
    out_pnl: Dict[str, Any] = {}
    out_exp: Dict[str, Any] = {}
    block_m = _OP_SUM_RE.search(md or "")
    text = block_m.group(0) if block_m else (md or "")
    if not text:
        return {"pnl": {}, "expenses": {}}
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        mnum = re.search(r"\$?\(?-?[\d,]+(?:\.\d+)?\)?", line)
        if not mnum:
            continue
        actual = _num(mnum.group(0))
        label = re.sub(r"\$?\(?-?[\d,]+(?:\.\d+)?\)?.*$", "", line).strip().upper()
        key = None
        for k, v in _LABEL_MAP.items():
            if k in label:
                key = v; break
        if key is None:
            continue
        if key in {"taxes","insurance","admin","repairs_maintenance","utilities","marketing","management","other"}:
            out_exp[key] = actual
        else:
            out_pnl[key] = actual
    if out_exp and "operating_expenses" not in out_pnl:
        out_pnl["operating_expenses"] = sum(v for v in out_exp.values() if isinstance(v, (int, float)))
    if out_pnl.get("gross_potential_rent") is not None and out_pnl.get("vacancy_amount") is not None:
        gpr = out_pnl["gross_potential_rent"]; vac = abs(out_pnl["vacancy_amount"])
        if gpr:
            out_pnl["vacancy_rate"] = round(vac / gpr, 4)
    return {"pnl": out_pnl, "expenses": out_exp}

RECOVERY_KEYWORDS = [
    "PRICING DETAIL","LIST PRICE","ASKING PRICE","OFFERING PRICE","PURCHASE PRICE",
    "PRICE PER UNIT","PRICE PER SQUARE FOOT","NUMBER OF UNITS","RENTABLE SQUARE FOOT","RBA","LOT SIZE",
    "OPERATING SUMMARY","INCOME STATEMENT","GROSS POTENTIAL RENT","EFFECTIVE GROSS INCOME",
    "OTHER INCOME","VACANCY","OPERATING EXPENSES","NET OPERATING INCOME","NOI",
    "UNIT MIX","RENT ROLL","MARKET RENT","CURRENT RENT","ADDRESS","PROPERTY OVERVIEW"
]
def _pages_with_keywords(ocr_json: dict, keywords: List[str]) -> List[int]:
    hits = []
    for i, p in enumerate(ocr_json.get("pages", []) or []):
        md = (p.get("markdown") or "").lower()
        if any(k.lower() in md for k in keywords):
            hits.append(i)
    return sorted(set(hits)) or list(range(min(3, len(ocr_json.get("pages", [])))))

def _merge_truthy(dst: Dict[str, Any], src: Dict[str, Any], fields: List[str]):
    for f in fields:
        v = src.get(f)
        if v is not None and v != "":
            dst[f] = v

# ---------------- Normalize / Enrich / Compute ----------------
def _normalize_parsed(raw: Dict[str, Any]) -> Dict[str, Any]:
    property_ = raw.get("property", {}) or {}
    pricing   = raw.get("pricing_financing", {}) or {}
    pnl_in    = raw.get("pnl", {}) or {}
    expenses_in = raw.get("expenses", {}) or {}

    pnl = {
        "gross_potential_rent": _as_number(pnl_in.get("gross_potential_rent") or pnl_in.get("scheduled_gross_rent_current") or pnl_in.get("market_rent_current")),
        "other_income": _as_number(pnl_in.get("other_income")),
        "vacancy_rate": _as_number(pnl_in.get("vacancy_rate") or pnl_in.get("vacancy_rate_current")),
        "vacancy_amount": _as_number(pnl_in.get("vacancy_amount") or pnl_in.get("vacancy_amount_current")),
        "effective_gross_income": _as_number(pnl_in.get("effective_gross_income") or pnl_in.get("effective_gross_income_current")),
        "operating_expenses": _as_number(pnl_in.get("operating_expenses") or pnl_in.get("expenses_current")),
        "noi": _as_number(pnl_in.get("noi") or pnl_in.get("noi_current")),
        "cap_rate": _as_number(pnl_in.get("cap_rate") or pnl_in.get("cap_rate_current")),
        "expense_ratio": _as_number(pnl_in.get("expense_ratio") or pnl_in.get("noi_margin_current")),
    }

    pricing_norm = {
        "price": _as_number(pricing.get("price")),
        "price_per_unit": _as_number(pricing.get("price_per_unit")),
        "price_per_sf": _as_number(pricing.get("price_per_sf")),
        "loan_amount": _as_number(pricing.get("loan_amount")),
        "down_payment": _as_number(pricing.get("down_payment")),
        "interest_rate": _as_number(pricing.get("interest_rate")),
        "ltv": _as_number(pricing.get("ltv")),
        "term_years": _as_number(pricing.get("term_years")),
        "amortization_years": _as_number(pricing.get("amortization_years")),
        "io_period_years": _as_number(pricing.get("io_period_years")),
        "monthly_payment": _as_number(pricing.get("monthly_payment")),
        "annual_debt_service": _as_number(pricing.get("annual_debt_service") or pricing.get("annual_payment")),
        "debt_type": pricing.get("debt_type"),
        "balloon_amount": _as_number(pricing.get("balloon_amount")),
    }

    out = {
        "property": {
            "address": property_.get("address"),
            "city": property_.get("city"),
            "state": property_.get("state"),
            "zip": property_.get("zip"),
            "units": _as_number(property_.get("units") or property_.get("total_units") or property_.get("number_of_units") or property_.get("unit_count")),
            "year_built": _as_number(property_.get("year_built") or property_.get("built") or property_.get("year")),
            "rba_sqft": _as_number(property_.get("rba_sqft") or property_.get("rentable_sqft") or property_.get("building_sf")),
            "land_area_acres": _as_number(property_.get("land_area_acres") or property_.get("land_acres")),
            "property_type": property_.get("property_type") or "",
            "property_class": property_.get("property_class") or "",
            "parking_spaces": _as_number(property_.get("parking_spaces")),
        },
        "pricing_financing": pricing_norm,
        "pnl": pnl,
        "expenses": expenses_in or {},
        "unit_mix": raw.get("unit_mix", []) or [],
        "underwriting": raw.get("underwriting", {}) or {},
        "deal_analysis": raw.get("deal_analysis", {}) or {},
        "suggested_financing": raw.get("suggested_financing", {}) or {},
        "time_periods": raw.get("time_periods", {}) or {},
        "data_quality": raw.get("data_quality", {}) or {},
        "warnings": raw.get("warnings", []) or [],
    }

    nmix = []
    for r in (raw.get("unit_mix", []) or []):
        if not isinstance(r, dict):
            continue
        nmix.append({
            "type": r.get("type") or r.get("name") or r.get("plan") or "",
            "units": _as_number(r.get("units") or r.get("count") or r.get("qty")),
            "unit_sf": _as_number(r.get("unit_sf") or r.get("sf") or r.get("unit_size") or r.get("size")),
            "rent_current": _as_number(r.get("rent_current") or r.get("current_rent") or r.get("unit_rent") or r.get("rent")),
            "rent_market": _as_number(r.get("rent_market") or r.get("market_rent") or r.get("proforma_rent") or r.get("rent")),
        })
    out["unit_mix"] = [x for x in nmix if x and (x["type"] or x["units"])]
    return out

def _validate_and_enrich(data: Dict[str, Any]) -> Dict[str, Any]:
    warnings, calc = [], []
    price = _as_number(data.get("pricing_financing", {}).get("price"))
    units = _as_number(data.get("property", {}).get("units"))
    noi   = _as_number(data.get("pnl", {}).get("noi"))
    egi   = _as_number(data.get("pnl", {}).get("effective_gross_income"))
    opex  = _as_number(data.get("pnl", {}).get("operating_expenses"))
    debt  = _as_number(data.get("pricing_financing", {}).get("annual_debt_service"))

    if price and units and not _as_number(data["pricing_financing"].get("price_per_unit")):
        data["pricing_financing"]["price_per_unit"] = round(price/units, 2); calc.append("Calculated price per unit")
    if price and noi and not _as_number(data["pnl"].get("cap_rate")):
        data["pnl"]["cap_rate"] = round(noi/price, 4); calc.append("Calculated cap rate")
    if noi and debt and not _as_number(data.get("underwriting", {}).get("dscr")):
        data.setdefault("underwriting", {})["dscr"] = round(noi/debt, 2); calc.append("Calculated DSCR")
    if opex and egi and not _as_number(data["pnl"].get("expense_ratio")):
        data["pnl"]["expense_ratio"] = round(opex/egi, 4); calc.append("Calculated expense ratio")

    if not price: warnings.append("Missing purchase price")
    if not units: warnings.append("Missing unit count")
    if not noi:   warnings.append("Missing NOI")
    if not egi:   warnings.append("Missing Effective Gross Income")

    data.setdefault("metadata", {})
    data["metadata"].update({
        "warnings": warnings,
        "calculations_performed": calc,
        "parser_strategy": PARSER_STRATEGY_DEFAULT,
        "ocr_engine": "mistral-ocr",
    })
    return data

def _pmti(principal: float, annual_rate_pct: float, n_months: int) -> float:
    if principal is None or principal <= 0 or annual_rate_pct is None or n_months is None or n_months <= 0:
        return 0.0
    r = (annual_rate_pct / 100.0) / 12.0
    if r == 0:
        return principal / n_months
    return principal * (r / (1 - (1 + r) ** (-n_months)))

def _remaining_balance(principal: float, annual_rate_pct: float, amort_months: int, payments_made: int) -> float:
    if principal is None or principal <= 0:
        return 0.0
    r = (annual_rate_pct / 100.0) / 12.0
    if r == 0:
        paid = principal * payments_made / amort_months
        return max(0.0, principal - paid)
    return principal * (((1 + r) ** amort_months - (1 + r) ** payments_made) / ((1 + r) ** amort_months - 1))

def _compute_underwriting(d: Dict[str, Any]) -> Dict[str, Any]:
    prop = d.setdefault("property", {})
    pricing = d.setdefault("pricing_financing", {})
    pnl = d.setdefault("pnl", {})
    exps = d.setdefault("expenses", {})
    uw  = d.setdefault("underwriting", {})

    price = _as_number(pricing.get("price"))
    units = _as_number(prop.get("units"))
    noi   = _as_number(pnl.get("noi"))
    egi   = _as_number(pnl.get("effective_gross_income"))
    gpr   = _as_number(pnl.get("gross_potential_rent"))
    vac   = _as_number(pnl.get("vacancy_amount"))
    other = _as_number(pnl.get("other_income"))
    opex  = _as_number(pnl.get("operating_expenses"))
    debt  = _as_number(pricing.get("annual_debt_service"))

    if (price is not None) and (units and units > 0) and not _as_number(pricing.get("price_per_unit")):
        pricing["price_per_unit"] = round(price / units, 2)

    if egi is None and (gpr is not None):
        vac_amt = abs(vac) if vac is not None else 0.0
        other_inc = other if other is not None else 0.0
        pnl["effective_gross_income"] = round(gpr - vac_amt + other_inc, 2)
        egi = pnl["effective_gross_income"]

    if (opex is None) and exps:
        subtotal = 0.0
        for k, v in exps.items():
            if k in {"total", "total_current"}: continue
            val = _as_number(v)
            if val: subtotal += val
        if subtotal > 0:
            exps["total"] = round(subtotal, 2)
            pnl["operating_expenses"] = exps["total"]
            opex = exps["total"]

    if (noi is None) and (egi is not None) and (opex is not None):
        pnl["noi"] = round(egi - opex, 2)
        noi = pnl["noi"]

    if (pnl.get("expense_ratio") is None) and (egi is not None) and (opex is not None) and egi != 0:
        pnl["expense_ratio"] = round(opex / egi, 4)

    if (pnl.get("cap_rate") is None) and (noi is not None) and (price and price != 0):
        pnl["cap_rate"] = round(noi / price, 4)

    if (uw.get("dscr") is None) and (noi is not None) and (debt and debt != 0):
        uw["dscr"] = round(noi / debt, 2)

    return d

def _is_critically_incomplete(d: Dict[str, Any]) -> bool:
    prop, pnl, pricing = d.get("property", {}), d.get("pnl", {}), d.get("pricing_financing", {})
    missing_basic = not prop.get("address") or not prop.get("units") or not pricing.get("price")
    missing_fin   = not pnl.get("gross_potential_rent") or not pnl.get("operating_expenses") or not pnl.get("noi")
    return bool(missing_basic or missing_fin)

def _calculate_deal_metrics(d: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate comprehensive investment metrics programmatically"""
    
    # Extract key values
    price = _as_number(d.get("pricing_financing", {}).get("price")) or 0
    units = _as_number(d.get("property", {}).get("units")) or 0
    noi = _as_number(d.get("pnl", {}).get("noi")) or 0
    egi = _as_number(d.get("pnl", {}).get("effective_gross_income")) or 0
    gpr = _as_number(d.get("pnl", {}).get("gross_potential_rent")) or 0
    opex = _as_number(d.get("pnl", {}).get("operating_expenses")) or 0
    debt_service = _as_number(d.get("pricing_financing", {}).get("annual_debt_service")) or 0
    down_payment = _as_number(d.get("pricing_financing", {}).get("down_payment")) or 0
    loan_amount = _as_number(d.get("pricing_financing", {}).get("loan_amount")) or 0
    vacancy_rate = _as_number(d.get("pnl", {}).get("vacancy_rate")) or 0.05
    cap_rate = _as_number(d.get("pnl", {}).get("cap_rate")) or 0
    expense_ratio = _as_number(d.get("pnl", {}).get("expense_ratio")) or 0
    interest_rate = _as_number(d.get("pricing_financing", {}).get("interest_rate")) or 0
    term_years = _as_number(d.get("pricing_financing", {}).get("term_years")) or 30
    
    metrics = {}
    
    # 1. Annual Cash Flow
    annual_cash_flow = noi - debt_service if debt_service else noi
    monthly_cash_flow = annual_cash_flow / 12
    metrics["annual_cash_flow"] = round(annual_cash_flow, 2)
    metrics["monthly_cash_flow"] = round(monthly_cash_flow, 2)
    
    # 2. Cash-on-Cash Return
    if down_payment and down_payment > 0:
        coc_return = (annual_cash_flow / down_payment) * 100
        metrics["cash_on_cash_return"] = round(coc_return, 2)
    else:
        metrics["cash_on_cash_return"] = 0
    
    # 3. ROI (Return on Investment) - Year 1
    if price and price > 0:
        roi = (annual_cash_flow / price) * 100
        metrics["roi_year_1"] = round(roi, 2)
    else:
        metrics["roi_year_1"] = 0
    
    # 4. Cap Rate
    if price and price > 0 and noi:
        calculated_cap = (noi / price) * 100
        metrics["cap_rate"] = round(calculated_cap, 2)
    else:
        metrics["cap_rate"] = round(cap_rate * 100, 2) if cap_rate else 0
    
    # 5. DSCR (Debt Service Coverage Ratio)
    if debt_service and debt_service > 0:
        dscr = noi / debt_service
        metrics["dscr"] = round(dscr, 2)
    else:
        metrics["dscr"] = 0
    
    # 6. Gross Rent Multiplier
    if price and gpr and gpr > 0:
        grm = price / gpr
        metrics["grm"] = round(grm, 2)
    else:
        metrics["grm"] = 0
    
    # 7. Price per Unit
    if price and units and units > 0:
        ppu = price / units
        metrics["price_per_unit"] = round(ppu, 0)
    else:
        metrics["price_per_unit"] = 0
    
    # 8. Price per Square Foot
    rba_sqft = _as_number(d.get("property", {}).get("rba_sqft")) or 0
    if price and rba_sqft and rba_sqft > 0:
        ppsf = price / rba_sqft
        metrics["price_per_sf"] = round(ppsf, 2)
    else:
        metrics["price_per_sf"] = 0
    
    # 9. Expense Ratio
    if egi and egi > 0 and opex:
        exp_ratio = (opex / egi) * 100
        metrics["expense_ratio"] = round(exp_ratio, 2)
    else:
        metrics["expense_ratio"] = round(expense_ratio * 100, 2) if expense_ratio else 0
    
    # 10. Break-even Ratio
    if egi and egi > 0:
        break_even = ((opex + debt_service) / egi) * 100
        metrics["break_even_ratio"] = round(break_even, 2)
    else:
        metrics["break_even_ratio"] = 0
    
    # 11. Loan-to-Value (LTV)
    if loan_amount and price and price > 0:
        ltv = (loan_amount / price) * 100
        metrics["ltv"] = round(ltv, 2)
    else:
        metrics["ltv"] = 0
    
    # 12. Debt Yield
    if loan_amount and loan_amount > 0 and noi:
        debt_yield = (noi / loan_amount) * 100
        metrics["debt_yield"] = round(debt_yield, 2)
    else:
        metrics["debt_yield"] = 0
    
    # 13. 1% Rule (Monthly Rent vs Purchase Price)
    if gpr and price and price > 0:
        monthly_rent = gpr / 12
        one_percent_rule = (monthly_rent / price) * 100
        metrics["one_percent_rule"] = round(one_percent_rule, 2)
    else:
        metrics["one_percent_rule"] = 0
    
    # 14. IRR Calculation (5-year simplified)
    # Assumptions: 3% annual rent growth, 2% expense growth, 3% property appreciation
    irr_cash_flows = [-down_payment] if down_payment else [-price]
    for year in range(1, 6):
        year_noi = noi * (1.03 ** year) - (opex * (0.02 * year))  # Rent grows 3%, expenses grow 2%
        year_cash_flow = year_noi - debt_service
        if year == 5:  # Add sale proceeds in year 5
            sale_price = price * (1.03 ** 5)  # 3% annual appreciation
            remaining_loan = loan_amount * 0.85 if loan_amount else 0  # Rough estimate of remaining balance
            year_cash_flow += (sale_price - remaining_loan)
        irr_cash_flows.append(year_cash_flow)
    
    # Simple IRR approximation
    try:
        # Newton's method for IRR (simplified)
        rate = 0.1  # Initial guess
        for _ in range(20):
            npv = sum(cf / ((1 + rate) ** i) for i, cf in enumerate(irr_cash_flows))
            dnpv = sum(-i * cf / ((1 + rate) ** (i + 1)) for i, cf in enumerate(irr_cash_flows) if i > 0)
            if abs(dnpv) < 0.0001:
                break
            rate = rate - npv / dnpv
        metrics["irr_5_year"] = round(rate * 100, 2)
    except:
        metrics["irr_5_year"] = 0
    
    # 15. Payback Period (years to recover initial investment)
    if annual_cash_flow > 0 and down_payment:
        payback_period = down_payment / annual_cash_flow
        metrics["payback_period_years"] = round(payback_period, 1)
    else:
        metrics["payback_period_years"] = 0
    
    # 16. Rent to Price Ratio
    if gpr and price and price > 0:
        rent_price_ratio = (gpr / price) * 100
        metrics["rent_to_price_ratio"] = round(rent_price_ratio, 2)
    else:
        metrics["rent_to_price_ratio"] = 0
    
    # 17. Operating Margin
    if egi and egi > 0:
        operating_margin = (noi / egi) * 100
        metrics["operating_margin"] = round(operating_margin, 2)
    else:
        metrics["operating_margin"] = 0
    
    # 18. Cash Flow per Unit
    if units and units > 0:
        cf_per_unit = annual_cash_flow / units
        metrics["cash_flow_per_unit"] = round(cf_per_unit, 2)
    else:
        metrics["cash_flow_per_unit"] = 0
    
    # Now ask Claude for opinion based on these calculated metrics
    metrics_summary = f"""
    Investment Metrics Summary:
    - Cap Rate: {metrics['cap_rate']}%
    - Cash-on-Cash Return: {metrics['cash_on_cash_return']}%
    - DSCR: {metrics['dscr']}
    - Annual Cash Flow: ${metrics['annual_cash_flow']:,.0f}
    - Monthly Cash Flow: ${metrics['monthly_cash_flow']:,.0f}
    - ROI Year 1: {metrics['roi_year_1']}%
    - IRR (5-year): {metrics['irr_5_year']}%
    - GRM: {metrics['grm']}
    - Price per Unit: ${metrics['price_per_unit']:,.0f}
    - Expense Ratio: {metrics['expense_ratio']}%
    - Break-even Ratio: {metrics['break_even_ratio']}%
    - Debt Yield: {metrics['debt_yield']}%
    - 1% Rule: {metrics['one_percent_rule']}%
    - Payback Period: {metrics['payback_period_years']} years
    - Operating Margin: {metrics['operating_margin']}%
    """
    
    prompt = f"""Based on these calculated investment metrics, provide a brief investment opinion.
    
    {metrics_summary}
    
    Return JSON with:
    - verdict: 'STRONG BUY', 'BUY', 'HOLD', 'PASS', or 'STRONG PASS'
    - confidence: 'High', 'Moderate', or 'Low'
    - pros: array of 3-4 positive factors
    - cons: array of 3-4 negative factors or risks
    - summary: 2-3 sentence investment thesis
    
    Focus on the actual numbers and standard investment criteria. Be critical and analytical."""
    
    try:
        res = ANTHROPIC.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=600,
            temperature=0,
            messages=[{"role": "user", "content": prompt}],
        )
        txt = res.content[0].text.strip().replace("```json", "").replace("```", "")
        m = re.search(r"\{.*\}\s*$", txt, re.DOTALL)
        opinion = json.loads(m.group(0) if m else txt)
    except:
        # Fallback opinion based on metrics
        opinion = {
            "verdict": "HOLD",
            "confidence": "Moderate",
            "pros": ["Metrics calculated successfully"],
            "cons": ["Unable to generate detailed analysis"],
            "summary": "Review the metrics carefully before making an investment decision."
        }
    
    # Calculate a simple score based on key metrics
    score = 50  # Base score
    if metrics['cap_rate'] >= 7: score += 10
    elif metrics['cap_rate'] >= 5: score += 5
    if metrics['cash_on_cash_return'] >= 10: score += 10
    elif metrics['cash_on_cash_return'] >= 7: score += 5
    if metrics['dscr'] >= 1.5: score += 10
    elif metrics['dscr'] >= 1.25: score += 5
    if metrics['expense_ratio'] <= 40: score += 10
    elif metrics['expense_ratio'] <= 50: score += 5
    if metrics['irr_5_year'] >= 15: score += 10
    elif metrics['irr_5_year'] >= 10: score += 5
    
    score = min(100, max(0, score))
    
    return {
        "metrics": metrics,
        "score": score,
        "verdict": opinion.get("verdict", "HOLD"),
        "confidence": opinion.get("confidence", "Moderate"),
        "pros": opinion.get("pros", []),
        "cons": opinion.get("cons", []),
        "summary": opinion.get("summary", ""),
        "metrics_summary": metrics_summary
    }

# ---------------- Property Analysis (UNCHANGED) ----------------
def analyze_property_with_market(
   property_data: Dict[str, Any],
   market_data: Dict[str, Any],
   live_rentals: list = None
) -> Dict[str, Any]:
   """
   Analyze property performance against market data using Claude
   """
   rental_summary = ""
   if live_rentals:
       rentals_by_bed = {}
       for r in live_rentals:
           bed = str(r.get('bed', 'Studio'))
           if bed not in rentals_by_bed:
               rentals_by_bed[bed] = []
           rent = r.get('rent')
           if rent:
               try:
                   rentals_by_bed[bed].append(float(str(rent).replace(',', '').replace('$', '')))
               except:
                   pass
       avg_rents = {}
       for bed, rents in rentals_by_bed.items():
           if rents:
               avg_rents[bed if bed != '0' else 'Studio'] = sum(rents) / len(rents)
       lines = [f"- {bed}: ${avg:,.0f}/month average" for bed, avg in avg_rents.items()]
       rental_summary = "\n\nLIVE RENTAL LISTINGS (" + str(len(live_rentals)) + " active):\n" + "\n".join(lines)

   schema_block = """
Format response as JSON with these exact keys:
{
 "summary": "Brief 2-3 sentence overview of property performance",
 "rent_analysis": {
   "current_vs_market": {
     "current_avg": number,
     "market_avg": number,
     "gap": number,
     "gap_percentage": number
   }},
   "unit_type_analysis": [
     {
       "type": "1BR",
       "current_rent": number,
       "market_rent": number,
       "fmr": number,
       "recommendation": "string"
     }
   ],
   "underpriced_units": ["string"],
   "revenue_opportunity": number
 },
 "expense_analysis": {
   "current_ratio": number,
   "benchmark_ratio": 0.38,
   "savings_opportunity": number,
   "specific_cuts": [
     {
       "category": "string",
       "current": number,
       "benchmark": number,
       "savings": number
     }
   ]
 },
 "vacancy_analysis": {
   "current": number,
   "market": number,
   "revenue_impact": number
 },
 "noi_improvement": {
   "current_noi": number,
   "potential_noi": number,
   "total_improvement": number,
   "improvement_pct": number
 },
 "recommendations": [
   {
     "category": "Revenue|Expenses|Operations",
     "action": "Specific action to take",
     "impact": "Dollar amount or percentage impact"
   }
 ],
 "red_flags": ["string"],
 "strengths": ["string"],
 "market_position": "Growing|Stable|Declining market assessment",
 "rubs_opportunity": {
   "current_recovery": number,
   "potential_recovery": number,
   "additional_income": number
 },
 "ancillary_revenue": [
   {
     "type": "Storage|Parking|Pet|Laundry",
     "monthly_per_unit": number,
     "annual_total": number
   }
 ]
}

Return ONLY the JSON object, no additional text.
""".strip()

   prompt = (
       "You are an expert multifamily property consultant. Analyze this property's performance against market data and provide specific recommendations to boost NOI.\n\n"
       "PROPERTY DATA:\n"
       f"- Address: {property_data.get('property', {}).get('address', 'N/A')}\n"
       f"- City: {property_data.get('property', {}).get('city', 'N/A')}\n"
       f"- State: {property_data.get('property', {}).get('state', 'N/A')}\n"
       f"- ZIP: {property_data.get('property', {}).get('zip', 'N/A')}\n"
       f"- Units: {property_data.get('property', {}).get('units', 'N/A')}\n"
       f"- Year Built: {property_data.get('property', {}).get('year_built', 'N/A')}\n\n"
       "PROPERTY FINANCIALS:\n"
       f"- Gross Potential Rent: ${property_data.get('pnl', {}).get('gross_potential_rent', 0):,.0f}\n"
       f"- Vacancy Rate: {property_data.get('pnl', {}).get('vacancy_rate', 0) if property_data.get('pnl', {}).get('vacancy_rate', 0) is not None else 0:.2f}\n"
       f"- Effective Gross Income: ${property_data.get('pnl', {}).get('effective_gross_income', 0):,.0f}\n"
       f"- Operating Expenses: ${property_data.get('pnl', {}).get('operating_expenses', 0):,.0f}\n"
       f"- NOI: ${property_data.get('pnl', {}).get('noi', 0):,.0f}\n"
       f"- Expense Ratio: {property_data.get('pnl', {}).get('expense_ratio', 0) if property_data.get('pnl', {}).get('expense_ratio', 0) is not None else 0:.2f}\n\n"
       "UNIT MIX:\n" + json.dumps(property_data.get('unit_mix', []), indent=2) + "\n\n"
       "EXPENSES BREAKDOWN:\n" + json.dumps(property_data.get('expenses', {}), indent=2) + "\n\n"
       "MARKET DATA:\n"
       f"- ZIP: {market_data.get('zip', 'N/A')}\n"
       f"- Population: {market_data.get('population', 'N/A')}\n"
       f"- Employment Rate: {market_data.get('employment_rate', 0)}\n"
       f"- Median Household Income: {market_data.get('median_household_income', 0)}\n"
       f"- Market Median Rent: {market_data.get('median_gross_rent', 0)}\n"
       f"- Market Vacancy Rate: {market_data.get('vacancy_rate', 0)}\n"
       f"- Total Housing Units: {market_data.get('total_housing_units', 0)}\n"
       f"- Renter Percentage: {market_data.get('pct_renter', 0)}\n\n"
       "FAIR MARKET RENTS (HUD):\n"
       f"- Studio: {market_data.get('fmr_0br', 0)}\n"
       f"- 1BR: {market_data.get('fmr_1br', 0)}\n"
       f"- 2BR: {market_data.get('fmr_2br', 0)}\n"
       f"- 3BR: {market_data.get('fmr_3br', 0)}\n"
       f"- 4BR: {market_data.get('fmr_4br', 0)}\n\n"
       + rental_summary + "\n\n" + schema_block
   )

   try:
       response = ANTHROPIC.messages.create(
           model=ANTHROPIC_MODEL,
           max_tokens=4000,
           temperature=0,
           messages=[{"role": "user", "content": prompt}],
       )
       result_text = response.content[0].text.strip()
       result_text = result_text.replace("```json", "").replace("```", "").strip()
       return json.loads(result_text)
   except json.JSONDecodeError as e:
       raise HTTPException(status_code=502, detail=f"Claude response parsing failed: {e}")
   except Exception as e:
       raise HTTPException(status_code=502, detail=f"Claude API error: {e}")

# ---------------- Visualizations ----------------
def _generate_visualization_data(data: Dict[str, Any]) -> Dict[str, Any]:
    expenses = data.get("expenses", {}) or {}
    pnl = data.get("pnl", {}) or {}
    unit_mix = data.get("unit_mix", []) or []

    total_expenses = expenses.get("total") or expenses.get("total_current") or 0
    breakdown = []
    if total_expenses:
        for k, v in expenses.items():
            if k in {"total", "total_current"}:
                continue
            try:
                val = float(v)
            except Exception:
                continue
            if val:
                breakdown.append({
                    "name": k.replace("_", " ").title(),
                    "value": val,
                    "percentage": round((val / float(total_expenses)) * 100, 1),
                })

    gpr = pnl.get("gross_potential_rent") or 0
    egi = pnl.get("effective_gross_income") or 0
    opex = pnl.get("operating_expenses") or 0
    noi = pnl.get("noi") or 0
    income_expense = []
    if egi or opex or noi:
        income_expense = [
            {"category": "Gross Income", "value": gpr or 0},
            {"category": "Effective Income", "value": egi or 0},
            {"category": "Operating Expenses", "value": opex or 0},
            {"category": "NOI", "value": noi or 0},
        ]

    unit_chart = []
    for u in unit_mix:
        try:
            n = int(float(u.get("units", 0)))
        except Exception:
            n = 0
        if n:
            unit_chart.append({"type": u.get("type", "Unknown"), "units": n, "percentage": 0})

    vac_amt = pnl.get("vacancy_amount") or 0
    other_inc = pnl.get("other_income") or 0
    waterfall = []
    if gpr:
        waterfall = [
            {"name": "Gross Rent", "value": gpr},
            {"name": "Vacancy", "value": -abs(vac_amt)},
            {"name": "Other Income", "value": other_inc},
            {"name": "Operating Expenses", "value": -abs(opex or 0)},
            {"name": "NOI", "value": noi or 0, "isTotal": True},
        ]

    return {
        "expense_breakdown": breakdown,
        "income_expense_comparison": income_expense,
        "unit_mix_chart": unit_chart,
        "cash_flow_waterfall": waterfall,
    }

# ---------------- API ----------------
@app.get("/health")
def health():
    return {
        "ok": True,
        "version": "9.0.0",
        "parser_default": PARSER_STRATEGY_DEFAULT,
        "clients": {
            "mistral": MISTRAL is not None,
            "anthropic": ANTHROPIC is not None,
        }
    }

@app.post("/ocr/underwrite")
async def ocr_and_underwrite(
    file: UploadFile = File(...),
    pages: Optional[str] = Form(default=""),

    # strategy override
    parser_strategy: Optional[str] = Form(default=None),

    # legacy financing params
    loan_amount: Optional[float] = Form(default=None),
    down_payment_pct: Optional[float] = Form(default=None),
    interest_rate: Optional[float] = Form(default=None),
    term_years: Optional[int] = Form(default=None),
    loan_type: Optional[str] = Form(default=None),

    # NEW: mode selector
    financing_mode: Optional[str] = Form(default=None),  # "traditional" | "seller_finance" | "subject_to"

    # traditional
    amort_years: Optional[int] = Form(default=None),

    # seller finance
    down_payment_amount: Optional[float] = Form(default=None),
    sf_interest_rate: Optional[float] = Form(default=None),
    sf_amort_years: Optional[int] = Form(default=None),
    sf_balloon_years: Optional[int] = Form(default=None),
    sf_io_years: Optional[int] = Form(default=0),

    # subject-to
    st_existing_balance: Optional[float] = Form(default=None),
    st_interest_rate: Optional[float] = Form(default=None),
    st_remaining_term_years: Optional[int] = Form(default=None),
    st_amort_years: Optional[int] = Form(default=None),
):
    print(f"\n{'='*80}")
    print(f"[OCR/UNDERWRITE] REQUEST RECEIVED")
    print(f"[OCR/UNDERWRITE] File: {file.filename}")
    print(f"[OCR/UNDERWRITE] Pages: {pages}")
    print(f"{'='*80}\n")
    
    mime = (file.content_type or "").lower()
    if mime not in ALLOWED_UPLOAD_MIMES:
        raise HTTPException(status_code=415, detail=f"Unsupported content type: {mime}")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty upload")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large (> {MAX_BYTES // (1024*1024)} MB)")

    orig_data, orig_mime = data, mime

    strategy = (parser_strategy or PARSER_STRATEGY_DEFAULT).lower().strip()
    if strategy not in {"claude", "om_v4", "hybrid"}:
        strategy = "claude"

    if mime == "application/pdf" and pages:
        try:
            data = _slice_pdf(data, pages)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    if mime in ALLOWED_DOC_MIMES:
        ocr_json = _call_mistral_ocr(data, mime)
        md_parts = [p.get("markdown", "") for p in ocr_json.get("pages", []) if isinstance(p, dict)]
        markdown_text = "\n\n".join([m for m in md_parts if m]).strip()
        if not markdown_text:
            raise HTTPException(status_code=502, detail="No text extracted from OCR")
    else:
        ocr_json = None
        try:
            text = data.decode("utf-8", errors="ignore")
        except Exception:
            text = base64.b64encode(data).decode("utf-8")
        markdown_text = "SPREADSHEET_CONTENT\n\n" + text[:500000]

    # build financing context for Claude prompt
    financing_params = {
        "financing_mode": financing_mode,
        "down_payment_pct": down_payment_pct,
        "term_years": term_years,
        "amort_years": amort_years,
        "loan_amount": loan_amount,
        "seller_dp_amount": down_payment_amount,
        "seller_rate": sf_interest_rate,
        "seller_amort_years": sf_amort_years,
        "seller_balloon_years": sf_balloon_years,
        "seller_io_years": sf_io_years,
        "subto_existing_balance": st_existing_balance,
        "subto_rate": st_interest_rate,
        "subto_remaining_term_years": st_remaining_term_years,
        "subto_amort_years": st_amort_years,
    }

    def _parse_with_claude(md: str):
        return _call_claude_parse_from_markdown(md, financing_params)

    def _parse_with_om_v4(j: dict):
        if not HAS_PARSER_V4 or j is None:
            raise HTTPException(status_code=500, detail="parser_v4 not available or OCR JSON missing")
        return PARSER_V4_PARSE_OM(j)

    try:
        if strategy == "claude":
            parsed_raw = _parse_with_claude(markdown_text); used_strategy = "claude"
        elif strategy == "om_v4":
            parsed_raw = _parse_with_om_v4(ocr_json);       used_strategy = "om_v4"
        else:
            try:
                parsed_raw = _parse_with_om_v4(ocr_json);   used_strategy = "om_v4"
            except Exception:
                parsed_raw = _parse_with_claude(markdown_text); used_strategy = "claude"
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Parsing failed: {e}")

    normalized = _normalize_parsed(parsed_raw)

    # Deterministic enrichment from selected pages
    prop = normalized.setdefault("property", {})
    pricing = normalized.setdefault("pricing_financing", {})
    pnl = normalized.setdefault("pnl", {})
    exps = normalized.setdefault("expenses", {})

    addr = _extract_address(markdown_text)
    _merge_truthy(prop, addr, ["address", "city", "state", "zip"])
    if not normalized.get("unit_mix"):
        um = _extract_unit_mix_from_markdown(markdown_text)
        if um:
            normalized["unit_mix"] = um
            if not prop.get("units"):
                prop["units"] = sum(r.get("units", 0) or 0 for r in um)

    pr = _extract_pricing_detail_from_markdown(markdown_text)
    if pr.get("units") and not prop.get("units"): prop["units"] = pr["units"]
    if pr.get("rba_sqft") and not prop.get("rba_sqft"): prop["rba_sqft"] = pr["rba_sqft"]
    if pr.get("land_area_acres"): prop["land_area_acres"] = pr["land_area_acres"]
    elif pr.get("land_area_sf") and not prop.get("land_area_acres"):
        try: prop["land_area_acres"] = round(pr["land_area_sf"]/43560.0, 4)
        except: pass
    for k in ["price", "price_per_unit", "price_per_sf"]:
        if pr.get(k) and not pricing.get(k):
            pricing[k] = pr[k]

    ops = _extract_operating_summary_from_markdown(markdown_text)
    for k, v in (ops.get("pnl") or {}).items():
        if v is not None and not pnl.get(k):
            pnl[k] = v
    for k, v in (ops.get("expenses") or {}).items():
        if v is not None and not exps.get(k):
            exps[k] = v

    # ---------- Financing mode compute (overrides/augments Claude) ----------
    fm = (financing_mode or "").strip().lower()
    price_val = _as_number(pricing.get("price"))

    def set_ads(monthly):
        if monthly and monthly > 0:
            pricing["monthly_payment"] = round(monthly, 2)
            pricing["annual_debt_service"] = round(monthly * 12, 2)

    if fm == "traditional":
        dp_pct_v   = _as_number(down_payment_pct)
        rate_v     = _as_number(interest_rate)
        term_y_v   = _as_number(term_years)
        amort_y_v  = _as_number(amort_years or term_y_v)

        if price_val and dp_pct_v is not None:
            loan_amt = price_val * (1 - dp_pct_v/100.0)
            pricing["loan_amount"] = round(loan_amt, 2)
            pricing["down_payment"] = round(price_val - loan_amt, 2)
        else:
            loan_amt = _as_number(pricing.get("loan_amount"))

        n = int((amort_y_v or term_y_v or 30) * 12) if (amort_y_v or term_y_v) else None
        m = _pmti(loan_amt, rate_v or 0, n or 0)
        set_ads(m)
        pricing["debt_type"] = "Traditional"

    elif fm == "seller_finance":
        dp_amt_v  = _as_number(down_payment_amount)
        rate_v    = _as_number(sf_interest_rate)
        amort_y_v = _as_number(sf_amort_years)
        bal_y_v   = _as_number(sf_balloon_years)
        io_y_v    = int(_as_number(sf_io_years or 0) or 0)

        if price_val and dp_amt_v is not None:
            loan_amt = price_val - dp_amt_v
            pricing["loan_amount"] = round(loan_amt, 2)
            pricing["down_payment"] = round(dp_amt_v, 2)
        else:
            loan_amt = _as_number(pricing.get("loan_amount"))

        amort_m = int((amort_y_v or 30) * 12)
        if io_y_v and io_y_v > 0:
            io_months = int(io_y_v * 12)
            io_payment = (rate_v or 0)/100/12 * (loan_amt or 0)
            if bal_y_v and bal_y_v*12 <= io_months:
                balloon_amt = loan_amt
                set_ads(io_payment)
            else:
                rem_months = max(0, (bal_y_v or 0)*12 - io_months) if bal_y_v else amort_m - io_months
                pmt = _pmti(loan_amt, rate_v or 0, amort_m)
                set_ads(io_payment if io_months else pmt)
                if bal_y_v:
                    balloon_amt = _remaining_balance(loan_amt, rate_v or 0, amort_m, rem_months)
                else:
                    balloon_amt = 0.0
        else:
            pmt = _pmti(loan_amt, rate_v or 0, amort_m)
            set_ads(pmt)
            if bal_y_v:
                balloon_amt = _remaining_balance(loan_amt, rate_v or 0, amort_m, int(bal_y_v*12))
            else:
                balloon_amt = 0.0

        pricing["balloon_amount"] = round(balloon_amt, 2) if balloon_amt else 0.0
        pricing["debt_type"] = "Seller Finance"

    elif fm == "subject_to":
        existing_bal_v = _as_number(st_existing_balance)
        rate_v         = _as_number(st_interest_rate)
        rem_term_y_v   = _as_number(st_remaining_term_years)
        amort_y_v      = _as_number(st_amort_years or rem_term_y_v)

        loan_amt = existing_bal_v
        pricing["loan_amount"] = round(loan_amt or 0, 2)
        amort_m = int((amort_y_v or rem_term_y_v or 30) * 12)
        pmt = _pmti(loan_amt, rate_v or 0, amort_m)
        set_ads(pmt)
        pricing["debt_type"] = "Subject-To"
        if price_val and existing_bal_v is not None:
            pricing["down_payment"] = round(max(0.0, price_val - existing_bal_v), 2)

    # base enrich + compute
    normalized = _validate_and_enrich(normalized)
    normalized = _compute_underwriting(normalized)
    normalized.setdefault("metadata", {})["used_strategy"] = used_strategy
    normalized["visualizations"] = _generate_visualization_data(normalized)

    # Recovery pass if still incomplete and user sliced pages
    if (mime == "application/pdf") and pages and _is_critically_incomplete(normalized):
        try:
            full_ocr = _call_mistral_ocr(orig_data, orig_mime)
            rec_idxs = _pages_with_keywords(full_ocr, RECOVERY_KEYWORDS)
            rec_md = "\n\n".join([(full_ocr["pages"][i].get("markdown") or "") for i in rec_idxs])
            combined_md = markdown_text + "\n\n--- RECOVERY PAGES ---\n\n" + rec_md
            parsed2 = _call_claude_parse_from_markdown(combined_md, financing_params)
            n2 = _normalize_parsed(parsed2)

            prop2 = n2.setdefault("property", {})
            pricing2 = n2.setdefault("pricing_financing", {})
            pnl2 = n2.setdefault("pnl", {})
            exps2 = n2.setdefault("expenses", {})

            addr2 = _extract_address(combined_md); _merge_truthy(prop2, addr2, ["address","city","state","zip"])
            if not n2.get("unit_mix"):
                um2 = _extract_unit_mix_from_markdown(combined_md)
                if um2:
                    n2["unit_mix"] = um2
                    if not prop2.get("units"): prop2["units"] = sum(r.get("units",0) or 0 for r in um2)

            pr2 = _extract_pricing_detail_from_markdown(combined_md)
            ops2 = _extract_operating_summary_from_markdown(combined_md)

            if pr2.get("units") and not prop2.get("units"): prop2["units"] = pr2["units"]
            if pr2.get("rba_sqft") and not prop2.get("rba_sqft"): prop2["rba_sqft"] = pr2["rba_sqft"]
            if pr2.get("land_area_acres"): prop2["land_area_acres"] = pr2["land_area_acres"]
            elif pr2.get("land_area_sf") and not prop2.get("land_area_acres"):
                try: prop2["land_area_acres"] = round(pr2["land_area_sf"]/43560.0, 4)
                except: pass

            for k in ["price","price_per_unit","price_per_sf"]:
                if pr2.get(k) and not pricing2.get(k): pricing2[k] = pr2[k]
            for k,v in (ops2.get("pnl") or {}).items():
                if v is not None and not pnl2.get(k): pnl2[k] = v
            for k,v in (ops2.get("expenses") or {}).items():
                if v is not None and not exps2.get(k): exps2[k] = v

            n2 = _validate_and_enrich(n2)
            n2 = _compute_underwriting(n2)
            n2.setdefault("metadata", {})["used_strategy"] = used_strategy + "+recovery"
            n2["visualizations"] = _generate_visualization_data(n2)
            n2["metadata"]["recovery_pages_used"] = [i+1 for i in rec_idxs]

            def _score(d: Dict[str, Any]) -> int:
                s = 0
                s += sum(1 for k in ["address", "units"] if d.get("property", {}).get(k))
                s += sum(1 for k in ["price"] if d.get("pricing_financing", {}).get(k))
                s += sum(1 for k in ["gross_potential_rent", "operating_expenses", "noi"] if d.get("pnl", {}).get(k))
                return s

            if _score(n2) > _score(normalized):
                normalized = n2

        except Exception as e:
            normalized.setdefault("metadata", {})["recovery_error"] = str(e)[:200]

    # Calculate comprehensive deal metrics instead of simple opinion
    normalized["deal_analysis"] = _calculate_deal_metrics(normalized)

    return {
        "ok": True,
        "parsed": normalized,
        "raw_markdown": markdown_text,
        "ocr_page_count": len(ocr_json.get("pages", [])) if ocr_json else None,
        "selected_pages": pages or "all",
        "file_name": file.filename,
        "file_size_mb": round(len(data) / (1024 * 1024), 2),
        "user_financing": financing_params,
    }

@app.post("/ocr/file")
async def ocr_file_legacy(
    file: UploadFile = File(...),
    pages: Optional[str] = Form(default=""),
    include_image_base64: Optional[bool] = Form(default=False),
):
    mime = (file.content_type or "").lower()
    if mime not in ALLOWED_DOC_MIMES:
        raise HTTPException(status_code=415, detail=f"Unsupported content type: {mime}")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty upload")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large")

    if mime == "application/pdf" and pages:
        try:
            data = _slice_pdf(data, pages)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    ocr_json = _call_mistral_ocr(data, mime)
    return {"ok": True, "parser": "none (ocr only)", "ocr_data": ocr_json}

# ============================================================================
# STRIPE WEBHOOK (Disabled - no usage tracking)
# ============================================================================
# @app.post("/webhook/stripe")
# async def stripe_webhook(request: Request):

# ============================================================================
# HEALTH CHECK ENDPOINTS (from health_check_app.py)
# ============================================================================

@app.post("/api/health-check/verify")
async def health_check_verify(
   file: UploadFile = File(...),
   pages: Optional[str] = Form(default=""),
   user_fixes: Optional[str] = Form(default="{}")
):
   """Proxy to health check service - extract and verify property data"""
   # Import health check functions
   try:
       from health_check_parser import parse_document_with_claude as health_parse
       from health_check_parser import normalize_and_compute, validate_data
   except ImportError:
       raise HTTPException(status_code=501, detail="Health check parser not available")
   
   mime = (file.content_type or "").lower()
   if mime not in ALLOWED_UPLOAD_MIMES:
       raise HTTPException(status_code=415, detail=f"Unsupported content type: {mime}")
   
   data = await file.read()
   orig_data = data
   orig_mime = mime
   
   if not data:
       raise HTTPException(status_code=400, detail="Empty upload")
   if len(data) > MAX_BYTES:
       raise HTTPException(status_code=413, detail="File too large")
   
   # Handle PDF page selection
   if mime == "application/pdf" and pages:
       try:
           data = _slice_pdf(data, pages)
       except ValueError as e:
           raise HTTPException(status_code=400, detail=str(e))
   
   # OCR the document
   markdown_text = ""
   if mime in {"application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"}:
       try:
           ocr_json = _call_mistral_ocr(data, mime)
           for page in ocr_json.get("pages", []):
               if isinstance(page, dict) and "markdown" in page:
                   markdown_text += page["markdown"] + "\n\n"
       except Exception as e:
           print(f"OCR error: {e}")
           raise HTTPException(status_code=502, detail=f"OCR failed: {str(e)}")
   else:
       try:
           markdown_text = data.decode("utf-8", errors="ignore")
       except:
           markdown_text = str(data)[:100000]
   
   if not markdown_text:
       raise HTTPException(status_code=400, detail="No text extracted from document")
   
   # Parse with health check parser
   try:
       extracted_data = health_parse(markdown_text)
       extracted_data = normalize_and_compute(extracted_data)
       
       # Apply user corrections if any
       try:
           user_fixes_dict = json.loads(user_fixes) if user_fixes != "{}" else {}
           for key_path, value in user_fixes_dict.items():
               keys = key_path.split('.')
               target = extracted_data
               for key in keys[:-1]:
                   target = target.setdefault(key, {})
               target[keys[-1]] = float(value) if isinstance(value, str) and value.replace('.','',1).isdigit() else value
           extracted_data = normalize_and_compute(extracted_data)
       except Exception as e:
           print(f"Error applying user fixes: {e}")
       
       validation = validate_data(extracted_data)
       
       return {
           "ok": True,
           "verification": validation,
           "file_name": file.filename
       }
   except Exception as e:
       print(f"Health check parsing error: {e}")
       raise HTTPException(status_code=500, detail=f"Health check parsing failed: {str(e)}")

@app.post("/api/health-check/analyze")
async def health_check_analyze(request: Request):
   """Generate health check analysis"""
   try:
       data = await request.json()
       verified_payload = data.get("verified_payload", {})
       if not verified_payload:
           raise HTTPException(status_code=400, detail="Missing verified_payload")
       
       # Import health check analysis function
       try:
           from health_check_parser import generate_health_check_analysis
       except ImportError:
           raise HTTPException(status_code=501, detail="Health check analysis not available")
       
       health_check_result = generate_health_check_analysis(verified_payload)
       return {
           "ok": True,
           "health_check": health_check_result
       }
   except HTTPException:
       raise
   except Exception as e:
       print(f"Analysis error: {e}")
       return {
           "ok": True,
           "health_check": {
               "snapshot": {"property_name": "Analysis Error", "error": str(e)},
               "operational_issues": [],
               "noi_levers": {"revenue": [], "expenses": []},
               "market_position": {"competitive_advantages": [], "competitive_disadvantages": []},
               "strengths": [],
               "weak_spots": [],
               "force_appreciation": [],
               "tenant_retention": [],
               "missing_items": ["Analysis failed"],
               "source_check": f"Error: {str(e)}"
           }
       }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8010")))