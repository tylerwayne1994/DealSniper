# V2 Underwriter - API Routes
import os
import json
import logging
import re
from datetime import datetime
from dotenv import load_dotenv
from fastapi import APIRouter, UploadFile, File, HTTPException, Request, Form
from fastapi.responses import JSONResponse
from openai import OpenAI

from .models import ChatRequest, ChatResponse, ChatMessage
from . import storage
from .llm_client import call_openai_chat
from .prompts import build_deal_chat_system_prompt
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

log = logging.getLogger("v2_underwriter")
router = APIRouter(prefix="/v2", tags=["UnderwriterV2"])


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
  "pnl": {"gross_potential_rent": 0, "other_income": 0, "vacancy_rate": 0, "vacancy_amount": 0, "effective_gross_income": 0, "operating_expenses": 0, "noi": 0, "cap_rate": 0},
  "expenses": {"taxes": 0, "insurance": 0, "utilities": 0, "repairs_maintenance": 0, "management": 0, "payroll": 0, "admin": 0, "marketing": 0, "other": 0, "total": 0},
  "underwriting": {"holding_period": 0, "exit_cap_rate": 0},
  "unit_mix": [{"type": "", "units": 0, "unit_sf": 0, "rent_current": 0, "rent_market": 0}]
}
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


@router.post("/deals/{deal_id}/underwrite")
async def underwrite_deal(deal_id: str, request: Request):
    """
    Run full AI underwriting analysis on a deal.
    Returns structured 8-section analysis with BUY/MAYBE/PASS verdict.
    """
    from anthropic import Anthropic
    from .prompts import build_underwriter_system_prompt
    
    log.info(f"[V2] Underwrite request for deal: {deal_id}")
    
    # Get buy_box from request body
    try:
        body = await request.json()
        buy_box = body.get('buy_box') if body else None
        underwriting_mode = body.get('underwriting_mode', 'hardcoded') if body else 'hardcoded'
        log.info(f"[V2] Underwriting mode: {underwriting_mode}, Buy box: {buy_box}")
    except:
        buy_box = None
        underwriting_mode = 'hardcoded'
    
    deal = storage.get_deal(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="Claude/Anthropic API key not configured")
    
    try:
        anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)
        
        # Build the comprehensive underwriting system prompt
        system_prompt = build_underwriter_system_prompt(deal.parsed_json, buy_box or {})
        
        log.info("[V2] Calling Claude for full underwriting analysis...")
        
        response = anthropic_client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=8000,
            system=system_prompt,
            messages=[{
                "role": "user",
                "content": "Underwrite this deal and give me the full 8-section analysis. Be blunt and direct. Calculate all numbers, identify all value-add opportunities, run both creative financing structures, and give me a clear BUY/MAYBE/PASS verdict with reasoning."
            }]
        )
        
        analysis_text = response.content[0].text.strip()
        
        log.info(f"[V2] Underwriting complete. Response length: {len(analysis_text)} chars")
        
        # Try to extract verdict from the response
        verdict = "MAYBE"  # default
        if "🟢" in analysis_text or "BUY" in analysis_text.upper()[:500]:
            verdict = "BUY"
        elif "🔴" in analysis_text or "PASS" in analysis_text.upper()[:500]:
            verdict = "PASS"
        
        # Store underwriting result in deal
        deal.parsed_json["_underwriting_result"] = {
            "analysis": analysis_text,
            "verdict": verdict,
            "timestamp": datetime.utcnow().isoformat() if 'datetime' in dir() else None
        }
        storage.save_deal(deal)
        
        return JSONResponse({
            "deal_id": deal_id,
            "verdict": verdict,
            "analysis": analysis_text,
            "summary": {
                "address": deal.summary_address,
                "units": deal.summary_units,
                "price": deal.summary_price,
                "noi": deal.summary_noi,
                "cap_rate": deal.summary_cap_rate
            }
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
        system_prompt = build_deal_chat_system_prompt(deal.parsed_json, request.buy_box)
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
    """
    log.info(f"[V2] Market research run request for deal: {deal_id}")
    
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
        
        loi_text = response.content[0].text.strip()
        log.info(f"[V2] LOI generated successfully, length: {len(loi_text)} chars")
        
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

