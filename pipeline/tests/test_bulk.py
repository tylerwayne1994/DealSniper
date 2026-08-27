"""Bulk adapter reads a zipped shapefile fixture built on the fly."""
import zipfile

from shapely.geometry import Polygon

from adapters.base import GEOM_KEY
from adapters.bulk_download import BulkDownloadAdapter
from core.models import SourceRecord


def _make_zipped_shapefile(tmp_path):
    import geopandas as gpd

    polys = [Polygon([(i, 0), (i, 1), (i + 1, 1), (i + 1, 0)]) for i in range(5)]
    gdf = gpd.GeoDataFrame(
        {"APN": [f"P-{i}" for i in range(5)],
         "OWNER": [f"Owner {i}" for i in range(5)]},
        geometry=polys, crs="EPSG:4326")
    shp_dir = tmp_path / "shp"
    shp_dir.mkdir()
    gdf.to_file(shp_dir / "parcels.shp")
    zpath = tmp_path / "parcels.zip"
    with zipfile.ZipFile(zpath, "w") as z:
        for f in shp_dir.iterdir():
            z.write(f, f.name)
    return zpath


def test_reads_zipped_shapefile(cfg, target, tmp_path):
    zpath = _make_zipped_shapefile(tmp_path)
    src = SourceRecord(target_id=target.id, layer="parcels", rung="bulk_download",
                       source_url=zpath.resolve().as_uri())
    adapter = BulkDownloadAdapter("parcels", target, src, cfg)
    rows = list(adapter.fetch(target, src, cfg))
    assert len(rows) == 5
    assert rows[0][GEOM_KEY] is not None
    mapped = adapter.map_row(rows[0])
    assert mapped.apn == "P-0"
    assert mapped.owner_name == "Owner 0"
    assert mapped.geom.geom_type == "MultiPolygon"
