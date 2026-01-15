# V2 Underwriter - API Routes
import os
import json
import logging
import re
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
from fastapi import APIRouter, UploadFile, File, HTTPException, Request, Form
from fastapi.responses import JSONResponse
from openai import OpenAI
from anthropic import Anthropic

from .models import ChatRequest, ChatResponse, ChatMessage
from . import storage
from .llm_client import call_openai_chat
from .chat_prompts import build_deal_partner_chat_prompt, build_sheet_underwriter_chat_prompt
from .value_add_prompts import build_noi_engineering_prompt, build_deal_structure_prompt
from .prompts_v3 import build_underwriter_system_prompt_v3, build_summary_prompt_v2
from .prompts_max_ai import build_max_ai_underwriting_prompt
from . import llm_usage
from .cost_seg import (
    CostSegInputs, 
    calculate_cost_seg_analysis, 
    calculate_standard_depreciation_comparison,
    extract_cost_seg_inputs_from_deal
)

# Import Deal Manager parser (add-on, doesn't replace existing parsing)
try:
    from deal_manager_parser import (
        parse_deal_manager_bytes,
        is_deal_manager_file
    )
    HAS_DEAL_MANAGER_PARSER = True
except ImportError:
    HAS_DEAL_MANAGER_PARSER = False
    parse_deal_manager_bytes = None
    is_deal_manager_file = None

load_dotenv(override=True)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
anthropic_client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

log = logging.getLogger("v2_underwriter")
router = APIRouter(prefix="/v2", tags=["UnderwriterV2"])


# ---------------------------------------------------------------------------
# Lazy-loaded external market data (FMR by ZIP, property taxes)
# ---------------------------------------------------------------------------

_FMR_BY_ZIP = None  # type: ignore[var-annotated]
_PROPERTY_TAX_BY_COUNTY = None  # type: ignore[var-annotated]


def _get_repo_root() -> Path:
    """Return repository root assuming backend/ is a direct child.

    This keeps paths stable for local use without hard-coding absolute paths.
    """
    return Path(__file__).resolve().parents[2]


def _load_fmr_by_zip() -> dict:
    """Load HUD FMR data keyed by ZIP code (string)."""
    global _FMR_BY_ZIP
    if _FMR_BY_ZIP is not None:
        return _FMR_BY_ZIP

    csv_path = _get_repo_root() / "client" / "public" / "fmr_by_zip_clean.csv"
    fmr_map: dict[str, dict] = {}
    try:
        with csv_path.open("r", encoding="utf-8-sig") as f:
            import csv as _csv

            reader = _csv.DictReader(f)
            for row in reader:
                z = (row.get("zip") or "").strip()
                if not z:
                    continue
                fmr_map[z] = row
    except FileNotFoundError:
        log.warning("[RapidFire] FMR file not found at %s", csv_path)
    except Exception as e:
        log.exception("[RapidFire] Failed loading FMR data: %s", e)

    _FMR_BY_ZIP = fmr_map
    return _FMR_BY_ZIP


def _load_property_tax_by_county() -> dict:
    """Load property tax effective rates keyed by (state, county)."""
    global _PROPERTY_TAX_BY_COUNTY
    if _PROPERTY_TAX_BY_COUNTY is not None:
        return _PROPERTY_TAX_BY_COUNTY

    csv_path = _get_repo_root() / "client" / "public" / "Property Taxes by State and County, 2025  Tax Foundation Maps.csv"
    tax_map: dict[tuple[str, str], float] = {}
    try:
        with csv_path.open("r", encoding="utf-8-sig") as f:
            import csv as _csv

            reader = _csv.DictReader(f)
            for row in reader:
                state = (row.get("State") or "").strip()
                county = (row.get("County") or "").strip()
                rate_raw = (row.get("Effective Property Tax Rate (2023)") or "").strip()
                if not state or not county or not rate_raw:
                    continue
                # Example format: "0.2850%" -> 0.00285
                rate_clean = rate_raw.replace("%", "").strip()
                try:
                    rate = float(rate_clean) / 100.0
                except Exception:
                    continue
                key = (state.lower(), county.lower())
                tax_map[key] = rate
    except FileNotFoundError:
        log.warning("[RapidFire] Property tax file not found at %s", csv_path)
    except Exception as e:
        log.exception("[RapidFire] Failed loading property tax data: %s", e)

    _PROPERTY_TAX_BY_COUNTY = tax_map
    return _PROPERTY_TAX_BY_COUNTY


def analyze_property_with_ai(
    address: str,
    units: float | None,
    sale_price: float | None,
    sqft: float | None,
    mortgage_amount: float | None,
    zip_code: str | None,
    fmr_data: dict | None,
    settings: dict,
    tax_by_county: dict | None = None,
) -> dict:
    """Use Claude Haiku to intelligently analyze a property with limited data.
    
    Returns analysis with estimated NOI, cap rate, verdict, and reasoning.
    """
    
    # Build context for AI
    market_rent = None
    state_name = None
    county_name = None
    property_tax_rate = None
    estimated_annual_tax = None
    
    if fmr_data and zip_code:
        zip_row = fmr_data.get(zip_code)
        if zip_row:
            try:
                market_rent = float(zip_row.get("fmr_2br") or 0.0)
                state_name = str(zip_row.get("state_name") or "").strip()
                county_name = str(zip_row.get("county_name") or "").strip()
            except Exception:
                market_rent = None
    
    # Calculate property tax if we have county data
    if tax_by_county and state_name and county_name and sale_price:
        key = (state_name.lower(), county_name.lower())
        rate = tax_by_county.get(key)
        if rate and rate > 0:
            property_tax_rate = rate * 100  # Convert to percentage
            estimated_annual_tax = sale_price * rate
    
    # Calculate price per unit for context
    price_per_unit = None
    if sale_price and units and units > 0:
        price_per_unit = sale_price / units
    
    # Detect Phoenix submarket for context
    submarket_context = ""
    if address:
        addr_lower = address.lower()
        if "scottsdale" in addr_lower:
            submarket_context = "Scottsdale (Premium market: expect $1,800-2,200/unit rents)"
        elif "tempe" in addr_lower or "85281" in str(zip_code):
            submarket_context = "Tempe/ASU area (Strong student/professional demand: $1,500-1,800/unit)"
        elif "gilbert" in addr_lower or "chandler" in addr_lower:
            submarket_context = "Gilbert/Chandler (Family-oriented suburbs: $1,600-1,900/unit)"
        elif "mesa" in addr_lower:
            submarket_context = "Mesa (Value market: $1,400-1,700/unit)"
        elif "phoenix" in addr_lower:
            submarket_context = "Phoenix metro (Varies by area: $1,400-1,800/unit)"
        elif "peoria" in addr_lower or "surprise" in addr_lower or "glendale" in addr_lower:
            submarket_context = "West Valley (Growing market: $1,500-1,750/unit)"
    
    market_rent_str = f"${market_rent:,.0f}/month" if market_rent else "Unknown"
    sale_price_str = f"${sale_price:,.0f}" if sale_price else "Unknown"
    sqft_str = f"{sqft:,.0f}" if sqft else "Unknown"
    mortgage_str = f"${mortgage_amount:,.0f}" if mortgage_amount else "None"
    price_per_unit_str = f"${price_per_unit:,.0f}" if price_per_unit else "Unknown"
    tax_rate_str = f"{property_tax_rate:.2f}%" if property_tax_rate else "Unknown"
    annual_tax_str = f"${estimated_annual_tax:,.0f}" if estimated_annual_tax else "Unknown"
    
    prompt = f"""You are an elite commercial real estate underwriting AI partner. Analyze this multifamily property with institutional-grade rigor.

PROPERTY OVERVIEW:
Address: {address}
Submarket: {submarket_context or "Phoenix Metro Area"}
Units: {units}
Sale Price: {sale_price_str}
Price/Unit: {price_per_unit_str}
Total SF: {sqft_str}
Existing Mortgage: {mortgage_str}
ZIP Code: {zip_code or "Unknown"}

MARKET INTELLIGENCE:
Market Rent (FMR 2BR): {market_rent_str}
  → FMR = HUD Fair Market Rent (conservative baseline)
  → Market typically pays 10-20% above FMR in strong markets
  → Adjust based on submarket, property class, and condition

Property Tax Rate: {tax_rate_str}
Estimated Annual Tax: {annual_tax_str}

UNDERWRITING CRITERIA (Investor Buy-Box):
- Vacancy Rate: {settings.get('vacancyRate', 5)}%
- Operating Expense Ratio: {settings.get('expenseRatio', 50)}% (includes all opex + taxes)
- LTV: {settings.get('ltv', 75)}%
- Interest Rate: {settings.get('interestRate', 6.5)}%
- Min DSCR: {settings.get('minDscr', 1.25)} (debt service coverage)
- Min Cash-on-Cash: {settings.get('minCoC', 8)}%
- Min Cap Rate: {settings.get('minCapRate', 7)}%

VERDICT RULES (CRITICAL - Follow exactly):
→ DEAL: Property EXCEEDS ALL minimum thresholds (cap rate ≥ {settings.get('minCapRate', 7)}%, DSCR ≥ {settings.get('minDscr', 1.25)}, CoC ≥ {settings.get('minCoC', 8)}%)
→ MAYBE: Property is CLOSE but falls short on 1 threshold by <15% (e.g., 6.2% cap when 7% required)
→ TRASH: Property fails 2+ thresholds OR misses any single threshold by >15%

UNDERWRITING INSTRUCTIONS:
1. **Estimate Realistic Rent**: Use FMR as baseline, adjust for submarket. If Scottsdale/premium = FMR + 15-20%. If value market = FMR - 5-10%.

2. **Calculate Gross Potential Rent (GPR)**: Units × Monthly Rent × 12

3. **Calculate Effective Gross Income (EGI)**: GPR × (1 - Vacancy Rate)

4. **Calculate Operating Expenses**: 
   - Base OpEx (management, maintenance, utilities, etc.) = EGI × {settings.get('expenseRatio', 50)}%
   - Property Taxes = {annual_tax_str}
   - Insurance = Sale Price × 0.75% (standard multifamily insurance rate)
   - Total OpEx = Base + Taxes + Insurance

5. **Calculate NOI**: EGI - Total Operating Expenses

6. **Calculate Cap Rate**: (NOI / Sale Price) × 100

7. **Calculate Debt Service**:
   - Down Payment = Sale Price × (1 - {settings.get('ltv', 75)}%)
   - Loan Amount = Sale Price × {settings.get('ltv', 75)}%
   - Monthly Payment = Loan × (r(1+r)^n) / ((1+r)^n - 1) where r = {settings.get('interestRate', 6.5)}%/12, n = 360 months (30 years)
   - Annual Debt Service = Monthly Payment × 12

8. **Calculate DSCR**: NOI / Annual Debt Service

9. **Calculate Equity & CoC**:
   - Down Payment = Sale Price × (1 - {settings.get('ltv', 75)}%)
   - Closing Costs = Sale Price × {settings.get('closingCosts', 2)}%
   - Acquisition Fee = Sale Price × {settings.get('acquisitionFee', 1)}%
   - Total Equity = Down Payment + Closing Costs + Acquisition Fee
   - Annual Cash Flow = NOI - Annual Debt Service
   - Cash-on-Cash = (Annual Cash Flow / Total Equity) × 100

10. **Mortgage Analysis** (if existing mortgage present):
   - Current mortgage: {mortgage_str}
   - If low existing mortgage, note refinance/equity opportunity

11. **Apply Verdict Rules**: Compare to thresholds and classify as DEAL/MAYBE/TRASH per rules above

12. **Confidence Level**:
   - HIGH: Complete data, strong submarket, clear verdict
   - MEDIUM: Missing 1-2 data points, moderate submarket intel
   - LOW: Missing 3+ data points, weak market context

13. **Reasoning**: Write 2-3 sentences explaining: (a) rent estimate rationale, (b) key metrics vs thresholds, (c) final verdict justification

Return ONLY valid JSON in this exact format:
{{
  "estimatedRent": 1500,
  "estimatedNOI": 850000,
  "estimatedCapRate": 7.5,
  "dscr": 1.35,
  "cashOnCash": 9.2,
  "verdict": "DEAL",
  "confidence": "high",
  "reasoning": "Scottsdale submarket supports $1,850/unit rent (FMR + 15%). NOI of $850k yields 7.5% cap rate, exceeding 7% minimum. DSCR of 1.35 and CoC of 9.2% both exceed thresholds. Property qualifies as DEAL."
}}"""

    try:
        response = anthropic_client.messages.create(
            model="claude-3-5-haiku-20241022",  # Cheapest and fastest
            max_tokens=600,
            temperature=0.2,  # Lower temp for more consistent math
            messages=[{"role": "user", "content": prompt}]
        )
        
        # Extract JSON from response
        if not response.content or len(response.content) == 0:
            raise ValueError("Empty response from AI model")
        
        content = response.content[0].text
        # Try to parse JSON directly or extract from markdown code blocks
        if "```json" in content:
            parts = content.split("```json")
            if len(parts) > 1:
                content = parts[1].split("```")[0].strip()
        elif "```" in content:
            parts = content.split("```")
            if len(parts) > 2:
                content = parts[1].strip()
        
        analysis = json.loads(content)
        log.info(f"[AI] Analyzed {address}: {analysis.get('verdict')} ({analysis.get('confidence')})")
        return analysis
        
    except Exception as e:
        log.error(f"[AI] Failed to analyze property: {e}")
        # Return conservative fallback
        return {
            "estimatedRent": None,
            "estimatedNOI": None,
            "estimatedCapRate": None,
            "dscr": None,
            "cashOnCash": None,
            "verdict": "TRASH",
            "confidence": "low",
            "reasoning": "Unable to analyze property due to insufficient data."
        }


def score_page_for_financial_data(text: str) -> int:
    """
    Score a page based on likelihood of containing useful financial data.
    Higher score = more likely to have data we need.
    """
    score = 0
    text_lower = text.lower()
    
    # Financial keywords (high value)
    financial_keywords = [
        'rent roll', 'unit mix', 'income', 'expense', 'noi', 'cap rate',
        'operating', 'vacancy', 'gross', 'net', 'annual', 'monthly',
        'taxes', 'insurance', 'utilities', 'maintenance', 'management',
        'financing', 'loan', 'mortgage', 'interest rate', 'ltv', 'debt service',
        'purchase price', 'price per unit', 'price per sf', 'asking price',
        'proforma', 'pro forma', 'actual', 'budget', 'projected',
        'cash flow', 'return', 'irr', 'coc', 'cash on cash',
        'bedroom', 'br', 'bath', 'ba', 'sqft', 'sf', 'square feet',
        'tenant', 'lease', 'occupancy', 'occupied', 'vacant'
    ]
    
    for keyword in financial_keywords:
        if keyword in text_lower:
            score += 10
    
    # Count dollar signs and numbers (indicates financial data)
    dollar_count = text.count('$')
    score += min(dollar_count * 3, 30)  # Cap at 30 points
    
    # Count percentage signs
    pct_count = text.count('%')
    score += min(pct_count * 2, 20)  # Cap at 20 points
    
    # Look for number patterns (financial figures)
    number_pattern = r'\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b'
    numbers = re.findall(number_pattern, text)
    score += min(len(numbers) * 2, 40)  # Cap at 40 points
    
    # Table-like patterns (aligned numbers, common in financial docs)
    if re.search(r'\d+\s+\d+\s+\d+', text):
        score += 15
    
    # Penalize pages with very little text (likely just images)
    if len(text.strip()) < 100:
        score -= 50
    
    # Penalize marketing fluff
    marketing_words = ['amenities', 'lifestyle', 'community', 'neighborhood', 'location highlights', 'area overview']
    for word in marketing_words:
        if word in text_lower:
            score -= 5
    
    return score


