"""Bounded parcel/zoning API routes (§10).

Every route is bounded: bbox + limit, or single-record lookup. The browser
never receives a whole dataset. Limits come from env and are hard-capped.

Mount into the existing Deal Sniper FastAPI backend (backend/App.py):

    from pipeline.api.routes import router as parcels_router
    app.include_router(parcels_router)

Requires env: DATABASE_URL (point it at PgBouncer on the data VM),
PARCEL_API_DEFAULT_LIMIT, PARCEL_API_MAX_LIMIT.
"""
from __future__ import annotations

import json
import os
from contextlib import contextmanager

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api", tags=["parcel-data"])

_DEFAULT_LIMIT = int(os.environ.get("PARCEL_API_DEFAULT_LIMIT", "500"))
_MAX_LIMIT = int(os.environ.get("PARCEL_API_MAX_LIMIT", "2000"))


@contextmanager
def _conn():
    import psycopg
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise HTTPException(503, "DATABASE_URL not configured")
    with psycopg.connect(dsn) as conn:
        yield conn


def _parse_bbox(bbox: str) -> tuple[float, float, float, float]:
    try:
        minx, miny, maxx, maxy = (float(v) for v in bbox.split(","))
    except ValueError:
        raise HTTPException(400, "bbox must be 'minx,miny,maxx,maxy' in EPSG:4326")
    if not (-180 <= minx <= maxx <= 180 and -90 <= miny <= maxy <= 90):
        raise HTTPException(400, "bbox out of range")
    return minx, miny, maxx, maxy


def _cap(limit: int | None) -> int:
    return max(1, min(limit or _DEFAULT_LIMIT, _MAX_LIMIT))


def _rows_to_features(cur) -> list[dict]:
    cols = [d.name for d in cur.description]
    feats = []
    for row in cur.fetchall():
        rec = dict(zip(cols, row))
        gj = rec.pop("gj", None)
        feats.append({"type": "Feature",
                      "geometry": json.loads(gj) if gj else None,
                      "properties": {k: (str(v) if hasattr(v, "isoformat") else v)
                                     for k, v in rec.items()}})
    return feats


@router.get("/parcels")
def parcels_bbox(bbox: str = Query(...), limit: int | None = Query(None)):
    minx, miny, maxx, maxy = _parse_bbox(bbox)
    n = _cap(limit)
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            """SELECT ST_AsGeoJSON(geom) AS gj, fips, apn, situs_addr, situs_zip,
                      land_use_code, zoning, zoning_source, assessed_total,
                      last_sale_date, last_sale_price, year_built, sqft_bldg, units
               FROM parcels
               WHERE geom && ST_MakeEnvelope(%s,%s,%s,%s,4326)
               LIMIT %s""",
            (minx, miny, maxx, maxy, n))
        feats = _rows_to_features(cur)
    return {"type": "FeatureCollection", "features": feats, "limit": n}


@router.get("/parcels/{fips}/{apn}")
def parcel_one(fips: str, apn: str):
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            """SELECT ST_AsGeoJSON(geom) AS gj, fips, apn, owner_name, owner_mail_addr,
                      situs_addr, situs_city, situs_zip, land_use_code, land_use_desc,
                      zoning, zoning_source, assessed_land, assessed_impr, assessed_total,
                      last_sale_date, last_sale_price, year_built, sqft_bldg, sqft_lot,
                      units, raw
               FROM parcels WHERE fips = %s AND apn = %s""", (fips, apn))
        feats = _rows_to_features(cur)
    if not feats:
        raise HTTPException(404, "parcel not found")
    return feats[0]


@router.get("/zoning")
def zoning_bbox(bbox: str = Query(...), limit: int | None = Query(None)):
    minx, miny, maxx, maxy = _parse_bbox(bbox)
    n = _cap(limit)
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            """SELECT ST_AsGeoJSON(z.geom) AS gj, z.fips, z.zone_code, z.zone_desc,
                      z.zone_category, z.overlay, j.name AS jurisdiction
               FROM zoning z JOIN jurisdictions j ON j.id = z.jurisdiction_id
               WHERE z.geom && ST_MakeEnvelope(%s,%s,%s,%s,4326)
               LIMIT %s""",
            (minx, miny, maxx, maxy, n))
        feats = _rows_to_features(cur)
    return {"type": "FeatureCollection", "features": feats, "limit": n}


@router.get("/zoning/at")
def zoning_at(lat: float = Query(...), lon: float = Query(...)):
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise HTTPException(400, "lat/lon out of range")
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            """SELECT z.zone_code, z.zone_desc, z.zone_category, z.overlay,
                      z.ordinance_url, j.name AS jurisdiction
               FROM zoning z JOIN jurisdictions j ON j.id = z.jurisdiction_id
               WHERE ST_Contains(z.geom, ST_SetSRID(ST_MakePoint(%s, %s), 4326))
               ORDER BY z.overlay ASC, ST_Area(z.geom) ASC
               LIMIT 10""", (lon, lat))
        cols = [d.name for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    base = next((r for r in rows if not r["overlay"]), None)
    return {"zone": base, "overlays": [r for r in rows if r["overlay"]]}


@router.get("/coverage")
def coverage():
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            """SELECT c.fips, c.name, c.state, s.layer, s.status, s.rung,
                      s.last_success_at
               FROM counties c
               LEFT JOIN sources s ON s.target_id = c.fips OR s.target_id IN
                    (SELECT id FROM jurisdictions WHERE fips = c.fips)
               ORDER BY c.rank NULLS LAST, s.layer""")
        cols = [d.name for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    out: dict = {}
    for r in rows:
        entry = out.setdefault(r["fips"], {"name": r["name"], "state": r["state"],
                                           "layers": {}})
        if r["layer"]:
            layer = entry["layers"].setdefault(r["layer"], {"ok": 0, "total": 0})
            layer["total"] += 1
            if r["status"] == "ok":
                layer["ok"] += 1
    return out
