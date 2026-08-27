"""Adapter interface + shared mapping machinery.

An adapter's fetch() yields raw dicts with a shapely geometry under GEOM_KEY;
map_row() turns one into a canonical ParcelRow / ZoningRow using
config/field_synonyms.yaml (normalized exact match, then fuzzy match at the
configured threshold). Unmatched source columns land in `raw`.
"""
from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator, Optional, Protocol

import yaml
from shapely.geometry import shape
from shapely.geometry.base import BaseGeometry
from shapely import MultiPolygon, Polygon
from shapely.validation import make_valid

from core.config import Config
from core.models import ParcelRow, SourceRecord, TargetRecord, ZoningRow

GEOM_KEY = "__geometry"


class Adapter(Protocol):
    layer: str

    def fetch(self, target: TargetRecord, source: SourceRecord, cfg: Config) -> Iterator[dict]: ...

    def map_row(self, raw: dict) -> ParcelRow | ZoningRow: ...


def _norm(header: str) -> str:
    return re.sub(r"[^a-z0-9]", "", header.lower())


_SYNONYMS_CACHE: dict[str, dict] = {}


def load_synonyms(cfg: Config) -> dict:
    path = str(cfg.root / "config" / "field_synonyms.yaml")
    if path not in _SYNONYMS_CACHE:
        with open(path, "r", encoding="utf-8") as fh:
            _SYNONYMS_CACHE[path] = yaml.safe_load(fh)
    return _SYNONYMS_CACHE[path]


def build_field_map(headers: list[str], layer: str, cfg: Config) -> dict[str, str]:
    """source header -> canonical field, for one dataset's headers."""
    synonyms = load_synonyms(cfg)[layer]
    norm_headers = {h: _norm(h) for h in headers}
    mapping: dict[str, str] = {}
    claimed: set[str] = set()
    for canonical, alts in synonyms.items():
        alt_set = {_norm(canonical)} | {_norm(a) for a in alts}
        for h, nh in norm_headers.items():
            if h not in claimed and nh in alt_set:
                mapping[h] = canonical
                claimed.add(h)
                break
    # fuzzy pass for canonical fields still unmatched
    threshold = float(cfg.get("field_matching.fuzzy_threshold"))
    unmatched_canon = [c for c in synonyms if c not in mapping.values()]
    if unmatched_canon:
        try:
            from rapidfuzz import fuzz
        except ImportError:
            return mapping
        for canonical in unmatched_canon:
            alts = [_norm(canonical)] + [_norm(a) for a in synonyms[canonical]]
            best_h, best_score = None, 0.0
            for h, nh in norm_headers.items():
                if h in claimed or not nh:
                    continue
                score = max(fuzz.ratio(nh, a) for a in alts)
                if score > best_score:
                    best_h, best_score = h, score
            if best_h and best_score >= threshold:
                mapping[best_h] = canonical
                claimed.add(best_h)
    return mapping


def normalize_geom(geom: Any) -> Optional[BaseGeometry]:
    """GeoJSON dict or shapely -> valid MultiPolygon in 4326 (already reprojected)."""
    if geom is None:
        return None
    if isinstance(geom, dict):
        try:
            geom = shape(geom)
        except Exception:
            return None
    if not isinstance(geom, BaseGeometry) or geom.is_empty:
        return None
    if not geom.is_valid:
        geom = make_valid(geom)
    if isinstance(geom, Polygon):
        geom = MultiPolygon([geom])
    elif geom.geom_type == "GeometryCollection":
        polys = [g for g in geom.geoms if isinstance(g, (Polygon, MultiPolygon))]
        if not polys:
            return None
        parts: list[Polygon] = []
        for g in polys:
            parts.extend(g.geoms if isinstance(g, MultiPolygon) else [g])
        geom = MultiPolygon(parts)
    if not isinstance(geom, MultiPolygon):
        return None
    return geom


def _to_num(v: Any) -> Optional[float]:
    if v in (None, ""):
        return None
    try:
        return float(re.sub(r"[$,]", "", v.strip())) if isinstance(v, str) else float(v)
    except (ValueError, TypeError):
        return None


def _to_int(v: Any) -> Optional[int]:
    n = _to_num(v)
    return int(n) if n is not None else None


_DATE_FORMATS = ("%Y-%m-%d", "%Y%m%d", "%m/%d/%Y", "%m/%d/%y", "%Y/%m/%d", "%Y-%m-%dT%H:%M:%S")


def _to_date(v: Any) -> Optional[str]:
    if v in (None, ""):
        return None
    if isinstance(v, (int, float)):  # epoch millis (ArcGIS) or seconds
        try:
            ts = float(v)
            if abs(ts) > 1e11:
                ts /= 1000.0
            return datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")
        except (ValueError, OSError, OverflowError):
            return None
    s = str(v).strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s[:19] if "T" in s else s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _to_bool(v: Any) -> bool:
    if isinstance(v, bool):
        return v
    return str(v).strip().lower() in ("1", "true", "y", "yes", "t")