def filter_pdf_pages_smart(pdf_bytes: bytes, min_score: int = 20, max_pages: int = 25) -> list:
    """
    Intelligently filter PDF pages to only include those with financial data.
    Returns a list of PIL images for the selected pages.
    """
    import fitz  # PyMuPDF
    from pdf2image import convert_from_bytes
    
    log.info("[V2] Smart PDF filtering - analyzing pages for financial content...")
    
    # Open PDF with PyMuPDF to extract text
    pdf_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    total_pages = len(pdf_doc)
    
    page_scores = []
    for page_num in range(total_pages):
        page = pdf_doc[page_num]
        text = page.get_text()
        score = score_page_for_financial_data(text)
        page_scores.append((page_num, score, len(text.strip())))
        log.debug(f"  Page {page_num + 1}: score={score}, text_len={len(text.strip())}")
    
    pdf_doc.close()
    
    # Sort by score descending
    page_scores.sort(key=lambda x: x[1], reverse=True)
    
    # Select pages that meet minimum score, up to max_pages
    selected_pages = []
    for page_num, score, text_len in page_scores:
        if score >= min_score and len(selected_pages) < max_pages:
            selected_pages.append(page_num)
    
    # If we didn't get enough pages, add some more by score order
    if len(selected_pages) < 5:
        for page_num, score, text_len in page_scores:
            if page_num not in selected_pages and len(selected_pages) < max_pages:
                selected_pages.append(page_num)
            if len(selected_pages) >= 10:
                break
    
    # Sort selected pages back to original order for coherent reading
    selected_pages.sort()
    
    log.info(f"[V2] Selected {len(selected_pages)} of {total_pages} pages: {[p+1 for p in selected_pages]}")
    
    # Convert only selected pages to images at reduced resolution
    # Using DPI of 100 instead of default 200 to reduce file size
    all_images = convert_from_bytes(pdf_bytes, dpi=100)
    selected_images = [all_images[i] for i in selected_pages if i < len(all_images)]
    
    log.info(f"[V2] Converted {len(selected_images)} pages to images for Claude (DPI=100)")
    
    return selected_images


# ---------------------------------------------------------------------------
# Rapid Fire Underwriting (CREXI export napkin underwriting)
# ---------------------------------------------------------------------------

