"""
Google Sheets Updater - Auto-fill underwriting model with parsed OM data
Uses Service Account authentication for write access
"""
import os
import json
import csv
from pathlib import Path
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SHEET_ID = "1jZSrAJY_gIu7Rqcmdmg-cdvQc88aC6YyVwhTQ1-dwi0"
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

def get_credentials():
    """
    Load service account credentials from environment variable or file.
    Priority: 1) GOOGLE_SERVICE_ACCOUNT_JSON env var, 2) .google_service_account.json file
    """
    # Try environment variable first (for production)
    json_str = os.getenv('GOOGLE_SERVICE_ACCOUNT_JSON')
    if json_str:
        try:
            service_account_info = json.loads(json_str)
            credentials = service_account.Credentials.from_service_account_info(
                service_account_info, scopes=SCOPES
            )
            return credentials
        except Exception as e:
            print(f"Error loading credentials from environment: {e}")
    
    # Fall back to file (for local development)
    creds_file = Path(__file__).parent / ".google_service_account.json"
    if creds_file.exists():
        credentials = service_account.Credentials.from_service_account_file(
            str(creds_file), scopes=SCOPES
        )
        return credentials
    
    raise FileNotFoundError(
        "Google Service Account credentials not found. "
        "Set GOOGLE_SERVICE_ACCOUNT_JSON environment variable or create .google_service_account.json"
    )


def load_mapping():
    """Load the underwriting model data mapping CSV"""
    mapping_path = Path(__file__).parent.parent / "client" / "public" / "UNDERWRITE - Data Mapping.csv"
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
    Maps OM parsed data to Google Sheets underwriting model fields.
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
    
    elif input_name == "Loan Amount":
        return scenario_data.get('pricing_financing', {}).get('loan_amount')
    
    elif input_name == "Interest Rate %":
        rate = scenario_data.get('pricing_financing', {}).get('interest_rate')
        return rate / 100 if rate and rate > 1 else rate
    
    elif input_name == "Loan Term (Years)":
        return scenario_data.get('pricing_financing', {}).get('loan_term_years', 30)
    
    elif input_name == "Amortization (Years)":
        return scenario_data.get('pricing_financing', {}).get('amortization_years', 30)

    # Expenses
    elif input_name == "Property Tax":
        return scenario_data.get('operating_data', {}).get('property_taxes')
    
    elif input_name == "Insurance":
        return scenario_data.get('operating_data', {}).get('insurance')
    
    elif input_name == "Utilities":
        return scenario_data.get('operating_data', {}).get('utilities')
    
    elif input_name == "Repairs & Maintenance":
        return scenario_data.get('operating_data', {}).get('repairs_and_maintenance')
    
    elif input_name == "Landscaping":
        return scenario_data.get('operating_data', {}).get('landscaping')
    
    elif input_name == "HOA Fees":
        return scenario_data.get('operating_data', {}).get('hoa_fees')
    
    elif input_name == "Property Management %":
        mgmt_pct = scenario_data.get('operating_data', {}).get('management_fee_pct')
        return mgmt_pct / 100 if mgmt_pct and mgmt_pct > 1 else mgmt_pct
    
    elif input_name == "Vacancy %":
        vac_pct = scenario_data.get('operating_data', {}).get('vacancy_pct')
        return vac_pct / 100 if vac_pct and vac_pct > 1 else vac_pct
    
    elif input_name == "CapEx Reserve %":
        capex_pct = scenario_data.get('operating_data', {}).get('capex_reserve_pct')
        return capex_pct / 100 if capex_pct and capex_pct > 1 else capex_pct

    # Unit Mix
    elif input_name.startswith("Unit Type "):
        idx = int(input_name.split(" ")[-1]) - 1  # "Unit Type 1" -> index 0
        unit_mix = scenario_data.get('unit_mix', [])
        if idx < len(unit_mix):
            return unit_mix[idx].get('type')
    
    elif input_name.startswith("Number of Units "):
        idx = int(input_name.split(" ")[-1]) - 1
        unit_mix = scenario_data.get('unit_mix', [])
        if idx < len(unit_mix):
            return unit_mix[idx].get('count')
    
    elif input_name.startswith("Rent per Unit "):
        idx = int(input_name.split(" ")[-1]) - 1
        unit_mix = scenario_data.get('unit_mix', [])
        if idx < len(unit_mix):
            return unit_mix[idx].get('rent')

    # Investor Metrics
    elif input_name == "Cash-on-Cash Return":
        return calcs.get('cash_on_cash_return')
    
    elif input_name == "Cap Rate":
        return calcs.get('cap_rate')
    
    elif input_name == "Gross Yield":
        return calcs.get('gross_yield')
    
    elif input_name == "Net Yield":
        return calcs.get('net_yield')
    
    elif input_name == "Equity Multiple (10 Years)":
        return calcs.get('equity_multiple_10y')
    
    elif input_name == "IRR (10 Years)":
        return calcs.get('irr_10y')

    # Property Valuation
    elif input_name == "Gross Annual Income":
        return calcs.get('gross_annual_income')
    
    elif input_name == "Net Operating Income (NOI)":
        return calcs.get('noi')
    
    elif input_name == "Appraised Value":
        return scenario_data.get('property_details', {}).get('appraised_value')
    
    elif input_name == "Market Value (Cap Rate)":
        return calcs.get('market_value_cap_rate')
    
    elif input_name == "Equity at Purchase":
        return calcs.get('equity_at_purchase')

    # Return Metrics
    elif input_name == "Monthly Cash Flow":
        return calcs.get('monthly_cash_flow')
    
    elif input_name == "Annual Cash Flow":
        return calcs.get('annual_cash_flow')
    
    elif input_name == "Total Gain (10 Years)":
        return calcs.get('total_gain_10y')
    
    elif input_name == "Total Return %":
        return calcs.get('total_return_pct')
    
    elif input_name == "Average Annual Return %":
        return calcs.get('avg_annual_return_pct')
    
    elif input_name == "Breakeven Year":
        return calcs.get('breakeven_year')
    
    elif input_name == "Payback Period":
        return calcs.get('payback_period')

    # Debt & Coverage
    elif input_name == "Monthly Debt Service":
        return calcs.get('monthly_debt_service')
    
    elif input_name == "DSCR (Debt Service Coverage Ratio)":
        return calcs.get('dscr')
    
    elif input_name == "LTV (Loan-to-Value)":
        return calcs.get('ltv')

    return None


