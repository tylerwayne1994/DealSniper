"""Runner behavior: pending_approval scrapers are never executed."""
from core.models import SourceRecord
from core.runner import Runner


def test_pending_approval_job_does_not_run(cfg, target, monkeypatch):
    src = SourceRecord(target_id=target.id, layer="parcels", rung="scraper",
                       adapter_module="gen_99999_parcels", status="pending_approval",
                       rungs_tried={"arcgis_rest": "nothing found"})
    runner = Runner(cfg, dry_run=True, no_selfheal=True)
    called = []
    monkeypatch.setattr(runner, "_attempt",
                        lambda *a, **k: called.append(1))
    res = runner.run_job(target, src)
    assert res.status == "pending_approval"
    assert not called, "an unapproved scraper must never execute"


def test_approved_source_becomes_runnable(cfg, tmp_path, monkeypatch):
    from core.registry import Registry
    orig_path = cfg.path
    monkeypatch.setattr(cfg, "path",
                        lambda key: (tmp_path / "sources.yaml") if key == "sources_file"
                        else orig_path(key))
    reg = Registry(cfg)
    reg.upsert_source(SourceRecord(target_id="99999", layer="parcels", rung="scraper",
                                   status="pending_approval"))
    reg.save()
    rec = reg.approve("99999/parcels")
    assert rec is not None and rec.status == "pending"
    assert Registry(cfg).get_source("99999", "parcels").status == "pending"