@router.post("/rapid-fire/underwrite")
async def rapid_fire_underwrite(
    file: UploadFile = File(...),
    settings: str = Form(...),
    sourceType: str = Form("crexi"),
):
    """Rapid Fire underwriting for CREXI exports.

    - Accepts a CREXI export spreadsheet as `file` (csv/xls/xlsx).
    - Accepts `settings` JSON string with buy-box assumptions.
    - Returns one RapidFireDeal-style dict per row using simple napkin math.
    """

    import io
    import csv
    import re
    from openpyxl import load_workbook

    # Guard: only accept sheet-like files here.
    allowed_sheet_mimes = {
        "text/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
    mime = (file.content_type or "").lower()
    log.info(f"[RapidFire] Incoming file name={file.filename!r} mime={mime}")
    if mime not in allowed_sheet_mimes:
        raise HTTPException(status_code=415, detail=f"Unsupported file type for rapid fire: {mime}")

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    source_type = (sourceType or "crexi").strip().lower()

    # Parse settings JSON and coerce to numbers with sane defaults.
    try:
        settings_obj = json.loads(settings or "{}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid settings JSON: {e}")

    def _num_or_default(key: str, default: float) -> float:
        v = settings_obj.get(key, default)
        try:
            return float(v)
        except Exception:
            return float(default)

    vacancy_rate = _num_or_default("vacancyRate", 5.0)
    expense_ratio = _num_or_default("expenseRatio", 50.0)
    closing_costs_pct = _num_or_default("closingCosts", 2.0)
    acquisition_fee_pct = _num_or_default("acquisitionFee", 1.0)
    ltv_pct = _num_or_default("ltv", 75.0)
    interest_rate_pct = _num_or_default("interestRate", 6.5)
    amort_years = _num_or_default("amortizationYears", 30.0)
    min_dscr = _num_or_default("minDscr", 1.25)
    min_coc = _num_or_default("minCoC", 8.0)
    min_cap = _num_or_default("minCapRate", 7.0)

    def as_float(v):
        if v is None:
            return None
        if isinstance(v, (int, float)):
            return float(v)
        s = str(v).strip().replace(",", "").replace("$", "").replace("%", "")
        if not s:
            return None
        try:
            return float(s)
        except Exception:
            return None

    # Load tabular data from CSV or Excel into list of dicts.
    rows = []
    filename = (file.filename or "").lower()
    try:
        if filename.endswith(".csv") or mime == "text/csv":
            # CREXI CSV exports often have 1-2 junk lines before the real headers.
            text_stream = io.TextIOWrapper(io.BytesIO(raw_bytes), encoding="utf-8-sig", newline="")
            reader = csv.reader(text_stream)
            csv_rows = list(reader)
            if not csv_rows:
                raise HTTPException(status_code=400, detail="No rows found in CSV")

            # Find header row: first row with at least 2 non-empty string cells.
            header_row_idx = 0
            for idx, row in enumerate(csv_rows):
                if not row:
                    continue
                non_empty_str = [c for c in row if isinstance(c, str) and c.strip()]
                if len(non_empty_str) >= 2:
                    header_row_idx = idx
                    break

            raw_headers = csv_rows[header_row_idx]
            headers = []
            seen_headers = set()
            for i, h in enumerate(raw_headers):
                if h is None:
                    col_name = f"col_{i+1}"
                else:
                    col_name = str(h).strip() or f"col_{i+1}"
                if col_name in seen_headers:
                    col_name = f"{col_name}_{i+1}"
                seen_headers.add(col_name)
                headers.append(col_name)

            rows = []
            for r in csv_rows[header_row_idx + 1 :]:
                if not any(str(c).strip() for c in r):
                    continue
                row_dict = {headers[i]: (r[i] if i < len(r) else None) for i in range(len(headers))}
                rows.append(row_dict)

            log.info(
                "[RapidFire] CSV header row index=%d, headers=%r, data_rows=%d",
                header_row_idx,
                headers,
                len(rows),
            )
        else:
            wb = load_workbook(io.BytesIO(raw_bytes), read_only=True, data_only=True)
            ws = wb.active
            values = list(ws.values)
            if not values:
                raise HTTPException(status_code=400, detail="No rows found in spreadsheet")

            # Find the most likely header row: first row with several non-empty strings
            header_row_idx = 0
            for idx, row in enumerate(values):
                if not row:
                    continue
                non_empty = [c for c in row if c is not None and str(c).strip() != ""]
                non_empty_str = [c for c in non_empty if isinstance(c, str) and c.strip()]
                if len(non_empty_str) >= 2:
                    header_row_idx = idx
                    break

            # Safety check: make sure we have a valid header row
            if header_row_idx >= len(values):
                raise HTTPException(status_code=400, detail="Could not find valid header row in spreadsheet")
            
            raw_headers = values[header_row_idx]
            if not raw_headers:
                raise HTTPException(status_code=400, detail="Header row is empty")
            headers = []
            seen_headers = set()
            for i, h in enumerate(raw_headers):
                if h is None:
                    col_name = f"col_{i+1}"
                else:
                    col_name = str(h).strip() or f"col_{i+1}"
                # Avoid duplicate empty headers
                if col_name in seen_headers:
                    col_name = f"{col_name}_{i+1}"
                seen_headers.add(col_name)
                headers.append(col_name)

            rows = []
            for r in values[header_row_idx + 1 :]:
                if not r:  # Skip completely empty rows
                    continue
                # Safety check: handle rows with fewer cells than headers
                row_dict = {headers[i]: (r[i] if i < len(r) else None) for i in range(len(headers))}
                rows.append(row_dict)

            log.info(
                "[RapidFire] Excel header row index=%d, headers=%r, data_rows=%d",
                header_row_idx,
                headers,
                len(rows),
            )
    except HTTPException:
        # Re-raise HTTPException unchanged so client sees the message.
        raise
    except Exception as e:
        log.exception(f"[RapidFire] Failed to parse spreadsheet: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to parse spreadsheet: {e}")

    log.info(f"[RapidFire] Parsed {len(rows)} data rows from spreadsheet")

    # Normalize headers for fuzzy matching.
    def norm(s: str) -> str:
        return re.sub(r"[^a-z0-9]+", "_", (s or "").strip().lower())

    def pick(col_map: dict, header_map: dict):
        """Fuzzy-match a logical field to a real header.

        col_map example: {"price": ["price", "asking_price", ...]}
        header_map: {"Asking Price ($)": "asking_price_"}
        """
        for _logical, candidates in col_map.items():
            for h, n in header_map.items():
                for cand in candidates:
                    # Exact match on normalized name
                    if n == cand:
                        return h
                    # Header contains candidate token (e.g. asking_price_ contains asking_price)
                    if cand in n:
                        return h
                    # Candidate is a broader token that contains header (rare but cheap to check)
                    if n and n in cand:
                        return h
        return None

    # Build header normalization map from first row's keys.
    header_map = {}
    if rows:
        for k in rows[0].keys():
            header_map[k] = norm(k)
    log.info(f"[RapidFire] ALL COLUMN HEADERS FOUND: {list(header_map.keys())}")
    log.info(f"[RapidFire] Normalized header map: {header_map}")

    # ========================================================================
    # INTELLIGENT COLUMN DETECTION - Analyzes DATA to identify columns
    # ========================================================================
    def detect_columns_by_data(rows, headers):
        """Intelligently detect what each column contains by analyzing the actual data."""
        
        if not rows or not headers:
            return {}
        
        # Sample first 20 rows for analysis
        sample_rows = rows[:min(20, len(rows))]
        
        column_scores = {h: {"address": 0, "units": 0, "price": 0, "price_per_unit": 0, "cap": 0, "noi": 0} for h in headers}
        
        for col in headers:
            col_lower = str(col).lower().strip()
            values = [row.get(col) for row in sample_rows if row.get(col) is not None]
            if not values:
                continue
            
            # Check header name first for quick wins
            if "address" in col_lower or "property" in col_lower or "location" in col_lower:
                column_scores[col]["address"] += 20
            if "unit" in col_lower and "price" not in col_lower:
                column_scores[col]["units"] += 15
            if any(word in col_lower for word in ["price", "sale", "mortgage amount", "asking"]):
                column_scores[col]["price"] += 15
            if "cap" in col_lower and "rate" in col_lower:
                column_scores[col]["cap"] += 15
            if "noi" in col_lower:
                column_scores[col]["noi"] += 15
            
            # Analyze each value
            for val in values:
                if val is None or str(val).strip() in ["", "--", "None", "N/A"]:
                    continue
                    
                val_str = str(val).strip()
                val_num = as_float(val)
                
                # ADDRESS detection: long text with street keywords
                if len(val_str) > 15 and any(word in val_str.lower() for word in [" st,", " ave,", " rd,", " blvd,", " dr,", " way,", " pkwy,", " ln,", "street", "avenue", "road"]):
                    column_scores[col]["address"] += 10
                
                # UNITS detection: small integers (1-500 range)
                if val_num is not None and 1 <= val_num <= 1000 and abs(val_num - int(val_num)) < 0.01:
                    column_scores[col]["units"] += 8
                
                # PRICE detection: large numbers ($50k - $500M)
                if val_num is not None:
                    if 50000 <= val_num <= 500000000:
                        column_scores[col]["price"] += 10
                    
                    # PRICE PER UNIT: typically $10k-$500k per unit
                    if 5000 <= val_num <= 1000000:
                        column_scores[col]["price_per_unit"] += 3
                    
                    # CAP RATE detection: small decimals or percentages (0-25%)
                    if 0 < val_num < 25:
                        column_scores[col]["cap"] += 3
                    
                    # NOI detection: medium-large numbers ($10k - $50M)
                    if 10000 <= val_num <= 50000000:
                        column_scores[col]["noi"] += 4
                
                if "%" in val_str and val_num is not None and 0 < val_num < 100:
                    column_scores[col]["cap"] += 5
        
        # Find best column for each type
        detected = {}
        for field in ["address", "units", "price", "price_per_unit", "cap", "noi"]:
            best_col = None
            best_score = 0
            for col, scores in column_scores.items():
                if scores[field] > best_score:
                    best_score = scores[field]
                    best_col = col
            if best_score >= 5:  # Confidence threshold
                detected[field] = best_col
        
        log.info(f"[RapidFire] Column scores: {column_scores}")
        log.info(f"[RapidFire] AUTO-DETECTED columns: {detected}")
        return detected
    
    # Run intelligent detection
    detected_cols = detect_columns_by_data(rows, list(header_map.keys()))
    
    # Use detected columns (fallback to empty string if not found)
    name_header = detected_cols.get("address", "")
    address_header = name_header  # Same column
    units_header = detected_cols.get("units", "")
    total_price_header = detected_cols.get("price", "")
    price_per_unit_header = detected_cols.get("price_per_unit", "")
    broker_cap_header = detected_cols.get("cap", "")
    noi_header = detected_cols.get("noi", "")
    
    # These are harder to detect from data, so leave empty for now
    city_header = ""
    state_header = ""
    zip_header = ""
    gross_income_header = ""
    url_header = ""
    owner_header = ""

    log.info(
        "[RapidFire] Using columns -> address=%r units=%r total_price=%r ppu=%r broker_cap=%r noi=%r",
        address_header,
        units_header,
        total_price_header,
        price_per_unit_header,
        broker_cap_header,
        noi_header,
    )

    if not total_price_header and not price_per_unit_header:
        log.warning("[RapidFire] No total price or price-per-unit column detected; rows may be skipped")

    deals = []
    skipped_no_price = 0

    # Preload external market data only when needed (Reonomy path)
    fmr_by_zip = None
    tax_by_county = None
    if source_type == "reonomy":
        fmr_by_zip = _load_fmr_by_zip()
        tax_by_county = _load_property_tax_by_county()

    # Debt service helper (always based on TOTAL PRICE, never PPU)
    def annual_debt_service(purchase_price):
        loan_amount = purchase_price * (ltv_pct / 100.0)
        r = (interest_rate_pct / 100.0) / 12.0
        n = int(amort_years * 12)
        if r <= 0 or n <= 0:
            return None
        try:
            payment = loan_amount * (r * (1 + r) ** n) / ((1 + r) ** n - 1)
        except ZeroDivisionError:
            return None
        return payment * 12.0

    for idx, row in enumerate(rows):
        name = (row.get(name_header) if name_header else None) or ""
        city = (row.get(city_header) if city_header else None) or ""
        state = (row.get(state_header) if state_header else None) or ""
        listing_url = (row.get(url_header) if url_header else None) or ""
        owner_name = (row.get(owner_header) if owner_header else None) or ""

        # Extract ZIP from explicit column or from address string (Reonomy path)
        zip_code = None
        if zip_header and row.get(zip_header):
            zip_str = str(row.get(zip_header)).strip()
            m = re.search(r"\b(\d{5})\b", zip_str)
            if m:
                zip_code = m.group(1)
        if not zip_code and address_header and row.get(address_header):
            addr_str = str(row.get(address_header))
            m = re.search(r"\b(\d{5})\b", addr_str)
            if m:
                zip_code = m.group(1)

        units = as_float(row.get(units_header)) if units_header else None
        total_price = as_float(row.get(total_price_header)) if total_price_header else None
        raw_price_per_unit = as_float(row.get(price_per_unit_header)) if price_per_unit_header else None
        broker_cap = as_float(row.get(broker_cap_header)) if broker_cap_header else None
        noi = as_float(row.get(noi_header)) if noi_header else None
        gross_income = as_float(row.get(gross_income_header)) if gross_income_header else None

        # Derive missing pricing fields according to explicit rules.
        # 1) Try to get total_price from explicit total price columns.
        # 2) If missing, but spreadsheet provides Price/Unit and Units, derive total_price.
        if (total_price is None or total_price <= 0) and raw_price_per_unit is not None and units is not None and units > 0:
            total_price = raw_price_per_unit * units

        # If we still don't have a usable total price, we cannot underwrite this row.
        if total_price is None or total_price <= 0:
            skipped_no_price += 1
            continue

        # AI analysis vars - will be populated if AI is used
        ai_reasoning = None
        ai_confidence = None
        use_ai_verdict = False
        
        # If NOI missing, approximate from gross income + settings, or from total price & broker cap.
        if noi is None:
            if gross_income is not None and gross_income > 0:
                effective_income = gross_income * (1.0 - vacancy_rate / 100.0)
                operating_expenses = effective_income * (expense_ratio / 100.0)
                noi = effective_income - operating_expenses
            elif broker_cap is not None and broker_cap > 0:
                noi = total_price * (broker_cap / 100.0)
            # Reonomy-style soft underwriting using FMR + taxes when NOI is missing
            elif source_type == "reonomy" and fmr_by_zip is not None and zip_code and units not in (None, 0):
                # Try AI-powered analysis for Reonomy deals with limited data
                log.info(f"[AI] Using AI analysis for property: {name}")
                
                # Extract additional fields for AI context
                sqft = as_float(row.get("total sqft")) if "total sqft" in row else None
                mortgage_amt = as_float(row.get("last mortgage")) if "last mortgage" in row else None
                
                ai_analysis = analyze_property_with_ai(
                    address=str(name or address_header),
                    units=units,
                    sale_price=total_price,
                    sqft=sqft,
                    mortgage_amount=mortgage_amt,
                    zip_code=zip_code,
                    fmr_data=fmr_by_zip,
                    tax_by_county=tax_by_county,
                    settings={
                        "vacancyRate": vacancy_rate,
                        "expenseRatio": expense_ratio,
                        "closingCosts": closing_costs_pct,
                        "acquisitionFee": acquisition_fee_pct,
                        "ltv": ltv_pct,
                        "interestRate": interest_rate_pct,
                        "minDscr": min_dscr,
                        "minCoC": min_coc,
                        "minCapRate": min_cap,
                    }
                )
                
                # Use AI results if available
                if ai_analysis.get("estimatedNOI"):
                    noi = ai_analysis["estimatedNOI"]
                    ai_reasoning = ai_analysis.get("reasoning", "AI-powered analysis")
                    ai_confidence = ai_analysis.get("confidence", "medium")
                    use_ai_verdict = True
                    
                    # Use AI's verdict directly - don't override with math logic
                    ai_verdict = ai_analysis.get("verdict", "MAYBE").upper()
                    
                    log.info(f"[AI] Estimated NOI: ${noi:,.0f}, Verdict: {ai_verdict}, Confidence: {ai_confidence}")
                
                # Fallback: Use basic FMR calculation if AI didn't produce NOI
                if noi is None:
                    zip_row = fmr_by_zip.get(zip_code)
                    if zip_row is not None:
                        try:
                            # Prefer 2BR FMR as a proxy for per-unit rent
                            rent_2br = float(zip_row.get("fmr_2br") or 0.0)
                        except Exception:
                            rent_2br = 0.0

                        if rent_2br > 0:
                            annual_gross_rent = rent_2br * float(units) * 12.0
                            effective_income = annual_gross_rent * (1.0 - vacancy_rate / 100.0)
                            base_operating_expenses = effective_income * (expense_ratio / 100.0)

                            tax_expense = 0.0
                            if tax_by_county is not None:
                                state_name = str(zip_row.get("state_name") or "").strip()
                                county_name = str(zip_row.get("county_name") or "").strip()
                                if state_name and county_name and total_price is not None:
                                    key = (state_name.lower(), county_name.lower())
                                    rate = tax_by_county.get(key)
                                    if rate is not None and rate > 0:
                                        tax_expense = float(total_price) * rate

                            operating_expenses = base_operating_expenses + tax_expense
                            noi = effective_income - operating_expenses

        calculated_cap_rate = None
        if noi is not None and total_price > 0:
            # Use totalPrice only; this is the underwriting cap rate.
            calculated_cap_rate = (noi / total_price) * 100.0

        ads = annual_debt_service(total_price)
        dscr = None
        if noi is not None and ads not in (None, 0):
            dscr = noi / ads

        # Simple equity + CoC calc, always based on TOTAL PRICE
        equity = total_price * (1.0 - ltv_pct / 100.0)
        equity += total_price * (closing_costs_pct / 100.0)
        equity += total_price * (acquisition_fee_pct / 100.0)

        cash_on_cash = None
        monthly_cf = None
        if noi is not None and ads is not None and equity > 0:
            annual_cf = noi - ads
            cash_on_cash = (annual_cf / equity) * 100.0
            monthly_cf = annual_cf / 12.0

        # Verdict classification with reasons
        verdict_reasons = []

        # If AI was used, trust its verdict instead of recalculating
        if use_ai_verdict:
            verdict = ai_verdict
            verdict_reasons.append(ai_reasoning or "AI-powered analysis")
        else:
            # Traditional math-based verdict logic
            missing_total = total_price is None or total_price <= 0
            missing_noi = noi is None or noi <= 0
            missing_units = units is None or units <= 0

            if missing_total or missing_noi or missing_units:
                verdict = "TRASH"
                if missing_total:
                    verdict_reasons.append("Missing or invalid total price")
                if missing_noi:
                    verdict_reasons.append("Missing or invalid NOI")
                if missing_units:
                    verdict_reasons.append("Missing or invalid units")
            else:
                # DSCR gate
                if dscr is not None and dscr < min_dscr:
                    verdict = "TRASH"
                    verdict_reasons.append(f"DSCR {dscr:.2f} below minimum {min_dscr:.2f}")
                # Cash-on-cash gate
                elif cash_on_cash is not None and cash_on_cash < min_coc:
                    verdict = "TRASH"
                    verdict_reasons.append(f"Cash-on-cash {cash_on_cash:.1f}% below minimum {min_coc:.1f}%")
                # Cap rate gate
                elif calculated_cap_rate is not None and calculated_cap_rate < min_cap:
                    verdict = "MAYBE"
                    verdict_reasons.append(f"Cap rate {calculated_cap_rate:.1f}% below minimum {min_cap:.1f}%")
                else:
                    verdict = "DEAL"
                    verdict_reasons.append("Meets all minimum underwriting thresholds")

        # Final price-per-unit for DTO: always derived from total price and units.
        price_per_unit_dto = None
        if total_price is not None and total_price > 0 and units is not None and units > 0:
            price_per_unit_dto = total_price / units

        deals.append({
            "id": f"rf-{idx+1}",
            "name": str(name) if name else "Unnamed Property",
            "city": str(city) if city else "",
            "state": str(state) if state else "",
            "units": int(units) if units is not None else None,
            # DTO fields for frontend
            "totalPrice": float(total_price),
            "pricePerUnit": float(price_per_unit_dto) if price_per_unit_dto is not None and price_per_unit_dto > 0 else None,
            "brokerCapRate": float(broker_cap) if broker_cap is not None else None,
            "noi": float(noi) if noi is not None else None,
            "calculatedCapRate": float(calculated_cap_rate) if calculated_cap_rate is not None else None,
            "dscr": float(dscr) if dscr is not None else None,
            "cashOnCash": float(cash_on_cash) if cash_on_cash is not None else None,
            "monthlyCashFlow": float(monthly_cf) if monthly_cf is not None else None,
            "listingUrl": str(listing_url).strip() if listing_url else None,
            "ownerName": str(owner_name).strip() if owner_name else None,
            "verdict": verdict,
            "verdictReasons": verdict_reasons,
            "aiAnalysis": {
                "used": use_ai_verdict,
                "reasoning": ai_reasoning,
                "confidence": ai_confidence,
            } if use_ai_verdict else None,
        })

    log.info(
        "[RapidFire] Built %d deals (skipped_no_price=%d)",
        len(deals),
        skipped_no_price,
    )

    debug = {
        "filename": file.filename,
        "mime": mime,
        "total_rows": len(rows),
        "header_map": header_map,
        "matched_headers": {
            "name": name_header,
            "city": city_header,
            "state": state_header,
            "units": units_header,
            "total_price": total_price_header,
            "price_per_unit": price_per_unit_header,
            "broker_cap": broker_cap_header,
            "noi": noi_header,
            "gross_income": gross_income_header,
            "listing_url": url_header,
            "zip": zip_header,
            "address": address_header,
            "owner": owner_header,
        },
        "skipped_no_price": skipped_no_price,
        "returned_deals": len(deals),
    }

    return {"deals": deals, "debug": debug}


@router.post("/deals/parse")
async def parse_deal_v2(file: UploadFile = File(...)):
    log.info(f"[V2] Parse request for file: {file.filename}")
    
    # Import at module level to avoid reimporting App
    from anthropic import Anthropic
    import base64
    
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
    ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929"
    
    ALLOWED_DOC_MIMES = {
        "application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp",
    }
    
    mime = (file.content_type or "").lower()
    if mime not in ALLOWED_DOC_MIMES:
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {mime}")
    
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="Claude/Anthropic API key not configured")
    
    try:
        log.info("[V2] Parsing with Claude vision API...")
        
        anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)
        
        # PDFs need to be converted to images for Claude vision
        if mime == "application/pdf":
            # Use smart filtering to only process pages with financial data
            try:
                images = filter_pdf_pages_smart(data, min_score=15, max_pages=15)
            except Exception as filter_err:
                log.warning(f"[V2] Smart filter failed, falling back to limited pages: {filter_err}")
                from pdf2image import convert_from_bytes
                images = convert_from_bytes(data, dpi=100, first_page=1, last_page=10)
            
            if not images:
                raise HTTPException(status_code=400, detail="Could not extract images from PDF")
            
            # Compress images to JPEG for smaller file sizes
            import io
            content_items = []
            for img in images:
                img_byte_arr = io.BytesIO()
                # Convert to RGB if needed (JPEG doesn't support RGBA)
                if img.mode == 'RGBA':
                    img = img.convert('RGB')
                # Save as JPEG with 75% quality - much smaller than PNG
                img.save(img_byte_arr, format='JPEG', quality=75, optimize=True)
                img_byte_arr = img_byte_arr.getvalue()
                file_b64 = base64.b64encode(img_byte_arr).decode('utf-8')
                content_items.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": file_b64
                    }
                })
        else:
            file_b64 = base64.b64encode(data).decode('utf-8')
            media_type_map = {
                "image/jpeg": "image/jpeg",
                "image/jpg": "image/jpeg",
                "image/png": "image/png",
                "image/webp": "image/webp",
            }
            media_type = media_type_map.get(mime, "image/png")
            content_items = [{
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": file_b64
                }
            }]

        schema_block = """
Return JSON matching this schema:
{
  "property": {"address": "", "city": "", "state": "", "zip": "", "units": 0, "year_built": 0, "rba_sqft": 0, "land_area_acres": 0, "property_type": "", "property_class": "", "parking_spaces": 0},
  "pricing_financing": {"price": 0, "price_per_unit": 0, "price_per_sf": 0, "loan_amount": 0, "down_payment": 0, "interest_rate": 0, "ltv": 0, "term_years": 0, "amortization_years": 0},
  "pnl": {
    "gross_potential_rent": 0,
    "other_income": 0,
        "vacancy_rate": 0,
        "vacancy_amount": 0,
        "vacancy_rate_t12": 0,
        "vacancy_rate_current": 0,
        "vacancy_rate_stabilized": 0,
    "effective_gross_income": 0,
    "operating_expenses": 0,
    "noi": 0,
    "noi_t12": 0,
    "noi_t3": 0,
    "noi_t1": 0,
    "noi_trailing_1": 0,
    "noi_proforma": 0,
    "noi_stabilized": 0,
    "cap_rate": 0,
    "cap_rate_t12": 0,
    "cap_rate_proforma": 0,
    "cap_rate_stabilized": 0,
    "expense_ratio": 0,
    "expense_ratio_t12": 0,
    "expense_ratio_proforma": 0
  },
  "expenses": {"taxes": 0, "insurance": 0, "utilities": 0, "repairs_maintenance": 0, "management": 0, "payroll": 0, "admin": 0, "marketing": 0, "other": 0, "total": 0},
  "underwriting": {"holding_period": 0, "exit_cap_rate": 0},
  "unit_mix": [{"type": "", "units": 0, "unit_sf": 0, "rent_current": 0, "rent_market": 0}]
}

NOI FIELD RULES:
- If the OM shows multiple NOIs (T-1, T-3, T-12, Trailing 1 month, Pro Forma, Stabilized), ALWAYS separate them:
  • Actual / T-12 / "T12" NOI → store in both pnl.noi_t12 and pnl.noi (this is the default NOI for underwriting).
  • T-3 or "Trailing 3" NOI → store in pnl.noi_t3.
  • T-1 or "Trailing 1" NOI → store in pnl.noi_t1.
  • A clearly labeled single trailing month NOI (e.g. "Trailing 1 Month") → store in pnl.noi_trailing_1.
  • Pro Forma / Year 1 projected NOI → store in pnl.noi_proforma.
  • Stabilized NOI after renovations/lease-up → store in pnl.noi_stabilized.
- NEVER put broker pro forma NOI into pnl.noi_t12 if an actual/T12 NOI is available.
- If ONLY pro forma NOI is given and you truly cannot find any actual/T12 NOI, put the value in pnl.noi_proforma and ALSO copy it to pnl.noi.

CAP RATE & VACANCY FIELD RULES:
- If the OM shows multiple cap rates (T12 / In-Place, T3, Pro Forma, Stabilized), always separate them:
    • In-Place / Actual / T12 Cap Rate → store in both pnl.cap_rate_t12 and pnl.cap_rate (this is the default cap rate for underwriting).
    • Pro Forma / Year 1 Cap Rate → store in pnl.cap_rate_proforma.
    • Stabilized Cap Rate (after renovations/lease-up) → store in pnl.cap_rate_stabilized.
- If only a Pro Forma cap rate is given and there is no clear actual/T12 cap rate, put it in pnl.cap_rate_proforma and ALSO copy to pnl.cap_rate.

- If the OM shows multiple vacancy or occupancy rates (current, T12, stabilized/pro forma), always separate them:
    • Actual / T12 Vacancy Rate → store in pnl.vacancy_rate_t12 and ALSO as pnl.vacancy_rate if that is the primary underwriting basis.
    • Current Vacancy / Occupancy (point-in-time) → store in pnl.vacancy_rate_current (convert occupancy to vacancy if needed).
    • Pro Forma / Stabilized Vacancy Rate → store in pnl.vacancy_rate_stabilized.

EXPENSE RATIO FIELD RULES:
- When the OM shows "Total Expenses as % of EGI" or similar expense ratio metrics:
    • Actual / T12 expense ratio → store in pnl.expense_ratio_t12 and ALSO as pnl.expense_ratio (this is the default for underwriting).
    • Pro Forma / Stabilized expense ratio → store in pnl.expense_ratio_proforma.
"""
        
        content_items.append({
            "type": "text",
            "text": f"Extract ONLY numerical data from this real estate document. Focus on property details, pricing/financing terms, income statements, expense breakdowns, underwriting assumptions, and unit mix. Read numbers directly from tables, financial statements, and text - do not estimate or infer values. Fill in the JSON schema with exact numbers found in the document.\n\n{schema_block}\n\nReturn ONLY valid JSON with numerical values, no text explanations or markdown."
        })
        
        messages = [{
            "role": "user",
            "content": content_items
        }]
        
        response = anthropic_client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=4000,
            messages=messages
        )

        # Try to extract token usage if provided by the client
        prompt_tokens = None
        completion_tokens = None
        total_tokens = None
        try:
            usage = getattr(response, 'usage', None) or (response.get('usage') if isinstance(response, dict) else None)
            if usage:
                prompt_tokens = usage.get('prompt_tokens') if isinstance(usage, dict) else getattr(usage, 'prompt_tokens', None)
                completion_tokens = usage.get('completion_tokens') if isinstance(usage, dict) else getattr(usage, 'completion_tokens', None)
                total_tokens = usage.get('total_tokens') if isinstance(usage, dict) else getattr(usage, 'total_tokens', None)
        except Exception:
            pass

        text = response.content[0].text.strip()
        log.info(f"[V2 DEBUG] Raw Claude response: {text}")
        
        if text.startswith("```"):
            text = text.split("```", 2)[1]
            if text.startswith("json"):
                text = text[4:].strip()
        
        parsed_json = json.loads(text)
        
        # DEBUG: Log complete parsed JSON
        log.info("="*80)
        log.info("[V2 DEBUG] COMPLETE CLAUDE PARSE RESULT:")
        log.info("="*80)
        log.info(json.dumps(parsed_json, indent=2, default=str))
        log.info("="*80)
        
        log.info("[V2] Creating DealV2...")
        deal = storage.create_deal(parsed_json, file.filename)
        
        # DEBUG: Log deal summary extraction
        log.info("[V2 DEBUG] Deal Summary Extracted:")
        log.info(f"  - Address: {deal.summary_address}")
        log.info(f"  - Units: {deal.summary_units}")
        log.info(f"  - Price: {deal.summary_price}")
        log.info(f"  - NOI: {deal.summary_noi}")
        log.info(f"  - Cap Rate: {deal.summary_cap_rate}")
        
        return JSONResponse({
            "deal_id": deal.id,
            "parsed": parsed_json,
            "summary": {
                "address": deal.summary_address,
                "units": deal.summary_units,
                "price": deal.summary_price,
                "noi": deal.summary_noi,
                "cap_rate": deal.summary_cap_rate
            }
        })
    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"[V2] Parse failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/deals/parse-deal-manager")
