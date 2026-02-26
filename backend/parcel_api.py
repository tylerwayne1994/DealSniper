"""
Parcel Overlay API — serves parcel boundary data from NDJSON GeoJSON files.

Data lives in ../client/public/parcels/us/{state}/{name}-parcels-{level}.geojson
Each file is newline-delimited GeoJSON (one Feature per line).
Companion .meta files provide bounding-box info for spatial indexing.
"""

import os
import json
import logging
import time
from pathlib import Path
from typing import List, Optional, Dict, Tuple

from fastapi import APIRouter, Query, HTTPException

log = logging.getLogger("parcel_api")
router = APIRouter()

# ─── Configuration ─────────────────────────────────────────────────
PARCEL_DATA_DIR = os.environ.get(
    "PARCEL_DATA_DIR",
    str(Path(__file__).resolve().parent.parent / "client" / "public" / "parcels" / "us"),
)
MAX_FEATURES = 5000          # Hard cap per request
MIN_ZOOM = 14                # Don't serve below this zoom
LAYERS_SERVED = {"parcels"}  # Only parcel polygons for now

# ─── Spatial Index (built lazily on first request) ─────────────────
_spatial_index: Optional[List[Dict]] = None  # list of { path, west, south, east, north, count, layer }


def _bbox_from_meta(meta: dict) -> Optional[Tuple[float, float, float, float]]:
    """Extract west, south, east, north from the bounds polygon in a .meta file."""
    try:
        coords = meta["bounds"]["coordinates"][0]
        lons = [c[0] for c in coords]
        lats = [c[1] for c in coords]
        return (min(lons), min(lats), max(lons), max(lats))
    except (KeyError, IndexError, TypeError):
        return None


def _build_spatial_index() -> List[Dict]:
    """Scan all .geojson.meta files and build a list of entries with bounding boxes."""
    entries = []
    root = Path(PARCEL_DATA_DIR)
    if not root.exists():
        log.warning(f"[PARCEL] Data directory not found: {root}")
        return entries

    for meta_path in root.rglob("*.geojson.meta"):
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except Exception:
            continue

        layer = meta.get("layer", "")
        if layer not in LAYERS_SERVED:
            continue

        bbox = _bbox_from_meta(meta)
        if bbox is None:
            continue

        geojson_path = str(meta_path).replace(".meta", "")
        if not os.path.isfile(geojson_path):
            continue

        entries.append({
            "path": geojson_path,
            "west": bbox[0],
            "south": bbox[1],
            "east": bbox[2],
            "north": bbox[3],
            "count": meta.get("count", 0),
            "layer": layer,
            "name": meta.get("source_name", meta_path.stem),
        })

    log.info(f"[PARCEL] Spatial index built: {len(entries)} parcel files indexed")
    return entries


def _get_index() -> List[Dict]:
    global _spatial_index
    if _spatial_index is None:
        _spatial_index = _build_spatial_index()
    return _spatial_index


def _bboxes_intersect(a_w, a_s, a_e, a_n, b_w, b_s, b_e, b_n) -> bool:
    """Return True if two axis-aligned bounding boxes overlap."""
    return not (a_e < b_w or a_w > b_e or a_n < b_s or a_s > b_n)


def _point_in_bbox(lon: float, lat: float, w: float, s: float, e: float, n: float) -> bool:
    return w <= lon <= e and s <= lat <= n


def _feature_in_bbox(feature: dict, w: float, s: float, e: float, n: float) -> bool:
    """Quick check: does the feature's first coordinate fall within the bbox?"""
    try:
        geom = feature["geometry"]
        gtype = geom["type"]
        coords = geom["coordinates"]

        if gtype == "Point":
            return _point_in_bbox(coords[0], coords[1], w, s, e, n)
        elif gtype == "Polygon":
            # Check centroid approximation using first ring
            ring = coords[0]
            cx = sum(c[0] for c in ring) / len(ring)
            cy = sum(c[1] for c in ring) / len(ring)
            return _point_in_bbox(cx, cy, w, s, e, n)
        elif gtype == "MultiPolygon":
            ring = coords[0][0]
            cx = sum(c[0] for c in ring) / len(ring)
            cy = sum(c[1] for c in ring) / len(ring)
            return _point_in_bbox(cx, cy, w, s, e, n)
        else:
            return False
    except (KeyError, IndexError, TypeError, ZeroDivisionError):
        return False


# ─── API Endpoint ──────────────────────────────────────────────────

@router.get("/api/parcels")
async def get_parcels(
    west: float = Query(..., description="Western longitude of bounding box"),
    south: float = Query(..., description="Southern latitude of bounding box"),
    east: float = Query(..., description="Eastern longitude of bounding box"),
    north: float = Query(..., description="Northern latitude of bounding box"),
    zoom: int = Query(14, description="Current map zoom level"),
    limit: int = Query(MAX_FEATURES, le=MAX_FEATURES, description="Max features to return"),
):
    """Return parcel polygons within the given bounding box as a GeoJSON FeatureCollection."""

    if zoom < MIN_ZOOM:
        return {
            "type": "FeatureCollection",
            "features": [],
            "_parcel_meta": {"message": f"Zoom in to level {MIN_ZOOM}+ to see parcels", "min_zoom": MIN_ZOOM},
        }

    # Clamp limit
    limit = min(limit, MAX_FEATURES)

    # Find files whose bounds intersect the request bbox
    index = _get_index()
    matching_files = [
        entry for entry in index
        if _bboxes_intersect(west, south, east, north, entry["west"], entry["south"], entry["east"], entry["north"])
    ]

    if not matching_files:
        return {
            "type": "FeatureCollection",
            "features": [],
            "_parcel_meta": {"message": "No parcel data for this area", "files_checked": len(index)},
        }

    # Sort by count (smallest first) to prioritize faster files
    matching_files.sort(key=lambda e: e["count"])

    features = []
    files_scanned = 0
    t0 = time.time()

    for entry in matching_files:
        if len(features) >= limit:
            break
        files_scanned += 1

        try:
            with open(entry["path"], "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        feat = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    if feat.get("type") != "Feature":
                        continue

                    if _feature_in_bbox(feat, west, south, east, north):
                        features.append(feat)
                        if len(features) >= limit:
                            break
        except Exception as e:
            log.error(f"[PARCEL] Error reading {entry['path']}: {e}")
            continue

    elapsed = time.time() - t0
    log.info(
        f"[PARCEL] Served {len(features)} features from {files_scanned} files in {elapsed:.2f}s "
        f"(bbox: {west:.4f},{south:.4f},{east:.4f},{north:.4f})"
    )

    return {
        "type": "FeatureCollection",
        "features": features,
        "_parcel_meta": {
            "count": len(features),
            "files_scanned": files_scanned,
            "elapsed_seconds": round(elapsed, 3),
            "capped": len(features) >= limit,
        },
    }


@router.get("/api/parcels/index")
async def get_parcel_index():
    """Return the spatial index — useful for debugging which parcel files are available."""
    index = _get_index()
    return {
        "total_files": len(index),
        "total_parcels": sum(e["count"] for e in index),
        "entries": [
            {
                "name": e["name"],
                "count": e["count"],
                "bounds": [e["west"], e["south"], e["east"], e["north"]],
            }
            for e in index
        ],
    }
