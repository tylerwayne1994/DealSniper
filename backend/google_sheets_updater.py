"""
Google Sheets Updater - Auto-fill underwriting model with parsed OM data
"""
import os
import csv
from pathlib import Path
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SHEET_ID = "1jZSrAJY_gIu7Rqcmdmg-cdvQc88aC6YyVwhTQ1-dwi0"
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

# Load mapping CSV
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


def extract_value_from_scenario(scenario_data, input_name):
    """
    Extract value from scenarioData based on input name.
    Maps common OM fields to the underwriting model inputs.
    """
    
    # Deal Structure mappings
    if input_name == "Purchase Price":
        return scenario_data.get('property', {}).get('asking_price') or \
               scenario_data.get('property', {}).get('purchase_price')
    
    elif input_name == "Down Payment %":
        financing = scenario_data.get('financing', {})
        if financing.get('down_payment_pct'):
            return financing['down_payment_pct']
        elif financing.get('loan_amount') and financing.get('purchase_price'):
            loan = financing['loan_amount']
            price = financing['purchase_price']
            return (price - loan) / price if price > 0 else None
    
    elif input_name == "Closing Costs %":
        return scenario_data.get('financing', {}).get('closing_costs_pct')
    
    elif input_name == "Interest Rate":
        return scenario_data.get('financing', {}).get('interest_rate')
    
    elif input_name == "Amortization (Years)":
        return scenario_data.get('financing', {}).get('amortization_years')
    
    elif input_name == "Term (Years)":
        return scenario_data.get('financing', {}).get('term_years')
    
    elif input_name == "Year Built":
        return scenario_data.get('property', {}).get('year_built')
    
    # Expenses - Year 1
    elif "Real Estate Taxes" in input_name:
        return scenario_data.get('expenses', {}).get('property_taxes')
    
    elif "Insurance" in input_name:
        return scenario_data.get('expenses', {}).get('insurance')
    
    elif "Repairs & Maintenance" in input_name:
        return scenario_data.get('expenses', {}).get('repairs_maintenance')
    
    elif "Turnover" in input_name:
        return scenario_data.get('expenses', {}).get('turnover')
    
    elif "G&A + Marketing" in input_name:
        return scenario_data.get('expenses', {}).get('administrative') or \
               scenario_data.get('expenses', {}).get('management')
    
    elif "Landscaping" in input_name:
        return scenario_data.get('expenses', {}).get('landscaping')
    
    elif "Reserves" in input_name:
        return scenario_data.get('expenses', {}).get('reserves')
    
    # Other Income
    elif "Other Income" in input_name:
        return scenario_data.get('income', {}).get('other_income')
    
    # Exit Assumptions
    elif "Exit Cap Rate" in input_name:
        return scenario_data.get('exit', {}).get('exit_cap_rate')
    
    # Utilities
    elif "Electric T-12 Annual Cost" in input_name:
        return scenario_data.get('expenses', {}).get('electric')
    
    elif "Water/Sewer T-12 Annual Cost" in input_name:
        return scenario_data.get('expenses', {}).get('water_sewer')
    
    elif "Trash T-12 Annual Cost" in input_name:
        return scenario_data.get('expenses', {}).get('trash')
    
    # Unit Mix - extract from unit_mix array
    elif "Studio - Total Units" in input_name:
        unit_mix = scenario_data.get('unit_mix', [])
        studio = next((u for u in unit_mix if 'studio' in u.get('unit_type', '').lower()), None)
        return studio.get('units') if studio else None
    
    elif "1+1 - Total Units" in input_name:
        unit_mix = scenario_data.get('unit_mix', [])
        one_bed = next((u for u in unit_mix if '1' in u.get('unit_type', '') and 'bed' in u.get('unit_type', '').lower()), None)
        return one_bed.get('units') if one_bed else None
    
    elif "2+1 - Total Units" in input_name:
        unit_mix = scenario_data.get('unit_mix', [])
        two_bed = next((u for u in unit_mix if '2' in u.get('unit_type', '') and 'bed' in u.get('unit_type', '').lower()), None)
        return two_bed.get('units') if two_bed else None
    
    elif "Studio - Unit SF" in input_name:
        unit_mix = scenario_data.get('unit_mix', [])
        studio = next((u for u in unit_mix if 'studio' in u.get('unit_type', '').lower()), None)
        return studio.get('unit_sf') if studio else None
    
    elif "1+1 - Unit SF" in input_name:
        unit_mix = scenario_data.get('unit_mix', [])
        one_bed = next((u for u in unit_mix if '1' in u.get('unit_type', '') and 'bed' in u.get('unit_type', '').lower()), None)
        return one_bed.get('unit_sf') if one_bed else None
    
    elif "2+1 - Unit SF" in input_name:
        unit_mix = scenario_data.get('unit_mix', [])
        two_bed = next((u for u in unit_mix if '2' in u.get('unit_type', '') and 'bed' in u.get('unit_type', '').lower()), None)
        return two_bed.get('unit_sf') if two_bed else None
    
    elif "Studio - Current Avg. Rent" in input_name:
        unit_mix = scenario_data.get('unit_mix', [])
        studio = next((u for u in unit_mix if 'studio' in u.get('unit_type', '').lower()), None)
        return studio.get('rent_current') if studio else None
    
    elif "1+1 - Current Avg. Rent" in input_name:
        unit_mix = scenario_data.get('unit_mix', [])
        one_bed = next((u for u in unit_mix if '1' in u.get('unit_type', '') and 'bed' in u.get('unit_type', '').lower()), None)
        return one_bed.get('rent_current') if one_bed else None
    
    elif "2+1 - Current Avg. Rent" in input_name:
        unit_mix = scenario_data.get('unit_mix', [])
        two_bed = next((u for u in unit_mix if '2' in u.get('unit_type', '') and 'bed' in u.get('unit_type', '').lower()), None)
        return two_bed.get('rent_current') if two_bed else None
    
    elif "Studio - Market Avg. Rent" in input_name:
        unit_mix = scenario_data.get('unit_mix', [])
        studio = next((u for u in unit_mix if 'studio' in u.get('unit_type', '').lower()), None)
        return studio.get('rent_market') if studio else None
    
    elif "1+1 - Market Avg. Rent" in input_name:
        unit_mix = scenario_data.get('unit_mix', [])
        one_bed = next((u for u in unit_mix if '1' in u.get('unit_type', '') and 'bed' in u.get('unit_type', '').lower()), None)
        return one_bed.get('rent_market') if one_bed else None
    
    elif "2+1 - Market Avg. Rent" in input_name:
        unit_mix = scenario_data.get('unit_mix', [])
        two_bed = next((u for u in unit_mix if '2' in u.get('unit_type', '') and 'bed' in u.get('unit_type', '').lower()), None)
        return two_bed.get('rent_market') if two_bed else None
    
    # Default: return None if not mapped
    return None


