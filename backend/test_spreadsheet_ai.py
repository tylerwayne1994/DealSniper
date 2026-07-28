"""One-off end-to-end test for spreadsheet_ai_builder (Claude spec -> Excel + Google Sheets)."""
import json
import sys
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

import spreadsheet_ai_builder as sab

DEAL_FILE = Path(__file__).parent / "data" / "deals_v2" / "54cf0738-9ad3-42e8-89f9-00884250d711.json"

deal = json.loads(DEAL_FILE.read_text(encoding="utf-8"))
payload = {"scenarioData": deal.get("scenario_json") or deal.get("parsed_json")}

print("1) Building workbook spec with Claude...")
spec = sab.build_workbook_spec(payload)
print(f"   workbookTitle: {spec.get('workbookTitle')}")
for s in spec.get("sheets", []):
    print(f"   - {s.get('title')}: {len(s.get('rows') or [])} rows, headers={s.get('headerRows')}, formats={s.get('columnFormats')}")

Path("_spec_debug.json").write_text(json.dumps(spec, indent=2), encoding="utf-8")

print("2) Rendering to Excel...")
buf = sab.render_spec_to_excel(spec)
out = Path(__file__).parent / "_test_export.xlsx"
out.write_bytes(buf.read())
import openpyxl
wb = openpyxl.load_workbook(out)
print(f"   Excel OK: {out} sheets={wb.sheetnames}")

# Pass a spreadsheet ID as argv[1]; it must be shared (Editor) with the
# service account email printed by spreadsheet_ai_builder._service_account_email().
if len(sys.argv) < 2:
    print("3) SKIPPED Google Sheets render — pass a shared spreadsheet ID as the first argument.")
    print(f"   Share it with: {sab._service_account_email()}")
    sys.exit(0)

sheet_id = sys.argv[1]
print(f"3) Rendering to Google Sheet {sheet_id} ...")
from googleapiclient.discovery import build as g_build
from google_sheets_updater import get_credentials
service = g_build("sheets", "v4", credentials=get_credentials())

result = sab.render_spec_to_google_sheets(spec, sheet_id=sheet_id, base_tab_name="Model")
print(f"   result: {json.dumps(result, indent=2)}")
if not result.get("success"):
    sys.exit(1)

# Read back a few values to confirm the write landed
first_tab = result["updatedTabs"][0]
vals = service.spreadsheets().values().get(spreadsheetId=sheet_id, range=f"'{first_tab}'!A1:C5").execute()
print(f"   readback from '{first_tab}': {vals.get('values')}")
print("ALL OK")
