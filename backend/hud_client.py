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
    token = os.getenv('HUD_API_KEY')
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
