"""Rung 1: one-shot download of a geo file from an open-data portal."""
from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Iterator
from urllib.parse import urlparse

from core.config import Config
from core.http import Http
from core.log import get_logger
from core.models import SourceRecord, TargetRecord

from .base import BaseAdapter, read_geo_file

log = get_logger("adapter.bulk")

_EXT_BY_HINT = {
    "geojson": ".geojson", "json": ".geojson", "gpkg": ".gpkg",
    "shapefile": ".zip", "zip": ".zip", "csv": ".csv",
}


class BulkDownloadAdapter(BaseAdapter):
    def fetch(self, target: TargetRecord, source: SourceRecord, cfg: Config,
              max_rows: int | None = None) -> Iterator[dict]:
        http = Http.from_config(cfg)
        url = source.source_url
        if not url:
            raise ValueError(f"source for {target.id}/{self.layer} has no source_url")
        suffix = Path(urlparse(url).path).suffix.lower()
        if not suffix:
            suffix = _EXT_BY_HINT.get(str(source.extra.get("format", "")).lower(), ".bin")
        with tempfile.TemporaryDirectory(prefix="ds_bulk_") as tmp:
            dest = Path(tmp) / f"download{suffix}"
            log.info("downloading %s -> %s", url, dest.name)
            http.download(url, dest)
            count = 0
            for row in read_geo_file(dest, max_features=max_rows):
                yield row
                count += 1
                if max_rows and count >= max_rows:
                    return
