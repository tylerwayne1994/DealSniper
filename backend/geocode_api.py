"""
Server-side Google Geocoding proxy.

Google Maps API keys embedded in browser JS must be restricted by HTTP
referrer for security — but Google explicitly blocks HTTP-referrer-restricted
keys from being used with server-executed APIs (Geocoding, Time Zone,
Elevation, etc.), regardless of which APIs are enabled for that key. So
geocoding has to happen server-side, using a SEPARATE key that is never
exposed to the browser (safe to leave referrer-unrestricted, or IP-restrict
it to this server's outbound IP).

Set GOOGLE_MAPS_SERVER_KEY in backend/.env (a second key, distinct from the
client's REACT_APP_GOOGLE_MAPS_KEY) to enable this. Falls back to returning
an error if not configured — the frontend already has a Nominatim fallback
for that case.
"""

import logging
import os
from typing import Optional

import requests

logger = logging.getLogger("geocode_api")

GOOGLE_MAPS_SERVER_KEY = os.environ.get("GOOGLE_MAPS_SERVER_KEY", "")
GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"


def geocode_address(address: str) -> Optional[dict]:
    if not address or not address.strip():
        return None
    if not GOOGLE_MAPS_SERVER_KEY:
        logger.warning("[geocode] GOOGLE_MAPS_SERVER_KEY not configured, cannot geocode server-side")
        return None
    try:
        resp = requests.get(
            GEOCODE_URL,
            params={"address": address, "key": GOOGLE_MAPS_SERVER_KEY},
            timeout=8,
        )
        data = resp.json()
        if data.get("status") != "OK" or not data.get("results"):
            logger.warning("[geocode] Google geocode failed for %r: %s", address, data.get("status"))
            return None
        location = data["results"][0]["geometry"]["location"]
        return {"latitude": location["lat"], "longitude": location["lng"]}
    except Exception as e:
        logger.warning("[geocode] Request failed for %r: %s", address, e)
        return None
