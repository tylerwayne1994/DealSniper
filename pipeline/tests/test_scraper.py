"""Scraper base: robots refusal, delay enforcement, page cap."""
import pytest

import adapters.scraper as scraper_mod
from adapters.scraper import PageCapExceeded, RobotsDisallowed, ScraperBase
from core.models import SourceRecord
from tests.conftest import FakeResponse, FakeSession


def _mk_scraper(cfg, target, handler):
    src = SourceRecord(target_id=target.id, layer="parcels", rung="scraper",
                       source_url="https://assessor.invalid/records")
    s = ScraperBase("parcels", target, src, cfg)
    s.http.session = FakeSession(handler)
    return s


def test_refuses_robots_disallowed_path(cfg, target):
    def handler(method, url, params):
        if url.endswith("/robots.txt"):
            return FakeResponse(text="User-agent: *\nDisallow: /records\n")
        return FakeResponse(text="<html></html>")
    s = _mk_scraper(cfg, target, handler)
    with pytest.raises(RobotsDisallowed):
        s.get_page("https://assessor.invalid/records?page=1")


def test_enforces_min_delay(cfg, target, monkeypatch):
    sleeps = []
    monkeypatch.setattr(scraper_mod.time, "sleep", lambda s: sleeps.append(s))
    def handler(method, url, params):
        if url.endswith("/robots.txt"):
            return FakeResponse(text="User-agent: *\nAllow: /\n")
        return FakeResponse(text="<html>ok</html>")
    s = _mk_scraper(cfg, target, handler)
    s.get_page("https://assessor.invalid/records?page=1")
    s.get_page("https://assessor.invalid/records?page=2")
    assert sleeps and sleeps[0] > 0
    assert sleeps[0] <= float(cfg.get("scraper.min_delay_s"))


def test_page_cap(cfg, target, monkeypatch):
    monkeypatch.setattr(scraper_mod.time, "sleep", lambda s: None)
    def handler(method, url, params):
        if url.endswith("/robots.txt"):
            return FakeResponse(text="User-agent: *\nAllow: /\n")
        return FakeResponse(text="<html>ok</html>")
    s = _mk_scraper(cfg, target, handler)
    s.max_pages = 3
    for i in range(3):
        s.get_page(f"https://assessor.invalid/records?page={i}")
    with pytest.raises(PageCapExceeded):
        s.get_page("https://assessor.invalid/records?page=99")


def test_identifies_with_configured_user_agent(cfg, target):
    def handler(method, url, params):
        return FakeResponse(text="User-agent: *\nAllow: /\n")
    s = _mk_scraper(cfg, target, handler)
    assert s.user_agent == cfg.get("scraper.user_agent")
