"""
zoning_agent.py
---------------
Autonomous Zoning Data Gathering Agent for secondary US cities.

Uses OpenAI (gpt-4.1-mini) to discover zoning GeoJSON endpoints, WMS tile URLs,
and legend mappings for any US city — then downloads and enriches the data.

Called by the zoning_router API endpoints. NOT a CLI tool — imported as a module.
"""

import json
import os
import re
import time
import logging
import requests
from pathlib import Path
from typing import Optional

from openai import OpenAI

from legend_normalizer import (
    apply_legend_to_geojson,
    build_enriched_legend,
    STANDARD_COLORS,
    STANDARD_CATEGORIES,
)

log = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

DATA_DIR = Path(__file__).parent / "data" / "zoning_cache"
DATA_DIR.mkdir(parents=True, exist_ok=True)

LLM_MODEL = "gpt-4.1-mini"

# ─────────────────────────────────────────────────────────────────────────────
# LLM Client
# ─────────────────────────────────────────────────────────────────────────────

_client: Optional[OpenAI] = None

def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY not configured")
        _client = OpenAI(api_key=api_key)
    return _client


SYSTEM_PROMPT = """You are an expert geospatial data engineer and urban planning researcher.
Your task is to gather zoning boundary data (GeoJSON), map tile services (WMS/Vector Tiles), and zoning legends for US cities.

You have deep knowledge of:
- ESRI ArcGIS Hub, REST Services, MapServer, and FeatureServer endpoints
- Socrata open data portals (data.cityname.gov)
- OGC WMS (Web Map Service) and XYZ tile URL patterns
- Municipal GIS departments and their URL patterns
- Zoning code conventions across US cities

When given a city name, you must return a valid JSON object with no extra commentary.
Do NOT include markdown code fences. Return ONLY the raw JSON object."""


DISCOVERY_PROMPT = """Find the zoning GeoJSON data, map tile service URL, and legend for: {city}

Return a JSON object with this exact schema:
{{
  "city": "{city}",
  "data_source_url": "<URL to the open data portal page for the zoning dataset>",
  "geojson_api_url": "<Direct URL to download the full zoning GeoJSON. For ArcGIS REST services use the MapServer query endpoint: https://...MapServer/0/query?where=1%3D1&outFields=*&f=geojson  (prefer MapServer over FeatureServer — many city ArcGIS instances only expose MapServer)>",
  "wms_tile_url": "<The MapServer or WMS tile URL for rendering. For ArcGIS MapServer use: https://.../MapServer/tile/{{z}}/{{y}}/{{x}} or WMS equivalent. Leave null if unavailable>",
  "zoning_field_name": "<The property key in the GeoJSON features that holds the zoning code, e.g. 'ZONING', 'CODE', 'ZONE_CLASS', 'ZONING_LBL'>",
  "legend_source_url": "<URL to the zoning ordinance, code table, or metadata that explains the zone codes>",
  "legend_mapping": {{
    "<ZONE_CODE>": {{
      "description": "<Human-readable description of this zone>",
      "standardized_category": "<One of: Residential, Commercial, Industrial, Mixed Use, Agricultural, Public/Institutional, Overlay/Other>"
    }}
  }},
  "notes": "<Any caveats, e.g. data last updated date, known limitations>"
}}

Rules:
- The geojson_api_url MUST be a direct download URL, not a portal page.
- For ArcGIS REST services, PREFER MapServer over FeatureServer (many cities only expose MapServer). Use: .../MapServer/0/query?where=1%3D1&outFields=*&f=geojson
- Only use FeatureServer if you are confident the city exposes it.
- For Socrata datasets, use the .geojson endpoint (e.g., https://data.city.gov/resource/xxxx-xxxx.geojson?$limit=50000)
- Include ALL major base zoning codes in legend_mapping (at minimum 5-15 codes).
- Map every code to one of the 7 standardized categories listed above.
- If a code is ambiguous, use "Overlay/Other".
- Return ONLY raw JSON, no markdown, no commentary."""


