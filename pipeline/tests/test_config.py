import pytest

from core.config import Config, ConfigError


def test_loads_with_env_set(cfg):
    assert cfg.get("target.county_count") == 50
    assert cfg.get("sources.census_population_api") == "https://census.invalid/data"
    assert cfg.get("ingest.page_size") == 2000


def test_fails_fast_listing_missing_env(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setenv("CLAUDE_MODEL", "claude-test-model")
    cfg = Config.load()
    with pytest.raises(SystemExit) as exc:
        cfg.require_env(["ingest_db", "selfheal"])
    msg = str(exc.value)
    assert "DATABASE_URL" in msg and "ANTHROPIC_API_KEY" in msg


def test_unset_env_access_raises(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    cfg = Config.load()
    with pytest.raises(SystemExit):
        cfg.get("db.dsn")


def test_unknown_group_rejected(cfg):
    with pytest.raises(SystemExit):
        cfg.require_env(["nope"])
