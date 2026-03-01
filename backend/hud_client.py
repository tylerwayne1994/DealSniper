import os
import json
import time
from typing import Optional
import requests

HUD_BASE = "https://www.huduser.gov/hudapi/public/fmr"
CACHE_FILE = os.path.join(os.path.dirname(__file__), 'data', 'hud_cache.json')
TTL = 24 * 3600

_cache = {}

def _load_file_cache():
    try:
        if os.path.exists(CACHE_FILE):
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                d = json.load(f)
                # drop expired
                now = time.time()
                for k, v in list(d.items()):
                    if v.get('ts', 0) + TTL < now:
                        d.pop(k, None)
                return d
    except Exception:
        return {}
    return {}

def _save_file_cache(d):
    try:
        os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(d, f)
    except Exception:
        pass

def _get_cache(key: str) -> Optional[dict]:
    now = time.time()
    if key in _cache:
        entry = _cache[key]
        if entry.get('ts', 0) + TTL >= now:
            return entry.get('data')
        else:
            _cache.pop(key, None)
    # try file
    file_cache = _load_file_cache()
    if key in file_cache:
        entry = file_cache[key]
        if entry.get('ts', 0) + TTL >= now:
            # warm memory
            _cache[key] = entry
            return entry.get('data')
    return None

def _set_cache(key: str, data: dict):
    now = time.time()
    entry = {'ts': now, 'data': data}
    _cache[key] = entry
    try:
        file_cache = _load_file_cache()
        file_cache[key] = entry
        _save_file_cache(file_cache)
    except Exception:
        pass

def _get_auth_headers():
    token = os.getenv('HUD_API_KEY', 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI2IiwianRpIjoiMmYxNThkMDI1MTJiM2YwNmE5YTQxYmUxNWRmZDE5MDY5NWY5MmZhYjdhYjVkNzcwOWNhMGRkNWVkNDUxMGNmNmRkNzg5MDZjNWZmYTU1NWEiLCJpYXQiOjE3NzI0MDM3ODkuMjM3NDgzLCJuYmYiOjE3NzI0MDM3ODkuMjM3NDg2LCJleHAiOjIwODgwMjI5ODkuMjMzMzUyLCJzdWIiOiI5OTY4NiIsInNjb3BlcyI6W119.d8mLW6nl_y81ebW9IKQnAEYygRgAtaI9pG2DQlSU0BnDLRskPTehSuA7izk7E4N9fd4CZnfZpJvvkTytMjQ5vw')
    if not token:
        return None
    return {'Authorization': f'Bearer {token}', 'Accept': 'application/json'}

def fetch_fmr(entityid: str, year: Optional[int] = None) -> dict:
    """Fetch FMR data for the provided entity id (county, metro, or zip).
    Caches responses for TTL seconds."""
    key = f'fmr:data:{entityid}:{year or "latest"}'
    cached = _get_cache(key)
    if cached:
        return cached

    headers = _get_auth_headers()
    if headers is None:
        raise RuntimeError('HUD_API_KEY not configured')

    url = f"{HUD_BASE}/data/{entityid}"
    params = {}
    if year:
        params['year'] = str(year)

    resp = requests.get(url, headers=headers, params=params, timeout=15)
    if resp.status_code != 200:
        raise RuntimeError(f'HUD API error {resp.status_code}: {resp.text}')
    data = resp.json()
    _set_cache(key, data)
    return data

def fetch_fmr_for_zip(zip_code: str) -> Optional[dict]:
    """Convenience: fetch all FMR bedroom values for a ZIP code.

    Returns dict like:
      {'fmr_0br': 900, 'fmr_1br': 1050, 'fmr_2br': 1300, 'fmr_3br': 1700, 'fmr_4br': 2000,
       'county': 'Harris County', 'state': 'TX', 'metro': 'Houston-The Woodlands-Sugar Land',
       'year': 2025, 'source': 'hud_api'}
    or None on failure.
    """
    try:
        raw = fetch_fmr(zip_code)
        # HUD returns {"data": {"basicdata": {...}, ...}} for ZIP queries
        data = raw.get('data', raw) if isinstance(raw, dict) else raw
        basic = None
        if isinstance(data, dict):
            basic = data.get('basicdata', data)
        elif isinstance(data, list) and len(data) > 0:
            basic = data[0] if isinstance(data[0], dict) else None

        if not basic:
            return None

        # HUD field names vary: try several patterns
        def _fmr_val(basic_dict, br_num):
            for key in (f'fmr_{br_num}', f'fmr{br_num}', f'Rent_{br_num}',
                        f'fmr_{br_num}br', f'basicdata.fmr_{br_num}'):
                v = basic_dict.get(key)
                if v is not None:
                    try:
                        return float(v)
                    except (ValueError, TypeError):
                        pass
            return None

        result = {
            'fmr_0br': _fmr_val(basic, 0),
            'fmr_1br': _fmr_val(basic, 1),
            'fmr_2br': _fmr_val(basic, 2),
            'fmr_3br': _fmr_val(basic, 3),
            'fmr_4br': _fmr_val(basic, 4),
            'county': basic.get('county_name') or basic.get('county'),
            'state': basic.get('state_alpha') or basic.get('state'),
            'metro': basic.get('metro_name') or basic.get('hud_area_name') or basic.get('areaname'),
            'year': basic.get('year') or basic.get('fy'),
            'source': 'hud_api',
        }
        # If all FMR values are None, treat as failure
        if all(result[f'fmr_{i}br'] is None for i in range(5)):
            return None
        return result
    except Exception:
        return None


def list_counties(state_code: str) -> dict:
    key = f'fmr:listCounties:{state_code}'
    cached = _get_cache(key)
    if cached:
        return cached

    headers = _get_auth_headers()
    if headers is None:
        raise RuntimeError('HUD_API_KEY not configured')

    url = f"{HUD_BASE}/listCounties/{state_code}"
    resp = requests.get(url, headers=headers, timeout=15)
    if resp.status_code != 200:
        raise RuntimeError(f'HUD API error {resp.status_code}: {resp.text}')
    data = resp.json()
    _set_cache(key, data)
    return data
