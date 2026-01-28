"""
Google Sheets Updater - Auto-fill underwriting model with parsed OM data
"""
import os
import csv
from pathlib import Path
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SHEET_ID = "2PACX-1vTIMXq7cZzOuS2aIe2s840j81XlrG-I65Lcf0kD7h5L1zVmuOxcMjZ6IIsTnMzwJ1aQ7KaHRwJV_WM3"
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

def load_mapping():
    """Load the underwriting model data mapping CSV"""
    mapping_path = Path(__file__).parent.parent / "client" / "public" / "UNDERWRITE  - Data Mapping.csv"
    mapping = []
    
    with open(mapping_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get('CELL REFERENCE') and row.get('INPUT NAME'):
                mapping.append({
                    'category': row.get('CATEGORY', '').strip(),
                    'cell': row.get('CELL REFERENCE', '').strip(),
                    'input_name': row.get('INPUT NAME', '').strip(),
                    'notes': row.get('NOTES', '').strip()
                })
    
    return mapping


def extract_value_from_scenario(scenario_data, calcs, input_name):
    """
    Extract value from scenarioData and fullCalcs based on input name.
    """
    
    # Deal Structure
    if input_name == "Purchase Price":
        return scenario_data.get('pricing_financing', {}).get('price') or \
               scenario_data.get('pricing_financing', {}).get('purchase_price')
    
    elif input_name == "Down Payment %":
        return scenario_data.get('pricing_financing', {}).get('down_payment_pct', 0) / 100
    
    elif input_name == "Closing Costs %":
        return 0.03  # Default 3% if not in data
    
    elif input_name == "Your Equity":
        return scenario_data.get('pricing_financing', {}).get('down_payment')
    
    elif input_name == "Interest Rate":
        return scenario_data.get('pricing_financing', {}).get('interest_rate', 0) / 100
    
    elif input_name == "Amortization (Years)":
        return scenario_data.get('pricing_financing', {}).get('amortization_years')
    
    elif input_name == "Term (Years)":
        return scenario_data.get('pricing_financing', {}).get('term_years')
    
    elif input_name == "Year Built":
        return scenario_data.get('property', {}).get('year_built')
    
    # Expenses - Year 1
    elif "Real Estate Taxes" in input_name:
        return scenario_data.get('expenses', {}).get('taxes')
    
    elif "Insurance" in input_name:
        return scenario_data.get('expenses', {}).get('insurance')
    
    elif "Repairs & Maintenance" in input_name:
        return scenario_data.get('expenses', {}).get('repairs_maintenance')
    
    elif "Turnover" in input_name:
        return scenario_data.get('expenses', {}).get('repairs_maintenance', 0) * 0.05  # 5% of R&M
    
    elif "G&A + Marketing" in input_name:
        return scenario_data.get('expenses', {}).get('admin', 0) + scenario_data.get('expenses', {}).get('marketing', 0)
    
    elif "Landscaping" in input_name:
        return 0  # Not typically in OM
    
    elif "Reserves" in input_name:
        return 0  # Not typically in OM
    
    # Other Income
    elif "Other Income" in input_name:
        return scenario_data.get('pnl', {}).get('other_income')
    
    # Exit Assumptions
    elif "Exit Cap Rate" in input_name:
        if calcs and calcs.get('returns'):
            return calcs['returns'].get('terminalCapRate', 0) / 100
        return 0.075  # Default 7.5%
    
    # Utilities
    elif "Electric T-12 Annual Cost" in input_name:
        utils = scenario_data.get('expenses', {}).get('utilities', 0)
        return utils * 0.4  # Estimate 40% of utils are electric
    
    elif "Water/Sewer T-12 Annual Cost" in input_name:
        utils = scenario_data.get('expenses', {}).get('utilities', 0)
        return utils * 0.4  # Estimate 40% of utils are water/sewer
    
    elif "Trash T-12 Annual Cost" in input_name:
        utils = scenario_data.get('expenses', {}).get('utilities', 0)
        return utils * 0.2  # Estimate 20% of utils are trash
    
    # Unit Mix - Counts
    elif "Studio - Total Units" in input_name:
        unit_mix = scenario_data.get('unit_mix', [])
        for u in unit_mix:
            if 'studio' in u.get('type', '').lower():
                return u.get('units')
        return 0
    
    elif "1+1 - Total Units" in input_name:
        unit_mix = scenario_data.get('unit_mix', [])
        for u in unit_mix:
            if '1x1' in u.get('type', '').lower() or '1+1' in u.get('type', '').lower():
                return u.get('units')
        return 0
    
    elif "2+1 - Total Units" in input_name:
        unit_mix = scenario_data.get('unit_mix', [])
        for u in unit_mix:
            if '2x1' in u.get('type', '').lower() or '2+1' in u.get('type', '').lower():
                return u.get('units')
        return 0
    
    # Unit Mix - SF
    elif "Studio - Unit SF" in input_name:
        unit_mix = scenario_data.get('unit_mix', [])
        for u in unit_mix:
            if 'studio' in u.get('type', '').lower():
                return u.get('unit_sf')
        return 0
    
    elif "1+1 - Unit SF" in input_name:
        unit_mix = scenario_data.get('unit_mix', [])
        for u in unit_mix:
            if '1x1' in u.get('type', '').lower() or '1+1' in u.get('type', '').lower():
                return u.get('unit_sf')
        return 0
    
    elif "2+1 - Unit SF" in input_name:
        unit_mix = scenario_data.get('unit_mix', [])
        for u in unit_mix:
            if '2x1' in u.get('type', '').lower() or '2+1' in u.get('type', '').lower():
                return u.get('unit_sf')
        return 0
    
    # Unit Mix - Current Rent
    elif "Studio - Current Avg. Rent" in input_name:
        unit_mix = scenario_data.get('unit_mix', [])
        for u in unit_mix:
            if 'studio' in u.get('type', '').lower():
                return u.get('rent_current')
        return 0
    
    elif "1+1 - Current Avg. Rent" in input_name:
        unit_mix = scenario_data.get('unit_mix', [])
        for u in unit_mix:
            if '1x1' in u.get('type', '').lower() or '1+1' in u.get('type', '').lower():
                return u.get('rent_current')
        return 0
    
    elif "2+1 - Current Avg. Rent" in input_name:
        unit_mix = scenario_data.get('unit_mix', [])
        for u in unit_mix:
            if '2x1' in u.get('type', '').lower() or '2+1' in u.get('type', '').lower():
                return u.get('rent_current')
        return 0
    
    # Unit Mix - Market Rent
    elif "Studio - Market Avg. Rent" in input_name:
        unit_mix = scenario_data.get('unit_mix', [])
        for u in unit_mix:
            if 'studio' in u.get('type', '').lower():
                return u.get('rent_market')
        return 0
    
    elif "1+1 - Market Avg. Rent" in input_name:
        unit_mix = scenario_data.get('unit_mix', [])
        for u in unit_mix:
            if '1x1' in u.get('type', '').lower() or '1+1' in u.get('type', '').lower():
                return u.get('rent_market')
        return 0
    
    elif "2+1 - Market Avg. Rent" in input_name:
        unit_mix = scenario_data.get('unit_mix', [])
        for u in unit_mix:
            if '2x1' in u.get('type', '').lower() or '2+1' in u.get('type', '').lower():
                return u.get('rent_market')
        return 0
    
    # Investor Metrics (NEW)
    elif "Total Capital Required" in input_name:
        price = scenario_data.get('pricing_financing', {}).get('price', 0)
        closing_pct = 0.03
        return price * (1 + closing_pct)
    
    elif "Loan Amount" in input_name:
        return scenario_data.get('pricing_financing', {}).get('loan_amount')
    
    elif "LTV" in input_name:
        loan = scenario_data.get('pricing_financing', {}).get('loan_amount', 0)
        price = scenario_data.get('pricing_financing', {}).get('price', 1)
        return (loan / price) if price > 0 else 0
    
    elif "Price Per Unit" in input_name:
        return scenario_data.get('pricing_financing', {}).get('price_per_unit')
    
    elif "Price Per SF" in input_name:
        return scenario_data.get('pricing_financing', {}).get('price_per_sf')
    
    # Property Valuation (NEW)
    elif "Current NOI (Year 1)" in input_name:
        if calcs and calcs.get('year1'):
            return calcs['year1'].get('noi')
        return scenario_data.get('pnl', {}).get('noi')
    
    elif "Stabilized NOI (Year 5)" in input_name:
        return scenario_data.get('pnl', {}).get('noi_stabilized', 0)
    
    elif "Cap Rate (Input)" in input_name:
        return scenario_data.get('pnl', {}).get('cap_rate', 0) / 100
    
    # Income Metrics (NEW)
    elif "Gross Potential Rent (Yr1)" in input_name:
        return scenario_data.get('pnl', {}).get('gross_potential_rent')
    
    elif "Effective Gross Income (Yr1)" in input_name:
        return scenario_data.get('pnl', {}).get('effective_gross_income')
    
    elif "1% Rule" in input_name:
        rent = scenario_data.get('pnl', {}).get('gross_potential_rent', 0)
        price = scenario_data.get('pricing_financing', {}).get('price', 1)
        return (rent / 12) / price if price > 0 else 0
    
    elif "Gross Rent Multiplier" in input_name:
        price = scenario_data.get('pricing_financing', {}).get('price', 0)
        rent = scenario_data.get('pnl', {}).get('gross_potential_rent', 1)
        return price / rent if rent > 0 else 0
    
    # Return Metrics (NEW)
    elif "Cap Rate (Yr1)" in input_name:
        if calcs and calcs.get('year1'):
            return calcs['year1'].get('capRate', 0) / 100
        return scenario_data.get('pnl', {}).get('cap_rate', 0) / 100
    
    elif "Cap Rate (Yr5)" in input_name:
        if calcs and calcs.get('returns'):
            return calcs['returns'].get('terminalCapRate', 0) / 100
        return 0.075
    
    elif "Cash-on-Cash (Yr1)" in input_name:
        if calcs and calcs.get('year1'):
            return calcs['year1'].get('cashOnCash', 0) / 100
        return 0
    
    elif "Yield on Cost" in input_name:
        noi = scenario_data.get('pnl', {}).get('noi', 0)
        cost = scenario_data.get('pricing_financing', {}).get('price', 1)
        return noi / cost if cost > 0 else 0
    
    elif "Equity Multiple" in input_name:
        if calcs and calcs.get('returns'):
            return calcs['returns'].get('leveredEquityMultiple', 0)
        return 0
    
    elif "Your IRR (Est.)" in input_name:
        if calcs and calcs.get('returns'):
            return calcs['returns'].get('leveredIRR', 0) / 100
        return 0
    
    # Debt & Coverage (NEW)
    elif "DSCR (Year 1)" in input_name:
        if calcs and calcs.get('year1'):
            return calcs['year1'].get('dscr', 0)
        return 0
    
    elif "DSCR (Year 5)" in input_name:
        if calcs and calcs.get('returns'):
            return calcs['returns'].get('minDSCR', 0)
        return 0
    
    # Default
    return None


def format_value_for_sheet(value, notes):
    """Format value based on type (%, $, etc.)"""
    if value is None:
        return ""
    
    if isinstance(value, str):
        return value
    
    # Format based on notes field
    if '%' in notes:
        return float(value)  # Sheet will handle % formatting
    elif '$' in notes:
        return float(value)
    elif 'units' in notes.lower() or 'year' in notes.lower():
        return int(value)
    else:
        return float(value)


def update_google_sheet(scenario_data, full_calcs=None):
    """
    Update Google Sheet with parsed OM data using the mapping CSV
    """
    try:
        api_key = os.environ.get('GOOGLE_SHEETS_API_KEY')
        if not api_key:
            return {"error": "Google Sheets API key not configured"}
        
        service = build('sheets', 'v4', developerKey=api_key)
        mapping = load_mapping()
        
        data = []
        for map_entry in mapping:
            cell = map_entry['cell']
            input_name = map_entry['input_name']
            notes = map_entry['notes']
            
            value = extract_value_from_scenario(scenario_data, full_calcs, input_name)
            
            if value is not None:
                formatted_value = format_value_for_sheet(value, notes)
                data.append({
                    'range': f"'{cell}'",
                    'values': [[formatted_value]]
                })
        
        if not data:
            return {"message": "No data to update", "updated_cells": 0}
        
        body = {
            'valueInputOption': 'USER_ENTERED',
            'data': data
        }
        
        result = service.spreadsheets().values().batchUpdate(
            spreadsheetId=SHEET_ID,
            body=body
        ).execute()
        
        return {
            "success": True,
            "updated_cells": result.get('totalUpdatedCells', 0),
            "updated_ranges": len(data)
        }
        
    except HttpError as error:
        return {"error": f"Google Sheets API error: {str(error)}"}
    except Exception as e:
        return {"error": f"Failed to update sheet: {str(e)}"}
