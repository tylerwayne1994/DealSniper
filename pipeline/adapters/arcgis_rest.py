"""Rung 2: generic ArcGIS FeatureServer/MapServer layer adapter.

Reads layer metadata (maxRecordCount, fields, geometry type), pages with
resultOffset/resultRecordCount requesting outSR=4326 + f=geojson, honours
exceededTransferLimit, and falls back to OID-range queries when offset
pagination is unsupported. Retries/backoff come from core.http.
"""
from __future__ import annotations

from typing import Any, Iterator, Optional

from core.config import Config
from core.http import FetchError, Http
from core.log import get_logger
from core.models import SourceRecord, TargetRecord

from .base import GEOM_KEY, BaseAdapter

log = get_logger("adapter.arcgis")


def _feature_to_row(feature: dict) -> dict:
    row = dict(feature.get("properties") or {})
    row[GEOM_KEY] = feature.get("geometry")
    return row


class ArcGISRestAdapter(BaseAdapter):
    def _layer_meta(self, http: Http, url: str) -> dict:
        meta = http.get_json(url, params={"f": "json"})
        if "error" in meta:
            raise FetchError(f"ArcGIS metadata error: {meta['error']}", url,
                             body_snippet=str(meta)[:2048])
        return meta

    def _query(self, http: Http, url: str, params: dict) -> dict:
        data = http.get_json(f"{url.rstrip('/')}/query", params=params)
        if isinstance(data, dict) and "error" in data:
            raise FetchError(f"ArcGIS query error: {data['error']}", url,
                             body_snippet=str(data)[:2048])
        return data

    def fetch(self, target: TargetRecord, source: SourceRecord, cfg: Config,
              max_rows: int | None = None) -> Iterator[dict]:
        http = Http.from_config(cfg)
        url = (source.source_url or "").rstrip("/")
        if not url:
            raise ValueError(f"source for {target.id}/{self.layer} has no source_url")
        meta = self._layer_meta(http, url)
        page_size = min(
            int(cfg.get("ingest.page_size")),
            int(meta.get("maxRecordCount") or cfg.get("ingest.page_size")),
        )
        where = source.extra.get("where") or "1=1"
        base = {
            "where": where, "outFields": "*", "outSR": 4326, "f": "geojson",
            "resultRecordCount": page_size, "returnGeometry": "true",
        }
        bbox = source.extra.get("geometry_bbox")  # [minx, miny, maxx, maxy] in 4326
        if bbox:
            base.update({
                "geometry": ",".join(str(v) for v in bbox),
                "geometryType": "esriGeometryEnvelope",
                "inSR": 4326, "spatialRel": "esriSpatialRelIntersects",
            })
        supports_pagination = bool(
            meta.get("advancedQueryCapabilities", {}).get("supportsPagination",
                                                          meta.get("supportsPagination", False))
        )
        yielded = 0
        if supports_pagination:
            offset = 0
            while True:
                data = self._query(http, url, {**base, "resultOffset": offset})
                feats = data.get("features", [])
                for f in feats:
                    yield _feature_to_row(f)
                    yielded += 1
                    if max_rows and yielded >= max_rows:
                        return
                if not feats:
                    return
                exceeded = data.get("exceededTransferLimit") or (
                    data.get("properties", {}) or {}).get("exceededTransferLimit")
                if len(feats) < page_size and not exceeded:
                    return
                offset += len(feats)
        else:
            yield from self._fetch_by_oid(http, url, meta, base, page_size, max_rows)

    def _fetch_by_oid(self, http: Http, url: str, meta: dict, base: dict,
                      page_size: int, max_rows: Optional[int]) -> Iterator[dict]:
        oid_field = meta.get("objectIdField") or next(
            (f["name"] for f in meta.get("fields", [])
             if str(f.get("type")) == "esriFieldTypeOID"), "OBJECTID")
        ids_data = self._query(http, url, {
            "where": base["where"], "returnIdsOnly": "true", "f": "json"})
        oids = sorted(ids_data.get("objectIds") or [])
        if not oids:
            return
        yielded = 0
        for i in range(0, len(oids), page_size):
            lo, hi = oids[i], oids[min(i + page_size, len(oids)) - 1]
            where = f"{oid_field} >= {lo} AND {oid_field} <= {hi}"
            if base["where"] not in ("1=1", None):
                where = f"({base['where']}) AND {where}"
            data = self._query(http, url, {**base, "where": where})
            for f in data.get("features", []):
                yield _feature_to_row(f)
                yielded += 1
                if max_rows and yielded >= max_rows:
                    return
