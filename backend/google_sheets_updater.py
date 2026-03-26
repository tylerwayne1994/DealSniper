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
SHEET_TAB_NAME = "Model"

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
    backend_dir = Path(__file__).parent
    search_dirs = [
        backend_dir,                                     # backend/ (where code lives)
        backend_dir.parent / "client" / "public",        # legacy path
    ]

    # Optional override via env var; supports absolute or base_dir-relative
    override = os.getenv("UNDERWRITE_MAPPING_CSV")
    if override:
        candidate = Path(override)
        if not candidate.is_absolute():
            candidate = backend_dir / candidate
        if not candidate.exists():
            raise FileNotFoundError(
                f"UNDERWRITE_MAPPING_CSV points to a missing file: {candidate}"
            )
        mapping_path = candidate
    else:
        preferred_names = [
            "UNDERWRITE  - Data Mapping (1).csv",
            "UNDERWRITE  - Data Mapping.csv",
            "UNDERWRITE - Data Mapping.csv",
        ]
        mapping_path = None
        for d in search_dirs:
            if mapping_path:
                break
            for name in preferred_names:
                p = d / name
                if p.exists():
                    mapping_path = p
                    break

        # Fallback: glob any close match in each search dir
        if mapping_path is None:
            for d in search_dirs:
                matches = [p for p in d.glob("UNDERWRITE*Data Mapping*.csv") if p.is_file()]
                matches.sort(key=lambda p: ("(1)" not in p.name, p.name))
                if matches:
                    mapping_path = matches[0]
                    break

        if mapping_path is None:
            searched = ", ".join(str(d) for d in search_dirs)
            raise FileNotFoundError(
                f"Mapping CSV not found. Looked for variants in: {searched}"
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
    Maps parsed OM data to the Google Sheets underwriting model cells.
    Cell references match the 'Model' tab in the Underwriting Model spreadsheet.
    """
    sd = scenario_data
    prop = sd.get('property', {})
    pf = sd.get('pricing_financing', {})
    fin = sd.get('financing', {})
    pnl = sd.get('pnl', {})
    exp = sd.get('expenses', {})
    uw = sd.get('underwriting', {})
    va = sd.get('value_add', {})
    unit_mix = sd.get('unit_mix', [])
    util_bk = exp.get('utility_breakdown', {})

    # ── Property Info ──
    if input_name == "Property Name":
        return prop.get('address') or sd.get('property_name') or prop.get('name')

    elif input_name == "Total Units":
        return prop.get('units') or prop.get('total_units')

    elif input_name == "Total Square Feet":
        return prop.get('net_rentable_sf') or prop.get('rba_sqft')

    elif input_name == "Purchase Price":
        return pf.get('price') or pf.get('purchase_price')

    elif input_name == "Year Built":
        return prop.get('year_built')

    # ── Assumptions ──
    elif input_name == "Closing Costs":
        pct = pf.get('closing_costs_percent', 2)
        price = pf.get('price') or pf.get('purchase_price')
        if price and pct:
            return round(price * pct / 100, 2)
        return calcs.get('acquisition', {}).get('closingCosts')

    elif input_name == "Due Diligence Budget":
        return pf.get('due_diligence') or sd.get('due_diligence_budget')

    elif input_name == "CapEx Budget":
        return pf.get('upfront_capex') or va.get('renovation_cost')

    elif input_name == "Annual Rent Growth %":
        rate = uw.get('income_growth_rate')
        if rate is not None:
            return rate if rate < 1 else rate / 100
        return 0.02

    elif input_name == "Annual Expense Growth %":
        rate = uw.get('expense_growth_rate')
        if rate is not None:
            return rate if rate < 1 else rate / 100
        return 0.03

    elif input_name == "Vacancy %":
        vac = (pnl.get('vacancy_rate') or pnl.get('vacancy_rate_current')
               or pnl.get('vacancy_rate_stabilized'))
        if vac is not None:
            return vac / 100 if vac > 1 else vac
        return 0.05

    elif input_name == "Bad Debt %":
        bd = pnl.get('bad_debt_pct') or sd.get('bad_debt_pct')
        if bd is not None:
            return bd / 100 if bd > 1 else bd
        return None

    elif input_name == "Management Fee %":
        mgmt_amt = exp.get('management')
        egi = pnl.get('effective_gross_income') or calcs.get('year1', {}).get('effectiveGrossIncome')
        if mgmt_amt and egi and egi > 0:
            return round(mgmt_amt / egi, 4)
        mgmt_pct = sd.get('operating_data', {}).get('management_fee_pct')
        if mgmt_pct is not None:
            return mgmt_pct / 100 if mgmt_pct > 1 else mgmt_pct
        return None

    elif input_name == "Exit Cap Rate 5-Year":
        ec = uw.get('exit_cap_rate') or fin.get('exit_cap_rate')
        if ec is not None:
            return ec / 100 if ec > 1 else ec
        return None

    elif input_name == "Exit Cap Rate 10-Year":
        ec = uw.get('exit_cap_rate') or fin.get('exit_cap_rate')
        if ec is not None:
            val = ec / 100 if ec > 1 else ec
            return val + 0.005  # 50bp higher for 10-yr
        return None

    elif input_name == "Selling Costs %":
        ed = sd.get('exit_details', {})
        closing = ed.get('closingPct', 2)
        broker = ed.get('brokerPct', 2)
        return (closing + broker) / 100

    elif input_name == "CapEx Reserve $/Unit/Year":
        return sd.get('operating_data', {}).get('capex_reserve_per_unit')

    # ── Revenue ──
    elif input_name == "Gross Potential Rent (Annual)":
        gpr = pnl.get('gross_potential_rent') or pnl.get('potential_gross_income')
        if gpr:
            return gpr
        # Compute from unit mix
        total_monthly = 0
        for u in unit_mix:
            cnt = u.get('units', 0)
            rent = u.get('rent_current') or u.get('rent_market') or u.get('proforma_rent', 0)
            total_monthly += cnt * rent
        return total_monthly * 12 if total_monthly > 0 else None

    elif input_name == "Loss to Lease (Annual)":
        ltl = pnl.get('loss_to_lease')
        if ltl:
            return ltl
        # Compute from unit mix
        total_monthly = 0
        for u in unit_mix:
            cnt = u.get('units', 0)
            market = u.get('rent_market', 0)
            current = u.get('rent_current', 0)
            if market and current:
                total_monthly += cnt * max(0, market - current)
        return total_monthly * 12 if total_monthly > 0 else None

    elif input_name == "Laundry Income":
        return sd.get('other_income_details', {}).get('laundry')

    elif input_name == "Parking Income":
        return sd.get('other_income_details', {}).get('parking')

    elif input_name == "Pet Income":
        return sd.get('other_income_details', {}).get('pet')

    elif input_name in ("Other Income 1", "Other Income 2", "Other Income 3"):
        return None  # Mapped if user has specific line items

    # ── Expenses (annual amounts → written to C column as $/unit/mo) ──
    elif input_name == "Real Estate Taxes":
        return exp.get('taxes') or sd.get('operating_data', {}).get('property_taxes')

    elif input_name == "Property Insurance":
        return exp.get('insurance') or sd.get('operating_data', {}).get('insurance')

    elif input_name == "Water/Sewer":
        return util_bk.get('water_sewer') or exp.get('water_sewer')

    elif input_name == "Electric (Common)":
        return util_bk.get('electric') or exp.get('electric')

    elif input_name == "Gas":
        return util_bk.get('gas') or exp.get('gas')

    elif input_name == "Trash Removal":
        return util_bk.get('trash') or exp.get('trash')

    elif input_name == "Repairs & Maintenance":
        return exp.get('repairs_maintenance') or sd.get('operating_data', {}).get('repairs_and_maintenance')

    elif input_name == "Landscaping":
        return exp.get('landscaping') or sd.get('operating_data', {}).get('landscaping')

    elif input_name == "Pest Control":
        return exp.get('pest_control')

    elif input_name == "Snow Removal":
        return exp.get('snow_removal')

    elif input_name == "Unit Turnover":
        return exp.get('turnover') or exp.get('unit_turnover')

    elif input_name == "On-Site Payroll":
        return exp.get('payroll')

    elif input_name == "Marketing/Advertising":
        return exp.get('marketing')

    elif input_name == "Legal & Professional":
        return exp.get('legal') or exp.get('legal_professional')

    elif input_name == "Accounting":
        return exp.get('accounting')

    elif input_name == "Administrative":
        return exp.get('admin') or exp.get('administrative')

    elif input_name == "Security":
        return exp.get('security')

    elif input_name == "Cable/Internet":
        return exp.get('cable_internet') or exp.get('cable')

    # ── Unit Mix (rows 18-23 in the Model sheet) ──
    elif input_name.startswith("Unit Number "):
        idx = int(input_name.split(" ")[-1]) - 1
        if idx < len(unit_mix):
            return unit_mix[idx].get('units') or unit_mix[idx].get('count')

    elif input_name.startswith("Unit Type "):
        idx = int(input_name.split(" ")[-1]) - 1
        if idx < len(unit_mix):
            return unit_mix[idx].get('type')

    elif input_name.startswith("Unit SF "):
        idx = int(input_name.split(" ")[-1]) - 1
        if idx < len(unit_mix):
            return unit_mix[idx].get('unit_sf') or unit_mix[idx].get('sqft') or unit_mix[idx].get('avg_sqft')

    elif input_name.startswith("Unit Status "):
        idx = int(input_name.split(" ")[-1]) - 1
        if idx < len(unit_mix):
            return unit_mix[idx].get('status', 'rented')

    elif input_name.startswith("Market Rent "):
        idx = int(input_name.split(" ")[-1]) - 1
        if idx < len(unit_mix):
            return unit_mix[idx].get('rent_market') or unit_mix[idx].get('proforma_rent')

    elif input_name.startswith("In-Place Rent "):
        idx = int(input_name.split(" ")[-1]) - 1
        if idx < len(unit_mix):
            return unit_mix[idx].get('rent_current')

    # ── Financing (existing debt for subject-to) ──
    elif input_name == "Existing Loan Balance":
        return sd.get('existing_financing', {}).get('loan_balance')

    elif input_name == "Existing Loan Rate":
        return sd.get('existing_financing', {}).get('interest_rate')

    elif input_name == "Remaining Term (Months)":
        return sd.get('existing_financing', {}).get('remaining_term_months')

    # ── Value-Add Inputs (rows 119-121) ──
    elif input_name == "Monthly Rent Increase ($/unit)":
        annual_upside = va.get('annual_rent_upside', 0)
        units = prop.get('units') or prop.get('total_units') or 1
        if annual_upside:
            return round(annual_upside / units / 12, 2)
        return None

    elif input_name == "Annual Expense Reduction ($/unit)":
        annual_savings = va.get('annual_expense_savings', 0)
        units = prop.get('units') or prop.get('total_units') or 1
        if annual_savings:
            return round(annual_savings / units, 2)
        return None

    elif input_name == "Renovation Cost (Total)":
        return va.get('renovation_cost') or pf.get('upfront_capex')

    return None


def update_google_sheet(scenario_data, full_calcs, sheet_id=None, sheet_tab=None):
    """
    Update Google Sheet with parsed data using Service Account authentication.
    
    Args:
        scenario_data: Parsed OM data from underwriting
        full_calcs: Calculated financial metrics
        sheet_id: Google Sheets spreadsheet ID (user-provided)
        sheet_tab: Tab name within the spreadsheet
    
    Returns:
        dict: Success/error message
    """
    target_sheet_id = sheet_id or SHEET_ID
    target_tab = sheet_tab or SHEET_TAB_NAME
    try:
        _dbg(f"Starting sheet update for sheet={target_sheet_id} tab={target_tab}")
        # Get service account credentials
        credentials = get_credentials()
        
        # Build Google Sheets API service
        service = build('sheets', 'v4', credentials=credentials)
        
        # Validate the tab name exists in the spreadsheet
        try:
            sheet_meta = service.spreadsheets().get(
                spreadsheetId=target_sheet_id,
                fields='sheets.properties.title'
            ).execute()
            actual_tabs = [s['properties']['title'] for s in sheet_meta.get('sheets', [])]
            _dbg(f"Spreadsheet tabs: {actual_tabs}")
            
            if target_tab not in actual_tabs:
                # Try case-insensitive match
                tab_lower = target_tab.lower()
                matched = [t for t in actual_tabs if t.lower() == tab_lower]
                if matched:
                    _dbg(f"Tab name case mismatch: requested '{target_tab}', using '{matched[0]}'")
                    target_tab = matched[0]
                else:
                    # Try partial/fuzzy match: check if any tab contains the target or vice-versa
                    partial = [t for t in actual_tabs if tab_lower in t.lower() or t.lower() in tab_lower]
                    if partial:
                        _dbg(f"Tab name partial match: requested '{target_tab}', using '{partial[0]}'")
                        target_tab = partial[0]
                    else:
                        # Use the first tab as last resort
                        if actual_tabs:
                            _dbg(f"Tab '{target_tab}' not found. Using first tab: '{actual_tabs[0]}'")
                            target_tab = actual_tabs[0]
                        else:
                            return {
                                'success': False,
                                'message': f"Spreadsheet has no tabs. Available: {actual_tabs}"
                            }
        except Exception as tab_err:
            _dbg(f"Warning: could not validate tab name: {tab_err}")
        
        # Load mapping
        mapping, mapping_path = load_mapping()
        _dbg(f"Loaded {len(mapping)} mapping rows; sheet: {target_sheet_id} tab: {target_tab}")
        
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
                    'range': f"'{target_tab}'!{cell}",
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
                    'sheetId': target_sheet_id,
                    'sheetTab': target_tab,
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
                spreadsheetId=target_sheet_id,
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
