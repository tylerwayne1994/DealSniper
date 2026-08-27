"""Rung 4: CKAN adapter — datastore API pagination or plain resource download."""
from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Iterator
from urllib.parse import urlparse

from core.config import Config
from core.http import Http
from core.log import get_logger
from core.models import SourceRecord, TargetRecord

from .base import GEOM_KEY, BaseAdapter, read_geo_file

log = get_logger("adapter.ckan")


class CkanAdapter(BaseAdapter):
    """source_url is either a CKAN datastore_search endpoint (extra.resource_id set)
    or a direct resource file URL (delegated to the bulk reader)."""

    def fetch(self, target: TargetRecord, source: SourceRecord, cfg: Config,
              max_rows: int | None = None) -> Iterator[dict]:
        http = Http.from_config(cfg)
        url = source.source_url or ""
        if not url:
            raise ValueError(f"source for {target.id}/{self.layer} has no source_url")
        resource_id = source.extra.get("resource_id")
        if resource_id:
            yield from self._fetch_datastore(http, url, resource_id, cfg, max_rows)
            return
        suffix = Path(urlparse(url).path).suffix.lower() or ".bin"
        with tempfile.TemporaryDirectory(prefix="ds_ckan_") as tmp:
            dest = Path(tmp) / f"resource{suffix}"
            http.download(url, dest)
            count = 0
            for row in read_geo_file(dest, max_features=max_rows):
                yield row
                count += 1
                if max_rows and count >= max_rows:
                    return

    def _fetch_datastore(self, http: Http, base_url: str, resource_id: str,
                         cfg: Config, max_rows: int | None) -> Iterator[dict]:
        from shapely import wkt as shapely_wkt
        import json as _json
        from shapely.geometry import shape as _shape

        page_size = int(cfg.get("ingest.page_size"))
        offset, yielded = 0, 0
        endpoint = f"{base_url.rstrip('/')}/api/3/action/datastore_search"
        while True:
            data = http.get_json(endpoint, params={
                "resource_id": resource_id, "limit": page_size, "offset": offset})
            if not data.get("success"):
                raise RuntimeError(f"CKAN datastore_search failed: {str(data)[:1024]}")
            records = data["result"].get("records", [])
            for rec in records:
                geom = None
                for key in ("wkt", "geometry", "the_geom", "geom", "shape"):
                    v = rec.get(key)
                    if isinstance(v, str) and v:
                        try:
                            geom = (_shape(_json.loads(v)) if v.lstrip().startswith("{")
                                    else shapely_wkt.loads(v))
                        except Exception:
                            geom = None
                        break
                    if isinstance(v, dict):
                        geom = v
                        break
                rec[GEOM_KEY] = geom
                yield rec
                yielded += 1
                if max_rows and yielded >= max_rows:
                    return
            if len(records) < page_size:
                return
            offset += page_size
