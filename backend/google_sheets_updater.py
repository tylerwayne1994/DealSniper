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
SHEET_TAB_NAME = "Underwriting Model"

def _debug_enabled():
    val = os.getenv("UNDERWRITE_DEBUG", "1")
    return str(val).lower() not in ("0", "false", "")

def _dbg(msg):
    if _debug_enabled():
        print(f"[Underwrite Debug] {msg}")

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
    """Load the underwriting model data mapping CSV.

    Handles files that include a title row and a leading blank column.

    Returns:
        tuple[list[dict], Path]: (mapping rows, selected mapping CSV path)
    """
    base_dir = Path(__file__).parent.parent / "client" / "public"

    # Optional override via env var; supports absolute or base_dir-relative
    override = os.getenv("UNDERWRITE_MAPPING_CSV")
    if override:
        candidate = Path(override)
        if not candidate.is_absolute():
            candidate = base_dir / candidate
        if not candidate.exists():
            raise FileNotFoundError(
                f"UNDERWRITE_MAPPING_CSV points to a missing file: {candidate}"
            )
        mapping_path = candidate
    else:
        # Prefer the explicit (1) copy if present, then double-space, then single-space
        preferred_names = [
            "UNDERWRITE  - Data Mapping (1).csv",
            "UNDERWRITE  - Data Mapping.csv",
            "UNDERWRITE - Data Mapping.csv",
        ]
        mapping_path = None
        for name in preferred_names:
            p = base_dir / name
            if p.exists():
                mapping_path = p
                break

        # Fallback: glob any close match, prefer ones containing (1)
        if mapping_path is None:
            matches = [p for p in base_dir.glob("UNDERWRITE*Data Mapping*.csv") if p.is_file()]
            matches.sort(key=lambda p: ("(1)" not in p.name, p.name))
            if matches:
                mapping_path = matches[0]
            else:
                raise FileNotFoundError(
                    f"Mapping CSV not found. Looked for variants in {base_dir}."
                )

    _dbg(f"Using mapping CSV: {mapping_path}")
    mapping = []
    # Robust read: locate the header row containing CATEGORY/CELL REFERENCE/INPUT NAME
    with open(mapping_path, 'r', encoding='utf-8', newline='') as f:
        rdr = csv.reader(f)
        header_idx = None
        cols = {}
        rows = list(rdr)
        for i, r in enumerate(rows[:20]):  # scan first few rows for header
            lower = [c.strip().lower() for c in r]
            if 'cell reference' in lower and 'input name' in lower:
                header_idx = i
                # Build column index map allowing for optional leading blank column
                for idx, name in enumerate(r):
                    n = name.strip().lower()
                    if n in ('category', 'cell reference', 'input name', 'notes'):
                        cols[n] = idx
                break
        if header_idx is None:
            _dbg("Failed to locate header row in mapping CSV")
            return [], mapping_path
        for r in rows[header_idx + 1:]:
            if not r or all(not (c or '').strip() for c in r):
                continue
            cat = (r[cols.get('category', 0)] if len(r) > cols.get('category', 0) else '').strip()
            cell = (r[cols.get('cell reference', 0)] if len(r) > cols.get('cell reference', 0) else '').strip()
            inp = (r[cols.get('input name', 0)] if len(r) > cols.get('input name', 0) else '').strip()
            notes = (r[cols.get('notes', 0)] if len(r) > cols.get('notes', 0) else '').strip()
            if cell and inp:
                mapping.append({'category': cat, 'cell': cell, 'input_name': inp, 'notes': notes})

    _dbg(f"Parsed mapping rows: {len(mapping)}")
    return mapping, mapping_path


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
        pf = scenario_data.get('pricing_financing', {})
        return pf.get('loan_term_years') or pf.get('term_years') or calcs.get('financing', {}).get('loanTermYears') or 30
    
    elif input_name == "Amortization (Years)":
        return scenario_data.get('pricing_financing', {}).get('amortization_years', 30)

    elif input_name == "IO Period (Years)":
        return (scenario_data.get('financing', {}).get('io_years')
                or scenario_data.get('pricing_financing', {}).get('io_period_years')
                or 0)

    # Expenses
    elif input_name == "Property Tax":
        return (scenario_data.get('expenses', {}).get('taxes')
                or scenario_data.get('operating_data', {}).get('property_taxes'))
    
    elif input_name == "Insurance":
        return (scenario_data.get('expenses', {}).get('insurance')
                or scenario_data.get('operating_data', {}).get('insurance'))
    
    elif input_name == "Utilities":
        return (scenario_data.get('expenses', {}).get('utilities')
                or scenario_data.get('operating_data', {}).get('utilities'))
    
    elif input_name == "Repairs & Maintenance":
        return (scenario_data.get('expenses', {}).get('repairs_maintenance')
                or scenario_data.get('operating_data', {}).get('repairs_and_maintenance'))
    
    elif input_name == "Landscaping":
        return scenario_data.get('operating_data', {}).get('landscaping')
    
    elif input_name == "HOA Fees":
        return scenario_data.get('operating_data', {}).get('hoa_fees')
    
    elif input_name == "Property Management %":
        # Prefer computed percent from expenses.management / EGI
        mgmt_amt = scenario_data.get('expenses', {}).get('management')
        egi = scenario_data.get('pnl', {}).get('effective_gross_income') or calcs.get('year1', {}).get('effectiveGrossIncome')
        if mgmt_amt and egi:
            return mgmt_amt / egi
        mgmt_pct = scenario_data.get('operating_data', {}).get('management_fee_pct')
        return (mgmt_pct / 100) if mgmt_pct and mgmt_pct > 1 else mgmt_pct
    
    elif input_name == "Vacancy %":
        vac = (scenario_data.get('pnl', {}).get('vacancy_rate')
               or scenario_data.get('pnl', {}).get('vacancy_rate_current')
               or scenario_data.get('pnl', {}).get('vacancy_rate_stabilized')
               or scenario_data.get('operating_data', {}).get('vacancy_pct'))
        return (vac / 100) if vac and vac > 1 else vac
    
    elif input_name == "CapEx Reserve %":
        capex_pct = scenario_data.get('operating_data', {}).get('capex_reserve_pct')
        return (capex_pct / 100) if capex_pct and capex_pct > 1 else capex_pct

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
            return unit_mix[idx].get('count') or unit_mix[idx].get('units')
    
    elif input_name.startswith("Rent per Unit "):
        idx = int(input_name.split(" ")[-1]) - 1
        unit_mix = scenario_data.get('unit_mix', [])
        if idx < len(unit_mix):
            return unit_mix[idx].get('rent') or unit_mix[idx].get('rent_current') or unit_mix[idx].get('rent_market')

    # Investor Metrics
    elif input_name == "Cash-on-Cash Return":
        return (calcs.get('cash_on_cash_return')
                or calcs.get('returns', {}).get('avgCashOnCash')
                or calcs.get('year1', {}).get('cashOnCash'))
    
    elif input_name == "Cap Rate":
        return (calcs.get('cap_rate')
                or calcs.get('year1', {}).get('capRate')
                or scenario_data.get('pnl', {}).get('cap_rate'))
    
    elif input_name == "Gross Yield":
        return calcs.get('gross_yield')
    
    elif input_name == "Net Yield":
        return calcs.get('net_yield')
    
    elif input_name == "Equity Multiple (10 Years)":
        em = calcs.get('equity_multiple_10y')
        if em is not None:
            return em
        exits = calcs.get('returns', {}).get('exitScenarios', [])
        for s in exits:
            if s.get('exitYear') == 10:
                return s.get('equityMultiple')
        return calcs.get('returns', {}).get('leveredEquityMultiple')
    
    elif input_name == "IRR (10 Years)":
        irr = calcs.get('irr_10y')
        if irr is not None:
            return irr
        exits = calcs.get('returns', {}).get('exitScenarios', [])
        for s in exits:
            if s.get('exitYear') == 10:
                return s.get('irr')
        return calcs.get('returns', {}).get('leveredIRR')

    # Property Valuation
    elif input_name == "Gross Annual Income":
        return (calcs.get('gross_annual_income')
                or calcs.get('year1', {}).get('potentialGrossIncome')
                or scenario_data.get('pnl', {}).get('potential_gross_income'))
    
    elif input_name == "Net Operating Income (NOI)":
        return (calcs.get('noi')
                or calcs.get('year1', {}).get('noi')
                or scenario_data.get('pnl', {}).get('noi'))
    
    elif input_name == "Appraised Value":
        return scenario_data.get('property_details', {}).get('appraised_value')
    
    elif input_name == "Market Value (Cap Rate)":
        mv = calcs.get('market_value_cap_rate')
        if mv is not None:
            return mv
        noi = (calcs.get('year1', {}).get('noi') or scenario_data.get('pnl', {}).get('noi'))
        mcap = calcs.get('returns', {}).get('marketCapRateY1') or scenario_data.get('pnl', {}).get('cap_rate')
        if noi and mcap:
            # mcap may be percent (e.g., 7.25) or decimal
            rate = (mcap/100) if mcap > 1 else mcap
            return round(noi / rate, 2)
        return None
    
    elif input_name == "Equity at Purchase":
        return calcs.get('equity_at_purchase')

    # Return Metrics
    elif input_name == "Monthly Cash Flow":
        cf_annual = (calcs.get('annual_cash_flow') or calcs.get('year1', {}).get('cashFlow'))
        if cf_annual is not None:
            return round(cf_annual / 12, 2)
        return calcs.get('monthly_cash_flow')
    
    elif input_name == "Annual Cash Flow":
        return (calcs.get('annual_cash_flow') or calcs.get('year1', {}).get('cashFlow'))
    
    elif input_name == "Total Gain (10 Years)":
        gain = calcs.get('total_gain_10y')
        if gain is not None:
            return gain
        exits = calcs.get('returns', {}).get('exitScenarios', [])
        for s in exits:
            if s.get('exitYear') == 10:
                return s.get('totalProfit')
        return None
    
    elif input_name == "Total Return %":
        tr = calcs.get('total_return_pct')
        if tr is not None:
            return tr
        exits = calcs.get('returns', {}).get('exitScenarios', [])
        for s in exits:
            if s.get('exitYear') == 10 and s.get('equityMultiple') is not None:
                em = s.get('equityMultiple')
                return (em - 1) if em is not None else None
        return None
    
    elif input_name == "Average Annual Return %":
        return calcs.get('avg_annual_return_pct')
    
    elif input_name == "Breakeven Year":
        return calcs.get('breakeven_year')
    
    elif input_name == "Payback Period":
        return calcs.get('payback_period')

    # Debt & Coverage
    elif input_name == "Monthly Debt Service":
        return (calcs.get('monthly_debt_service')
                or calcs.get('financing', {}).get('monthlyPayment'))
    
    elif input_name == "DSCR (Debt Service Coverage Ratio)":
        return (calcs.get('dscr') or calcs.get('year1', {}).get('dscr'))
    
    elif input_name == "LTV (Loan-to-Value)":
        return (calcs.get('ltv') or calcs.get('financing', {}).get('ltv')
                or scenario_data.get('pricing_financing', {}).get('ltv'))

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
        _dbg("Starting sheet update")
        # Get service account credentials
        credentials = get_credentials()
        
        # Build Google Sheets API service
        service = build('sheets', 'v4', credentials=credentials)
        
        # Load mapping
        mapping, mapping_path = load_mapping()
        _dbg(f"Loaded {len(mapping)} mapping rows; sheet: {SHEET_ID} tab: {SHEET_TAB_NAME}")
        
        # Prepare batch update data
        updates = []
        values_by_input = {}
        missing_inputs = []
        for item in mapping:
            cell = item['cell']
            input_name = item['input_name']
            
            # Extract value from scenario data
            value = extract_value_from_scenario(scenario_data, full_calcs, input_name)
            
            if value is not None:
                values_by_input[input_name] = value
                updates.append({
                    'range': f"'{SHEET_TAB_NAME}'!{cell}",
                    'values': [[value]]
                })
            else:
                missing_inputs.append(input_name)

        _dbg(f"Prepared {len(updates)} updates; missing {len(missing_inputs)} inputs")
        if missing_inputs:
            _dbg("Missing INPUT NAMEs (first 25): " + ", ".join(missing_inputs[:25]))

        # Write a filled copy of the mapping CSV with a VALUE column for transparency/debug
        try:
            base_dir = mapping_path.parent
            out_path = base_dir / f"{mapping_path.stem} - filled{mapping_path.suffix}"
            with open(out_path, 'w', encoding='utf-8', newline='') as dst:
                fieldnames = ['CATEGORY', 'CELL REFERENCE', 'INPUT NAME', 'VALUE', 'NOTES']
                writer = csv.DictWriter(dst, fieldnames=fieldnames)
                writer.writeheader()
                for item in mapping:
                    writer.writerow({
                        'CATEGORY': item.get('category', ''),
                        'CELL REFERENCE': item.get('cell', ''),
                        'INPUT NAME': item.get('input_name', ''),
                        'VALUE': values_by_input.get(item.get('input_name', '')),
                        'NOTES': item.get('notes', ''),
                    })
            _dbg(f"Wrote filled CSV to {out_path}")
        except Exception as e:
            # Do not fail sheet update if writing the filled CSV fails
            print(f"Warning: failed to write filled mapping CSV: {e}")

        # Also write a debug JSON with values and missing inputs
        try:
            debug_json_path = mapping_path.parent / f"{mapping_path.stem} - debug.json"
            with open(debug_json_path, 'w', encoding='utf-8') as dj:
                json.dump({
                    'sheetId': SHEET_ID,
                    'sheetTab': SHEET_TAB_NAME,
                    'mappingCsv': str(mapping_path),
                    'totalMappingRows': len(mapping),
                    'totalUpdates': len(updates),
                    'missingInputs': missing_inputs,
                    'valuesByInput': values_by_input,
                    'scenarioKeys': list(scenario_data.keys()),
                    'calcsKeys': list(full_calcs.keys()),
                }, dj, indent=2)
            _dbg(f"Wrote debug JSON to {debug_json_path}")
        except Exception as e:
            print(f"Warning: failed to write debug JSON: {e}")
        
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
            
            _dbg(f"Google response totalUpdatedCells={result.get('totalUpdatedCells')}")
            return {
                'success': True,
                'message': f'Updated {result.get("totalUpdatedCells")} cells',
                'updates': result.get("totalUpdatedCells")
            }
        else:
            _dbg("No data to update: all extracted values were None")
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
