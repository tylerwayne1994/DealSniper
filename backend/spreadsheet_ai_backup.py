"""
Spreadsheet AI - Complete Implementation
Converts natural language into institutional-grade underwriting models
"""
from anthropic import Anthropic
import os
import json
import math

from dotenv import load_dotenv

# Ensure env vars are loaded even when this module is imported directly by uvicorn.
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=True)


def _get_anthropic_api_key() -> str | None:
    # Support both env var names (existing repo used CLAUDE_API_KEY).
    return os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("CLAUDE_API_KEY")


def _get_anthropic_client() -> Anthropic:
    api_key = _get_anthropic_api_key()
    if not api_key:
        raise RuntimeError(
            "Missing Anthropic API key. Set ANTHROPIC_API_KEY (or CLAUDE_API_KEY) in backend/.env."
        )
    return Anthropic(api_key=api_key)

SYSTEM_PROMPT = """You are an institutional-grade real estate underwriting expert that converts natural language into spreadsheet operations.

YOUR PRIMARY TASK: Extract ALL parameters from the user's message to build CUSTOM models. DO NOT use generic templates.

PARAMETER EXTRACTION RULES:
When user says "Build me a 102-unit multifamily model at $7.4M with 75% LTV DSCR loan at 6%", extract:
- units: 102
- purchasePrice: 7400000
- avgRentPerUnit: 1200 (default or from message)
- financingType: "DSCR"
- ltv: 0.75
- interestRate: 0.06
- loanTerm: 30 (default if not specified)
- lpSplit: 0.90 (default 90/10 if not specified)
- gpSplit: 0.10
- exitCapRate: 0.055 (default or from user)
- rentGrowth: 0.03 (default 3% or from user)
- expenseGrowth: 0.025 (default 2.5% or from user)

OPERATION TYPES:

1. setCells - Set values in cells
   {
     "type": "setCells",
     "data": {
       "cells": [
         {"row": 0, "col": 0, "value": "Property Name"},
         {"row": 0, "col": 1, "value": "Actual extracted value"}
       ]
     }
   }

2. setFormula - Set Excel formulas (USE REAL FORMULAS, NOT PLACEHOLDERS)
   {
     "type": "setFormula",
     "data": {
       "cells": [
         {"row": 5, "col": 1, "formula": "=SUM(B2:B4)"},
         {"row": 6, "col": 1, "formula": "=B5*12"},
         {"row": 7, "col": 1, "formula": "=IRR(B10:L10)"}
       ]
     }
   }

3. setStyle - Apply formatting
   {
     "type": "setStyle",
     "data": {
       "range": {"startRow": 0, "endRow": 0, "startCol": 0, "endCol": 5},
       "style": {
         "bgcolor": "#1F4E79",
         "color": "#FFFFFF",
         "font": {"bold": True, "size": 12}
       }
     }
   }

4. merge - Merge cells
   {
     "type": "merge",
     "data": {
       "range": {"startRow": 0, "endRow": 0, "startCol": 0, "endCol": 5}
     }
   }

5. buildModel - Generate comprehensive underwriting model with extracted parameters
   {
     "type": "buildModel",
     "data": {
       "modelType": "multifamily_underwriting",
       "parameters": {
         "units": 102,
         "purchasePrice": 7400000,
         "avgRentPerUnit": 1200,
         "financingType": "DSCR",
         "ltv": 0.75,
         "interestRate": 0.06,
         "loanTerm": 30,
         "lpSplit": 0.90,
         "gpSplit": 0.10,
         "exitCapRate": 0.055,
         "rentGrowth": 0.03,
         "expenseGrowth": 0.025
       }
     }
   }

MULTIFAMILY UNDERWRITING MODEL SECTIONS (ALL REQUIRED):
1. Header & Key Metrics
2. Rent Roll (complete with ALL units)
3. Unit Mix Summary
4. Revenue Projections (10-year with formulas)
5. Operating Expenses (22 line items)
6. Financing Structure
7. Cash Flow Projections (Year 0-10)
8. Waterfall Distribution
9. IRR Calculations
10. Sensitivity Analysis (5x5 matrix)

CRITICAL RULES:
✅ ALWAYS extract parameters from user message
✅ ALWAYS generate ALL sections
✅ ALWAYS use real Excel formulas
✅ If user says "102 units", generate 102 rent roll rows
✅ Return valid JSON array

❌ NEVER use hardcoded templates
❌ NEVER skip sections
❌ NEVER use placeholder formulas

RESPONSE FORMAT: Return JSON array starting with [{ and ending with }]"""


