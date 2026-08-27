import sys
from pathlib import Path

import pytest

PIPELINE_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PIPELINE_ROOT))

from core.config import Config  # noqa: E402
from core.models import SourceRecord, TargetRecord  # noqa: E402


@pytest.fixture()
def cfg(monkeypatch):
    # Tests never hit the network; endpoint values just need to exist.
    for var, val in {
        "CENSUS_API_BASE": "https://census.invalid/data",
        "CENSUS_TIGER_BASE": "https://tiger.invalid/MapServer",
        "ARCGIS_HUB_API_BASE": "https://hub.invalid/api/v3",
        "SOCRATA_DISCOVERY_API": "https://socrata.invalid/catalog/v1",
        "SCRAPER_USER_AGENT": "DealSniperTest/0.0 (pytest)",
        "CLAUDE_MODEL": "claude-test-model",
        "TILES_DIR": "tiles-test",
        "TILES_BASE_URL": "http://tiles.invalid/tiles",
    }.items():
        monkeypatch.setenv(var, val)
    return Config.load()


@pytest.fixture()
def target():
    return TargetRecord(id="99999", kind="county", fips="99999", name="Test County",
                        state="TS", state_fips="99", bbox=[-1.0, -1.0, 1.0, 1.0])


@pytest.fixture()
def zoning_target():
    return TargetRecord(id="9900001", kind="city", fips="99999", name="Testville",
                        state="TS", state_fips="99", bbox=[-1.0, -1.0, 1.0, 1.0])


@pytest.fixture()
def source():
    return SourceRecord(target_id="99999", layer="parcels", rung="arcgis_rest",
                        source_url="https://gis.invalid/FeatureServer/0")


class FakeResponse:
    def __init__(self, json_data=None, text="", status_code=200):
        self._json = json_data
        self.text = text if text else ("" if json_data is None else "json")
        self.status_code = status_code

    def json(self):
        if self._json is None:
            raise ValueError("no json")
        return self._json


class FakeSession:
    """Route (method, url, params) -> FakeResponse via a handler callable."""

    def __init__(self, handler):
        self.handler = handler
        self.headers = {}
        self.calls = []

    def request(self, method, url, timeout=None, params=None, **kw):
        self.calls.append((method, url, params))
        return self.handler(method, url, params or {})

    def get(self, url, timeout=None, stream=False, params=None, **kw):
        return self.request("GET", url, timeout=timeout, params=params)


@pytest.fixture()
def fake_http_factory():
    from core.http import Http

    def make(handler):
        return Http(timeout_s=5, max_retries=0, backoff_base_s=0,
                    session_factory=lambda: FakeSession(handler))
    return make
