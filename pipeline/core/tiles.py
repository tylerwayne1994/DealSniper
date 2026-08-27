"""PostGIS -> GeoJSONSeq -> tippecanoe -> PMTiles, per county per layer (§10).

Writes <fips>_<layer>.pmtiles atomically and maintains tiles/index.json listing
counties, layers, bbox, and URL.
"""
from __future__ import annotations

import json
import os
import subprocess
import tempfile
from pathlib import Path

from .config import Config
from .log import get_logger

log = get_logger("tiles")


def _dump_geojsonseq(conn, cfg: Config, fips: str, layer: str, dest: Path) -> int:
    props = cfg.get(f"tiles.properties.{layer}")
    if layer == "parcels":
        cols = ", ".join(f"p.{c}" for c in props)
        sql = (f"SELECT ST_AsGeoJSON(p.geom) AS gj, {cols} "
               f"FROM parcels p WHERE p.fips = %s AND p.geom IS NOT NULL")
    else:
        col_map = {"jurisdiction": "j.name AS jurisdiction"}
        cols = ", ".join(col_map.get(c, f"z.{c}") for c in props)
        sql = (f"SELECT ST_AsGeoJSON(z.geom) AS gj, {cols} "
               f"FROM zoning z JOIN jurisdictions j ON j.id = z.jurisdiction_id "
               f"WHERE z.fips = %s AND z.geom IS NOT NULL")
    n = 0
    with conn.cursor(name=f"tiles_{fips}_{layer}") as cur, \
            open(dest, "w", encoding="utf-8") as out:
        cur.itersize = 5000
        cur.execute(sql, (fips,))
        colnames = None
        for row in cur:
            if colnames is None:
                colnames = [d.name for d in cur.description]
            rec = dict(zip(colnames, row))
            gj = rec.pop("gj")
            out.write(json.dumps({
                "type": "Feature", "geometry": json.loads(gj),
                "properties": {k: (str(v) if hasattr(v, "isoformat") else v)
                               for k, v in rec.items()},
            }, default=str) + "\n")
            n += 1
    return n


def build_tiles(conn, cfg: Config, fips: str, layer: str) -> Path:
    cfg.require_env(["tiles"])
    out_dir = Path(str(cfg.get("tiles.output_dir")))
    out_dir.mkdir(parents=True, exist_ok=True)
    final = out_dir / f"{fips}_{layer}.pmtiles"
    bin_ = str(cfg.get("tiles.tippecanoe_bin"))
    with tempfile.TemporaryDirectory(prefix="ds_tiles_") as tmp:
        seq = Path(tmp) / f"{fips}_{layer}.geojsonl"
        rows = _dump_geojsonseq(conn, cfg, fips, layer, seq)
        if rows == 0:
            raise RuntimeError(f"no rows to tile for {fips}/{layer}")
        tmp_out = Path(tmp) / final.name
        cmd = [bin_, "-o", str(tmp_out),
               "--minimum-zoom", str(cfg.get("tiles.min_zoom")),
               "--maximum-zoom", str(cfg.get("tiles.max_zoom")),
               "--layer", layer, "--force",
               "--drop-densest-as-needed", "--extend-zooms-if-still-dropping",
               "--read-parallel", str(seq)]
        log.info("tippecanoe %s/%s (%d features)", fips, layer, rows)
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode != 0:
            raise RuntimeError(f"tippecanoe failed: {proc.stderr[-2000:]}")
        os.replace(tmp_out, final)  # atomic within the same filesystem
    _update_index(conn, cfg, fips, layer, final)
    return final


def _update_index(conn, cfg: Config, fips: str, layer: str, pmtiles_path: Path) -> None:
    out_dir = Path(str(cfg.get("tiles.output_dir")))
    base_url = str(cfg.get("tiles.base_url")).rstrip("/")
    index_path = out_dir / "index.json"
    index = {"counties": {}}
    if index_path.exists():
        try:
            index = json.loads(index_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass
    with conn.cursor() as cur:
        cur.execute("SELECT name, ST_XMin(bbox), ST_YMin(bbox), ST_XMax(bbox), ST_YMax(bbox) "
                    "FROM counties WHERE fips = %s", (fips,))
        row = cur.fetchone()
    name = row[0] if row else fips
    bbox = list(row[1:5]) if row and row[1] is not None else None
    entry = index.setdefault("counties", {}).setdefault(
        fips, {"name": name, "bbox": bbox, "layers": {}})
    entry["name"], entry["bbox"] = name, bbox
    entry["layers"][layer] = {"url": f"{base_url}/{pmtiles_path.name}",
                              "size_bytes": pmtiles_path.stat().st_size}
    fd, tmp = tempfile.mkstemp(dir=str(out_dir), suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        json.dump(index, fh, indent=2)
    os.replace(tmp, index_path)