def ask_agent(city: str, max_retries: int = 3) -> Optional[dict]:
    """Ask the LLM agent to discover zoning data for a city."""
    client = _get_client()
    prompt = DISCOVERY_PROMPT.format(city=city)

    for attempt in range(1, max_retries + 1):
        log.info(f"[{city}] LLM discovery attempt {attempt}/{max_retries}...")
        try:
            response = client.chat.completions.create(
                model=LLM_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user",   "content": prompt},
                ],
                temperature=0.1,
                max_tokens=4096,
            )
            raw = response.choices[0].message.content.strip()

            # Strip markdown fences if the model adds them
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)

            data = json.loads(raw)
            log.info(f"[{city}] Agent returned data successfully.")
            return data

        except json.JSONDecodeError as e:
            log.warning(f"[{city}] JSON parse error on attempt {attempt}: {e}")
            if attempt < max_retries:
                time.sleep(2)
        except Exception as e:
            log.error(f"[{city}] LLM error on attempt {attempt}: {e}")
            if attempt < max_retries:
                time.sleep(3)

    log.error(f"[{city}] All attempts failed.")
    return None


# ─────────────────────────────────────────────────────────────────────────────
# GeoJSON Downloader
# ─────────────────────────────────────────────────────────────────────────────

def download_geojson(url: str, city: str, max_features: int = None) -> Optional[dict]:
    """Download GeoJSON from a URL, handling ArcGIS pagination.
    Automatically tries FeatureServer ↔ MapServer fallback."""
    log.info(f"[{city}] Downloading GeoJSON from: {url}")

    if ("FeatureServer" in url or "MapServer" in url) and "/query" not in url.lower():
        result = _download_arcgis_geojson(url, city, max_features)
        if result:
            return result
        # Fallback: try the other server type
        alt_url = _swap_server_type(url)
        if alt_url != url:
            log.info(f"[{city}] Retrying with alternate endpoint: {alt_url}")
            return _download_arcgis_geojson(alt_url, city, max_features)
        return None
    elif "FeatureServer" in url or "MapServer" in url:
        result = _download_direct_geojson(url, city)
        if result:
            return result
        result = _download_arcgis_geojson(url, city, max_features)
        if result:
            return result
        # Fallback: try the other server type
        alt_url = _swap_server_type(url)
        if alt_url != url:
            log.info(f"[{city}] Retrying with alternate endpoint: {alt_url}")
            result = _download_direct_geojson(alt_url, city)
            if result:
                return result
            return _download_arcgis_geojson(alt_url, city, max_features)
        return None
    else:
        return _download_direct_geojson(url, city)


def _swap_server_type(url: str) -> str:
    """Swap FeatureServer ↔ MapServer in a URL for fallback."""
    if "FeatureServer" in url:
        return url.replace("FeatureServer", "MapServer")
    elif "MapServer" in url:
        return url.replace("MapServer", "FeatureServer")
    return url


