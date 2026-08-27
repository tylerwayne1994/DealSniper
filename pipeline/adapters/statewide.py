"""Rung 5: statewide dataset filtered down to one county / jurisdiction.

Two filter strategies, chosen per source record:
  - attribute: extra.filter_field / extra.filter_value (e.g. county FIPS column)
  - spatial:   rows whose geometry intersects the target polygon (fallback)
Statewide sources can be a bulk file or an ArcGIS layer (extra.kind).
"""
from __future__ import annotations

from typing import Iterator

from shapely import wkt as shapely_wkt

from core.config import Config
from core.log import get_logger
from core.models import SourceRecord, TargetRecord

from .base import GEOM_KEY, BaseAdapter, normalize_geom
from .arcgis_rest import ArcGISRestAdapter
from .bulk_download import BulkDownloadAdapter

log = get_logger("adapter.statewide")


class StatewideAdapter(BaseAdapter):
    def fetch(self, target: TargetRecord, source: SourceRecord, cfg: Config,
              max_rows: int | None = None) -> Iterator[dict]:
        kind = source.extra.get("kind", "bulk")
        filter_field = source.extra.get("filter_field")
        filter_value = source.extra.get("filter_value")

        if kind == "arcgis":
            inner: BaseAdapter = ArcGISRestAdapter(self.layer, target, source, cfg)
            if filter_field and filter_value:
                source.extra["where"] = f"{filter_field} = '{filter_value}'"
                yield from inner.fetch(target, source, cfg, max_rows=max_rows)
                return
        else:
            inner = BulkDownloadAdapter(self.layer, target, source, cfg)

        target_geom = shapely_wkt.loads(target.geom_wkt) if target.geom_wkt else None
        prepared = None
        if target_geom is not None:
            from shapely.prepared import prep
            prepared = prep(target_geom)

        yielded = 0
        for row in inner.fetch(target, source, cfg, max_rows=None):
            if filter_field and filter_value:
                if str(row.get(filter_field, "")).strip() != str(filter_value):
                    continue
            elif prepared is not None:
                geom = normalize_geom(row.get(GEOM_KEY))
                if geom is None or not prepared.intersects(geom):
                    continue
                row[GEOM_KEY] = geom
            yield row
            yielded += 1
            if max_rows and yielded >= max_rows:
                return