class ZoneCategorizer:
    """zone_code/zone_desc -> normalized category, from the config regex mapping."""

    def __init__(self, cfg: Config):
        self.rules = [
            (re.compile(r["pattern"], re.IGNORECASE), r["category"])
            for r in cfg.get("zone_categories")
        ]
        self.unmapped: dict[str, int] = {}

    def categorize(self, code: Optional[str], desc: Optional[str]) -> str:
        text = " ".join(x for x in (code, desc) if x)
        if not text:
            return "other"
        for rx, cat in self.rules:
            if rx.search(text.upper()):
                return cat
        self.unmapped[code or text] = self.unmapped.get(code or text, 0) + 1
        return "other"


class BaseAdapter:
    """Common map_row logic; subclasses implement fetch()."""

    def __init__(self, layer: str, target: TargetRecord, source: SourceRecord, cfg: Config):
        self.layer = layer
        self.target = target
        self.source = source
        self.cfg = cfg
        self._field_map: Optional[dict[str, str]] = None
        self._categorizer = ZoneCategorizer(cfg) if layer == "zoning" else None

    # -- fetch is provided by subclasses --
    def fetch(self, target: TargetRecord, source: SourceRecord, cfg: Config) -> Iterator[dict]:
        raise NotImplementedError

    def _fields(self, raw: dict) -> dict[str, Any]:
        props = {k: v for k, v in raw.items() if k != GEOM_KEY}
        if self._field_map is None:
            self._field_map = build_field_map(list(props.keys()), self.layer, self.cfg)
        canon: dict[str, Any] = {}
        leftovers: dict[str, Any] = {}
        for k, v in props.items():
            target_field = self._field_map.get(k)
            if target_field and target_field not in canon and v not in (None, ""):
                canon[target_field] = v
            else:
                leftovers[k] = v
        canon["__raw"] = leftovers
        return canon

    def map_row(self, raw: dict) -> ParcelRow | ZoningRow:
        geom = normalize_geom(raw.get(GEOM_KEY))
        f = self._fields(raw)
        clean = lambda v: str(v).strip() if v not in (None, "") else None  # noqa: E731
        if self.layer == "parcels":
            return ParcelRow(
                apn=clean(f.get("apn")) or "",
                fips=self.target.fips,
                geom=geom,
                owner_name=clean(f.get("owner_name")),
                owner_mail_addr=clean(f.get("owner_mail_addr")),
                situs_addr=clean(f.get("situs_addr")),
                situs_city=clean(f.get("situs_city")),
                situs_zip=(clean(f.get("situs_zip")) or "")[:10] or None,
                land_use_code=clean(f.get("land_use_code")),
                land_use_desc=clean(f.get("land_use_desc")),
                zoning=clean(f.get("zoning")),
                zoning_source="source" if clean(f.get("zoning")) else None,
                assessed_land=_to_num(f.get("assessed_land")),
                assessed_impr=_to_num(f.get("assessed_impr")),
                assessed_total=_to_num(f.get("assessed_total")),
                last_sale_date=_to_date(f.get("last_sale_date")),
                last_sale_price=_to_num(f.get("last_sale_price")),
                year_built=_to_int(f.get("year_built")),
                sqft_bldg=_to_num(f.get("sqft_bldg")),
                sqft_lot=_to_num(f.get("sqft_lot")),
                units=_to_int(f.get("units")),
                raw=f["__raw"],
            )
        code = clean(f.get("zone_code")) or ""
        desc = clean(f.get("zone_desc"))
        return ZoningRow(
            zone_code=code,
            fips=self.target.fips,
            jurisdiction_id=self.target.id,
            jurisdiction=self.target.name,
            geom=geom,
            zone_desc=desc,
            zone_category=self._categorizer.categorize(code, desc),  # type: ignore[union-attr]
            overlay=_to_bool(f.get("overlay")),
            ordinance_url=clean(f.get("ordinance_url")),
            effective_date=_to_date(f.get("effective_date")),
            source_key=clean(f.get("source_key")),
            raw=f["__raw"],
        )

    @property
    def unmapped_zone_codes(self) -> dict[str, int]:
        return dict(self._categorizer.unmapped) if self._categorizer else {}


def read_geo_file(path: Path, max_features: Optional[int] = None) -> Iterator[dict]:
    """Read any GDAL-supported geo file (shp/zip/geojson/gpkg/csv+wkt) as raw dicts.

    Reprojects to EPSG:4326. Shared by bulk_download, ckan, and statewide.
    """
    import geopandas as gpd

    read_kw: dict[str, Any] = {}
    if max_features:
        read_kw["max_features"] = max_features
    p = str(path)
    if p.lower().endswith(".zip"):
        p = f"zip://{p}"
    if p.lower().endswith(".csv"):
        import pandas as pd
        from shapely import wkt as shapely_wkt

        df = pd.read_csv(path, nrows=max_features)
        cols = {c.lower(): c for c in df.columns}
        for row in df.to_dict("records"):
            geom = None
            for key in ("wkt", "geometry", "the_geom", "geom", "shape"):
                if key in cols and isinstance(row.get(cols[key]), str):
                    try:
                        geom = shapely_wkt.loads(row[cols[key]])
                    except Exception:
                        geom = None
                    break
            row[GEOM_KEY] = geom
            yield row
        return
    gdf = gpd.read_file(p, **read_kw)
    if gdf.crs is not None and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(4326)
    geom_col = gdf.geometry.name
    for row in gdf.to_dict("records"):
        row[GEOM_KEY] = row.pop(geom_col, None)
        yield row
