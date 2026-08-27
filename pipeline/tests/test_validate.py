"""Validator rejects each §9 failure case for both layers."""
from shapely.geometry import MultiPolygon, Polygon, box

from core.models import ParcelRow, ZoningRow
from core.validate import validate_rows

SQ = MultiPolygon([Polygon([(0, 0), (0, 0.01), (0.01, 0.01), (0.01, 0)])])
TARGET_GEOM = box(-1, -1, 1, 1)
FAR_AWAY = MultiPolygon([Polygon([(50, 50), (50, 50.01), (50.01, 50.01), (50.01, 50)])])


def _parcels(n, **overrides):
    rows = []
    for i in range(n):
        kw = dict(apn=f"A-{i}", fips="99999", geom=SQ)
        kw.update({k: (v(i) if callable(v) else v) for k, v in overrides.items()})
        rows.append(ParcelRow(**kw))
    return rows


def _zoning(n, **overrides):
    rows = []
    for i in range(n):
        kw = dict(zone_code=f"R-{i % 3 + 1}", fips="99999", jurisdiction_id="9900001",
                  jurisdiction="Testville", geom=SQ, source_key=f"K-{i}",
                  zone_category="residential")
        kw.update({k: (v(i) if callable(v) else v) for k, v in overrides.items()})
        rows.append(ZoningRow(**kw))
    return rows


def _failed(report, check):
    return any(c["check"] == check and not c["ok"] for c in report.checks)


# ---- min_rows ----
def test_parcels_min_rows(cfg):
    r = validate_rows(_parcels(10), "parcels", "99999", cfg, TARGET_GEOM)
    assert _failed(r, "min_rows") and not r.ok


def test_zoning_min_rows(cfg):
    r = validate_rows(_zoning(5), "zoning", "9900001", cfg, TARGET_GEOM)
    assert _failed(r, "min_rows") and not r.ok


# ---- required-field null ratio ----
def test_parcels_null_apn_ratio(cfg):
    rows = _parcels(100, apn=lambda i: "" if i < 60 else f"A-{i}")
    r = validate_rows(rows, "parcels", "99999", cfg, TARGET_GEOM)
    assert _failed(r, "required_field_nulls")


def test_zoning_null_zone_code_ratio(cfg):
    rows = _zoning(100, zone_code=lambda i: "" if i < 30 else "R-1")
    r = validate_rows(rows, "zoning", "9900001", cfg, TARGET_GEOM)
    assert _failed(r, "required_field_nulls")


# ---- invalid geometry ratio ----
def test_parcels_invalid_geom_ratio(cfg):
    rows = _parcels(100, geom=lambda i: None if i < 10 else SQ)
    r = validate_rows(rows, "parcels", "99999", cfg, TARGET_GEOM)
    assert _failed(r, "invalid_geom_ratio")


def test_zoning_invalid_geom_ratio(cfg):
    rows = _zoning(100, geom=lambda i: None if i < 10 else SQ)
    r = validate_rows(rows, "zoning", "9900001", cfg, TARGET_GEOM)
    assert _failed(r, "invalid_geom_ratio")


# ---- bbox must intersect target ----
def test_parcels_bbox_outside_target(cfg):
    rows = _parcels(100, geom=FAR_AWAY)
    r = validate_rows(rows, "parcels", "99999", cfg, TARGET_GEOM)
    assert _failed(r, "bbox_intersects_target")


def test_zoning_bbox_outside_target(cfg):
    rows = _zoning(100, geom=FAR_AWAY)
    r = validate_rows(rows, "zoning", "9900001", cfg, TARGET_GEOM)
    assert _failed(r, "bbox_intersects_target")


# ---- duplicate key ratio ----
def test_parcels_duplicate_apn_ratio(cfg):
    rows = _parcels(100, apn=lambda i: f"A-{i % 50}")   # 50% dupes
    r = validate_rows(rows, "parcels", "99999", cfg, TARGET_GEOM)
    assert _failed(r, "duplicate_key_ratio")


def test_zoning_duplicate_source_key_ratio(cfg):
    rows = _zoning(100, source_key=lambda i: f"K-{i % 50}")
    r = validate_rows(rows, "zoning", "9900001", cfg, TARGET_GEOM)
    assert _failed(r, "duplicate_key_ratio")


# ---- zoning-only: too many 'other' categories ----
def test_zoning_other_category_ratio(cfg):
    rows = _zoning(100, zone_category=lambda i: "other" if i < 40 else "residential")
    r = validate_rows(rows, "zoning", "9900001", cfg, TARGET_GEOM)
    assert _failed(r, "zone_category_other_ratio")


# ---- clean data passes ----
def test_zoning_clean_passes(cfg):
    r = validate_rows(_zoning(50), "zoning", "9900001", cfg, TARGET_GEOM)
    assert r.ok, r.to_json()
