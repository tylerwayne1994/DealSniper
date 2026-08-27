"""Runner (§11): orchestrates ingest per county/layer with bounded concurrency,
plain retries, self-heal escalation, spatial join, tiles, and the end-of-run
report.

CLI:
  python -m core.runner [--county FIPS] [--layer parcels|zoning]
                        [--jurisdiction ID] [--dry-run] [--rediscover]
                        [--no-selfheal] [--approve TARGET/LAYER]
"""
from __future__ import annotations

import argparse
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from shapely.geometry import box

from adapters import get_adapter_class
from .config import Config
from .http import FetchError
from .log import error_context, get_logger, setup_logging
from .models import SourceRecord, TargetRecord
from .registry import Registry
from .selfheal import SelfHeal
from .validate import StreamingValidator

log = get_logger("runner")


@dataclass
class JobResult:
    target_id: str
    layer: str
    status: str                  # ok | failed | needs_human | pending_approval | skipped | dry_ok
    rung: Optional[str] = None
    rows_in: int = 0
    rows_upserted: int = 0
    duration_s: float = 0.0
    error: Optional[str] = None
    rungs_tried: dict = field(default_factory=dict)
    unmapped_zone_codes: dict = field(default_factory=dict)


class Runner:
    def __init__(self, cfg: Config, dry_run: bool, no_selfheal: bool):
        self.cfg = cfg
        self.dry_run = dry_run
        self.reg = Registry(cfg)
        self.targets = self.reg.targets_by_id()
        self.selfheal_on = (not no_selfheal) and bool(cfg.get("selfheal.enabled")) \
            and not dry_run
        self.healer = SelfHeal(cfg) if self.selfheal_on else None
        self.results: list[JobResult] = []
        self.max_rewrites = int(cfg.get("selfheal.max_rewrites_per_job"))

    def _conn(self):
        from .db import get_conn
        return get_conn(self.cfg)

    # ---------------- single job ----------------
    def _record_run(self, conn, source: SourceRecord, status: str, rows_in: int,
                    rows_up: int, started: datetime, err: Optional[str],
                    ctx: Optional[dict]) -> None:
        if conn is None:
            return
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO ingest_runs (source_id, started_at, finished_at, status,
                         rows_in, rows_upserted, error, error_context, adapter_module, rung)
                       VALUES (%s,%s,now(),%s,%s,%s,%s,%s,%s,%s)""",
                    (source.id, started, status, rows_in, rows_up, err,
                     json.dumps(ctx or {}, default=str)[:100_000],
                     source.adapter_module, source.rung))
            conn.commit()
        except Exception as e:  # recording must never mask the real outcome
            log.error("failed to record ingest_run: %s", e)
            try:
                conn.rollback()
            except Exception:
                pass

    def _attempt(self, conn, target: TargetRecord, source: SourceRecord) -> JobResult:
        """One fetch+map+(validate[+upsert]) attempt. Raises on failure."""
        started = datetime.now(timezone.utc)
        t0 = time.monotonic()
        layer = source.layer
        min_rows = int(self.cfg.get(f"validation.{layer}.min_rows"))
        target_geom = box(*target.bbox) if target.bbox else None
        adapter_cls = get_adapter_class(source.rung or "", source.adapter_module, self.cfg)
        adapter = adapter_cls(layer, target, source, self.cfg)
        validator = StreamingValidator(layer, target.id, self.cfg, target_geom)
        upserter = None
        if not self.dry_run and conn is not None:
            from .load import Upserter
            upserter = Upserter(conn, self.cfg, layer)
        max_rows = min_rows if self.dry_run else None
        rows_in = 0
        sample_rows: list[dict] = []
        try:
            for raw in adapter.fetch(target, source, self.cfg, max_rows=max_rows):
                rows_in += 1
                if len(sample_rows) < 20:
                    sample_rows.append({k: v for k, v in raw.items()
                                        if not k.startswith("__")})
                row = adapter.map_row(raw)
                validator.add(row)
                if upserter is not None:
                    upserter.add(row)
            if upserter is not None:
                upserter.flush()
            report = validator.finalize(adapter.unmapped_zone_codes)
            failed_checks = [c for c in report.checks if not c["ok"]]
            if self.dry_run:
                # a dry run caps fetching at min_rows; other checks still apply
                failed_checks = [c for c in failed_checks if c["check"] != "min_rows"
                                 or rows_in < min_rows]
            if failed_checks:
                if conn is not None:
                    conn.rollback()
                raise IngestValidationError(report.to_json(), sample_rows)
            if conn is not None:
                conn.commit()
            self._record_run(conn, source, "ok", rows_in,
                             upserter.upserted if upserter else 0, started, None, None)
            return JobResult(
                target_id=target.id, layer=layer,
                status="dry_ok" if self.dry_run else "ok", rung=source.rung,
                rows_in=rows_in, rows_upserted=upserter.upserted if upserter else 0,
                duration_s=time.monotonic() - t0, rungs_tried=source.rungs_tried,
                unmapped_zone_codes=adapter.unmapped_zone_codes)
        except IngestValidationError:
            raise
        except Exception as e:
            if conn is not None:
                try:
                    conn.rollback()
                except Exception:
                    pass
            e.sample_rows = sample_rows  # type: ignore[attr-defined]
            raise
        finally:
            pass

    def run_job(self, target: TargetRecord, source: SourceRecord) -> JobResult:
        layer = source.layer
        if source.status == "pending_approval":
            return JobResult(target_id=target.id, layer=layer, status="pending_approval",
                             rung=source.rung, rungs_tried=source.rungs_tried,
                             error="scraper adapter awaiting --approve")
        conn = None
        if not self.dry_run:
            conn = self._conn()
        try:
            if source.discovery_mode and not source.rung:
                return self._discovery_job(conn, target, source)
            heal_budget = self.max_rewrites
            plain_retries = int(self.cfg.get("ingest.max_retries_per_run"))
            backoff = float(self.cfg.get("ingest.backoff_base_s"))
            while True:
                last_exc: Optional[Exception] = None
                for attempt in range(plain_retries):
                    try:
                        result = self._attempt(conn, target, source)
                        source.status = "ok"
                        source.last_error = None
                        self._save_source(conn, source)
                        return result
                    except Exception as e:
                        last_exc = e
                        log.warning("attempt %d/%d failed for %s/%s: %s",
                                    attempt + 1, plain_retries, target.id, layer, e)
                        if attempt < plain_retries - 1:
                            time.sleep(backoff * (2 ** attempt))
                failure = self._failure_bundle(last_exc)
                started = datetime.now(timezone.utc)
                self._record_run(conn, source, "failed", 0, 0, started,
                                 str(last_exc)[:2000], failure)
                if self.healer is None or heal_budget <= 0:
                    source.status = "failed" if self.healer is None else "needs_human"
                    source.last_error = str(last_exc)[:2000]
                    self._save_source(conn, source)
                    return JobResult(target_id=target.id, layer=layer,
                                     status=source.status, rung=source.rung,
                                     error=source.last_error,
                                     rungs_tried=source.rungs_tried)
                before = source.rewrite_count
                heal = self.healer.heal(target, source, failure)
                heal_budget -= max(source.rewrite_count - before, 1)
                self._save_source(conn, source)
                if heal.status in ("fixed_source", "fixed_adapter"):
                    log.info("self-heal %s for %s/%s; re-running ingest",
                             heal.status, target.id, layer)
                    continue
                return JobResult(target_id=target.id, layer=layer, status=heal.status,
                                 rung=source.rung, error=heal.detail,
                                 rungs_tried=source.rungs_tried)
        finally:
            if conn is not None:
                conn.close()

    def _discovery_job(self, conn, target: TargetRecord, source: SourceRecord) -> JobResult:
        if self.healer is None:
            return JobResult(target_id=target.id, layer=source.layer, status="skipped",
                             error="no source found and self-heal unavailable",
                             rungs_tried=source.rungs_tried)
        heal = self.healer.heal(target, source,
                                {"exception": "no ladder rung yielded a source"},
                                discovery=True)
        self._save_source(conn, source)
        if heal.status == "fixed_source":
            return self.run_job(target, source)
        return JobResult(target_id=target.id, layer=source.layer, status=heal.status,
                         rung=source.rung, error=heal.detail, rungs_tried=source.rungs_tried)

    @staticmethod
    def _failure_bundle(exc: Optional[Exception]) -> dict:
        bundle = error_context(exc)
        if isinstance(exc, FetchError):
            bundle["http_status"] = exc.status
            bundle["response_snippet"] = exc.body_snippet
            bundle["source_url"] = exc.url
        if isinstance(exc, IngestValidationError):
            bundle["validation_report"] = exc.report_json
            bundle["sample_rows"] = exc.sample_rows
        elif exc is not None and hasattr(exc, "sample_rows"):
            bundle["sample_rows"] = exc.sample_rows
        return bundle

    def _save_source(self, conn, source: SourceRecord) -> None:
        self.reg.upsert_source(source)
        self.reg.save()
        if conn is not None:
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """UPDATE sources SET rung=%s, source_url=%s, adapter_module=%s,
                             status=%s, last_error=%s, rewrite_count=%s, rungs_tried=%s,
                             last_success_at=CASE WHEN %s='ok' THEN now()
                                                  ELSE last_success_at END
                           WHERE target_id=%s AND layer=%s""",
                        (source.rung, source.source_url, source.adapter_module,
                         source.status, source.last_error, source.rewrite_count,
                         json.dumps(source.rungs_tried or {}), source.status,
                         source.target_id, source.layer))
                conn.commit()
            except Exception as e:
                log.error("failed to sync source to DB: %s", e)
                try:
                    conn.rollback()
                except Exception:
                    pass

    # ---------------- whole run ----------------
    def build_jobs(self, county: Optional[str], layer: Optional[str],
                   jurisdiction: Optional[str]) -> list[tuple[TargetRecord, SourceRecord]]:
        rank = {c["fips"]: c.get("rank", 999) for c in self.reg.counties}
        layer_order = {l: i for i, l in enumerate(self.cfg.get("target.layers"))}
        jobs = []
        for src in self.reg.sources():
            tgt = self.targets.get(src.target_id)
            if tgt is None:
                continue
            if county and tgt.fips != county:
                continue
            if layer and src.layer != layer:
                continue
            if jurisdiction and src.target_id != jurisdiction:
                continue
            if src.status == "needs_human":
                self.results.append(JobResult(
                    target_id=src.target_id, layer=src.layer, status="needs_human",
                    rung=src.rung, error=src.last_error, rungs_tried=src.rungs_tried))
                continue
            jobs.append((tgt, src))
        jobs.sort(key=lambda j: (rank.get(j[0].fips, 999), layer_order.get(j[1].layer, 9)))
        return jobs

    def run(self, county: Optional[str] = None, layer: Optional[str] = None,
            jurisdiction: Optional[str] = None) -> list[JobResult]:
        jobs = self.build_jobs(county, layer, jurisdiction)
        log.info("running %d jobs (dry_run=%s, selfheal=%s)",
                 len(jobs), self.dry_run, self.selfheal_on)
        max_workers = int(self.cfg.get("ingest.max_concurrent_jobs"))
        with ThreadPoolExecutor(max_workers=max_workers) as pool:
            futures = {pool.submit(self.run_job, t, s): (t, s) for t, s in jobs}
            for fut in as_completed(futures):
                t, s = futures[fut]
                try:
                    res = fut.result()
                except Exception as e:
                    log.error("job crashed: %s/%s: %s", t.id, s.layer, e,
                              extra={"ctx": error_context(e)})
                    res = JobResult(target_id=t.id, layer=s.layer, status="failed",
                                    rung=s.rung, error=str(e), rungs_tried=s.rungs_tried)
                self.results.append(res)
                log.info("job %s/%s -> %s (%d rows)", res.target_id, res.layer,
                         res.status, res.rows_in)
        if not self.dry_run:
            self._postprocess(county)
        return self.results

    def _postprocess(self, county_filter: Optional[str]) -> None:
        """Join + tiles for every county whose parcels loaded this run."""
        from .join import join_county
        from .tiles import build_tiles
        ok_parcels = {r.target_id for r in self.results
                      if r.layer == "parcels" and r.status == "ok"}
        conn = self._conn()
        try:
            for fips in sorted(ok_parcels):
                if county_filter and fips != county_filter:
                    continue
                try:
                    split = join_county(conn, self.cfg, fips)
                    log.info("county %s zoning_source split: %s", fips, split)
                except Exception as e:
                    log.error("join failed for %s: %s", fips, e,
                              extra={"ctx": error_context(e, fips=fips)})
                for lyr in self.cfg.get("target.layers"):
                    try:
                        build_tiles(conn, self.cfg, fips, lyr)
                    except Exception as e:
                        log.error("tiles failed for %s/%s: %s", fips, lyr, e,
                                  extra={"ctx": error_context(e, fips=fips, layer=lyr)})
        finally:
            conn.close()

    # ---------------- report ----------------
    def write_report(self) -> str:
        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        lines = [f"# Ingest run report — {ts}", ""]
        lines += ["| target | layer | status | rung | rows | upserted | duration_s | error |",
                  "|---|---|---|---|---|---|---|---|"]
        for r in sorted(self.results, key=lambda r: (r.target_id, r.layer)):
            lines.append(f"| {r.target_id} | {r.layer} | {r.status} | {r.rung or ''} "
                         f"| {r.rows_in} | {r.rows_upserted} | {r.duration_s:.0f} "
                         f"| {(r.error or '')[:120].replace('|', '/')} |")
        scraper_jobs = [r for r in self.results if r.rung == "scraper"]
        if scraper_jobs:
            lines += ["", "## Jobs on the scraper rung (and why rungs 1–5 failed)", ""]
            for r in scraper_jobs:
                lines.append(f"- **{r.target_id}/{r.layer}**:")
                for rung, why in (r.rungs_tried or {}).items():
                    lines.append(f"    - {rung}: {why}")
        pending = [r for r in self.results if r.status == "pending_approval"]
        if pending:
            lines += ["", "## Pending approval (scrapers held until --approve)", ""]
            lines += [f"- {r.target_id}/{r.layer} (approve with: "
                      f"python -m core.runner --approve {r.target_id}/{r.layer})"
                      for r in pending]
        humans = [r for r in self.results if r.status == "needs_human"]
        if humans:
            lines += ["", "## Needs human", ""]
            lines += [f"- {r.target_id}/{r.layer}: {(r.error or '')[:300]}" for r in humans]
        unmapped: dict[str, int] = {}
        for r in self.results:
            for code, n in (r.unmapped_zone_codes or {}).items():
                unmapped[code] = unmapped.get(code, 0) + n
        if unmapped:
            lines += ["", "## Unmapped zoning codes (extend zone_categories in config)", ""]
            lines += [f"- `{code}`: {n} rows" for code, n
                      in sorted(unmapped.items(), key=lambda kv: -kv[1])[:100]]
        text = "\n".join(lines)
        reports_dir = self.cfg.path("reports_dir")
        reports_dir.mkdir(parents=True, exist_ok=True)
        path = reports_dir / f"{ts}.md"
        path.write_text(text, encoding="utf-8")
        print(text)
        print(f"\nreport written: {path}")
        return str(path)


class IngestValidationError(Exception):
    def __init__(self, report_json: str, sample_rows: list):
        super().__init__("validation failed (see report)")
        self.report_json = report_json
        self.sample_rows = sample_rows


def main() -> None:
    ap = argparse.ArgumentParser(description="Deal Sniper ingest runner")
    ap.add_argument("--county")
    ap.add_argument("--layer", choices=["parcels", "zoning"])
    ap.add_argument("--jurisdiction")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--rediscover", action="store_true")
    ap.add_argument("--no-selfheal", action="store_true")
    ap.add_argument("--approve", metavar="TARGET/LAYER or DB id")
    args = ap.parse_args()

    cfg = Config.load()
    setup_logging(cfg)

    if args.approve:
        reg = Registry(cfg)
        rec = reg.approve(args.approve)
        if rec is None:
            raise SystemExit(f"no pending_approval source matches {args.approve!r}")
        print(f"approved: {rec.target_id}/{rec.layer} (status -> pending)")
        return

    groups: list[str] = []
    if not args.dry_run:
        groups += ["ingest_db", "tiles"]
        if bool(cfg.get("selfheal.enabled")) and not args.no_selfheal:
            groups.append("selfheal")
    cfg.require_env(groups)

    if args.rediscover:
        from .discover import discover
        discover(cfg, rediscover=True, county_filter=args.county)

    if not args.dry_run:
        from .db import run_migrations, get_conn
        run_migrations(cfg)
        reg = Registry(cfg)
        with get_conn(cfg) as conn:
            reg.sync_to_db(conn)
        # jurisdiction geometries from the discover cache
        _load_geoms(cfg)

    runner = Runner(cfg, dry_run=args.dry_run, no_selfheal=args.no_selfheal)
    runner.run(county=args.county, layer=args.layer, jurisdiction=args.jurisdiction)
    runner.write_report()


def _load_geoms(cfg: Config) -> None:
    """Push cached county/jurisdiction geometries from discover into Postgres."""
    import json as _json
    from .db import get_conn
    cache = cfg.path("discover_cache_dir")
    if not cache.exists():
        return
    with get_conn(cfg) as conn, conn.cursor() as cur:
        for path in cache.glob("jurisdictions_*.geojson"):
            try:
                fc = _json.loads(path.read_text(encoding="utf-8"))
                for feat in fc.get("features", []):
                    cur.execute(
                        """UPDATE jurisdictions
                           SET geom = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326))
                           WHERE id = %s AND geom IS NULL""",
                        (_json.dumps(feat["geometry"]), feat["properties"]["id"]))
            except Exception as e:
                log.warning("geom cache load failed for %s: %s", path.name, e)
        conn.commit()


if __name__ == "__main__":
    main()