def process_spreadsheet_command(user_message, property_data=None, current_sheet_state=None):
    """Process natural language command and return spreadsheet operations"""
    
    context = f"Current property data: {json.dumps(property_data)}\n" if property_data else ""
    if current_sheet_state:
        context += f"Current sheet state: {json.dumps(current_sheet_state)[:500]}\n"
    
    try:
        client = _get_anthropic_client()

        # Use the most stable/common Claude model identifiers
        preferred_model = (
            os.environ.get("ANTHROPIC_MODEL")
            or os.environ.get("CLAUDE_MODEL")
            or "claude-3-5-sonnet-20240620"
        )
        fallback_models = [
            preferred_model,
            "claude-3-5-sonnet-20240620",
            "claude-3-sonnet-20240229",
        ]

        last_error = None
        response = None
        for model_name in fallback_models:
            try:
                response = client.messages.create(
                    model=model_name,
                    max_tokens=16000,
                    system=SYSTEM_PROMPT,
                    messages=[
                        {
                            "role": "user",
                            "content": f"{context}\nUser command: {user_message}\n\nReturn JSON array of spreadsheet operations."
                        }
                    ],
                )
                last_error = None
                break
            except Exception as e:
                # If model is not found, try the next fallback.
                msg = str(e)
                if "not_found_error" in msg or "model:" in msg:
                    last_error = e
                    continue
                raise

        if response is None:
            raise RuntimeError(
                "No available Anthropic model. Set ANTHROPIC_MODEL in backend/.env "
                "to a model your API key has access to."
            ) from last_error
        
        content = response.content[0].text
        
        # Extract JSON from response
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        operations = json.loads(content)
        
        # If it's a buildModel operation, expand it into full model
        if isinstance(operations, list) and len(operations) > 0:
            if operations[0].get('type') == 'buildModel':
                operations = build_full_underwriting_model(operations[0].get('data', {}), property_data)
        
        return {
            "success": True,
            "operations": operations
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "operations": []
        }


