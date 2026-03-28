import re

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from google_sheets_updater import get_credentials


MAX_SHEET_TITLE_LENGTH = 100
INVALID_SHEET_TITLE_CHARS = r'[\\/*?:\[\]]'


def _sanitize_title(title):
    cleaned = re.sub(INVALID_SHEET_TITLE_CHARS, '-', str(title or '').strip())
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned[:MAX_SHEET_TITLE_LENGTH] or 'Results'


def _prefixed_title(base_title, sheet_title):
    if base_title:
        return _sanitize_title(f"{base_title} - {sheet_title}")
    return _sanitize_title(sheet_title)


def _existing_sheet_titles(service, spreadsheet_id):
    response = service.spreadsheets().get(
        spreadsheetId=spreadsheet_id,
        fields='sheets.properties.title'
    ).execute()
    return [sheet['properties']['title'] for sheet in response.get('sheets', [])]


def _ensure_sheet(service, spreadsheet_id, title, existing_titles):
    if title in existing_titles:
        return

    service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={
            'requests': [
                {
                    'addSheet': {
                        'properties': {
                            'title': title,
                        }
                    }
                }
            ]
        }
    ).execute()
    existing_titles.append(title)


def _clear_sheet(service, spreadsheet_id, title):
    service.spreadsheets().values().clear(
        spreadsheetId=spreadsheet_id,
        range=f"'{title}'"
    ).execute()


def _write_rows(service, spreadsheet_id, title, rows):
    normalized_rows = []
    for row in rows or []:
        normalized_rows.append([
            value if isinstance(value, (int, float)) else '' if value is None else str(value)
            for value in row
        ])

    if not normalized_rows:
        normalized_rows = [['No data available']]

    service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range=f"'{title}'!A1",
        valueInputOption='USER_ENTERED',
        body={'values': normalized_rows}
    ).execute()


def export_full_results_workbook(workbook, sheet_id, base_tab_name=None):
    if not workbook:
        return {
            'success': False,
            'message': 'workbook payload required'
        }

    credentials = get_credentials()
    service = build('sheets', 'v4', credentials=credentials)
    existing_titles = _existing_sheet_titles(service, sheet_id)

    prefix = workbook.get('baseTabName') or base_tab_name or 'Results'
    workbook_title = workbook.get('workbookTitle') or 'DealSniper Results'
    curated_sheets = workbook.get('sheets') or []
    raw_sheets = workbook.get('rawSheets') or []

    sheet_specs = []
    for item in curated_sheets + raw_sheets:
        source_title = item.get('title') or 'Sheet'
        rows = item.get('rows') or []
        sheet_specs.append({
            'title': _prefixed_title(prefix, source_title),
            'sourceTitle': source_title,
            'rows': rows,
        })

    index_rows = [[f'{workbook_title}'], [], ['Sheet', 'Source']]
    for item in sheet_specs:
        index_rows.append([item['title'], item['sourceTitle']])
    index_spec = {
        'title': _prefixed_title(prefix, 'Index'),
        'sourceTitle': 'Index',
        'rows': index_rows,
    }
    sheet_specs.insert(0, index_spec)

    updated_titles = []
    total_rows = 0
    try:
        for spec in sheet_specs:
            _ensure_sheet(service, sheet_id, spec['title'], existing_titles)
            _clear_sheet(service, sheet_id, spec['title'])
            _write_rows(service, sheet_id, spec['title'], spec['rows'])
            updated_titles.append(spec['title'])
            total_rows += len(spec['rows'])

        return {
            'success': True,
            'message': f'Updated {len(updated_titles)} tabs in Google Sheets',
            'updatedTabs': updated_titles,
            'tabCount': len(updated_titles),
            'rowCount': total_rows,
        }
    except HttpError as error:
        return {
            'success': False,
            'message': f'Google Sheets API error: {error}'
        }
    except Exception as error:
        return {
            'success': False,
            'message': f'Error exporting full results workbook: {error}'
        }