def _download_direct_geojson(url: str, city: str) -> Optional[dict]:
    """Direct GeoJSON download."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 ZoningDataAgent/1.0 (research purposes)",
            "Accept": "application/json, application/geo+json, */*",
        }
        resp = requests.get(url, headers=headers, timeout=120, allow_redirects=True)
        resp.raise_for_status()
        data = resp.json()

        if "features" not in data:
            log.warning(f"[{city}] Response not GeoJSON: {list(data.keys())}")
            return None

        log.info(f"[{city}] Downloaded {len(data['features'])} features.")
        return data
    except Exception as e:
        log.error(f"[{city}] Download failed: {e}")
        return None


def _download_arcgis_geojson(base_url: str, city: str, max_features: int = None) -> Optional[dict]:
    """Download all features from ArcGIS with pagination."""
    base_url = re.sub(r"\?.*", "", base_url)  # strip existing params

    # Ensure the URL ends with /query (some URLs point to layer root)
    if not base_url.rstrip("/").lower().endswith("/query"):
        # If URL ends with a layer number, append /query
        if re.search(r"/\d+$", base_url.rstrip("/")):
            base_url = base_url.rstrip("/") + "/query"
        else:
            # Assume layer 0
            base_url = base_url.rstrip("/") + "/0/query"

    all_features = []
    offset = 0
    page_size = 1000

    while True:
        params = {
            "where": "1=1",
            "outFields": "*",
            "f": "geojson",
            "resultOffset": offset,
            "resultRecordCount": page_size,
        }

        try:
            headers = {"User-Agent": "ZoningDataAgent/1.0 (research purposes)"}
            resp = requests.get(base_url, params=params, headers=headers, timeout=60)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            log.error(f"[{city}] ArcGIS page download failed at offset {offset}: {e}")
            break

        features = data.get("features", [])
        if not features:
            break

        all_features.extend(features)
        log.info(f"[{city}] Fetched {len(all_features)} features so far...")

        if max_features and len(all_features) >= max_features:
            all_features = all_features[:max_features]
            break

        if len(features) < page_size:
            break

        offset += page_size
        time.sleep(0.3)

    if not all_features:
        log.warning(f"[{city}] No features downloaded.")
        return None

    log.info(f"[{city}] Total features: {len(all_features)}")
    return {"type": "FeatureCollection", "features": all_features}


# ─────────────────────────────────────────────────────────────────────────────
# Enricher
# ─────────────────────────────────────────────────────────────────────────────

def enrich_geojson(geojson: dict, legend_mapping: dict, zoning_field: str, city: str) -> dict:
    """Enrich GeoJSON features with standardized zoning category."""
    return apply_legend_to_geojson(geojson, legend_mapping, zoning_field, city)


# ─────────────────────────────────────────────────────────────────────────────
# Slug helper
# ─────────────────────────────────────────────────────────────────────────────

def city_slug(city: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", city.lower()).strip("_")


# ─────────────────────────────────────────────────────────────────────────────
# Cache helpers
# ─────────────────────────────────────────────────────────────────────────────

def get_cached_legend(slug: str) -> Optional[dict]:
    """Return a cached legend JSON if it exists."""
    p = DATA_DIR / f"{slug}_legend.json"
    if p.exists():
        with open(p, "r") as f:
            return json.load(f)
    return None


def get_cached_geojson_path(slug: str) -> Optional[Path]:
    """Return the path to a cached enriched GeoJSON if it exists."""
    p = DATA_DIR / f"{slug}_zoning.geojson"
    return p if p.exists() else None


def list_cached_cities() -> list:
    """List all cities that have cached legend + geojson data."""
    cities = []
    for p in DATA_DIR.glob("*_legend.json"):
        slug = p.stem.replace("_legend", "")
        geojson_path = DATA_DIR / f"{slug}_zoning.geojson"
        with open(p, "r") as f:
            legend = json.load(f)
        cities.append({
            "slug": slug,
            "city": legend.get("city", slug),
            "has_geojson": geojson_path.exists(),
            "feature_count": None,
            "legend_codes": len(legend.get("legend_mapping", {})),
            "wms_tile_url": legend.get("wms_tile_url"),
            "data_source_url": legend.get("data_source_url", ""),
            "notes": legend.get("notes", ""),
        })
    return cities


# ─────────────────────────────────────────────────────────────────────────────
# Full Pipeline
# ─────────────────────────────────────────────────────────────────────────────

def process_city(city: str, max_features: int = 15000) -> dict:
    """Run the full discovery → download → enrich pipeline for a city."""
    slug = city_slug(city)
    result = {"city": city, "slug": slug, "status": "failed", "error": None}

    # Step 1: Agent Discovery
    agent_data = ask_agent(city)
    if not agent_data:
        result["error"] = "LLM agent failed to return data"
        return result

    # Save legend
    legend_path = DATA_DIR / f"{slug}_legend.json"
    with open(legend_path, "w") as f:
        json.dump(agent_data, f, indent=2)
    log.info(f"[{city}] Legend saved to {legend_path}")

    geojson_url    = agent_data.get("geojson_api_url", "")
    zoning_field   = agent_data.get("zoning_field_name", "ZONING")
    legend_mapping = agent_data.get("legend_mapping", {})

    if not geojson_url:
        result["error"] = "Agent did not return a GeoJSON URL"
        return result

    # Step 2: Download GeoJSON
    geojson = download_geojson(geojson_url, city, max_features=max_features)
    if not geojson:
        result["error"] = f"Failed to download GeoJSON from {geojson_url}"
        # Still return partial success — legend is saved, user can try WMS tiles
        result["status"] = "partial"
        result["legend_path"] = str(legend_path)
        result["wms_tile_url"] = agent_data.get("wms_tile_url")
        result["legend_codes"] = len(legend_mapping)
        return result

    # Step 3: Enrich
    enriched = enrich_geojson(geojson, legend_mapping, zoning_field, city)

    # Step 4: Save
    geojson_path = DATA_DIR / f"{slug}_zoning.geojson"
    with open(geojson_path, "w") as f:
        json.dump(enriched, f)
    log.info(f"[{city}] Enriched GeoJSON saved to {geojson_path}")

    result.update({
        "status":          "success",
        "feature_count":   len(enriched.get("features", [])),
        "geojson_path":    str(geojson_path),
        "legend_path":     str(legend_path),
        "data_source_url": agent_data.get("data_source_url", ""),
        "geojson_api_url": geojson_url,
        "wms_tile_url":    agent_data.get("wms_tile_url"),
        "zoning_field":    zoning_field,
        "legend_codes":    len(legend_mapping),
        "notes":           agent_data.get("notes", ""),
    })
    return result
