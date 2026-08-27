"""Batched, idempotent upserts for both layers. Re-running an ingest for a
county/layer updates rows in place — it never duplicates (PK fips+apn for
parcels; UNIQUE jurisdiction_id+source_key for zoning, with a deterministic
hash fallback when the source has no row id).
"""
from __future__ import annotations

import hashlib
import json
from typing import Iterable

from .config import Config
from .log import get_logger
from .models import ParcelRow, ZoningRow

log = get_logger("load")

PARCEL_SQL = """
INSERT INTO parcels (fips, apn, owner_name, owner_mail_addr, situs_addr, situs_city,
                     situs_zip, land_use_code, land_use_desc, zoning, zoning_source,
                     assessed_land, assessed_impr, assessed_total, last_sale_date,
                     last_sale_price, year_built, sqft_bldg, sqft_lot, units, raw, geom,
                     updated_at)
VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
        ST_Multi(ST_GeomFromText(%s, 4326)), now())
ON CONFLICT (fips, apn) DO UPDATE SET
  owner_name=EXCLUDED.owner_name, owner_mail_addr=EXCLUDED.owner_mail_addr,
  situs_addr=EXCLUDED.situs_addr, situs_city=EXCLUDED.situs_city,
  situs_zip=EXCLUDED.situs_zip, land_use_code=EXCLUDED.land_use_code,
  land_use_desc=EXCLUDED.land_use_desc,
  zoning=COALESCE(EXCLUDED.zoning, parcels.zoning),
  zoning_source=COALESCE(EXCLUDED.zoning_source, parcels.zoning_source),
  assessed_land=EXCLUDED.assessed_land, assessed_impr=EXCLUDED.assessed_impr,
  assessed_total=EXCLUDED.assessed_total, last_sale_date=EXCLUDED.last_sale_date,
  last_sale_price=EXCLUDED.last_sale_price, year_built=EXCLUDED.year_built,
  sqft_bldg=EXCLUDED.sqft_bldg, sqft_lot=EXCLUDED.sqft_lot, units=EXCLUDED.units,
  raw=EXCLUDED.raw, geom=EXCLUDED.geom, updated_at=now()
"""

ZONING_SQL = """
INSERT INTO zoning (fips, jurisdiction_id, zone_code, zone_desc, zone_category, overlay,
                    ordinance_url, effective_date, source_key, raw, geom, updated_at)
VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, ST_Multi(ST_GeomFromText(%s, 4326)), now())
ON CONFLICT (jurisdiction_id, source_key) DO UPDATE SET
  zone_code=EXCLUDED.zone_code, zone_desc=EXCLUDED.zone_desc,
  zone_category=EXCLUDED.zone_category, overlay=EXCLUDED.overlay,
  ordinance_url=EXCLUDED.ordinance_url, effective_date=EXCLUDED.effective_date,
  raw=EXCLUDED.raw, geom=EXCLUDED.geom, updated_at=now()
"""


def _parcel_params(r: ParcelRow) -> tuple:
    return (r.fips, r.apn, r.owner_name, r.owner_mail_addr, r.situs_addr, r.situs_city,
            r.situs_zip, r.land_use_code, r.land_use_desc, r.zoning, r.zoning_source,
            r.assessed_land, r.assessed_impr, r.assessed_total, r.last_sale_date,
            r.last_sale_price, r.year_built, r.sqft_bldg, r.sqft_lot, r.units,
            json.dumps(r.raw, default=str), r.geom.wkt if r.geom is not None else None)


def zoning_source_key(r: ZoningRow) -> str:
    if r.source_key not in (None, ""):
        return str(r.source_key)
    basis = f"{r.zone_code}|{r.geom.wkt if r.geom is not None else ''}"
    return hashlib.sha1(basis.encode("utf-8")).hexdigest()


def _zoning_params(r: ZoningRow) -> tuple:
    return (r.fips, r.jurisdiction_id, r.zone_code, r.zone_desc, r.zone_category,
            bool(r.overlay), r.ordinance_url, r.effective_date, zoning_source_key(r),
            json.dumps(r.raw, default=str), r.geom.wkt if r.geom is not None else None)


class Upserter:
    def __init__(self, conn, cfg: Config, layer: str):
        self.conn = conn
        self.layer = layer
        self.batch_size = int(cfg.get("ingest.upsert_batch_size"))
        self.sql = PARCEL_SQL if layer == "parcels" else ZONING_SQL
        self._params = _parcel_params if layer == "parcels" else _zoning_params
        self._batch: dict = {}   # keyed to dedupe within a batch (ON CONFLICT can't
        self.upserted = 0        # touch the same row twice per statement)

    def _key(self, row) -> tuple:
        if self.layer == "parcels":
            return (row.fips, row.apn)
        return (row.jurisdiction_id, zoning_source_key(row))

    def add(self, row: ParcelRow | ZoningRow) -> None:
        if self.layer == "parcels" and not row.apn:
            return
        if self.layer == "zoning" and not row.zone_code:
            return
        self._batch[self._key(row)] = row
        if len(self._batch) >= self.batch_size:
            self.flush()

    def flush(self) -> None:
        # No commit here: the runner holds one transaction per job and commits
        # only after validation passes, so a failed run never half-loads.
        if not self._batch:
            return
        with self.conn.cursor() as cur:
            cur.executemany(self.sql, [self._params(r) for r in self._batch.values()])
        self.upserted += len(self._batch)
        self._batch.clear()
