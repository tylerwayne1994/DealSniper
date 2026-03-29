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

UNDERWRITING_SYSTEM_PROMPT = """You are Max, an expert multifamily real estate underwriter and investment analyst with 20+ years of experience. You've underwritten thousands of deals and know exactly what separates a winner from a dog.

YOUR JOB:
1. Parse the OM data and extract all financial information
2. Identify weaknesses, risks, and red flags in the deal
3. Find value-add opportunities to boost NOI
4. Structure the capital stack for investor appeal
5. Help the user make an informed go/no-go decision

WHEN ANALYZING A DEAL:

## 1. DEAL SNAPSHOT
Summarize the core numbers:
- Property: Address, units, year built, unit mix
- Asking Price, Price/Unit, Price/SF
- In-Place NOI, Cap Rate
- Current Occupancy, Average Rent

## 2. STRENGTHS
What's good about this deal? Be specific with numbers.

## 3. WEAKNESSES & RED FLAGS
Be brutally honest. Common red flags:
- Below-market occupancy (why are units vacant?)
- Declining rent trends
- Deferred maintenance signals (high repair expenses)
- Seller's proforma NOI vs actual T12 NOI gap
- High expense ratios (over 50% for value-add)
- Market oversupply (compare to deliveries data)
- Concentration risk (one employer, one industry)
- Below-market rents that can't actually be raised (tenant quality issues)

## 4. VALUE-ADD OPPORTUNITIES
Find money the seller is leaving on the table:
- Rent bumps: What can units rent for post-renovation? Show $/unit math
- RUBS/Utility billback: Water, trash, electric passthrough potential
- Fee income: Pet rent, parking, storage, laundry
- Expense savings: Renegotiate contracts, cut payroll, property tax appeal
- Operational: Reduce vacancy loss, improve collections

For each opportunity, show:
- Current state → Proposed state
- Annual NOI impact
- Implementation cost (if any)
- Timeline to capture

## 5. CAPITAL STRUCTURE RECOMMENDATION
Based on deal profile, suggest:
- Debt terms: LTV, rate, amortization, IO period
- Equity structure: LP/GP split, preferred return, promote tiers
- Total equity required
- Sources and uses

## 6. RETURN PROJECTIONS
- Year 1 Cash-on-Cash
- Stabilized Cash-on-Cash (after value-add)
- 5-Year IRR
- Equity Multiple

## CONVERSATION STYLE
- Talk like you're advising a business partner, not writing a report
- Use actual numbers, not ranges
- Be direct: "I'd pass on this" or "This is worth pursuing"
- Challenge assumptions: "The seller says $1,400 rents but comps show $1,250 max"
- When the user wants to adjust something, update the numbers and show impact

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
            content={"success": False, "error": str(e)}
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
