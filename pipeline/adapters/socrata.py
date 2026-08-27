"""Rung 3: Socrata SODA API adapter (paginated .geojson resource endpoint)."""
from __future__ import annotations

from typing import Iterator

from core.config import Config
from core.http import Http
from core.log import get_logger
from core.models import SourceRecord, TargetRecord

from .base import GEOM_KEY, BaseAdapter

log = get_logger("adapter.socrata")


class SocrataAdapter(BaseAdapter):
    """source_url is the dataset's SODA resource URL, e.g.
    https://data.example.gov/resource/abcd-1234 — fetched as .geojson pages."""

    def fetch(self, target: TargetRecord, source: SourceRecord, cfg: Config,
              max_rows: int | None = None) -> Iterator[dict]:
        http = Http.from_config(cfg)
        url = (source.source_url or "").rstrip("/")
        if not url:
            raise ValueError(f"source for {target.id}/{self.layer} has no source_url")
        if not url.endswith(".geojson"):
            url = f"{url}.geojson"
        page_size = int(cfg.get("ingest.page_size"))
        offset, yielded = 0, 0
        order = source.extra.get("order_field") or ":id"
        while True:
            params = {"$limit": page_size, "$offset": offset, "$order": order}
            if source.extra.get("where"):
                params["$where"] = source.extra["where"]
            data = http.get_json(url, params=params)
            feats = data.get("features", []) if isinstance(data, dict) else []
            for f in feats:
                row = dict(f.get("properties") or {})
                row[GEOM_KEY] = f.get("geometry")
                yield row
                yielded += 1
                if max_rows and yielded >= max_rows:
                    return
            if len(feats) < page_size:
                return
            offset += page_size
