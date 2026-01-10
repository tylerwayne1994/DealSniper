"""
Excel AI - Spreadsheet assistant with GPT-4
Provides intelligent spreadsheet analysis and manipulation
"""

import os
import logging
import re
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from openai import OpenAI

log = logging.getLogger("excel_ai")

router = APIRouter(prefix="/api/excel-ai", tags=["Excel AI"])

# Initialize OpenAI client
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None


class ChatMessage(BaseModel):
    role: str
    content: str


class ExcelChatRequest(BaseModel):
    message: str
    spreadsheetData: List[Dict[str, Any]]
    history: List[ChatMessage] = []


class CellUpdate(BaseModel):
    cell: str
    value: str


class ExcelChatResponse(BaseModel):
    response: str
    cellUpdates: Optional[List[CellUpdate]] = None
    suggestions: Optional[List[str]] = None


@router.post("/chat", response_model=ExcelChatResponse)
async def excel_ai_chat(request: ExcelChatRequest):
    """
    Chat with AI about spreadsheet data
    AI can analyze, suggest formulas, fill data, and more
    """
    if not client:
        raise HTTPException(
            status_code=503, 
            detail="OpenAI API not configured. Please set OPENAI_API_KEY environment variable."
        )

    try:
        log.info(f"[Excel AI] Received request: {request.message[:100]}")
        
        # Build context from spreadsheet
        spreadsheet_context = ""
        if request.spreadsheetData:
            spreadsheet_context = "Current Spreadsheet Data:\n"
            for item in request.spreadsheetData[:30]:
                row_num = item.get('row', '?')
                data = item.get('data', {})
                row_str = ", ".join([f"{k}={v}" for k, v in data.items()])
                spreadsheet_context += f"Row {row_num}: {row_str}\n"
            
            if len(request.spreadsheetData) > 30:
                spreadsheet_context += f"... ({len(request.spreadsheetData) - 30} more rows with data)\n"
        else:
            spreadsheet_context = "The spreadsheet is currently empty.\n"

        # System prompt
        system_prompt = """You are Underwrite AI, an institutional-grade real estate underwriting assistant. You build investment-quality financial models used by REITs, private equity firms, and commercial real estate investors.

CRITICAL OUTPUT RULES:
1. Generate COMPLETE tables with ALL cells populated - never partial tables
2. Use professional real estate terminology and industry-standard metrics
3. Include section headers, subtotals, and grand totals with proper formulas
4. Create multi-column layouts with proper alignment
5. EVERY cell you output MUST use CELL_UPDATE format

CELL_UPDATE SYNTAX:
CELL_UPDATE: A1=Label or Value
CELL_UPDATE: B1==FORMULA (formulas start with =)

PROFESSIONAL TABLE STRUCTURE:
Row 1: Main title (merged concept)
Row 2: Blank for spacing
Row 3: Section header (BOLD CAPS)
Row 4+: Data rows with labels in column A, values in columns B,C,D...
Blank rows between sections for clean separation
Bottom rows: Subtotals and Grand Totals with SUM formulas

REAL ESTATE FINANCIAL MODELS YOU BUILD:

1. OPERATING PROFORMA (12-month or annual)
   - Gross Rental Income by unit type
   - Vacancy Loss (% of GRI)
   - Effective Gross Income
   - Operating Expenses (line by line: property mgmt, insurance, taxes, utilities, R&M, etc.)
   - Net Operating Income (EGI - OpEx)
   - Debt Service
   - Cash Flow Before Tax

2. PURCHASE ANALYSIS
   - Purchase Price, Closing Costs, Financing terms
   - Sources and Uses table
   - Loan assumptions (LTV, rate, term, amortization)
   - Cash-on-Cash Return
   - Cap Rate (NOI/Purchase Price)
   - Debt Yield
   - DSCR (NOI/Debt Service)

3. UNIT MIX ANALYSIS
   - Unit Type (Studio, 1BR, 2BR, 3BR)
   - Number of Units
   - Monthly Rent per unit
   - Total Monthly Rent (quantity × rate)
   - Annual Rent
   - % of Total Income

4. EXPENSE BREAKDOWN
   - Fixed expenses (insurance, property tax)
   - Variable expenses (utilities, repairs)
   - Management fees (% of EGI)
   - Reserves (per unit or % of EGI)
   - Total with =SUM formulas

5. CASH FLOW PROJECTIONS
   - Year-by-year or month-by-month
   - Rent growth assumptions
   - Expense escalations
   - Reversion analysis (Year 5 or 10 sale)

6. SENSITIVITY ANALYSIS
   - Cap Rate scenarios (5%, 6%, 7%)
   - Exit value calculations
   - IRR and equity multiple at different exit caps

FORMATTING STANDARDS:
- Column A: 150px width for labels (left-aligned text)
- Columns B-Z: 120px width for numbers (right-aligned)
- Section headers: ALL CAPS, row 3, 8, 15, etc.
- Subtotals: Indented or bold
- Grand totals: Double indent or highlighted
- Currency: No $ symbol in cells (implied USD)
- Percentages: Express as decimals (0.05 for 5%) or with % symbol
- Formulas: =SUM(B4:B10), =B5*C5, =B12/B7, etc.

WHEN USER ASKS FOR TABLES:
Output EVERY single cell needed including:
- All row labels
- All column headers  
- All data values
- ALL formulas for calculations
- Section headers
- Spacing rows (leave them empty, don't output CELL_UPDATE for them)

EXAMPLE - Complete Unit Mix Table:
CELL_UPDATE: A1=Unit Mix Analysis - Rent Roll
CELL_UPDATE: A3=UNIT TYPE
CELL_UPDATE: B3=Units
CELL_UPDATE: C3=Monthly Rent
CELL_UPDATE: D3=Total Monthly
CELL_UPDATE: E3=Annual Rent
CELL_UPDATE: A4=Studio
CELL_UPDATE: B4=8
CELL_UPDATE: C4=1250
CELL_UPDATE: D4==B4*C4
CELL_UPDATE: E4==D4*12
CELL_UPDATE: A5=1 Bedroom
CELL_UPDATE: B5=24
CELL_UPDATE: C5=1650
CELL_UPDATE: D5==B5*C5
CELL_UPDATE: E5==D5*12
CELL_UPDATE: A6=2 Bedroom
CELL_UPDATE: B6=18
CELL_UPDATE: C6=2150
CELL_UPDATE: D6==B6*C6
CELL_UPDATE: E6==D6*12
CELL_UPDATE: A7=3 Bedroom
CELL_UPDATE: B7=4
CELL_UPDATE: C7=2850
CELL_UPDATE: D7==B7*C7
CELL_UPDATE: E7==D7*12
CELL_UPDATE: A9=TOTAL
CELL_UPDATE: B9==SUM(B4:B7)
CELL_UPDATE: D9==SUM(D4:D7)
CELL_UPDATE: E9==SUM(E4:E7)

NEVER say "I'll create" or "I can help" - JUST OUTPUT THE CELL_UPDATES IMMEDIATELY.
NEVER output partial tables - if user wants a table, output EVERY cell.
NEVER use placeholder values - use realistic real estate numbers.

You are the institutional standard for real estate underwriting AI."""

        # Build messages
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add conversation history
        for msg in request.history[-6:]:
            messages.append({"role": msg.role, "content": msg.content})
        
        # Add current request with spreadsheet context
        user_message = f"{spreadsheet_context}\n\nUser: {request.message}"
        messages.append({"role": "user", "content": user_message})

        # Call GPT-4
        log.info(f"[Excel AI] Calling GPT-4o-mini...")
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7,
            max_tokens=2000
        )

        ai_response = response.choices[0].message.content
        log.info(f"[Excel AI] Raw response length: {len(ai_response)} chars")

        # Parse cell updates from response
        cell_updates = []
        
        # Extract CELL_UPDATE lines
        update_pattern = r'CELL_UPDATE:\s*([A-Z]+\d+)\s*=\s*(.+?)(?:\n|$)'
        matches = re.findall(update_pattern, ai_response, re.IGNORECASE | re.MULTILINE)
        
        for cell, value in matches:
            cell_updates.append(CellUpdate(cell=cell.upper(), value=value.strip()))
        
        # Remove CELL_UPDATE lines from response for cleaner output
        clean_response = re.sub(r'CELL_UPDATE:\s*[A-Z]+\d+\s*=.+?(?:\n|$)', '', ai_response, flags=re.IGNORECASE | re.MULTILINE)
        clean_response = clean_response.strip()
        
        # If response is too short after cleaning, keep some context
        if len(clean_response) < 20 and cell_updates:
            clean_response = f"I've updated {len(cell_updates)} cells in your spreadsheet as requested."

        log.info(f"[Excel AI] Parsed {len(cell_updates)} cell updates")
        if cell_updates:
            log.info(f"[Excel AI] Sample updates: {cell_updates[:3]}")

        return ExcelChatResponse(
            response=clean_response,
            cellUpdates=cell_updates if cell_updates else None,
            suggestions=None
        )

    except Exception as e:
        log.exception("[Excel AI] Error processing chat request")
        raise HTTPException(
            status_code=500,
            detail=f"Excel AI error: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "openai_configured": bool(OPENAI_API_KEY),
        "model": "gpt-4o-mini"
    }