def format_value_for_sheet(value, notes):
    """Format value based on type (%, $, etc.)"""
    if value is None:
        return ""
    
    # If it's already a string representation, return as-is
    if isinstance(value, str):
        return value
    
    # Format based on notes field
    if '%' in notes:
        # Convert to percentage (0.25 -> 0.25, not 25%)
        return float(value)
    elif '$' in notes:
        # Keep as number for currency
        return float(value)
    elif 'units' in notes.lower() or 'year' in notes.lower():
        # Keep as integer
        return int(value)
    else:
        # Default to float
        return float(value)


def update_google_sheet(scenario_data):
    """
    Update Google Sheet with parsed OM data using the mapping CSV
    """
    try:
        # Get Google Sheets API credentials from environment
        api_key = os.environ.get('GOOGLE_SHEETS_API_KEY')
        if not api_key:
            return {"error": "Google Sheets API key not configured"}
        
        # Build service with API key (simpler than service account)
        service = build('sheets', 'v4', developerKey=api_key)
        
        # Load mapping
        mapping = load_mapping()
        
        # Prepare batch update data
        data = []
        for map_entry in mapping:
            cell = map_entry['cell']
            input_name = map_entry['input_name']
            notes = map_entry['notes']
            
            # Extract value from scenario data
            value = extract_value_from_scenario(scenario_data, input_name)
            
            if value is not None:
                formatted_value = format_value_for_sheet(value, notes)
                data.append({
                    'range': f"'Underwriting Model'!{cell}",
                    'values': [[formatted_value]]
                })
        
        if not data:
            return {"message": "No data to update", "updated_cells": 0}
        
        # Batch update the sheet
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