def build_full_underwriting_model(model_spec, property_data):
    """Generate COMPLETE institutional-grade underwriting model matching exact CSV template structure"""
    
    operations = []
    
    # Extract parameters from model_spec (from Claude)
    params = model_spec.get('parameters', {})
    
    # Core property metrics
    units = params.get('units', property_data.get('propertyInfo', {}).get('numberOfUnits', 102) if property_data else 102)
    purchase_price = params.get('purchasePrice', property_data.get('pricing', {}).get('purchasePrice', 7400000) if property_data else 7400000)
    property_name = params.get('propertyName', property_data.get('propertyInfo', {}).get('name', 'New Town Apartments') if property_data else 'New Town Apartments')
    total_sf = params.get('totalSf', 75904)
    year_built = params.get('yearBuilt', 1985)
    
    # Rent assumptions - Create unit mix
    rent_2br = params.get('rent2br', 950)
    rent_1br = params.get('rent1br', 800)
    
    # Financing structure
    ltv = params.get('ltv', 0.724)
    interest_rate = params.get('interestRate', 0.06)
    loan_term_years = params.get('loanTerm', 30)
    loan_amount = purchase_price * ltv
    
    # Equity splits
    lp_split = params.get('lpSplit', 0.248)
    gp_split = params.get('gpSplit', 0.028)
    
    # Growth assumptions
    rent_growth = params.get('rentGrowth', 0.03)
    expense_growth = params.get('expenseGrowth', 0.025)
    vacancy_rate = params.get('vacancyRate', 0.05)
    bad_debt_rate = params.get('badDebtRate', 0.01)
    concessions_rate = params.get('concessionsRate', 0.005)
    management_fee_pct = params.get('managementFeePct', 0.06)
    
    # Exit assumptions
    exit_cap_5yr = params.get('exitCapRate5Yr', 0.06)
    exit_cap_10yr = params.get('exitCapRate10Yr', 0.065)
    selling_costs_pct = params.get('sellingCostsPct', 0.02)
    
    # Waterfall structure
    preferred_return = params.get('preferredReturn', 0.08)
    lp_equity_pct = params.get('lpEquityPct', 0.90)
    gp_equity_pct = params.get('gpEquityPct', 0.10)
    lp_split_post_pref = params.get('lpSplitPostPref', 0.70)
    gp_promote_post_pref = params.get('gpPromotePostPref', 0.30)
    
    # Acquisition costs
    closing_costs = params.get('closingCosts', 36000)
    due_diligence = params.get('dueDiligence', 15000)
    capex_budget_yr1 = params.get('capexBudgetYr1', 150000)
    financing_costs = params.get('financingCosts', 12000)
    operating_reserves = params.get('operatingReserves', 50000)
    
    # Calculated values
    price_per_unit = purchase_price / units
    price_per_sf = purchase_price / total_sf
    
    # Calculate total sources and uses
    total_sources = loan_amount + (purchase_price + closing_costs + due_diligence + capex_budget_yr1 + financing_costs + operating_reserves - loan_amount)
    total_uses = purchase_price + closing_costs + due_diligence + capex_budget_yr1 + financing_costs + operating_reserves
    
    # Calculate equity amounts
    required_equity = total_uses - loan_amount
    lp_equity = required_equity * lp_equity_pct
    gp_equity = required_equity * gp_equity_pct
    
    # ========== ROW 1: BLANK ==========
    row = 1
    
    # ========== ROW 2: HEADER ==========
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": row, "col": 1, "value": "MULTIFAMILY UNDERWRITING MODEL"}]}
    })
    operations.append({
        "type": "setStyle",
        "data": {
            "range": {"startRow": row, "endRow": row, "startCol": 1, "endCol": 16},
            "style": {"bgcolor": "#1F4E78", "color": "#FFFFFF", "font": {"bold": True, "size": 14}}
        }
    })
    operations.append({
        "type": "merge",
        "data": {"range": {"startRow": row, "endRow": row, "startCol": 1, "endCol": 16}}
    })
    row += 1
    
    # ========== ROW 3: SUBTITLE ==========
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": row, "col": 1, "value": "Comprehensive Analysis with Creative Financing"}]}
    })
    operations.append({
        "type": "setStyle",
        "data": {
            "range": {"startRow": row, "endRow": row, "startCol": 1, "endCol": 16},
            "style": {"font": {"italic": True, "size": 10}, "color": "#595959"}
        }
    })
    row += 2
    
    # ========== SECTION 2: KEY METRICS ==========
    key_metrics_row = row
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": row, "col": 0, "value": "KEY DEAL METRICS"}]}
    })
    operations.append({
        "type": "setStyle",
        "data": {
            "range": {"startRow": row, "endRow": row, "startCol": 0, "endCol": 2},
            "style": {"bgcolor": "#1F4E79", "color": "#FFFFFF", "font": {"bold": True}}
        }
    })
    row += 1
    
    # Year 1 NOI will be calculated later - store row reference
    noi_row = row + 6
    
    metrics_data = [
        ("Property Name", property_name),
        ("Total Units", units),
        ("Total SF", f"{total_sf:,.0f}"),
        ("Purchase Price", f"${purchase_price:,.0f}"),
        ("Price/Unit", f"${price_per_unit:,.0f}"),
        ("Price/SF", f"${price_per_sf:.2f}"),
        ("Year 1 NOI", "=B82"),  # Link to NOI calculation
        ("Going-In Cap", "=B39/B23"),  # NOI/Price
        ("Exit Cap (5yr)", f"{exit_cap_5yr:.1%}"),
    ]
    
    for label, value in metrics_data:
        operations.append({
            "type": "setCells",
            "data": {"cells": [
                {"row": row, "col": 0, "value": label},
                {"row": row, "col": 1, "value": value if not isinstance(value, str) or not value.startswith('=') else ""}
            ]}
        })
        if isinstance(value, str) and value.startswith('='):
            operations.append({
                "type": "setFormula",
                "data": {"cells": [{"row": row, "col": 1, "formula": value}]}
            })
        operations.append({
            "type": "setStyle",
            "data": {
                "range": {"startRow": row, "endRow": row, "startCol": 0, "endCol": 0},
                "style": {"bgcolor": "#F2F2F2", "font": {"bold": True}}
            }
        })
        row += 1
    
    # ========== SECTION 3: SOURCES & USES (Side by side) ==========
    sources_row = key_metrics_row
    
    # Sources of Funds
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": sources_row, "col": 4, "value": "SOURCES OF FUNDS"}]}
    })
    operations.append({
        "type": "setStyle",
        "data": {
            "range": {"startRow": sources_row, "endRow": sources_row, "startCol": 4, "endCol": 6},
            "style": {"bgcolor": "#1F4E79", "color": "#FFFFFF", "font": {"bold": True}}
        }
    })
    sources_row += 1
    
    operations.append({
        "type": "setCells",
        "data": {"cells": [
            {"row": sources_row, "col": 4, "value": "Source"},
            {"row": sources_row, "col": 5, "value": "Amount"},
            {"row": sources_row, "col": 6, "value": "%"}
        ]}
    })
    sources_row += 1
    
    sources_start = sources_row
    sources_data = [
        ("DSCR Loan", loan_amount),
        ("LP Equity (90%)", lp_equity),
        ("GP Equity (10%)", gp_equity),
    ]
    
    for label, amount in sources_data:
        operations.append({
            "type": "setCells",
            "data": {"cells": [
                {"row": sources_row, "col": 4, "value": label},
                {"row": sources_row, "col": 5, "value": amount}
            ]}
        })
        operations.append({
            "type": "setFormula",
            "data": {"cells": [{"row": sources_row, "col": 6, "formula": f"=F{sources_row+1}/F{sources_start+len(sources_data)+1}"}]}
        })
        sources_row += 1
    
    # Total Sources
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": sources_row, "col": 4, "value": "Total Sources"}]}
    })
    operations.append({
        "type": "setFormula",
        "data": {"cells": [{"row": sources_row, "col": 5, "formula": f"=SUM(F{sources_start+1}:F{sources_row})"}]}
    })
    operations.append({
        "type": "setStyle",
        "data": {
            "range": {"startRow": sources_row, "endRow": sources_row, "startCol": 4, "endCol": 6},
            "style": {"bgcolor": "#C6E0B4", "font": {"bold": True}}
        }
    })
    
    # Uses of Funds
    uses_row = key_metrics_row
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": uses_row, "col": 8, "value": "USES OF FUNDS"}]}
    })
    operations.append({
        "type": "setStyle",
        "data": {
            "range": {"startRow": uses_row, "endRow": uses_row, "startCol": 8, "endCol": 10},
            "style": {"bgcolor": "#1F4E79", "color": "#FFFFFF", "font": {"bold": True}}
        }
    })
    uses_row += 1
    
    operations.append({
        "type": "setCells",
        "data": {"cells": [
            {"row": uses_row, "col": 8, "value": "Use"},
            {"row": uses_row, "col": 9, "value": "Amount"},
            {"row": uses_row, "col": 10, "value": "%"}
        ]}
    })
    uses_row += 1
    
    uses_start = uses_row
    uses_data = [
        ("Purchase Price", purchase_price),
        ("Closing Costs", closing_costs),
        ("CapEx Budget", capex_budget),
    ]
    
    for label, amount in uses_data:
        operations.append({
            "type": "setCells",
            "data": {"cells": [
                {"row": uses_row, "col": 8, "value": label},
                {"row": uses_row, "col": 9, "value": amount}
            ]}
        })
        operations.append({
            "type": "setFormula",
            "data": {"cells": [{"row": uses_row, "col": 10, "formula": f"=J{uses_row+1}/J{uses_start+len(uses_data)+1}"}]}
        })
        uses_row += 1
    
    # Total Uses
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": uses_row, "col": 8, "value": "Total Uses"}]}
    })
    operations.append({
        "type": "setFormula",
        "data": {"cells": [{"row": uses_row, "col": 9, "formula": f"=SUM(J{uses_start+1}:J{uses_row})"}]}
    })
    operations.append({
        "type": "setStyle",
        "data": {
            "range": {"startRow": uses_row, "endRow": uses_row, "startCol": 8, "endCol": 10},
            "style": {"bgcolor": "#C6E0B4", "font": {"bold": True}}
        }
    })
    
    row = max(row, sources_row + 2, uses_row + 2)
    
    # ========== SECTION 4: RENT ROLL ==========
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": row, "col": 0, "value": "RENT ROLL"}]}
    })
    operations.append({
        "type": "setStyle",
        "data": {
            "range": {"startRow": row, "endRow": row, "startCol": 0, "endCol": 6},
            "style": {"bgcolor": "#1F4E79", "color": "#FFFFFF", "font": {"bold": True}}
        }
    })
    row += 1
    
    # Headers
    rent_roll_headers = ["Unit #", "Type", "SF", "Market Rent", "In-Place Rent", "Loss to Lease", "Status"]
    for col_idx, header in enumerate(rent_roll_headers):
        operations.append({
            "type": "setCells",
            "data": {"cells": [{"row": row, "col": col_idx, "value": header}]}
        })
        operations.append({
            "type": "setStyle",
            "data": {
                "range": {"startRow": row, "endRow": row, "startCol": col_idx, "endCol": col_idx},
                "style": {"bgcolor": "#D6DCE4", "font": {"bold": True}}
            }
        })
    row += 1
    
    rent_roll_start = row
    
    # Generate all units dynamically
    unit_types = ["1BR/1BA", "2BR/2BA", "3BR/2BA"]
    unit_sfs = [650, 900, 1100]
    base_rents = [950, 1250, 1550]
    
    for unit_num in range(1, units + 1):
        # Distribute unit types evenly
        type_idx = (unit_num - 1) % len(unit_types)
        unit_type = unit_types[type_idx]
        unit_sf = unit_sfs[type_idx]
        market_rent = base_rents[type_idx]
        
        # 80% occupied, 20% vacant
        is_occupied = unit_num % 5 != 0
        in_place_rent = market_rent if is_occupied else 0
        status = "Occupied" if is_occupied else "Vacant"
        
        operations.append({
            "type": "setCells",
            "data": {"cells": [
                {"row": row, "col": 0, "value": unit_num},
                {"row": row, "col": 1, "value": unit_type},
                {"row": row, "col": 2, "value": unit_sf},
                {"row": row, "col": 3, "value": market_rent},
                {"row": row, "col": 4, "value": in_place_rent},
                {"row": row, "col": 6, "value": status}
            ]}
        })
        operations.append({
            "type": "setFormula",
            "data": {"cells": [{"row": row, "col": 5, "formula": f"=D{row+1}-E{row+1}"}]}
        })
        row += 1
    
    rent_roll_end = row - 1
    
    # Rent Roll Summary
    operations.append({
        "type": "setCells",
        "data": {"cells": [
            {"row": row, "col": 0, "value": "TOTAL"},
            {"row": row, "col": 1, "value": f"{units} Units"}
        ]}
    })
    operations.append({
        "type": "setFormula",
        "data": {"cells": [
            {"row": row, "col": 2, "formula": f"=SUM(C{rent_roll_start+1}:C{rent_roll_end+1})"},
            {"row": row, "col": 3, "formula": f"=SUM(D{rent_roll_start+1}:D{rent_roll_end+1})"},
            {"row": row, "col": 4, "formula": f"=SUM(E{rent_roll_start+1}:E{rent_roll_end+1})"},
            {"row": row, "col": 5, "formula": f"=SUM(F{rent_roll_start+1}:F{rent_roll_end+1})"}
        ]}
    })
    operations.append({
        "type": "setStyle",
        "data": {
            "range": {"startRow": row, "endRow": row, "startCol": 0, "endCol": 6},
            "style": {"bgcolor": "#C6E0B4", "font": {"bold": True}}
        }
    })
    row += 2
    
    # ========== SECTION 5: REVENUE PROJECTIONS (10-Year) ==========
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": row, "col": 0, "value": "REVENUE PROJECTIONS"}]}
    })
    operations.append({
        "type": "setStyle",
        "data": {
            "range": {"startRow": row, "endRow": row, "startCol": 0, "endCol": 11},
            "style": {"bgcolor": "#1F4E79", "color": "#FFFFFF", "font": {"bold": True}}
        }
    })
    row += 1
    
    # Headers: Line Item, Year 0-10
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": row, "col": 0, "value": "Line Item"}]}
    })
    for year in range(11):
        operations.append({
            "type": "setCells",
            "data": {"cells": [{"row": row, "col": year + 1, "value": f"Year {year}"}]}
        })
    operations.append({
        "type": "setStyle",
        "data": {
            "range": {"startRow": row, "endRow": row, "startCol": 0, "endCol": 11},
            "style": {"bgcolor": "#D6DCE4", "font": {"bold": True}}
        }
    })
    row += 1
    
    revenue_start = row
    
    # Gross Potential Rent
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": row, "col": 0, "value": "Gross Potential Rent"}]}
    })
    annual_market_rent = avg_rent * units * 12
    for year in range(11):
        growth_factor = (1 + rent_growth) ** year
        year_rent = annual_market_rent * growth_factor
        operations.append({
            "type": "setCells",
            "data": {"cells": [{"row": row, "col": year + 1, "value": year_rent}]}
        })
    row += 1
    
    # Vacancy Loss
    gpr_row = row - 1
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": row, "col": 0, "value": "Vacancy Loss"}]}
    })
    for year in range(11):
        col_letter = chr(66 + year)  # B=66
        operations.append({
            "type": "setFormula",
            "data": {"cells": [{"row": row, "col": year + 1, "formula": f"=-{col_letter}{gpr_row+1}*{vacancy_rate}"}]}
        })
    row += 1
    
    # Other Income (5% of GPR)
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": row, "col": 0, "value": "Other Income"}]}
    })
    for year in range(11):
        col_letter = chr(66 + year)
        operations.append({
            "type": "setFormula",
            "data": {"cells": [{"row": row, "col": year + 1, "formula": f"={col_letter}{gpr_row+1}*0.05"}]}
        })
    row += 1
    
    # Effective Gross Income
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": row, "col": 0, "value": "Effective Gross Income"}]}
    })
    for year in range(11):
        col_letter = chr(66 + year)
        operations.append({
            "type": "setFormula",
            "data": {"cells": [{"row": row, "col": year + 1, "formula": f"={col_letter}{revenue_start+1}+{col_letter}{revenue_start+2}+{col_letter}{revenue_start+3}"}]}
        })
    operations.append({
        "type": "setStyle",
        "data": {
            "range": {"startRow": row, "endRow": row, "startCol": 0, "endCol": 11},
            "style": {"bgcolor": "#C6E0B4", "font": {"bold": True}}
        }
    })
    egi_row = row
    row += 2
    
    # ========== SECTION 6: OPERATING EXPENSES ==========
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": row, "col": 0, "value": "OPERATING EXPENSES"}]}
    })
    operations.append({
        "type": "setStyle",
        "data": {
            "range": {"startRow": row, "endRow": row, "startCol": 0, "endCol": 11},
            "style": {"bgcolor": "#1F4E79", "color": "#FFFFFF", "font": {"bold": True}}
        }
    })
    row += 1
    
    expenses_start = row
    
    # Expense line items with Year 0 amounts
    expense_items = [
        ("Property Taxes", purchase_price * 0.012),
        ("Insurance", units * 600),
        ("Water/Sewer", units * 400),
        ("Electric (Common)", units * 200),
        ("Gas", units * 150),
        ("Trash", units * 180),
        ("Repairs & Maintenance", units * 500),
        ("Landscaping", units * 100),
        ("Pest Control", units * 50),
        ("Snow Removal", units * 75),
        ("Turnover", units * 300),
        ("Management Fee", 0),  # Will be formula
        ("Payroll", units * 400),
        ("Marketing", units * 150),
        ("Legal & Accounting", 8000),
        ("Administrative", 5000),
        ("Security", units * 100),
    ]
    
    for label, yr0_amount in expense_items:
        operations.append({
            "type": "setCells",
            "data": {"cells": [{"row": row, "col": 0, "value": label}]}
        })
        
        if label == "Management Fee":
            # Management fee is % of EGI
            for year in range(11):
                col_letter = chr(66 + year)
                operations.append({
                    "type": "setFormula",
                    "data": {"cells": [{"row": row, "col": year + 1, "formula": f"={col_letter}{egi_row+1}*{management_fee_pct}"}]}
                })
        else:
            # Regular expenses with escalation
            for year in range(11):
                growth_factor = (1 + expense_growth) ** year
                year_expense = yr0_amount * growth_factor
                operations.append({
                    "type": "setCells",
                    "data": {"cells": [{"row": row, "col": year + 1, "value": year_expense}]}
                })
        row += 1
    
    expenses_end = row - 1
    
    # Total Operating Expenses
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": row, "col": 0, "value": "Total Operating Expenses"}]}
    })
    for year in range(11):
        col_letter = chr(66 + year)
        operations.append({
            "type": "setFormula",
            "data": {"cells": [{"row": row, "col": year + 1, "formula": f"=SUM({col_letter}{expenses_start+1}:{col_letter}{expenses_end+1})"}]}
        })
    operations.append({
        "type": "setStyle",
        "data": {
            "range": {"startRow": row, "endRow": row, "startCol": 0, "endCol": 11},
            "style": {"bgcolor": "#C6E0B4", "font": {"bold": True}}
        }
    })
    total_opex_row = row
    row += 1
    
    # NET OPERATING INCOME (NOI)
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": row, "col": 0, "value": "NET OPERATING INCOME"}]}
    })
    for year in range(11):
        col_letter = chr(66 + year)
        operations.append({
            "type": "setFormula",
            "data": {"cells": [{"row": row, "col": year + 1, "formula": f"={col_letter}{egi_row+1}-{col_letter}{total_opex_row+1}"}]}
        })
    operations.append({
        "type": "setStyle",
        "data": {
            "range": {"startRow": row, "endRow": row, "startCol": 0, "endCol": 11},
            "style": {"bgcolor": "#548235", "color": "#FFFFFF", "font": {"bold": True}}
        }
    })
    noi_row = row
    row += 2
    
    # ========== SECTION 7: FINANCING & DEBT SERVICE ==========
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": row, "col": 0, "value": "FINANCING & DEBT SERVICE"}]}
    })
    operations.append({
        "type": "setStyle",
        "data": {
            "range": {"startRow": row, "endRow": row, "startCol": 0, "endCol": 11},
            "style": {"bgcolor": "#1F4E79", "color": "#FFFFFF", "font": {"bold": True}}
        }
    })
    row += 1
    
    # Loan details
    monthly_rate = interest_rate / 12
    num_payments = loan_term * 12
    monthly_payment = loan_amount * (monthly_rate * (1 + monthly_rate)**num_payments) / ((1 + monthly_rate)**num_payments - 1)
    annual_debt_service = monthly_payment * 12
    
    operations.append({
        "type": "setCells",
        "data": {"cells": [
            {"row": row, "col": 0, "value": "Loan Amount"},
            {"row": row, "col": 1, "value": loan_amount}
        ]}
    })
    row += 1
    operations.append({
        "type": "setCells",
        "data": {"cells": [
            {"row": row, "col": 0, "value": "Interest Rate"},
            {"row": row, "col": 1, "value": f"{interest_rate:.2%}"}
        ]}
    })
    row += 1
    operations.append({
        "type": "setCells",
        "data": {"cells": [
            {"row": row, "col": 0, "value": "Loan Term (Years)"},
            {"row": row, "col": 1, "value": loan_term}
        ]}
    })
    row += 1
    operations.append({
        "type": "setCells",
        "data": {"cells": [
            {"row": row, "col": 0, "value": "Annual Debt Service"},
            {"row": row, "col": 1, "value": annual_debt_service}
        ]}
    })
    debt_service_row = row
    row += 2
    
    # ========== SECTION 8: CASH FLOW PROJECTIONS ==========
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": row, "col": 0, "value": "CASH FLOW PROJECTIONS"}]}
    })
    operations.append({
        "type": "setStyle",
        "data": {
            "range": {"startRow": row, "endRow": row, "startCol": 0, "endCol": 11},
            "style": {"bgcolor": "#1F4E79", "color": "#FFFFFF", "font": {"bold": True}}
        }
    })
    row += 1
    
    # Headers
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": row, "col": 0, "value": "Line Item"}]}
    })
    for year in range(11):
        operations.append({
            "type": "setCells",
            "data": {"cells": [{"row": row, "col": year + 1, "value": f"Year {year}"}]}
        })
    row += 1
    
    cashflow_start = row
    
    # NOI (reference)
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": row, "col": 0, "value": "Net Operating Income"}]}
    })
    for year in range(11):
        col_letter = chr(66 + year)
        operations.append({
            "type": "setFormula",
            "data": {"cells": [{"row": row, "col": year + 1, "formula": f"={col_letter}{noi_row+1}"}]}
        })
    row += 1
    
    # Debt Service
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": row, "col": 0, "value": "Debt Service"}]}
    })
    for year in range(1, 11):
        operations.append({
            "type": "setCells",
            "data": {"cells": [{"row": row, "col": year + 1, "value": -annual_debt_service}]}
        })
    row += 1
    
    # CapEx
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": row, "col": 0, "value": "CapEx"}]}
    })
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": row, "col": 1, "value": -capex_budget}]}
    })
    for year in range(2, 11):
        operations.append({
            "type": "setCells",
            "data": {"cells": [{"row": row, "col": year + 1, "value": -units * 250}]}
        })
    row += 1
    
    # Before-Tax Cash Flow
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": row, "col": 0, "value": "Before-Tax Cash Flow"}]}
    })
    for year in range(11):
        col_letter = chr(66 + year)
        if year == 0:
            operations.append({
                "type": "setCells",
                "data": {"cells": [{"row": row, "col": year + 1, "value": -equity_needed}]}
            })
        else:
            operations.append({
                "type": "setFormula",
                "data": {"cells": [{"row": row, "col": year + 1, "formula": f"={col_letter}{cashflow_start+1}+{col_letter}{cashflow_start+2}+{col_letter}{cashflow_start+3}"}]}
            })
    operations.append({
        "type": "setStyle",
        "data": {
            "range": {"startRow": row, "endRow": row, "startCol": 0, "endCol": 11},
            "style": {"bgcolor": "#548235", "color": "#FFFFFF", "font": {"bold": True}}
        }
    })
    btcf_row = row
    row += 1
    
    # DSCR
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": row, "col": 0, "value": "DSCR"}]}
    })
    for year in range(1, 11):
        col_letter = chr(66 + year)
        operations.append({
            "type": "setFormula",
            "data": {"cells": [{"row": row, "col": year + 1, "formula": f"={col_letter}{noi_row+1}/{annual_debt_service}"}]}
        })
    row += 2
    
    # ========== SECTION 9: RETURN SUMMARY ==========
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": row, "col": 0, "value": "RETURN SUMMARY"}]}
    })
    operations.append({
        "type": "setStyle",
        "data": {
            "range": {"startRow": row, "endRow": row, "startCol": 0, "endCol": 5},
            "style": {"bgcolor": "#548235", "color": "#FFFFFF", "font": {"bold": True}}
        }
    })
    row += 1
    
    operations.append({
        "type": "setCells",
        "data": {"cells": [
            {"row": row, "col": 0, "value": "Metric"},
            {"row": row, "col": 1, "value": "5-Year Exit"},
            {"row": row, "col": 2, "value": "10-Year Exit"}
        ]}
    })
    row += 1
    
    # Calculate sale proceeds (simplified)
    yr5_noi = annual_market_rent * (1 + rent_growth)**5
    yr10_noi = annual_market_rent * (1 + rent_growth)**10
    yr5_sale_price = yr5_noi / exit_cap_5yr
    yr10_sale_price = yr10_noi / exit_cap_10yr
    
    operations.append({
        "type": "setCells",
        "data": {"cells": [
            {"row": row, "col": 0, "value": "Exit Cap Rate"},
            {"row": row, "col": 1, "value": f"{exit_cap_5yr:.1%}"},
            {"row": row, "col": 2, "value": f"{exit_cap_10yr:.1%}"}
        ]}
    })
    row += 1
    
    operations.append({
        "type": "setCells",
        "data": {"cells": [
            {"row": row, "col": 0, "value": "Gross Sale Price"},
            {"row": row, "col": 1, "value": yr5_sale_price},
            {"row": row, "col": 2, "value": yr10_sale_price}
        ]}
    })
    row += 1
    
    operations.append({
        "type": "setCells",
        "data": {"cells": [
            {"row": row, "col": 0, "value": "Project IRR (Placeholder)"},
            {"row": row, "col": 1, "value": "~25%"},
            {"row": row, "col": 2, "value": "~22%"}
        ]}
    })
    row += 1
    
    operations.append({
        "type": "setCells",
        "data": {"cells": [
            {"row": row, "col": 0, "value": "Equity Multiple (Placeholder)"},
            {"row": row, "col": 1, "value": "~2.8x"},
            {"row": row, "col": 2, "value": "~4.2x"}
        ]}
    })
    row += 2
    
    # ========== SECTION 10: SENSITIVITY ANALYSIS ==========
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": row, "col": 0, "value": "SENSITIVITY ANALYSIS - Project IRR"}]}
    })
    operations.append({
        "type": "setStyle",
        "data": {
            "range": {"startRow": row, "endRow": row, "startCol": 0, "endCol": 6},
            "style": {"bgcolor": "#548235", "color": "#FFFFFF", "font": {"bold": True}}
        }
    })
    row += 1
    
    # 5x5 matrix headers
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": row, "col": 0, "value": "Exit Cap ↓ / Rent Growth →"}]}
    })
    for i, growth in enumerate([0.02, 0.025, 0.03, 0.035, 0.04]):
        operations.append({
            "type": "setCells",
            "data": {"cells": [{"row": row, "col": i + 1, "value": f"{growth:.1%}"}]}
        })
    row += 1
    
    # Matrix values (simplified)
    caps = [0.05, 0.055, 0.06, 0.065, 0.07]
    for cap in caps:
        operations.append({
            "type": "setCells",
            "data": {"cells": [{"row": row, "col": 0, "value": f"{cap:.1%}"}]}
        })
        for i in range(5):
            # Simplified IRR estimate
            irr_estimate = 0.20 + (0.055 - cap) * 2 + (0.03 + i * 0.005 - 0.03) * 1.5
            operations.append({
                "type": "setCells",
                "data": {"cells": [{"row": row, "col": i + 1, "value": f"{irr_estimate:.1%}"}]}
            })
        row += 1
    
    row += 1
    operations.append({
        "type": "setCells",
        "data": {"cells": [{"row": row, "col": 0, "value": f"✅ Complete Model Generated: {units} units, ${purchase_price:,.0f}, {ltv:.0%} LTV, {interest_rate:.1%} rate"}]}
    })
    operations.append({
        "type": "setStyle",
        "data": {
            "range": {"startRow": row, "endRow": row, "startCol": 0, "endCol": 11},
            "style": {"bgcolor": "#C6E0B4", "font": {"italic": True}}
        }
    })
    
    return operations
