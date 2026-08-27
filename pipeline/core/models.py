"""Shared record types passed between discover, adapters, validation, and load."""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Optional


@dataclass
class TargetRecord:
    """A county (parcels / unincorporated zoning) or a Census Place (city zoning)."""

    id: str                      # county fips, place GEOID, or '<fips>-UNINC'
    kind: str                    # county | city | town | cdp | unincorporated
    fips: str                    # containing county fips
    name: str
    state: str                   # 2-letter USPS
    state_fips: str
    bbox: Optional[list] = None  # [minx, miny, maxx, maxy] in EPSG:4326
    geom_wkt: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class SourceRecord:
    """One row per (target, layer); mirrors the `sources` table and sources.yaml."""

    target_id: str
    layer: str                   # parcels | zoning
    rung: Optional[str] = None   # bulk_download | arcgis_rest | socrata | ckan | statewide | scraper | generated
    source_url: Optional[str] = None
    adapter_module: Optional[str] = None
    status: str = "pending"      # pending | pending_approval | ok | failed | needs_human
    last_error: Optional[str] = None
    rewrite_count: int = 0
    rungs_tried: dict = field(default_factory=dict)   # {rung: reason_it_failed}
    discovery_mode: bool = False
    extra: dict = field(default_factory=dict)         # adapter hints: layer meta, filter fields, format
    id: Optional[int] = None                          # DB id once synced

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "SourceRecord":
        known = {f for f in cls.__dataclass_fields__}
        return cls(**{k: v for k, v in d.items() if k in known})


@dataclass
class ParcelRow:
    apn: str
    fips: str
    geom: Any                    # shapely geometry (MultiPolygon after normalization)
    owner_name: Optional[str] = None
    owner_mail_addr: Optional[str] = None
    situs_addr: Optional[str] = None
    situs_city: Optional[str] = None
    situs_zip: Optional[str] = None
    land_use_code: Optional[str] = None
    land_use_desc: Optional[str] = None
    zoning: Optional[str] = None
    zoning_source: Optional[str] = None
    assessed_land: Optional[float] = None
    assessed_impr: Optional[float] = None
    assessed_total: Optional[float] = None
    last_sale_date: Optional[str] = None
    last_sale_price: Optional[float] = None
    year_built: Optional[int] = None
    sqft_bldg: Optional[float] = None
    sqft_lot: Optional[float] = None
    units: Optional[int] = None
    raw: dict = field(default_factory=dict)

    KEY_FIELD = "apn"


@dataclass
class ZoningRow:
    zone_code: str
    fips: str
    jurisdiction_id: str
    jurisdiction: str
    geom: Any
    zone_desc: Optional[str] = None
    zone_category: str = "other"
    overlay: bool = False
    ordinance_url: Optional[str] = None
    effective_date: Optional[str] = None
    source_key: Optional[str] = None
    raw: dict = field(default_factory=dict)

    KEY_FIELD = "source_key"
