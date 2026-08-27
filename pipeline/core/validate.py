"""Per-layer validation rules (§9). Streaming so full ingests validate while
loading; emits a JSON report either way — the report is part of the self-heal
context bundle.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Optional

from shapely.geometry import box
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

from .config import Config
from .models import ParcelRow, ZoningRow

REQUIRED_FIELD_ATTRS = {"geom": "geom", "apn": "apn", "zone_code": "zone_code",
                        "jurisdiction": "jurisdiction"}


@dataclass
class ValidationReport:
    layer: str
    target_id: str
    ok: bool = True
    rows: int = 0
    checks: list[dict] = field(default_factory=list)
    unmapped_zone_codes: dict = field(default_factory=dict)

    def fail(self, name: str, detail: str) -> None:
        self.ok = False
        self.checks.append({"check": name, "ok": False, "detail": detail})

    def passed(self, name: str, detail: str = "") -> None:
        self.checks.append({"check": name, "ok": True, "detail": detail})

    def to_json(self) -> str:
        return json.dumps(self.__dict__, default=str, indent=2)


class StreamingValidator:
    """Consumes mapped rows one at a time; finalize() produces the report."""

    def __init__(self, layer: str, target_id: str, cfg: Config,
                 target_geom: Optional[BaseGeometry] = None):
        self.layer = layer
        self.cfg = cfg
        self.target_geom = target_geom
        self.rules = cfg.section(f"validation.{layer}")
        self.rows = 0
        self.null_counts: dict[str, int] = {f: 0 for f in self.rules["required_fields"]}
        self.invalid_geoms = 0
        self.seen_keys: set = set()
        self.dup_keys = 0
        self.zone_other = 0
        self.bbox_sample: list[BaseGeometry] = []
        self.bbox_sample_max = int(cfg.get("validation.bbox_sample_rows"))
        self.report = ValidationReport(layer=layer, target_id=target_id)

    def add(self, row: ParcelRow | ZoningRow) -> None:
        self.rows += 1
        for f in self.null_counts:
            attr = REQUIRED_FIELD_ATTRS.get(f, f)
            v = getattr(row, attr, None)
            if v in (None, ""):
                self.null_counts[f] += 1
        if row.geom is None:
            self.invalid_geoms += 1
        elif len(self.bbox_sample) < self.bbox_sample_max:
            self.bbox_sample.append(box(*row.geom.bounds))
        key = getattr(row, type(row).KEY_FIELD, None)
        if key not in (None, ""):
            if key in self.seen_keys:
                self.dup_keys += 1
            self.seen_keys.add(key)
        if self.layer == "zoning" and getattr(row, "zone_category", None) == "other":
            self.zone_other += 1

    def finalize(self, unmapped_zone_codes: Optional[dict] = None) -> ValidationReport:
        rep = self.report
        rep.rows = self.rows
        rep.unmapped_zone_codes = unmapped_zone_codes or {}
        n = max(self.rows, 1)

        min_rows = int(self.rules["min_rows"])
        if self.rows < min_rows:
            rep.fail("min_rows", f"{self.rows} rows < required {min_rows}")
        else:
            rep.passed("min_rows", f"{self.rows} rows")

        max_null = float(self.rules["max_null_ratio_per_field"])
        for f, nulls in self.null_counts.items():
            ratio = nulls / n
            if ratio > max_null:
                rep.fail("required_field_nulls",
                         f"{f} null in {ratio:.1%} of rows (max {max_null:.0%})")
            else:
                rep.passed("required_field_nulls", f"{f}: {ratio:.1%} null")

        max_invalid = float(self.cfg.get("validation.max_invalid_geom_ratio"))
        inv_ratio = self.invalid_geoms / n
        if inv_ratio > max_invalid:
            rep.fail("invalid_geom_ratio",
                     f"{inv_ratio:.1%} invalid/missing geometries (max {max_invalid:.0%})")
        else:
            rep.passed("invalid_geom_ratio", f"{inv_ratio:.1%}")

        if bool(self.cfg.get("validation.bbox_must_intersect_target")) and self.target_geom is not None:
            if self.bbox_sample:
                union_bbox = box(*unary_union(self.bbox_sample).bounds)
                if union_bbox.intersects(self.target_geom):
                    rep.passed("bbox_intersects_target")
                else:
                    rep.fail("bbox_intersects_target",
                             f"sample bbox {union_bbox.bounds} does not intersect target")
            elif self.rows:
                rep.fail("bbox_intersects_target", "no valid geometries to sample")

        max_dup = float(self.cfg.get("validation.max_duplicate_key_ratio"))
        dup_ratio = self.dup_keys / n
        if dup_ratio > max_dup:
            rep.fail("duplicate_key_ratio",
                     f"{dup_ratio:.1%} duplicate keys (max {max_dup:.1%})")
        else:
            rep.passed("duplicate_key_ratio", f"{dup_ratio:.1%}")

        if self.layer == "zoning" and self.rows:
            max_other = float(self.cfg.get("validation.max_zone_other_ratio"))
            other_ratio = self.zone_other / n
            if other_ratio > max_other:
                rep.fail("zone_category_other_ratio",
                         f"{other_ratio:.1%} rows categorized 'other' (max {max_other:.0%}) — "
                         "broken code field or mapping needs extending")
            else:
                rep.passed("zone_category_other_ratio", f"{other_ratio:.1%}")
        return rep


def validate_rows(rows: list[Any], layer: str, target_id: str, cfg: Config,
                  target_geom: Optional[BaseGeometry] = None,
                  unmapped_zone_codes: Optional[dict] = None) -> ValidationReport:
    v = StreamingValidator(layer, target_id, cfg, target_geom)
    for r in rows:
        v.add(r)
    return v.finalize(unmapped_zone_codes)
