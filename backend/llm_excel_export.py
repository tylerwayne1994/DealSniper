"""
LLM-Powered Excel Export for DealSniper
Uses Claude to intelligently structure underwriting data into a professional spreadsheet.
Charges 1 token per export.
"""

import io
import os
import json
import logging
from typing import Dict, Any, Optional, List

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from anthropic import Anthropic

log = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")


def get_anthropic_client():
    """Get Anthropic client."""
    if not ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY not configured")
    return Anthropic(api_key=ANTHROPIC_API_KEY)


EXCEL_SYSTEM_PROMPT = """You are an expert commercial real estate underwriter. 
Your task is to structure deal data into a clean, professional underwriting model.

You will receive JSON data from various tabs of an underwriting tool:
- Overview: Property info, purchase price, financing, key metrics
- Expenses: All operating expenses with current and proforma values
- Value-Add: Rent bumps, RUBS, expense optimization opportunities
- Rent Roll: Unit mix with current/market rents
- Waterfall: Equity splits, preferred returns, promote structure
- Stress Test: Revaluation scenarios, cash-out refi analysis, post-refi cashflows

Return a JSON object with sheets to create in Excel. Each sheet has:
- "name": Sheet name
- "rows": Array of rows, each row is array of cell values

Use these formatting conventions:
- Currency: Just numbers (formatting applied in Excel)
- Percentages: Decimals like 0.065 for 6.5%
- Headers should be clear and professional
- Include subtotals and totals where appropriate
- Group related data logically

Return ONLY valid JSON, no markdown or explanation."""


def build_excel_from_llm_response(llm_response: Dict[str, Any]) -> io.BytesIO:
    """Build Excel workbook from LLM-structured data."""
    wb = openpyxl.Workbook()
    # Remove default sheet
    wb.remove(wb.active)
    
    # Styling
    header_font = Font(bold=True, color="FFFFFF", size=11)
    header_fill = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
    subheader_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    money_format = '_($* #,##0_);_($* (#,##0);_($* "-"_);_(@_)'
    pct_format = '0.00%'
    
    sheets = llm_response.get("sheets", [])
    
    for sheet_data in sheets:
        sheet_name = sheet_data.get("name", "Sheet")[:31]  # Excel max 31 chars
        ws = wb.create_sheet(title=sheet_name)
        
        rows = sheet_data.get("rows", [])
        for row_idx, row in enumerate(rows, start=1):
            for col_idx, value in enumerate(row, start=1):
                cell = ws.cell(row=row_idx, column=col_idx, value=value)
                
                # Apply formatting based on content
                if row_idx == 1:  # Header row
                    cell.font = header_font
                    cell.fill = header_fill
                    cell.alignment = Alignment(horizontal='center')
                elif isinstance(value, str) and value.isupper():  # Section headers
                    cell.font = Font(bold=True)
                elif isinstance(value, (int, float)):
                    if isinstance(value, float) and 0 < abs(value) < 1:
                        cell.number_format = pct_format
                    elif abs(value) >= 100:
                        cell.number_format = money_format
        
        # Auto-width columns
        for col in range(1, ws.max_column + 1):
            ws.column_dimensions[get_column_letter(col)].width = 18
    
    # If no sheets were created, create a default one
    if not wb.sheetnames:
        ws = wb.create_sheet(title="Underwriting Model")
        ws.cell(row=1, column=1, value="No data provided")
    
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