async def parse_deal_manager_excel(file: UploadFile = File(...)):
    """
    Parse Deal Manager Excel files using direct cell mapping.
    This is an ADD-ON parser that reads specific cells from Deal Manager spreadsheets.
    Does NOT replace or modify existing PDF/image parsing.
    """
    log.info(f"[V2] Deal Manager parse request for file: {file.filename}")
    
    if not HAS_DEAL_MANAGER_PARSER:
        raise HTTPException(
            status_code=503, 
            detail="Deal Manager parser not available. Install openpyxl: pip install openpyxl"
        )
    
    # Check file type
    mime = (file.content_type or "").lower()
    filename = file.filename or ""
    
    ALLOWED_EXCEL_MIMES = {
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/octet-stream"  # Some browsers send this for xlsx
    }
    
    is_excel_ext = filename.lower().endswith('.xlsx') or filename.lower().endswith('.xls')
    
    if mime not in ALLOWED_EXCEL_MIMES and not is_excel_ext:
        raise HTTPException(
            status_code=415, 
            detail=f"File must be an Excel file (.xlsx or .xls). Got: {mime}"
        )
    
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    
    try:
        log.info("[V2] Parsing with Deal Manager Excel parser...")
        
        # Parse using Deal Manager mapping
        result = parse_deal_manager_bytes(data, filename)
        
        if not result.get("success"):
            error_msg = result.get("error", "Unknown parsing error")
            log.error(f"[V2] Deal Manager parse failed: {error_msg}")
            raise HTTPException(status_code=422, detail=error_msg)
        
        parsed_json = result["data"]
        fields_found = result.get("fields_found", [])
        fields_missing = result.get("fields_missing", [])
        
        log.info(f"[V2] Deal Manager parsed {len(fields_found)} fields")
        if fields_missing:
            log.warning(f"[V2] Missing required fields: {fields_missing}")
        
        # Create deal from parsed data
        deal = storage.create_deal(parsed_json, filename)
        
        log.info("[V2 DEBUG] Deal Manager Summary Extracted:")
        log.info(f"  - Address: {deal.summary_address}")
        log.info(f"  - Price: {deal.summary_price}")
        log.info(f"  - NOI: {deal.summary_noi}")
        log.info(f"  - Cap Rate: {deal.summary_cap_rate}")
        log.info(f"  - Fields Found: {len(fields_found)}")
        
        return JSONResponse({
            "deal_id": deal.id,
            "parsed": parsed_json,
            "summary": {
                "address": deal.summary_address,
                "units": deal.summary_units,
                "price": deal.summary_price,
                "noi": deal.summary_noi,
                "cap_rate": deal.summary_cap_rate
            },
            "parser_info": {
                "source": "deal_manager_excel",
                "fields_found": len(fields_found),
                "fields_missing": fields_missing
            }
        })
        
    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"[V2] Deal Manager parse failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/deals/{deal_id}")
