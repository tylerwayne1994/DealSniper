"""Self-heal safety: forbidden-name rejection, scraper gating, rewrite cap."""
from core.selfheal import SelfHeal, _extract_json, _extract_python


def test_static_check_rejects_secrets(cfg):
    heal = SelfHeal(cfg)
    assert heal.static_check("import os\nk = os.environ['ANTHROPIC_API_KEY']")
    assert heal.static_check("dsn = os.getenv('DATABASE_URL')")
    assert heal.static_check("x = 'DATABASE_URL'")
    assert heal.static_check("import requests\n") is None


def test_scraper_code_lands_in_pending_approval_and_never_runs(
        cfg, target, source, monkeypatch):
    heal = SelfHeal(cfg)
    scraper_code = (
        "# No free dataset exists for this county (verified): portal offers HTML only.\n"
        "from adapters.scraper import ScraperBase\n"
        "class GeneratedAdapter(ScraperBase):\n"
        "    def fetch(self, target, source, cfg, max_rows=None):\n"
        "        yield {}\n")
    monkeypatch.setattr(heal, "_call_claude",
                        lambda messages, discovery: f"```python\n{scraper_code}```")
    ran = []
    monkeypatch.setattr(heal, "sandbox_run",
                        lambda *a, **k: ran.append(1) or ([], {}))
    monkeypatch.setattr(heal, "persist_adapter", lambda *a, **k: "gen_99999_parcels")
    result = heal.heal(target, source, {"exception": "boom"})
    assert result.status == "pending_approval"
    assert source.status == "pending_approval"
    assert source.rung == "scraper"
    assert not ran, "scraper adapter must not execute before approval"


def test_rewrite_cap_never_exceeds_max_api_calls(cfg, target, source, monkeypatch):
    heal = SelfHeal(cfg)
    calls = []
    monkeypatch.setattr(heal, "_call_claude",
                        lambda messages, discovery: calls.append(1) or "no fences here")
    result = heal.heal(target, source, {"exception": "boom"})
    assert result.status == "needs_human"
    assert len(calls) == int(cfg.get("selfheal.max_rewrites_per_job"))


def test_forbidden_code_is_rejected_not_run(cfg, target, source, monkeypatch):
    heal = SelfHeal(cfg)
    bad = ("from adapters.base import BaseAdapter\nimport os\n"
           "class GeneratedAdapter(BaseAdapter):\n"
           "    def fetch(self, t, s, c, max_rows=None):\n"
           "        os.environ['DATABASE_URL']\n        yield {}\n")
    monkeypatch.setattr(heal, "_call_claude",
                        lambda messages, discovery: f"```python\n{bad}```")
    ran = []
    monkeypatch.setattr(heal, "sandbox_run", lambda *a, **k: ran.append(1) or ([], {}))
    result = heal.heal(target, source, {"exception": "boom"})
    assert result.status == "needs_human"
    assert not ran


def test_new_source_reply_updates_record(cfg, target, source, monkeypatch):
    heal = SelfHeal(cfg)
    reply = '```json\n{"new_source_url": "https://open.invalid/parcels/FeatureServer/0", "rung": "arcgis_rest"}\n```'
    monkeypatch.setattr(heal, "_call_claude", lambda messages, discovery: reply)
    result = heal.heal(target, source, {"exception": "boom"})
    assert result.status == "fixed_source"
    assert source.source_url.endswith("/FeatureServer/0")
    assert source.rung == "arcgis_rest"
    assert source.status == "pending"


def test_fence_extractors():
    assert _extract_json('x ```json\n{"a": 1}\n``` y') == {"a": 1}
    assert _extract_python("```python\nprint(1)\n```") == "print(1)\n"
    assert _extract_json("nope") is None