def llm_export_to_excel(
    scenario_data: Dict[str, Any],
    full_calcs: Dict[str, Any] = None,
    sensitivity_data: Dict[str, Any] = None,
    waterfall_data: Dict[str, Any] = None
) -> io.BytesIO:
    """
    Use Claude to structure deal data into an Excel underwriting model.
    
    Args:
        scenario_data: Full scenarioData from frontend
        full_calcs: Calculated values from frontend
        sensitivity_data: Stress test data (revaluation, refi, post-refi cashflow)
        waterfall_data: Equity waterfall structure
    
    Returns:
        BytesIO buffer containing Excel file
    """
    client = get_anthropic_client()
    
    # Extract relevant sections
    property_info = scenario_data.get('property', {})
    pricing = scenario_data.get('pricing_financing', {})
    pnl = scenario_data.get('pnl', {})
    expenses = scenario_data.get('expenses', {})
    unit_mix = scenario_data.get('unit_mix', [])
    value_add = scenario_data.get('value_add', {})
    financing = scenario_data.get('financing', {})
    
    # Build the data payload for Claude
    data_payload = {
        "overview": {
            "property": property_info,
            "purchase_price": pricing.get('purchase_price') or pricing.get('price'),
            "loan_amount": pricing.get('loan_amount'),
            "down_payment": pricing.get('down_payment'),
            "interest_rate": pricing.get('interest_rate'),
            "amortization_years": pricing.get('amortization_years'),
            "term_years": pricing.get('term_years'),
            "annual_debt_service": pricing.get('annual_debt_service'),
            "noi": pnl.get('noi') or pnl.get('noi_t12'),
            "effective_gross_income": pnl.get('effective_gross_income'),
            "cap_rate": full_calcs.get('capRate') if full_calcs else None,
            "cash_on_cash": full_calcs.get('cashOnCash') if full_calcs else None,
            "dscr": full_calcs.get('dscr') if full_calcs else None,
        },
        "expenses": expenses,
        "value_add": value_add,
        "unit_mix": unit_mix,
        "financing_structure": financing,
    }
    
    if sensitivity_data:
        data_payload["sensitivity"] = sensitivity_data
    
    if waterfall_data:
        data_payload["waterfall"] = waterfall_data
    
    if full_calcs:
        data_payload["calculations"] = {
            "year1": full_calcs.get('year1'),
            "projections": full_calcs.get('projections'),
            "returns": {
                "irr": full_calcs.get('irr'),
                "equity_multiple": full_calcs.get('equityMultiple'),
                "cash_on_cash": full_calcs.get('cashOnCash'),
            }
        }
    
    user_prompt = f"""Structure this commercial real estate deal data into a professional underwriting model Excel spreadsheet.

DATA:
{json.dumps(data_payload, indent=2, default=str)}

Create sheets for:
1. "Summary" - Key metrics, property info, purchase/financing summary
2. "Pro Forma" - Income and expense breakdown with current and stabilized columns  
3. "Unit Mix" - Rent roll with unit types, counts, current rent, market rent, loss to lease
4. "Value-Add" - All value-add opportunities with annual impact calculations
5. "Returns" - Cash-on-cash, cap rate, IRR, equity multiple, DSCR
6. "Sensitivity" - If sensitivity data provided, include revaluation scenarios and refi analysis

Return JSON with this exact structure:
{{
  "sheets": [
    {{
      "name": "Summary",
      "rows": [
        ["Header1", "Header2", ...],
        ["Label", value, ...],
        ...
      ]
    }},
    ...
  ]
}}

Rules:
- Use actual numbers from the data, don't make up values
- If a value is missing, use 0 or "N/A"
- Include all expenses that have non-zero values
- Calculate totals where appropriate
- Format headers in the first row of each sheet"""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[
                {"role": "user", "content": user_prompt}
            ],
            system=EXCEL_SYSTEM_PROMPT
        )
        
        # Parse response
        content = response.content[0].text
        
        # Try to extract JSON from response
        try:
            # Handle potential markdown code blocks
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            llm_data = json.loads(content.strip())
        except json.JSONDecodeError as e:
            log.error(f"Failed to parse LLM response as JSON: {e}")
            log.error(f"Content: {content[:500]}")
            # Fall back to simple export
            llm_data = {"sheets": [create_fallback_sheet(data_payload)]}
        
        return build_excel_from_llm_response(llm_data)
        
    except Exception as e:
        log.error(f"LLM export failed: {e}")
        # Fall back to simple export
        llm_data = {"sheets": [create_fallback_sheet(data_payload)]}
        return build_excel_from_llm_response(llm_data)


def create_fallback_sheet(data: Dict[str, Any]) -> Dict[str, Any]:
    """Create a simple fallback sheet if LLM fails."""
    rows = [["Property", "Value"]]
    
    overview = data.get("overview", {})
    prop = overview.get("property", {})
    
    rows.append(["Property Name", prop.get("name") or prop.get("address", "N/A")])
    rows.append(["Address", prop.get("address", "N/A")])
    rows.append(["Units", prop.get("units", 0)])
    rows.append(["Purchase Price", overview.get("purchase_price", 0)])
    rows.append(["NOI", overview.get("noi", 0)])
    rows.append(["Cap Rate", overview.get("cap_rate", 0)])
    
    return {"name": "Summary", "rows": rows}