async def get_deal_v2(deal_id: str):
    deal = storage.get_deal(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


@router.post("/deals/{deal_id}/scenario")
async def update_deal_scenario(deal_id: str, request: Request):
    """Update the stored scenario JSON for a deal.

    The frontend wizard/results should POST the full, user-edited deal
    payload here before calling the AI underwriting endpoint so the
    analysis prompt uses the same data the user is seeing.
    """
    from pydantic import ValidationError

    deal = storage.get_deal(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    scenario = body.get("scenario")
    if not isinstance(scenario, dict):
        raise HTTPException(status_code=400, detail="'scenario' must be an object")

    # Assign scenario_json directly; pydantic will validate on save
    try:
        deal.scenario_json = scenario
        storage.save_deal(deal)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=f"Invalid scenario payload: {e}")

    return {"ok": True}


@router.post("/deals/{deal_id}/underwrite")
async def underwrite_deal(deal_id: str, request: Request):
    """
    Run full AI underwriting analysis on a deal.
    Returns structured 8-section analysis with BUY/MAYBE/PASS verdict.
    """
    from .llm_client import call_openai_chat

    log.info(f"[V2] Underwrite request for deal: {deal_id}")
    
    # Get inputs from request body
    try:
        body = await request.json()
        body = body or {}
        buy_box = body.get("buy_box")
        underwriting_mode = body.get("underwriting_mode", "hardcoded")
        calc_json = body.get("calc_json") or {}
        wizard_structure = body.get("wizard_structure") or {}
        log.info(
            f"[V2] Underwriting mode: {underwriting_mode}, "
            f"Buy box keys: {list(buy_box.keys()) if isinstance(buy_box, dict) else 'None'}, "
            f"calc_json keys: {list(calc_json.keys()) if isinstance(calc_json, dict) else 'None'}, "
            f"wizard_structure keys: {list(wizard_structure.keys()) if isinstance(wizard_structure, dict) else 'None'}"
        )
    except:
        buy_box = None
        underwriting_mode = "hardcoded"
        calc_json = {}
        wizard_structure = {}
    
    deal = storage.get_deal(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    try:

        # Prefer the latest user-edited wizard scenario (if saved) so the
        # AI analysis reflects the numbers the user is actually underwriting
        # with, rather than just the original parsed OM snapshot.
        deal_json = getattr(deal, "scenario_json", None) or deal.parsed_json

        # Build the v3 underwriting system prompt that is pure "explainer"
        # and never recalculates numbers already present in calc_json.
        system_prompt = build_underwriter_system_prompt_v3(
            deal_json=deal_json,
            calc_json=calc_json,
            wizard_structure=wizard_structure,
            buy_box=buy_box or {},
        )
        
        log.info("[V2] Calling OpenAI (GPT) for full underwriting analysis...")

        # Build the user message and call OpenAI wrapper which logs usage
        user_message = {
            "role": "user",
            "content": "Use the system prompt, deal_json, calc_json, wizard_structure, and buy_box provided above. Do NOT recalculate numbers that already exist in calc_json. Produce the 1–8 section underwriting exactly in the required format."
        }

        analysis_text = call_openai_chat(
            system_prompt=system_prompt,
            messages=[user_message],
            model="gpt-4o-mini",
            user_id=request.headers.get('X-User-ID') or request.cookies.get('user_id'),
            action='underwrite_full',
            deduct_from_balance=True,
        )

        analysis_text = analysis_text.strip() if isinstance(analysis_text, str) else str(analysis_text)
        log.info(f"[V2] Underwriting complete. Response length: {len(analysis_text)} chars")
        
        # Try to extract verdict from the response
        verdict = "MAYBE"  # default
        if "🟢" in analysis_text or "BUY" in analysis_text.upper()[:500]:
            verdict = "BUY"
        elif "🔴" in analysis_text or "PASS" in analysis_text.upper()[:500]:
            verdict = "PASS"
        
        # Generate a separate compressed summary for the Deal-or-No-Deal band
        summary_system_prompt = build_summary_prompt_v2(
            deal_json=deal_json,
            calc_json=calc_json,
            wizard_structure=wizard_structure,
            buy_box=buy_box or {},
            verdict=verdict,
        )

        # Generate compact summary via OpenAI as well
        summary_text = call_openai_chat(
            system_prompt=summary_system_prompt,
            messages=[{"role": "user", "content": "Using only the data above, produce a 2–4 sentence, blunt summary for the Deal-or-No-Deal header. Do NOT compute any new numbers."}],
            model="gpt-4o-mini",
            user_id=request.headers.get('X-User-ID') or request.cookies.get('user_id'),
            action='underwrite_summary',
            deduct_from_balance=True,
        )
        summary_text = summary_text.strip() if isinstance(summary_text, str) else str(summary_text)

        log.info(f"[V2] Underwriting summary complete. Length: {len(summary_text)} chars")

        # Store underwriting result in deal (attach to both base parse and
        # scenario copy when available so later views can reference it)
        result_payload = {
            "analysis": analysis_text,
            "verdict": verdict,
            "timestamp": datetime.utcnow().isoformat() if 'datetime' in dir() else None
        }
        deal.parsed_json["_underwriting_result"] = result_payload
        if getattr(deal, "scenario_json", None) is not None:
            deal.scenario_json["_underwriting_result"] = result_payload
        # Store the compact summary text alongside the full analysis
        deal.parsed_json["_underwriting_summary_v2"] = summary_text
        if getattr(deal, "scenario_json", None) is not None:
            deal.scenario_json["_underwriting_summary_v2"] = summary_text
        storage.save_deal(deal)

        # Build numeric summary for the AI header entirely from calc_json
        effective_json = deal_json if isinstance(deal_json, dict) else {}
        property_json = effective_json.get("property", {}) or {}

        # Address and units still come from deal_json/property
        address = deal.summary_address or property_json.get("address") or ""
        units = property_json.get("units") or deal.summary_units or 0

        # Normalize calc_json views
        current = {}
        year1 = {}
        acquisition = {}
        if isinstance(calc_json, dict):
            current = calc_json.get("current") or {}
            year1 = calc_json.get("year1") or {}
            acquisition = calc_json.get("acquisition") or {}

        price = (
            current.get("price")
            or acquisition.get("purchasePrice")
            or 0
        )
        noi = current.get("noi") or year1.get("noi") or 0
        cap_rate = current.get("capRate") or year1.get("capRate") or 0.0
        dscr_header = current.get("dscr") or year1.get("dscr") or 0.0
        cashflow_header = current.get("cashflow") or year1.get("cashFlow") or 0
        expense_ratio_header = current.get("expenseRatio") or year1.get("expenseRatio") or 0.0

        return JSONResponse({
            "deal_id": deal_id,
            "verdict": verdict,
            "analysis": analysis_text,
            "analysis_markdown": analysis_text,
            "summary_text": summary_text,
            "calc_json": calc_json,
            "wizard_structure": wizard_structure,
            "numeric_summary": {
                "address": address,
                "units": units,
                "price": price,
                "noi": noi,
                "cap_rate": cap_rate,
                "dscr": dscr_header,
                "cashflow": cashflow_header,
                "expense_ratio": expense_ratio_header
            }
        })

    except Exception as e:
        log.error(f"[V2] Underwriting error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/deals/{deal_id}/max-underwrite")
async def max_underwrite_deal(deal_id: str, request: Request):
    """
    MAX AI Underwriting - Exhaustive principal-level underwriting.
    Uses the specialized MAX AI prompt for:
    - Never stopping early (no speed kills)
    - Always running full stress tests
    - Always attempting creative restructuring
    - Using buy box presets as exact user criteria
    """
    from .llm_client import call_openai_chat

    log.info(f"[MAX AI] Underwrite request for deal: {deal_id}")
    
    # Get inputs from request body
    try:
        body = await request.json()
        body = body or {}
        buy_box_presets = body.get("buy_box") or body.get("buyBoxPresets") or {}
        deal_data = body.get("scenario") or body.get("dealData") or {}
        
        log.info(
            f"[MAX AI] Buy box keys: {list(buy_box_presets.keys()) if isinstance(buy_box_presets, dict) else 'None'}, "
            f"Deal data keys: {list(deal_data.keys()) if isinstance(deal_data, dict) else 'None'}"
        )
    except Exception as e:
        log.error(f"[MAX AI] Error parsing request body: {e}")
        buy_box_presets = {}
        deal_data = {}
    
    deal = storage.get_deal(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    try:
        # If deal_data not provided, use latest scenario or parsed JSON
        if not deal_data or len(deal_data) == 0:
            deal_data = getattr(deal, "scenario_json", None) or deal.parsed_json

        # Build the MAX AI exhaustive underwriting prompt
        system_prompt = build_max_ai_underwriting_prompt(
            buy_box_presets=buy_box_presets,
            deal_data=deal_data
        )
        
        log.info("[MAX AI] Calling OpenAI (GPT-4o-mini) for exhaustive underwriting...")

        # Build the user message - MAX AI expects JSON input
        input_json = {
            "buyBoxPresets": buy_box_presets,
            "dealData": deal_data
        }
        
        user_message = {
            "role": "user",
            "content": f"Underwrite this deal:\n\n```json\n{json.dumps(input_json, indent=2)}\n```"
        }

        analysis_text = call_openai_chat(
            system_prompt=system_prompt,
            messages=[user_message],
            model="gpt-4o-mini",
            user_id=request.headers.get('X-User-ID') or request.cookies.get('user_id'),
            action='max_ai_underwrite',
            deduct_from_balance=True,
        )

        analysis_text = analysis_text.strip() if isinstance(analysis_text, str) else str(analysis_text)
        log.info(f"[MAX AI] Underwriting complete. Response length: {len(analysis_text)} chars")
        
        # Extract verdict from the response
        verdict = "MAYBE"  # default
        if "✅ WORKS AS-IS" in analysis_text:
            verdict = "BUY"
        elif "⚠️ WORKS ONLY IF RESTRUCTURED" in analysis_text:
            verdict = "MAYBE"
        elif "🟡 BORDERLINE / FRAGILE" in analysis_text:
            verdict = "MAYBE"
        elif "❌ DEAD DEAL" in analysis_text:
            verdict = "PASS"
        
        # Store MAX AI result in deal
        result_payload = {
            "analysis": analysis_text,
            "verdict": verdict,
            "source": "max_ai",
            "timestamp": datetime.utcnow().isoformat()
        }
        deal.parsed_json["_max_ai_result"] = result_payload
        if getattr(deal, "scenario_json", None) is not None:
            deal.scenario_json["_max_ai_result"] = result_payload
        storage.save_deal(deal)

        return JSONResponse({
            "deal_id": deal_id,
            "verdict": verdict,
            "analysis": analysis_text,
            "summary_text": analysis_text,  # MAX AI analysis is the summary
            "source": "max_ai"
        })

    except Exception as e:
        log.error(f"[MAX AI] Underwriting error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/deals/{deal_id}/scenario")
            "buy_box": buy_box or {},
            "summary": {
                "address": address,
                "units": units,
                "price": price,
                "noi": noi,
                "cap_rate": cap_rate,
                "dscr": dscr_header,
                "cashflow": cashflow_header,
                "expense_ratio": expense_ratio_header,
            },
        })
        
    except Exception as e:
        log.exception(f"[V2] Underwriting failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/deals/{deal_id}/chat")
async def chat_with_deal(deal_id: str, request: ChatRequest):
    log.info(f"[V2] Chat with deal: {deal_id}")
    
    deal = storage.get_deal(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    try:
        # Use the latest user-edited scenario data if available
        deal_json = getattr(deal, "scenario_json", None) or deal.parsed_json
        
        # Get calc_json and wizard_structure from the request body
        calc_json = request.calc_json or {}
        wizard_structure = request.wizard_structure or {}
        
        # Build the new Deal Partner chat prompt
        system_prompt = build_deal_partner_chat_prompt(
            deal_json=deal_json,
            calc_json=calc_json,
            wizard_structure=wizard_structure,
            buy_box=request.buy_box
        )
        
        messages_dict = [{"role": msg.role, "content": msg.content} for msg in request.messages]
        
        # Build full message list with system prompt first
        full_messages = [{"role": "system", "content": system_prompt}]
        full_messages.extend(messages_dict)
        
        if request.llm == "openai":
            from .llm_client import client
            response = client.chat.completions.create(
                model=request.model,
                messages=full_messages,
                temperature=0.7,
                max_tokens=2000
            )
            response_text = response.choices[0].message.content
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported LLM: {request.llm}")
        
        deal.chat_history.extend(messages_dict)
        deal.chat_history.append({"role": "assistant", "content": response_text})
        storage.save_deal(deal)
        
        return JSONResponse({"message": {"role": "assistant", "content": response_text}})
    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"[V2] Chat failed: {e}")
        raise HTTPException(status_code=500, detail="OpenAI chat error")


@router.post("/sheet/chat")
async def chat_with_sheet(request: Request):
    """Chat endpoint for the spreadsheet-style underwriting model.

    Expects JSON body with:
    - sheet_state_json: raw inputs from the grid
    - sheet_calc_json: calculated outputs from the JS engine
    - sheet_structure: current debt structure selection
    - messages: chat history as list[{role, content}]
    """

    try:
      body = await request.json()
    except Exception:
      raise HTTPException(status_code=400, detail="Invalid JSON body")

    sheet_state_json = body.get("sheet_state_json") or {}
    sheet_calc_json = body.get("sheet_calc_json") or {}
    sheet_structure = body.get("sheet_structure") or {}
    messages = body.get("messages") or []

    # Build system prompt for sheet underwriter
    system_prompt = build_sheet_underwriter_chat_prompt(
        sheet_state_json=sheet_state_json,
        sheet_calc_json=sheet_calc_json,
        sheet_structure=sheet_structure,
    )

    full_messages = [{"role": "system", "content": system_prompt}]
    # Ensure messages are in the right shape
    for m in messages:
        role = m.get("role")
        content = m.get("content")
        if not role or not content:
            continue
        full_messages.append({"role": role, "content": content})

    try:
        response = client.chat.completions.create(
            model=os.getenv("OPENAI_SHEET_MODEL", "gpt-4o-mini"),
            messages=full_messages,
            temperature=0.3,
            max_tokens=2000,
        )
        response_text = response.choices[0].message.content
        return JSONResponse({"message": {"role": "assistant", "content": response_text}})
    except Exception as e:
        log.exception(f"[V2] Sheet chat failed: {e}")
        raise HTTPException(status_code=500, detail="OpenAI sheet chat error")


@router.post("/deals/{deal_id}/noi-analysis")
async def analyze_noi(deal_id: str, request: Request):
    """
    Run NOI Engineering analysis on a deal.
    Returns NOI optimization opportunities and execution roadmap.
    """
    from .llm_client import call_openai_chat

    log.info(f"[V2] NOI Analysis request for deal: {deal_id}")
    
    try:
        body = await request.json()
        calc_json = body.get("calc_json") or {}
    except:
        calc_json = {}
    
    deal = storage.get_deal(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    try:
        deal_json = getattr(deal, "scenario_json", None) or deal.parsed_json

        system_prompt = build_noi_engineering_prompt(
            deal_json=deal_json,
            calc_json=calc_json
        )
        
        log.info("[V2] Calling OpenAI for NOI analysis...")

        user_message = {
            "role": "user",
            "content": "Analyze this property's NOI engineering opportunities using the provided deal_json and calc_json. Follow the output structure exactly."
        }

        analysis_text = call_openai_chat(
            system_prompt=system_prompt,
            messages=[user_message],
            model="gpt-4o-mini",
            user_id=request.headers.get('X-User-ID') or request.cookies.get('user_id'),
            action='noi_analysis',
            deduct_from_balance=False,  # FREE
        )

        analysis_text = analysis_text.strip() if isinstance(analysis_text, str) else str(analysis_text)
        log.info(f"[V2] NOI analysis complete. Response length: {len(analysis_text)} chars")
        
        return JSONResponse({
            "deal_id": deal_id,
            "analysis": analysis_text
        })
        
    except Exception as e:
        log.exception(f"[V2] NOI analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/deals/{deal_id}/structure-analysis")
async def analyze_structure(deal_id: str, request: Request):
    """
    Run Deal Structure analysis on a deal.
    Returns structure recommendations and risk assessment.
    """
    from .llm_client import call_openai_chat

    log.info(f"[V2] Structure Analysis request for deal: {deal_id}")
    
    try:
        body = await request.json()
        calc_json = body.get("calc_json") or {}
        wizard_structure = body.get("wizard_structure") or {}
        buy_box = body.get("buy_box") or {}
    except:
        calc_json = {}
        wizard_structure = {}
        buy_box = {}
    
    deal = storage.get_deal(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    try:
        deal_json = getattr(deal, "scenario_json", None) or deal.parsed_json

        system_prompt = build_deal_structure_prompt(
            deal_json=deal_json,
            calc_json=calc_json,
            wizard_structure=wizard_structure,
            buy_box=buy_box
        )
        
        log.info("[V2] Calling OpenAI for structure analysis...")

        user_message = {
            "role": "user",
            "content": "Analyze this deal's structure and recommend the optimal financing approach using the provided data. Follow the output structure exactly."
        }

        analysis_text = call_openai_chat(
            system_prompt=system_prompt,
            messages=[user_message],
            model="gpt-4o-mini",
            user_id=request.headers.get('X-User-ID') or request.cookies.get('user_id'),
            action='structure_analysis',
            deduct_from_balance=False,  # FREE
        )

        analysis_text = analysis_text.strip() if isinstance(analysis_text, str) else str(analysis_text)
        log.info(f"[V2] Structure analysis complete. Response length: {len(analysis_text)} chars")
        
        return JSONResponse({
            "deal_id": deal_id,
            "analysis": analysis_text
        })
        
    except Exception as e:
        log.exception(f"[V2] Structure analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/deals/{deal_id}/rentcast")
async def get_rentcast_data(deal_id: str, request: Request):
    """
    Fetch market rent data from RentCast API for the deal's address.
    User must explicitly request this - not automatic.
    """
    import httpx
    
    RENTCAST_API_KEY = "a4a69093ad93468e8ffc6aa804dff4ce"
    
    log.info(f"[V2] RentCast request for deal: {deal_id}")
    
    deal = storage.get_deal(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    # Get address from deal
    property_data = deal.parsed_json.get("property", {})
    address = property_data.get("address", "")
    city = property_data.get("city", "")
    state = property_data.get("state", "")
    zipcode = property_data.get("zip", "") or property_data.get("zipcode", "")
    
    if not address:
        raise HTTPException(status_code=400, detail="No address found for this deal")
    
    # Try to get optional parameters from request body
    try:
        body = await request.json()
        bedrooms = body.get("bedrooms")
        bathrooms = body.get("bathrooms")
        property_type = body.get("property_type", "Apartment")
    except:
        bedrooms = None
        bathrooms = None
        property_type = "Apartment"
    
    try:
        async with httpx.AsyncClient() as client:
            # Build query parameters
            params = {
                "address": address,
                "propertyType": property_type
            }
            if city:
                params["city"] = city
            if state:
                params["state"] = state
            if zipcode:
                params["zipCode"] = zipcode
            if bedrooms:
                params["bedrooms"] = bedrooms
            if bathrooms:
                params["bathrooms"] = bathrooms
            
            headers = {
                "X-Api-Key": RENTCAST_API_KEY,
                "Accept": "application/json"
            }
            
            log.info(f"[V2] RentCast API call with params: {params}")
            
            # Call RentCast Rent Estimate API
            response = await client.get(
                "https://api.rentcast.io/v1/avm/rent/long-term",
                params=params,
                headers=headers,
                timeout=30.0
            )
            
            if response.status_code == 200:
                rent_data = response.json()
                log.info(f"[V2] RentCast success: {rent_data}")
                
                # Also try to get comparable rentals
                try:
                    comps_response = await client.get(
                        "https://api.rentcast.io/v1/listings/rental/long-term",
                        params={
                            "latitude": rent_data.get("latitude"),
                            "longitude": rent_data.get("longitude"),
                            "radius": 1,  # 1 mile radius
                            "limit": 10,
                            "status": "Active"
                        },
                        headers=headers,
                        timeout=30.0
                    )
                    if comps_response.status_code == 200:
                        rent_data["comparables"] = comps_response.json()
                except Exception as comp_err:
                    log.warning(f"[V2] Could not fetch comparables: {comp_err}")
                    rent_data["comparables"] = []
                
                return JSONResponse({
                    "success": True,
                    "data": rent_data,
                    "address_searched": address
                })
            elif response.status_code == 404:
                return JSONResponse({
                    "success": False,
                    "error": "No rent data found for this address",
                    "address_searched": address
                }, status_code=404)
            else:
                log.error(f"[V2] RentCast API error: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=response.status_code, 
                    detail=f"RentCast API error: {response.text}"
                )
                
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="RentCast API timeout")
    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"[V2] RentCast request failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch rent data: {str(e)}")


# =============================================================================
# COST SEGREGATION ANALYSIS ENDPOINT
# =============================================================================

@router.post("/deals/{deal_id}/costseg")
async def calculate_cost_segregation(deal_id: str, request: Request):
    """
    Calculate cost segregation analysis for a deal.
    
    Accepts optional overrides in request body:
    {
        "purchase_price": float,
        "land_percent": float (0-100),
        "closing_costs": float,
        "five_year_percent": float (0-100),
        "seven_year_percent": float (0-100),
        "fifteen_year_percent": float (0-100),
        "is_residential": bool,
        "bonus_depreciation_percent": float (0-100),
        "federal_tax_rate": float (0-100),
        "state_tax_rate": float (0-100),
        "ltcg_rate": float (0-100),
        "hold_period_years": int,
        "exit_sale_price": float,
        "exit_cap_rate": float,
        "initial_equity": float,
        "pre_tax_cash_flows": [float, ...],
        "include_comparison": bool (default true)
    }
    
    Returns complete cost seg analysis including:
    - Allocation breakdown by asset class
    - Year-by-year depreciation schedule with MACRS
    - Annual tax impact table
    - Exit tax analysis with recapture breakdown
    - After-tax IRR and equity multiple
    - Comparison to standard depreciation (if requested)
    """
    log.info(f"[V2] Cost Seg analysis request for deal: {deal_id}")
    
    # Get the deal
    deal = storage.get_deal(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    # Parse request body for overrides
    try:
        body = await request.json()
    except:
        body = {}
    
    include_comparison = body.pop("include_comparison", True)
    
    try:
        # Extract inputs from deal JSON with any overrides
        inputs = extract_cost_seg_inputs_from_deal(
            deal.parsed_json,
            overrides=body if body else None
        )
        
        log.info(f"[V2] Cost Seg inputs: purchase_price={inputs.purchase_price}, "
                 f"land%={inputs.land_percent}, 5yr%={inputs.five_year_percent}, "
                 f"15yr%={inputs.fifteen_year_percent}, bonus%={inputs.bonus_depreciation_percent}")
        
        # Calculate cost seg analysis
        result = calculate_cost_seg_analysis(inputs)
        
        # Optionally calculate comparison to standard depreciation
        comparison = None
        if include_comparison:
            comparison = calculate_standard_depreciation_comparison(inputs)
            result.standard_depr_irr = comparison["standard_irr"]
            result.irr_improvement = result.after_tax_irr - comparison["standard_irr"]
        
        # Convert to dict for JSON response
        response_data = {
            "success": True,
            "deal_id": deal_id,
            
            # Inputs used (for debugging/display)
            "inputs": {
                "purchase_price": inputs.purchase_price,
                "land_percent": inputs.land_percent,
                "closing_costs": inputs.closing_costs,
                "five_year_percent": inputs.five_year_percent,
                "seven_year_percent": inputs.seven_year_percent,
                "fifteen_year_percent": inputs.fifteen_year_percent,
                "is_residential": inputs.is_residential,
                "bonus_depreciation_percent": inputs.bonus_depreciation_percent,
                "federal_tax_rate": inputs.federal_tax_rate,
                "state_tax_rate": inputs.state_tax_rate,
                "ltcg_rate": inputs.ltcg_rate,
                "hold_period_years": inputs.hold_period_years,
                "exit_cap_rate": inputs.exit_cap_rate,
                "initial_equity": inputs.initial_equity,
            },
            
            # Allocation breakdown
            "allocation": {
                "land_value": result.land_value,
                "building_value": result.building_value,
                "depreciable_basis": result.depreciable_basis,
                "five_year_basis": result.five_year_basis,
                "seven_year_basis": result.seven_year_basis,
                "fifteen_year_basis": result.fifteen_year_basis,
                "long_life_basis": result.long_life_basis,
            },
            
            # Key metrics
            "metrics": {
                "after_tax_irr": round(result.after_tax_irr, 2),
                "after_tax_equity_multiple": round(result.after_tax_equity_multiple, 2),
                "year_1_bonus_depreciation": round(result.year_1_bonus_depreciation, 0),
                "year_1_macrs_depreciation": round(result.year_1_macrs_depreciation, 0),
                "year_1_total_depreciation": round(result.year_1_total_depreciation, 0),
                "year_1_tax_shield": round(result.year_1_tax_shield, 0),
                "total_depreciation_over_hold": round(result.total_depreciation_over_hold, 0),
            },
            
            # Comparison to standard depreciation
            "comparison": {
                "standard_irr": round(result.standard_depr_irr, 2) if result.standard_depr_irr else None,
                "irr_improvement": round(result.irr_improvement, 2) if result.irr_improvement else None,
            } if include_comparison else None,
            
            # Depreciation schedule
            "depreciation_schedule": [
                {
                    "year": d.year,
                    "bonus": round(d.bonus_depreciation, 0),
                    "five_year": round(d.five_year_depreciation, 0),
                    "seven_year": round(d.seven_year_depreciation, 0),
                    "fifteen_year": round(d.fifteen_year_depreciation, 0),
                    "long_life": round(d.long_life_depreciation, 0),
                    "total": round(d.total_depreciation, 0),
                    "cumulative": round(d.cumulative_depreciation, 0),
                }
                for d in result.depreciation_schedule
            ],
            
            # Annual tax impact
            "annual_tax_impact": [
                {
                    "year": t.year,
                    "pre_tax_cf": round(t.pre_tax_cash_flow, 0),
                    "bonus_depreciation": round(t.bonus_depreciation, 0),
                    "five_year_depreciation": round(t.five_year_depreciation, 0),
                    "fifteen_year_depreciation": round(t.fifteen_year_depreciation, 0),
                    "long_life_depreciation": round(t.long_life_depreciation, 0),
                    "total_depreciation": round(t.total_depreciation, 0),
                    "taxable_income": round(t.taxable_income, 0),
                    "tax_liability": round(t.tax_liability, 0),
                    "after_tax_cf": round(t.after_tax_cash_flow, 0),
                    "cumulative_depreciation": round(t.cumulative_depreciation, 0),
                    "adjusted_basis": round(t.adjusted_basis, 0),
                }
                for t in result.annual_tax_impact
            ],
            
            # Exit tax analysis
            "exit_taxes": {
                "sale_price": round(result.exit_taxes.sale_price, 0),
                "selling_costs": round(result.exit_taxes.selling_costs, 0),
                "net_sale_proceeds": round(result.exit_taxes.net_sale_proceeds, 0),
                "original_basis": round(result.exit_taxes.original_basis, 0),
                "accumulated_depreciation": round(result.exit_taxes.accumulated_depreciation, 0),
                "adjusted_basis": round(result.exit_taxes.adjusted_basis, 0),
                "total_gain": round(result.exit_taxes.total_gain, 0),
                "recapture_5_7_year": round(result.exit_taxes.recapture_5_7_year, 0),
                "recapture_15_year": round(result.exit_taxes.recapture_15_year, 0),
                "unrecaptured_1250": round(result.exit_taxes.unrecaptured_1250_gain, 0),
                "long_term_capital_gain": round(result.exit_taxes.long_term_capital_gain, 0),
                "tax_on_personal_recapture": round(result.exit_taxes.tax_on_personal_recapture, 0),
                "tax_on_land_improvements": round(result.exit_taxes.tax_on_land_improvements_recapture, 0),
                "tax_on_1250": round(result.exit_taxes.tax_on_unrecaptured_1250, 0),
                "tax_on_ltcg": round(result.exit_taxes.tax_on_ltcg, 0),
                "total_exit_tax": round(result.exit_taxes.total_exit_tax, 0),
                "after_tax_proceeds": round(result.exit_taxes.after_tax_proceeds, 0),
            }
        }
        
        log.info(f"[V2] Cost Seg analysis complete: IRR={result.after_tax_irr:.2f}%, "
                 f"Multiple={result.after_tax_equity_multiple:.2f}x")
        
        return JSONResponse(response_data)
        
    except Exception as e:
        log.exception(f"[V2] Cost Seg calculation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Cost seg calculation failed: {str(e)}")


# ============================================================================
# Market Research Endpoints (Perplexity Integration)
# ============================================================================

from .market_research import (
    run_quick_market_check,
    run_deep_market_report,
    get_market_research_status,
    extract_market_context_from_deal,
    find_reports_for_deal,
    load_report,
    MarketResearchRequest
)


@router.get("/deals/{deal_id}/market_research/status")
async def get_market_research_status_endpoint(deal_id: str):
    """
    Get the current status of market research for a deal.
    Returns whether quick/deep reports exist, timestamps, scores, and if refresh is recommended.
    """
    log.info(f"[V2] Market research status request for deal: {deal_id}")
    
    deal = storage.get_deal(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    context = extract_market_context_from_deal(deal.parsed_json)
    status = get_market_research_status(deal_id, context)
    
    return JSONResponse({
        "deal_id": status.deal_id,
        "market_key": status.market_key,
        "quick": {
            "exists": status.quick_report_exists,
            "timestamp": status.quick_report_timestamp,
            "score": status.quick_report_score,
            "refresh_recommended": status.quick_refresh_recommended
        },
        "deep": {
            "exists": status.deep_report_exists,
            "timestamp": status.deep_report_timestamp,
            "score": status.deep_report_score,
            "estimated_cost": status.deep_report_cost,
            "refresh_recommended": status.deep_refresh_recommended
        }
    })


@router.post("/deals/{deal_id}/market_research/run")
async def run_market_research_endpoint(deal_id: str, request: Request):
    """
    Run market research analysis (quick or deep) for a deal.
    
    Request body:
    {
        "tier": "quick" | "deep",
        "force_refresh": false
    }
    
    Returns the full research report with scores, summary, and (for deep) IC memo.
    REQUIRES 1 TOKEN.
    """
    log.info(f"[V2] Market research run request for deal: {deal_id}")
    
    # Check if user has tokens
    try:
        import sys
        import os as _os
        sys.path.insert(0, _os.path.dirname(_os.path.dirname(__file__)))
        from token_manager import (
            get_current_profile_id,
            get_profile,
            reset_tokens_if_needed,
            TOKEN_COSTS,
            get_supabase as get_token_supabase,
        )

        profile_id = get_current_profile_id(request)
        profile = get_profile(profile_id)
        profile = reset_tokens_if_needed(profile)

        tokens_required = TOKEN_COSTS.get("market_research_results", 1)

        if profile["token_balance"] < tokens_required:
            raise HTTPException(
                status_code=402,
                detail=(
                    f"Insufficient tokens. You need {tokens_required} token(s) "
                    f"but have {profile['token_balance']}. Upgrade your plan to continue."
                ),
            )
    except HTTPException as he:
        if he.status_code == 402:
            raise
        log.warning(f"Token check failed (market research): {he.detail}. Allowing request for backward compatibility.")
        profile_id = None
        profile = None
        get_token_supabase = None
    except Exception as e:
        log.warning(f"Token check error (market research): {e}. Allowing request for backward compatibility.")
        profile_id = None
        profile = None
        get_token_supabase = None
    
    deal = storage.get_deal(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    # Parse request body
    try:
        body = await request.json()
        tier = body.get("tier", "quick")
        force_refresh = body.get("force_refresh", False)
    except:
        tier = "quick"
        force_refresh = False
    
    if tier not in ["quick", "deep"]:
        raise HTTPException(status_code=400, detail="tier must be 'quick' or 'deep'")
    
    context = extract_market_context_from_deal(deal.parsed_json)
    log.info(f"[V2] Running {tier} market research for {context.get('city')}, {context.get('state')}")
    
    try:
        if tier == "quick":
            report = await run_quick_market_check(deal_id, context, force_refresh)
        else:
            report = await run_deep_market_report(deal_id, context, force_refresh)
        
        if report.error:
            raise HTTPException(status_code=500, detail=report.error)
        
        # Build response
        response = {
            "id": report.id,
            "deal_id": report.deal_id,
            "tier": report.tier,
            "market_key": report.market_key,
            "model": report.model,
            "run_started_at": report.run_started_at,
            "run_completed_at": report.run_completed_at,
            "estimated_cost_usd": round(report.estimated_cost_usd, 4),
            "scores": {
                "overall": report.score_overall,
                "demand": report.score_demand,
                "supply_risk": report.score_supply_risk,
                "economic_resilience": report.score_economic_resilience,
                "landlord_friendliness": report.score_landlord_friendliness
            }
        }
        
        # Add summary data
        if report.summary:
            response["summary"] = {
                "market_name": report.summary.market_name,
                "time_horizon_years": report.summary.time_horizon_years,
                "bull_case": report.summary.summary_bull_case or report.summary.bull_case,
                "bear_case": report.summary.summary_bear_case or report.summary.bear_case,
                "investability": report.summary.investability or (report.summary.verdict.investability if report.summary.verdict else None),
                "thesis": report.summary.verdict.thesis if report.summary.verdict else None,
                "top_risks": report.summary.verdict.top_risks if report.summary.verdict else (report.summary.ic_recommendation.top_risks if report.summary.ic_recommendation else []),
                "recommended_hold_period": report.summary.verdict.recommended_hold_period_years if report.summary.verdict else (report.summary.ic_recommendation.recommended_hold_period_years if report.summary.ic_recommendation else None),
                "key_metrics": report.summary.key_metrics.model_dump() if report.summary.key_metrics else {}
            }
            
            # Add IC recommendation for deep reports
            if report.summary.ic_recommendation:
                response["ic_recommendation"] = {
                    "summary": report.summary.ic_recommendation.summary,
                    "recommended_strategy": report.summary.ic_recommendation.recommended_strategy,
                    "recommended_hold_period_years": report.summary.ic_recommendation.recommended_hold_period_years,
                    "top_risks": report.summary.ic_recommendation.top_risks,
                    "mitigations": report.summary.ic_recommendation.mitigations
                }
        
        # Add memo for deep reports
        if report.memo_markdown:
            response["memo_markdown"] = report.memo_markdown
        
        # Deduct token after successful generation
        if profile_id and profile and get_token_supabase:
            try:
                token_supabase = get_token_supabase()
                new_balance = max(0, profile["token_balance"] - tokens_required)
                token_supabase.table("profiles").update({"token_balance": new_balance}).eq("id", profile_id).execute()
                token_supabase.table("token_usage").insert(
                    {
                        "profile_id": profile_id,
                        "operation_type": "market_research_results",
                        "tokens_used": tokens_required,
                        "deal_id": deal_id,
                        "deal_name": report.market_key,
                        "location": report.market_key,
                    }
                ).execute()
                log.info(
                    f"[V2] Deducted {tokens_required} token for market research from profile {profile_id}, "
                    f"new balance: {new_balance}"
                )
            except Exception as e:
                log.error(f"[V2] Failed to deduct token for market research: {e}")
        
        log.info(f"[V2] Market research complete: {tier}, score={report.score_overall}")
        return JSONResponse(response)
        
    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"[V2] Market research failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/deals/{deal_id}/market_research/reports")
async def get_market_research_reports_endpoint(deal_id: str):
    """
    Get all market research reports for a deal.
    Returns list of all quick and deep reports with summaries.
    """
    log.info(f"[V2] Fetching market research reports for deal: {deal_id}")
    
    deal = storage.get_deal(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    reports = find_reports_for_deal(deal_id)
    
    result = []
    for r in reports:
        item = {
            "id": r.id,
            "tier": r.tier,
            "market_key": r.market_key,
            "model": r.model,
            "created_at": r.created_at,
            "estimated_cost_usd": round(r.estimated_cost_usd, 4),
            "scores": {
                "overall": r.score_overall,
                "demand": r.score_demand,
                "supply_risk": r.score_supply_risk,
                "economic_resilience": r.score_economic_resilience,
                "landlord_friendliness": r.score_landlord_friendliness
            },
            "error": r.error
        }
        
        if r.summary:
            item["investability"] = r.summary.investability or (r.summary.verdict.investability if r.summary.verdict else None)
        
        result.append(item)
    
    return JSONResponse({"reports": result})


@router.get("/deals/{deal_id}/market_research/report/{report_id}")
async def get_market_research_report_endpoint(deal_id: str, report_id: str):
    """
    Get a specific market research report by ID.
    Returns full report including memo_markdown for deep reports.
    """
    log.info(f"[V2] Fetching market research report {report_id} for deal: {deal_id}")
    
    report = load_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    if report.deal_id != deal_id:
        raise HTTPException(status_code=403, detail="Report does not belong to this deal")
    
    response = {
        "id": report.id,
        "deal_id": report.deal_id,
        "tier": report.tier,
        "market_key": report.market_key,
        "model": report.model,
        "run_started_at": report.run_started_at,
        "run_completed_at": report.run_completed_at,
        "estimated_cost_usd": round(report.estimated_cost_usd, 4),
        "scores": {
            "overall": report.score_overall,
            "demand": report.score_demand,
            "supply_risk": report.score_supply_risk,
            "economic_resilience": report.score_economic_resilience,
            "landlord_friendliness": report.score_landlord_friendliness
        },
        "error": report.error
    }
    
    if report.summary:
        response["summary"] = {
            "market_name": report.summary.market_name,
            "time_horizon_years": report.summary.time_horizon_years,
            "bull_case": report.summary.summary_bull_case or report.summary.bull_case,
            "bear_case": report.summary.summary_bear_case or report.summary.bear_case,
            "investability": report.summary.investability or (report.summary.verdict.investability if report.summary.verdict else None),
            "thesis": report.summary.verdict.thesis if report.summary.verdict else None,
            "top_risks": report.summary.verdict.top_risks if report.summary.verdict else (report.summary.ic_recommendation.top_risks if report.summary.ic_recommendation else []),
            "recommended_hold_period": report.summary.verdict.recommended_hold_period_years if report.summary.verdict else (report.summary.ic_recommendation.recommended_hold_period_years if report.summary.ic_recommendation else None),
            "key_metrics": report.summary.key_metrics.model_dump() if report.summary.key_metrics else {}
        }
        
        if report.summary.ic_recommendation:
            response["ic_recommendation"] = {
                "summary": report.summary.ic_recommendation.summary,
                "recommended_strategy": report.summary.ic_recommendation.recommended_strategy,
                "recommended_hold_period_years": report.summary.ic_recommendation.recommended_hold_period_years,
                "top_risks": report.summary.ic_recommendation.top_risks,
                "mitigations": report.summary.ic_recommendation.mitigations
            }
    
    if report.memo_markdown:
        response["memo_markdown"] = report.memo_markdown
    
    return JSONResponse(response)


# =====================================================
# Market Cap Rate Lookup via LLM
# =====================================================

MARKET_CAP_RATE_SYSTEM_PROMPT = """You are a commercial real estate market analyst with deep knowledge of cap rate trends across US markets.

Your task is to estimate the current MARKET CAP RATE for a specific property type and location. This is NOT the deal's going-in cap rate - it's the prevailing market cap rate for similar properties in that submarket.

Consider these factors:
1. Property type (multifamily, retail, office, industrial)
2. Asset class (Class A, B, or C based on age, condition, amenities)
3. Market tier (primary/gateway, secondary, tertiary)
4. Submarket characteristics
5. Current market conditions (interest rates, investor demand)

For MULTIFAMILY specifically:
- Class A (newer, amenity-rich): typically 4.0-5.5%
- Class B (1980s-2000s, solid): typically 5.0-6.5%
- Class C (older, value-add): typically 6.0-8.0%
- Gateway markets (NYC, LA, SF): compress 50-100 bps
- Secondary markets (Phoenix, Austin, Nashville): market rate
- Tertiary markets: expand 50-100 bps

You must respond with ONLY valid JSON in this exact format:
{
    "market_cap_rate": 5.75,
    "cap_rate_range_low": 5.25,
    "cap_rate_range_high": 6.25,
    "asset_class": "B",
    "market_tier": "secondary",
    "confidence": "medium",
    "rationale": "Brief 1-2 sentence explanation of the cap rate estimate",
    "data_sources": ["CoStar Q4 2024", "Real Capital Analytics", "Local broker surveys"],
    "market_trends": "Briefly describe if cap rates are compressing, expanding, or stable"
}

IMPORTANT:
- market_cap_rate should be a number (not a string), representing a percentage (e.g., 5.75 means 5.75%)
- confidence should be "high", "medium", or "low"
- Be realistic and conservative in your estimates
- If you're uncertain about the specific submarket, widen the range"""


@router.post("/market-cap-rate")
async def get_market_cap_rate(request: Request):
    """
    Get market cap rate estimate for a property based on location and characteristics.
    Uses Claude to research and estimate prevailing market cap rates.
    """
    from anthropic import Anthropic
    
    try:
        body = await request.json()
    except:
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    
    # Extract property info from request
    property_type = body.get("property_type", "multifamily")
    city = body.get("city", "")
    state = body.get("state", "")
    address = body.get("address", "")
    units = body.get("units", 0)
    year_built = body.get("year_built", 0)
    purchase_price = body.get("purchase_price", 0)
    
    if not city and not address:
        raise HTTPException(status_code=400, detail="City or address required")
    
    # Build the query for Claude
    location_str = f"{city}, {state}" if city and state else address
    
    # Estimate asset class from year built
    current_year = datetime.now().year
    age = current_year - year_built if year_built > 1900 else 0
    
    if age <= 10:
        estimated_class = "Class A (newer construction)"
    elif age <= 30:
        estimated_class = "Class B (1990s-2010s vintage)"
    else:
        estimated_class = "Class C (older vintage, potential value-add)"
    
    user_message = f"""Please estimate the current market cap rate for this property:

Property Type: {property_type}
Location: {location_str}
Units: {units}
Year Built: {year_built} ({age} years old)
Estimated Asset Class: {estimated_class}
Purchase Price: ${purchase_price:,.0f}

Based on current market conditions and comparable transactions, what is the prevailing market cap rate for similar properties in this submarket?"""

    log.info(f"[V2] Market cap rate lookup for {location_str}")
    
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="Claude/Anthropic API key not configured")
    
    try:
        anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)
        
        response = anthropic_client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=1000,
            system=MARKET_CAP_RATE_SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": user_message
            }]
        )
        # try to capture usage
        prompt_tokens = None
        completion_tokens = None
        total_tokens = None
        try:
            usage = getattr(response, 'usage', None) or (response.get('usage') if isinstance(response, dict) else None)
            if usage:
                prompt_tokens = usage.get('prompt_tokens') if isinstance(usage, dict) else getattr(usage, 'prompt_tokens', None)
                completion_tokens = usage.get('completion_tokens') if isinstance(usage, dict) else getattr(usage, 'completion_tokens', None)
                total_tokens = usage.get('total_tokens') if isinstance(usage, dict) else getattr(usage, 'total_tokens', None)
        except Exception:
            pass

        response_text = response.content[0].text.strip()
        log.info(f"[V2] Market cap rate response: {response_text[:200]}...")
        
        # Parse JSON response
        try:
            # Try to extract JSON from response
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                result = json.loads(json_match.group())
            else:
                raise ValueError("No JSON found in response")
        except json.JSONDecodeError as e:
            log.error(f"[V2] Failed to parse cap rate JSON: {e}")
            # Return a fallback estimate
            result = {
                "market_cap_rate": 5.5,
                "cap_rate_range_low": 5.0,
                "cap_rate_range_high": 6.0,
                "asset_class": "B",
                "market_tier": "unknown",
                "confidence": "low",
                "rationale": "Unable to parse LLM response, using default estimate",
                "data_sources": [],
                "market_trends": "Unknown"
            }
        
        # Add input context to response
        result["property_info"] = {
            "location": location_str,
            "property_type": property_type,
            "units": units,
            "year_built": year_built,
            "estimated_class": estimated_class
        }
        try:
            user_id = request.headers.get('X-User-ID') or request.cookies.get('user_id')
        except Exception:
            user_id = None
        try:
            llm_usage.log_usage(user_id=user_id, action='market_cap_rate', model='claude-sonnet-4-5-20250929', prompt_tokens=prompt_tokens, completion_tokens=completion_tokens, total_tokens=total_tokens, deduct_from_balance=True)
        except Exception:
            pass

        return JSONResponse(result)
        
    except Exception as e:
        log.exception(f"[V2] Market cap rate lookup failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# LOI (LETTER OF INTENT) GENERATION ENDPOINT
# =============================================================================

LOI_SYSTEM_PROMPT = """You are an expert commercial real estate attorney and deal-maker. Your job is to generate professional, legally-sound Letters of Intent (LOI) for real estate acquisitions.

Generate a complete, professional LOI that:
1. Is non-binding but expresses serious intent to purchase
2. Includes all standard commercial real estate LOI sections
3. Properly addresses the deal structure (traditional, seller financing, equity partner, subject-to, etc.)
4. Uses clear, professional language
5. Includes appropriate contingencies based on the deal type
6. Is formatted cleanly for easy reading

For creative deal structures, make sure to include the specific terms:
- Seller Financing: Interest rate, term, balloon payment, amortization schedule
- Equity Partner: Split percentages, preferred returns, waterfall structure
- Subject-To: Existing loan terms, assumption conditions
- Hybrid structures: Combine relevant terms appropriately

Output ONLY the LOI text - no explanations, no markdown formatting, no code blocks. Just the clean letter text ready to copy/paste or print."""


@router.post("/generate-loi")
async def generate_loi(request: Request):
    """
    Generate a Letter of Intent using Claude AI.
    REQUIRES 1 TOKEN.
    
    Request body:
    {
        "deal": {
            "address": str,
            "units": int,
            "purchasePrice": float,
            "dealStructure": str,
            "dayOneCashFlow": float,
            "stabilizedCashFlow": float,
            "brokerName": str,
            "brokerEmail": str,
            "fullScenarioData": dict (optional, for creative deals)
        },
        "buyer": {
            "name": str,
            "entity": str,
            "address": str,
            "phone": str,
            "email": str
        },
        "terms": {
            "earnestMoney": float,
            "earnestMoneyDays": int,
            "dueDiligenceDays": int,
            "closingDays": int,
            "financingContingency": bool,
            "inspectionContingency": bool,
            "appraisalContingency": bool,
            "additionalTerms": str
        }
    }
    """
    from anthropic import Anthropic
    
    log.info("[V2] LOI generation request received")
    
    # Check if user has tokens BEFORE processing
    try:
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
        from token_manager import get_current_profile_id, get_profile, reset_tokens_if_needed, TOKEN_COSTS
        
        profile_id = get_current_profile_id(request)
        profile = get_profile(profile_id)
        profile = reset_tokens_if_needed(profile)
        
        tokens_required = TOKEN_COSTS.get("loi_generation", 1)
        
        if profile["token_balance"] < tokens_required:
            raise HTTPException(
                status_code=402,  # Payment Required
                detail=f"Insufficient tokens. You need {tokens_required} token(s) but have {profile['token_balance']}. Upgrade your plan to continue."
            )
    except HTTPException as he:
        if he.status_code == 402:
            raise
        # If no profile found, log warning but allow for backward compatibility
        log.warning(f"Token check failed: {he.detail}. Allowing request for backward compatibility.")
    
    try:
        body = await request.json()
    except:
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    
    deal = body.get("deal", {})
    buyer = body.get("buyer", {})
    terms = body.get("terms", {})
    
    if not deal.get("address"):
        raise HTTPException(status_code=400, detail="Property address required")
    if not buyer.get("name"):
        raise HTTPException(status_code=400, detail="Buyer name required")
    
    # Format currency values
    def fmt(val):
        if not val:
            return "TBD"
        return f"${val:,.0f}"
    
    # Build contingencies list
    contingencies = []
    if terms.get("financingContingency", True):
        contingencies.append("Buyer obtaining satisfactory financing")
    if terms.get("inspectionContingency", True):
        contingencies.append("Satisfactory property inspection and due diligence")
    if terms.get("appraisalContingency", True):
        contingencies.append("Property appraisal meeting or exceeding purchase price")
    
    contingencies_text = "\n".join([f"  - {c}" for c in contingencies]) if contingencies else "  - None"
    
    # Build the prompt for Claude
    deal_structure = deal.get("dealStructure", "Traditional/Cash")
    scenario_data = deal.get("fullScenarioData", {})
    
    # Extract additional terms for creative deals from scenario data
    creative_terms = ""
    if scenario_data:
        fin = scenario_data.get("financing", {})
        if "seller" in deal_structure.lower() or fin.get("seller_note_amount"):
            seller_note = fin.get("seller_note_amount", 0)
            seller_rate = fin.get("seller_note_rate", 6)
            seller_term = fin.get("seller_note_term_months", 60)
            balloon = fin.get("seller_note_balloon_months", seller_term)
            creative_terms += f"""
SELLER FINANCING TERMS:
- Seller Note Amount: {fmt(seller_note)}
- Interest Rate: {seller_rate}%
- Term: {seller_term} months
- Balloon Payment Due: {balloon} months
- Amortization: 30 years (interest-only optional first 12 months)
"""
        
        if "equity" in deal_structure.lower() or "partner" in deal_structure.lower():
            equity_partner = fin.get("equity_partner_amount", 0)
            equity_split = fin.get("equity_partner_split", 70)
            pref_return = fin.get("preferred_return", 8)
            creative_terms += f"""
EQUITY PARTNER STRUCTURE:
- Partner Capital Contribution: {fmt(equity_partner)}
- Ownership Split: Buyer {equity_split}% / Partner {100-equity_split}%
- Preferred Return: {pref_return}% annually to partner
- Profit Split After Preferred: Pro-rata based on ownership
"""
        
        if "subject" in deal_structure.lower():
            existing_loan = fin.get("existing_loan_balance", 0)
            existing_rate = fin.get("existing_loan_rate", 0)
            creative_terms += f"""
SUBJECT-TO EXISTING FINANCING:
- Existing Loan Balance: {fmt(existing_loan)}
- Current Interest Rate: {existing_rate}%
- Buyer assumes all obligations under existing note
- Seller remains on title until loan payoff or refinance
"""
    
    user_message = f"""Generate a professional Letter of Intent for the following real estate acquisition:

PROPERTY DETAILS:
- Property Address: {deal.get('address', 'TBD')}
- Number of Units: {deal.get('units', 'TBD')}
- Purchase Price: {fmt(deal.get('purchasePrice'))}
- Deal Structure: {deal_structure}

BUYER INFORMATION:
- Buyer Name: {buyer.get('name', 'TBD')}
- Buyer Entity: {buyer.get('entity') or 'Individual'}
- Buyer Email: {buyer.get('email', 'TBD')}
- Buyer Phone: {buyer.get('phone', 'TBD')}

SELLER/BROKER INFORMATION:
- Listing Agent: {deal.get('brokerName') or 'TBD'}
- Agent Email: {deal.get('brokerEmail') or 'TBD'}
- Agent Phone: {deal.get('brokerPhone') or 'TBD'}

KEY TERMS:
- Earnest Money Deposit: {fmt(terms.get('earnestMoney', 25000))}
- EMD Due Within: {terms.get('earnestMoneyDays', 3)} business days of acceptance
- Due Diligence Period: {terms.get('dueDiligenceDays', 30)} days
- Target Closing: {terms.get('closingDays', 45)} days from acceptance

CONTINGENCIES:
{contingencies_text}
{creative_terms}

ADDITIONAL TERMS/NOTES:
{terms.get('additionalTerms') or 'None specified'}

Today's Date: {datetime.now().strftime('%B %d, %Y')}

Generate a complete, professional LOI ready for submission. Include appropriate sections for this {deal_structure} deal structure."""

    log.info(f"[V2] Generating LOI for {deal.get('address')} - {deal_structure}")
    
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="Claude/Anthropic API key not configured")
    
    try:
        anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)
        
        response = anthropic_client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=3000,
            system=LOI_SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": user_message
            }]
        )
        
        # try to capture usage
        prompt_tokens = None
        completion_tokens = None
        total_tokens = None
        try:
            usage = getattr(response, 'usage', None) or (response.get('usage') if isinstance(response, dict) else None)
            if usage:
                prompt_tokens = usage.get('prompt_tokens') if isinstance(usage, dict) else getattr(usage, 'prompt_tokens', None)
                completion_tokens = usage.get('completion_tokens') if isinstance(usage, dict) else getattr(usage, 'completion_tokens', None)
                total_tokens = usage.get('total_tokens') if isinstance(usage, dict) else getattr(usage, 'total_tokens', None)
        except Exception:
            pass

        loi_text = response.content[0].text.strip()
        log.info(f"[V2] LOI generated successfully, length: {len(loi_text)} chars")

        # Deduct token after successful generation
        try:
            from token_manager import get_supabase as get_token_supabase
            profile_id = get_current_profile_id(request)
            token_supabase = get_token_supabase()
            
            # Deduct 1 token
            token_supabase.table("profiles").update({
                "token_balance": profile["token_balance"] - 1
            }).eq("id", profile_id).execute()
            
            # Log usage
            token_supabase.table("token_usage").insert({
                "profile_id": profile_id,
                "operation_type": "loi_generation",
                "tokens_used": 1,
                "deal_id": None,
                "deal_name": deal.get('address'),
                "location": deal.get('address')
            }).execute()
            
            log.info(f"[V2] Deducted 1 token from profile {profile_id}, new balance: {profile['token_balance'] - 1}")
        except Exception as e:
            log.error(f"[V2] Failed to deduct token: {e}")

        try:
            user_id = request.headers.get('X-User-ID') or request.cookies.get('user_id')
        except Exception:
            user_id = None
        try:
            llm_usage.log_usage(user_id=user_id, action='generate_loi', model='claude-sonnet-4-5-20250929', prompt_tokens=prompt_tokens, completion_tokens=completion_tokens, total_tokens=total_tokens, deduct_from_balance=True)
        except Exception:
            pass

        return JSONResponse({
            "success": True,
            "loi": loi_text,
            "deal_address": deal.get('address'),
            "deal_structure": deal_structure,
            "generated_at": datetime.now().isoformat()
        })
        
    except Exception as e:
        log.exception(f"[V2] LOI generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"LOI generation failed: {str(e)}")


# =============================================================================
# PITCH DECK GENERATION ENDPOINT (EQUITY PARTNER / JV / SYNDICATION)
# =============================================================================

PITCH_DECK_SYSTEM_PROMPT = """You are an expert real estate capital raiser and investment storyteller.
Your job is to turn detailed underwriting results into a concise, investor-ready pitch deck narrative.

OUTPUT FORMAT (STRICT):
- Output JSON ONLY (no markdown, no backticks, no commentary).
- The JSON must be an object with a single key: "sections".
- "sections" must be an array of objects.
- Each section object must have:
    - "id": short snake_case identifier from the list below.
    - "title": human-readable slide title.
    - "body": multi-line string containing the slide content.

TARGET SECTIONS (EQUITY PARTNER REAL ESTATE PITCH):
- id: "cover"
    - title: Cover Slide
    - body: project/fund name, subtitle, presenter. CRITICAL: Replace ALL placeholders with actual contact info. Use: Presented by: {sponsor_name}\nContact: {email} | {phone}\nWebsite: {website}
- id: "executive_summary"
    - title: Executive Summary
    - body: one-sentence elevator pitch, asset type, location, size, equity required, target returns.
- id: "opportunity"
    - title: The Opportunity
    - body: market inefficiencies, rent growth, supply constraints, why now.
- id: "problem"
    - title: Problem / Pain Point
    - body: distressed operations, inefficiencies, under-utilized revenue streams.
- id: "strategy"
    - title: Solution / Strategy
    - body: value-add / renovation / repositioning / stabilization plan.
- id: "deal_overview"
    - title: The Deal Overview
    - body: purchase price, loan details, equity required & breakdown, sponsor vs investor equity, hold period.
- id: "financial_summary"
    - title: Financial Summary (Projections)
    - body: IRR, cash-on-cash, equity multiple, NOI growth, stabilized cap rate; can reference base/best/worst.
- id: "use_of_funds"
    - title: Use of Funds
    - body: allocation across purchase, renovation/CapEx, reserves, closing costs, fees.
- id: "sources_uses"
    - title: Sources & Uses
    - body: simple table-like text for sources (senior loan, equity partner, sponsor roll) vs uses (purchase, CapEx, reserves).
- id: "returns_waterfall"
    - title: Returns Waterfall
    - body: preferred return %, catch-up, sponsor split, promote tiers for JV or syndication.
- id: "exit_strategies"
    - title: Exit Strategies
    - body: sale at stabilization, refinance, extended hold options, multiple exit scenarios.
- id: "risk_mitigation"
    - title: Risk & Mitigation
    - body: key risks (cost overrun, rates, market) and how they are mitigated.
- id: "team_track_record"
    - title: Track Record / Team
    - body: sponsor experience, completed deals, realized returns, roles.
- id: "market_data"
    - title: Market Data
    - body: rental growth, population, jobs, comps based on available data.
- id: "case_studies"
    - title: Case Studies (Optional)
    - body: similar deals before/after if you can infer any; otherwise keep this section brief.
- id: "legal_structure"
    - title: Legal / Structure
    - body: high-level LLC structure, rights/responsibilities, distribution schedule (no legalese).
- id: "ask_next_steps"
    - title: Ask & Next Steps
    - body: precise equity raise amount, minimum check size, timeline, how to invest.
- id: "contact"
    - title: Contact
    - body: MUST USE THE EXACT CONTACT INFO PROVIDED. Format as:\nCONTACT:\n\n{sponsor_name}\n{email}\n{phone}\n{website}

You may keep sections very concise, but try to include all of them.
If you truly lack information for a section, still include it with a short, generic body.

COPY GUIDELINES:
- Assume the deck is for an equity partner/JV or a syndication (you will be told which).
- Emphasize: opportunity, returns, and risk/mitigation.
- Use clear bullet-style copy inside each body, but just as plain text lines starting with "-".
- Keep the overall length appropriate for a 1–2 page pitch summary.
- DO NOT include legal disclaimers or LOI-style contracting language.
- CRITICAL: For the "cover" and "contact" sections, USE THE EXACT CONTACT INFO PROVIDED in the prompt. Do NOT use placeholders like [Sponsor Name] or [Email].
"""


@router.post("/deals/{deal_id}/pitch-deck")
async def generate_pitch_deck(request: Request, deal_id: str):
    """Generate an investor pitch deck narrative from a saved deal.

    REQUIRES 1 TOKEN (pitch_deck_generation).

    Request body:
    {
      "structureType": "jv" | "syndication",
      "maxSections": int (optional, default 7)
    }
    """
    from anthropic import Anthropic

    log.info(f"[V2] Pitch deck generation request received for deal {deal_id}")

    # Token check
    try:
        import sys
        import os as _os
        sys.path.insert(0, _os.path.dirname(_os.path.dirname(__file__)))
        from token_manager import (
            get_current_profile_id,
            get_profile,
            reset_tokens_if_needed,
            TOKEN_COSTS,
            get_supabase as get_token_supabase,
        )

        profile_id = get_current_profile_id(request)
        profile = get_profile(profile_id)
        profile = reset_tokens_if_needed(profile)

        tokens_required = TOKEN_COSTS.get("pitch_deck_generation", 1)

        if profile["token_balance"] < tokens_required:
            raise HTTPException(
                status_code=402,
                detail=(
                    f"Insufficient tokens. You need {tokens_required} token(s) "
                    f"but have {profile['token_balance']}. Upgrade your plan to continue."
                ),
            )
    except HTTPException as he:
        if he.status_code == 402:
            raise
        log.warning(f"Token check failed (pitch deck): {he.detail}. Allowing request for backward compatibility.")
        profile_id = None
        profile = None
        get_token_supabase = None  # type: ignore
    except Exception as e:
        log.warning(f"Token check error (pitch deck): {e}. Allowing request for backward compatibility.")
        profile_id = None
        profile = None
        get_token_supabase = None  # type: ignore

    # Parse body
    try:
        body = await request.json()
    except Exception:
        body = {}

    structure_type = (body.get("structureType") or "jv").lower()
    max_sections = int(body.get("maxSections") or 7)
    
    # Extract contact info
    contact_info = body.get("contactInfo") or {}
    sponsor_name = contact_info.get("sponsorName") or "[Sponsor Name]"
    email = contact_info.get("email") or "[Email]"
    phone = contact_info.get("phone") or "[Phone]"
    website = contact_info.get("website") or "[Website]"
    signature = contact_info.get("signature")  # Base64 image data
    
    log.info(f"[V2] Pitch deck contact info received: Name='{sponsor_name}', Email='{email}', Phone='{phone}', Website='{website}'")

    # Load deal + scenario data from Supabase
    try:
        from token_manager import get_supabase as _get_supabase

        sb = _get_supabase()
        result = sb.table("deals").select("*").eq("deal_id", deal_id).single().execute()
        deal = (result.data or {})
    except Exception as e:
        log.error(f"[V2] Failed to load deal {deal_id} for pitch deck: {e}")
        raise HTTPException(status_code=404, detail="Deal not found for pitch deck generation")

    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found for pitch deck generation")

    scenario_data = deal.get("scenario_data") or {}
    parsed_data = deal.get("parsed_data") or {}
    calcs = (scenario_data.get("calculations") or {})

    # Extract core fields
    address = deal.get("address") or parsed_data.get("property", {}).get("address") or "Property Address TBD"
    units = deal.get("units") or parsed_data.get("property", {}).get("units") or 0
    purchase_price = deal.get("purchase_price") or 0
    deal_structure = deal.get("deal_structure") or "Traditional"

    asset_type = (
        parsed_data.get("property", {}).get("asset_type")
        or parsed_data.get("property", {}).get("property_type")
        or scenario_data.get("property", {}).get("asset_type")
        or "Multifamily"
    )
    city = parsed_data.get("property", {}).get("city") or scenario_data.get("property", {}).get("city")
    state = parsed_data.get("property", {}).get("state") or scenario_data.get("property", {}).get("state")
    location = ", ".join([x for x in [city, state] if x]) or "Target Market"

    irr = calcs.get("leveredIRR") or calcs.get("irr")
    coc = calcs.get("avgCashOnCash") or calcs.get("cashOnCash")
    equity_multiple = calcs.get("equityMultiple")
    noi_year1 = calcs.get("noiYear1") or calcs.get("noi_year1") or 0
    cap_rate = calcs.get("inPlaceCapRate") or calcs.get("capRate")
    dscr = calcs.get("dscr")
    ltv = calcs.get("ltv")
    hold_years = scenario_data.get("hold_period_years") or scenario_data.get("holdPeriodYears") or 5

    day_one_cf = calcs.get("dayOneCashFlow") or 0
    stabilized_cf = calcs.get("stabilizedCashFlow") or 0
    refi_value = calcs.get("refiValue") or 0

    def fmt_currency(val):
        try:
            return f"${float(val):,.0f}"
        except Exception:
            return "N/A"

    def fmt_pct(val):
        try:
            return f"{float(val):.1f}%"
        except Exception:
            return "N/A"

    def fmt_multiple(val):
        try:
            return f"{float(val):.2f}x"
        except Exception:
            return "N/A"

    structure_label = "Syndication" if structure_type == "syndication" else "JV / Equity Partner"

    # Build user prompt summarizing the deal
    user_prompt = f"""Generate an investor pitch deck narrative for an equity partner in commercial real estate.

Deal Type (framing): {structure_label}
Underlying Deal Structure in Model: {deal_structure}

CONTACT INFORMATION (USE THESE IN COVER SLIDE):
- Sponsor Name: {sponsor_name}
- Email: {email}
- Phone: {phone}
- Website: {website}

PROPERTY:
- Address: {address}
- Asset Type: {asset_type}
- Location: {location}
- Units: {units}

PRICING & CAPITALIZATION:
- Purchase Price: {fmt_currency(purchase_price)}
- Year 1 NOI: {fmt_currency(noi_year1)}
- Going-in Cap Rate: {fmt_pct(cap_rate) if cap_rate is not None else 'N/A'}
- LTV: {fmt_pct(ltv) if ltv is not None else 'N/A'}

RETURNS SUMMARY:
- Target IRR: {fmt_pct(irr) if irr is not None else 'N/A'}
- Avg Cash-on-Cash: {fmt_pct(coc) if coc is not None else 'N/A'}
- Equity Multiple: {fmt_multiple(equity_multiple)}
- Hold Period: {hold_years} years

CASH FLOWS:
- Day-One Annual Cash Flow: {fmt_currency(day_one_cf)}
- Stabilized Annual Cash Flow: {fmt_currency(stabilized_cf)}
- Projected Refi/Exit Value: {fmt_currency(refi_value)}

RISK & MITIGATION (for your internal reasoning):
- You have access to the full underwriting, including expenses, taxes, reserves, rent roll, and market data.
- Highlight the main risks you infer (execution, financing, market) and how the sponsor plans to mitigate them inside the risk_mitigation section.

STRUCTURE & CONSTRAINTS:
- Use the exact section IDs and meanings defined in the system prompt.
- Include ALL of those sections in the JSON output, even if some bodies are short or generic.
- Keep each section concise enough that the whole thing could fit in a 1–2 page pitch summary.
- Do NOT include legal disclaimers or LOI-style language.
- CRITICAL: In the "cover" and "contact" sections, replace ALL placeholders ([Sponsor Name], [Email], [Phone], [Website]) with the ACTUAL values provided above: {sponsor_name}, {email}, {phone}, {website}
"""

    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="Claude/Anthropic API key not configured")

    try:
        anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)

        response = anthropic_client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=8000,
            system=PITCH_DECK_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )

        raw_text = response.content[0].text.strip()
        
        log.info(f"[V2] Raw AI response (first 500 chars): {raw_text[:500]}")

        # Strip markdown code fences if present
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]  # Remove ```json
        elif raw_text.startswith("```"):
            raw_text = raw_text[3:]  # Remove ```
            
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]  # Remove trailing ```
            
        raw_text = raw_text.strip()
        
        log.info(f"[V2] Cleaned response (first 500 chars): {raw_text[:500]}")

        # Attempt to parse JSON; if it fails, wrap as a single section
        import json as _json

        sections = []
        try:
            parsed = _json.loads(raw_text)
            if isinstance(parsed, dict) and isinstance(parsed.get("sections"), list):
                sections = parsed["sections"]
                log.info(f"[V2] Successfully parsed {len(sections)} sections")
            else:
                log.warning(f"[V2] Parsed JSON but no sections array found: {list(parsed.keys())}")
        except Exception as e:
            log.warning(f"[V2] Failed to parse pitch deck JSON: {e}. Raw text: {raw_text[:200]}")
            sections = [
                {
                    "id": "summary",
                    "title": "Pitch Deck Narrative",
                    "body": raw_text,
                }
            ]

        # POST-PROCESS: Replace ALL placeholder text with actual contact info
        # Claude sometimes ignores instructions and uses placeholders anyway
        placeholder_map = {
            "[Sponsor Name]": sponsor_name,
            "[sponsor name]": sponsor_name,
            "[SPONSOR NAME]": sponsor_name,
            "[Email]": email,
            "[email]": email,
            "[EMAIL]": email,
            "[Phone]": phone,
            "[phone]": phone,
            "[PHONE]": phone,
            "[Website]": website,
            "[website]": website,
            "[WEBSITE]": website,
            "[Current Date]": datetime.now().strftime("%B %d, %Y"),
            "[current date]": datetime.now().strftime("%B %d, %Y"),
            "[Insert Date]": datetime.now().strftime("%B %d, %Y"),
            "[insert date]": datetime.now().strftime("%B %d, %Y"),
            "[DATE]": datetime.now().strftime("%B %d, %Y"),
        }
        
        for section in sections:
            if section.get("body"):
                original = section["body"]
                for placeholder, actual_value in placeholder_map.items():
                    section["body"] = section["body"].replace(placeholder, actual_value)
                if original != section["body"]:
                    log.info(f"[V2] Replaced placeholders in section {section.get('id')}")
        
        log.info(f"[V2] Post-processed sections - Contact info: {sponsor_name}, {email}, {phone}, {website}")

        # usage metrics
        prompt_tokens = None
        completion_tokens = None
        total_tokens = None
        try:
            usage = getattr(response, "usage", None) or (response.get("usage") if isinstance(response, dict) else None)
            if usage:
                prompt_tokens = usage.get("prompt_tokens") if isinstance(usage, dict) else getattr(usage, "prompt_tokens", None)
                completion_tokens = usage.get("completion_tokens") if isinstance(usage, dict) else getattr(usage, "completion_tokens", None)
                total_tokens = usage.get("total_tokens") if isinstance(usage, dict) else getattr(usage, "total_tokens", None)
        except Exception:
            pass

        # Deduct token after success
        if profile_id and profile and get_token_supabase:
            try:
                token_supabase = get_token_supabase()
                tokens_required = 1
                new_balance = max(0, profile["token_balance"] - tokens_required)
                token_supabase.table("profiles").update({"token_balance": new_balance}).eq("id", profile_id).execute()
                token_supabase.table("token_usage").insert(
                    {
                        "profile_id": profile_id,
                        "operation_type": "pitch_deck_generation",
                        "tokens_used": tokens_required,
                        "deal_id": deal_id,
                        "deal_name": address,
                        "location": location,
                    }
                ).execute()
                log.info(
                    f"[V2] Deducted {tokens_required} token for pitch deck from profile {profile_id}, "
                    f"new balance: {new_balance}"
                )
            except Exception as e:
                log.error(f"[V2] Failed to deduct token for pitch deck: {e}")

        # Log usage via llm_usage
        try:
            user_id = request.headers.get("X-User-ID") or request.cookies.get("user_id")
        except Exception:
            user_id = None
        try:
            llm_usage.log_usage(
                user_id=user_id,
                action="generate_pitch_deck",
                model="claude-sonnet-4-5-20250929",
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                deduct_from_balance=False,
            )
        except Exception:
            pass

        return JSONResponse(
            {
                "success": True,
                "deal_id": deal_id,
                "deal_address": address,
                "structure_type": structure_type,
                "sections": sections,
                "signature": signature,
                "contactInfo": {
                    "sponsorName": sponsor_name,
                    "email": email,
                    "phone": phone,
                    "website": website
                },
                "generated_at": datetime.now().isoformat(),
            }
        )

    except Exception as e:
        log.exception(f"[V2] Pitch deck generation FAILED for deal {deal_id}")
        raise HTTPException(status_code=500, detail=f"Pitch deck generation failed: {str(e)}")


