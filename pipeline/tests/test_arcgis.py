"""ArcGIS adapter pagination against a mocked 5,000-row FeatureServer."""
import core.http
from adapters.arcgis_rest import ArcGISRestAdapter
from adapters.base import GEOM_KEY

TOTAL = 5000
PAGE = 1000

SQUARE = {"type": "Polygon",
          "coordinates": [[[0, 0], [0, 0.001], [0.001, 0.001], [0.001, 0], [0, 0]]]}


def _service(method, url, params):
    from tests.conftest import FakeResponse
    if url.endswith("/query"):
        offset = int(params.get("resultOffset", 0))
        count = min(int(params.get("resultRecordCount", PAGE)), PAGE)
        feats = [{"type": "Feature",
                  "properties": {"APN": f"APN-{i}", "OBJECTID": i},
                  "geometry": SQUARE}
                 for i in range(offset, min(offset + count, TOTAL))]
        return FakeResponse(json_data={
            "type": "FeatureCollection", "features": feats,
            "exceededTransferLimit": offset + count < TOTAL})
    return FakeResponse(json_data={
        "maxRecordCount": PAGE, "geometryType": "esriGeometryPolygon",
        "objectIdField": "OBJECTID",
        "fields": [{"name": "APN", "type": "esriFieldTypeString"},
                   {"name": "OBJECTID", "type": "esriFieldTypeOID"}],
        "advancedQueryCapabilities": {"supportsPagination": True}})


def test_paginates_all_5000_rows(cfg, target, source, fake_http_factory, monkeypatch):
    http = fake_http_factory(_service)
    monkeypatch.setattr(core.http.Http, "from_config",
                        classmethod(lambda cls, c, **kw: http))
    adapter = ArcGISRestAdapter("parcels", target, source, cfg)
    rows = list(adapter.fetch(target, source, cfg))
    assert len(rows) == TOTAL
    assert rows[0]["APN"] == "APN-0" and rows[-1]["APN"] == f"APN-{TOTAL - 1}"
    assert rows[0][GEOM_KEY] == SQUARE
    # every page requested outSR=4326 geojson
    for _, url, params in http.session.calls:
        if url.endswith("/query"):
            assert params["outSR"] == 4326 and params["f"] == "geojson"


def _service_no_pagination(method, url, params):
    from tests.conftest import FakeResponse
    if url.endswith("/query"):
        if params.get("returnIdsOnly") == "true":
            return FakeResponse(json_data={"objectIds": list(range(TOTAL))})
        where = params.get("where", "")
        import re
        m = re.search(r">= (\d+) AND \w+ <= (\d+)", where)
        lo, hi = int(m.group(1)), int(m.group(2))
        feats = [{"type": "Feature", "properties": {"APN": f"APN-{i}", "OBJECTID": i},
                  "geometry": SQUARE} for i in range(lo, hi + 1)]
        return FakeResponse(json_data={"type": "FeatureCollection", "features": feats})
    return FakeResponse(json_data={
        "maxRecordCount": PAGE, "geometryType": "esriGeometryPolygon",
        "objectIdField": "OBJECTID",
        "fields": [{"name": "OBJECTID", "type": "esriFieldTypeOID"}],
        "advancedQueryCapabilities": {"supportsPagination": False}})


def test_oid_range_fallback(cfg, target, source, fake_http_factory, monkeypatch):
    http = fake_http_factory(_service_no_pagination)
    monkeypatch.setattr(core.http.Http, "from_config",
                        classmethod(lambda cls, c, **kw: http))
    adapter = ArcGISRestAdapter("parcels", target, source, cfg)
    rows = list(adapter.fetch(target, source, cfg))
    assert len(rows) == TOTAL


def test_map_row_canonicalizes(cfg, target, source, fake_http_factory, monkeypatch):
    http = fake_http_factory(_service)
    monkeypatch.setattr(core.http.Http, "from_config",
                        classmethod(lambda cls, c, **kw: http))
    adapter = ArcGISRestAdapter("parcels", target, source, cfg)
    raw = next(iter(adapter.fetch(target, source, cfg, max_rows=1)))
    row = adapter.map_row(raw)
    assert row.apn == "APN-0"
    assert row.fips == target.fips
    assert row.geom is not None and row.geom.geom_type == "MultiPolygon"