def update_google_sheet(scenario_data, full_calcs):
    """
    Update Google Sheet with parsed data using Service Account authentication.
    
    Args:
        scenario_data: Parsed OM data from underwriting
        full_calcs: Calculated financial metrics
    
    Returns:
        dict: Success/error message
    """
    try:
        # Get service account credentials
        credentials = get_credentials()
        
        # Build Google Sheets API service
        service = build('sheets', 'v4', credentials=credentials)
        
        # Load mapping
        mapping = load_mapping()
        
        # Prepare batch update data
        updates = []
        for item in mapping:
            cell = item['cell']
            input_name = item['input_name']
            
            # Extract value from scenario data
            value = extract_value_from_scenario(scenario_data, full_calcs, input_name)
            
            if value is not None:
                updates.append({
                    'range': f'Sheet1!{cell}',  # Adjust sheet name if needed
                    'values': [[value]]
                })
        
        # Execute batch update
        if updates:
            body = {
                'valueInputOption': 'USER_ENTERED',
                'data': updates
            }
            result = service.spreadsheets().values().batchUpdate(
                spreadsheetId=SHEET_ID,
                body=body
            ).execute()
            
            return {
                'success': True,
                'message': f'Updated {result.get("totalUpdatedCells")} cells',
                'updates': result.get("totalUpdatedCells")
            }
        else:
            return {
                'success': False,
                'message': 'No data to update'
            }
    
    except HttpError as error:
        return {
            'success': False,
            'message': f'Google Sheets API error: {error}'
        }
    except Exception as error:
        return {
            'success': False,
            'message': f'Error updating sheet: {error}'
        }
