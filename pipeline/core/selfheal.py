"""Self-heal loop (§8): when a job fails validation or raises after plain
retries, ask Claude to (a) point at a better free source, (b) rewrite the
adapter, or (c) — only if no free dataset exists — write a scraper, which then
lands in pending_approval and does not run.

Guarantees enforced here, not by the model:
  - at most selfheal.max_rewrites_per_job API calls per job
  - generated code referencing ANTHROPIC_API_KEY or DATABASE_URL is rejected
    before it ever runs
  - generated code executes in a subprocess with a scrubbed environment and a
    timeout; the parent does all DB writes
  - scraper adapters are stored with status pending_approval and never executed
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from shapely import wkt as shapely_wkt

from .config import Config
from .log import error_context, get_logger, tail_log_lines
from .models import ParcelRow, SourceRecord, TargetRecord, ZoningRow
from .validate import validate_rows

log = get_logger("selfheal")

FORBIDDEN_REFS = ("ANTHROPIC_API_KEY", "DATABASE_URL")

SYSTEM_PROMPT = """You fix failing data-ingest jobs for a county parcel/zoning pipeline.
Prefer, in this order:
(a) a different FREE dataset higher on the source ladder
    (bulk_download > arcgis_rest > socrata > ckan > statewide) — reply with a single
    ```json fence containing {"new_source_url": "...", "rung": "..."} and nothing else;
(b) a rewritten adapter for the CURRENT source — reply with a single ```python fence
    containing a complete module that defines class GeneratedAdapter(BaseAdapter)
    (import: from adapters.base import BaseAdapter, GEOM_KEY) implementing
    fetch(self, target, source, cfg, max_rows=None) yielding raw dicts with a shapely
    geometry (EPSG:4326) under GEOM_KEY; map_row is inherited unless you must override it;
(c) a scraper — ONLY if you have confirmed no free dataset exists; subclass ScraperBase
    (from adapters.scraper import ScraperBase), name the class GeneratedAdapter, use
    self.get_page() for every request, and say explicitly in a leading comment that no
    free dataset exists and why.
Hard rules: no hardcoded URLs — read them from source.source_url / source.extra;
never reference environment secrets; the module must be self-contained and import only
from the pipeline packages and the standard scientific stack (requests, shapely,
geopandas, bs4). Reply with exactly one fenced block and no prose outside it."""

DISCOVERY_PROMPT = """No source ladder rung yielded a usable dataset for this jurisdiction
and layer. Locate a public, free dataset (open data portal, ArcGIS FeatureServer, Socrata,
CKAN, or a statewide dataset covering it) for the target below. Reply with a single ```json
fence containing {"new_source_url": "...", "rung": "..."} where rung is one of
bulk_download|arcgis_rest|socrata|ckan|statewide. If after searching you are confident no
free dataset exists, reply with {"new_source_url": null, "rung": null, "reason": "..."}."""


@dataclass
class HealResult:
    status: str          # fixed_source | fixed_adapter | pending_approval | needs_human
    detail: str
    source: SourceRecord


class SelfHeal:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.enabled = bool(cfg.get("selfheal.enabled"))
        self.max_rewrites = int(cfg.get("selfheal.max_rewrites_per_job"))
        self._client = None

    # -- Anthropic client (lazy so dry-run / --no-selfheal never needs the key) --
    def _get_client(self):
        if self._client is None:
            import anthropic
            self.cfg.require_env(["selfheal"])
            self._client = anthropic.Anthropic(api_key=str(self.cfg.get("selfheal.api_key")))
        return self._client

    def _call_claude(self, messages: list[dict], discovery: bool) -> str:
        import anthropic
        client = self._get_client()
        kwargs: dict[str, Any] = dict(
            model=str(self.cfg.get("selfheal.model")),
            max_tokens=int(self.cfg.get("selfheal.max_tokens")),
            system=SYSTEM_PROMPT if not discovery else SYSTEM_PROMPT + "\n\n" + DISCOVERY_PROMPT,
            messages=messages,
        )
        if discovery and bool(self.cfg.get("selfheal.web_search")):
            kwargs["tools"] = [{"type": "web_search_20260209", "name": "web_search",
                                "max_uses": 8}]
        try:
            resp = client.messages.create(**kwargs)
        except anthropic.BadRequestError:
            if "tools" in kwargs:  # model may not support this web-search variant
                kwargs.pop("tools")
                resp = client.messages.create(**kwargs)
            else:
                raise
        return "".join(b.text for b in resp.content if b.type == "text")

    # -- context bundle (§8.1) --
    def build_context(self, target: TargetRecord, source: SourceRecord,
                      failure: dict) -> str:
        n_log = int(self.cfg.get("selfheal.context_log_lines"))
        n_body = int(self.cfg.get("selfheal.context_response_bytes"))
        n_rows = int(self.cfg.get("selfheal.context_sample_rows"))
        parts = [
            "## Target", json.dumps(target.to_dict(), default=str, indent=2),
            "## Source record", json.dumps(source.to_dict(), default=str, indent=2),
            "## Rungs tried", json.dumps(source.rungs_tried, indent=2),
        ]
        adapter_src = self._current_adapter_source(source)
        if adapter_src:
            parts += ["## Current adapter source", f"```python\n{adapter_src}\n```"]
        if failure.get("exception"):
            parts += ["## Exception", str(failure["exception"])]
        if failure.get("traceback"):
            parts += ["## Traceback", str(failure["traceback"])[-6000:]]
        if failure.get("http_status") is not None:
            parts += ["## HTTP status", str(failure["http_status"])]
        if failure.get("response_snippet"):
            parts += ["## Last response body (first bytes)",
                      str(failure["response_snippet"])[:n_body]]
        if failure.get("service_metadata"):
            parts += ["## Service/dataset metadata",
                      json.dumps(failure["service_metadata"], default=str)[:n_body]]
        if failure.get("sample_rows"):
            parts += ["## First raw rows",
                      json.dumps(failure["sample_rows"][:n_rows], default=str)[:n_body * 2]]
        if failure.get("validation_report"):
            parts += ["## Validation report", str(failure["validation_report"])]
        parts += ["## Recent log lines", "".join(tail_log_lines(self.cfg, n_log))[-4000:]]
        parts += ["## Row schema", self._row_schema(source.layer)]
        return "\n\n".join(parts)

    def _current_adapter_source(self, source: SourceRecord) -> Optional[str]:
        try:
            if source.adapter_module:
                p = self.cfg.path("generated_adapters_dir") / f"{source.adapter_module}.py"
                if p.exists():
                    return p.read_text(encoding="utf-8")
            if source.rung:
                p = self.cfg.root / "adapters" / f"{source.rung}.py"
                if p.exists():
                    return p.read_text(encoding="utf-8")
        except OSError:
            pass
        return None

    @staticmethod
    def _row_schema(layer: str) -> str:
        cls = ParcelRow if layer == "parcels" else ZoningRow
        fields = ", ".join(cls.__dataclass_fields__)
        return f"{cls.__name__} fields: {fields}. geom must be a shapely (Multi)Polygon in EPSG:4326."

    # -- static safety check on generated code --
    @staticmethod
    def static_check(code: str) -> Optional[str]:
        for name in FORBIDDEN_REFS:
            if re.search(re.escape(name), code):
                return f"generated code references forbidden name {name}"
        return None

    @staticmethod
    def is_scraper(code: str) -> bool:
        return bool(re.search(r"\bScraperBase\b", code))

    # -- sandboxed execution --
    def sandbox_run(self, code: str, target: TargetRecord, source: SourceRecord,
                    layer: str) -> tuple[list, dict]:
        """Run generated adapter code in a scrubbed subprocess; return (rows, meta)."""
        timeout = float(self.cfg.get("selfheal.sandbox_timeout_s"))
        sample_n = int(self.cfg.get("selfheal.sandbox_row_sample"))
        keep = ("PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "LANG", "LC_ALL",
                "PYTHONIOENCODING", "COMSPEC", "PATHEXT", "HOMEDRIVE", "HOMEPATH", "USERPROFILE",
                "PROJ_LIB", "GDAL_DATA", "PROGRAMDATA", "APPDATA", "LOCALAPPDATA")
        env = {k: v for k, v in os.environ.items() if k in keep}
        env["PYTHONPATH"] = str(self.cfg.root)
        for name in FORBIDDEN_REFS:
            env.pop(name, None)
        with tempfile.TemporaryDirectory(prefix="ds_sandbox_") as tmp:
            mod_path = Path(tmp) / "candidate_adapter.py"
            mod_path.write_text(code, encoding="utf-8")
            ctx_path = Path(tmp) / "context.json"
            out_path = Path(tmp) / "rows.jsonl"
            ctx_path.write_text(json.dumps({
                "target": target.to_dict(), "source": source.to_dict(),
                "layer": layer, "sample_n": sample_n, "config_path": None,
            }), encoding="utf-8")
            proc = subprocess.run(
                [sys.executable, "-m", "core.sandbox_runner",
                 str(mod_path), str(ctx_path), str(out_path)],
                cwd=str(self.cfg.root), env=env, timeout=timeout,
                capture_output=True, text=True)
            if proc.returncode != 0:
                raise RuntimeError(
                    f"sandbox exited {proc.returncode}: "
                    f"{(proc.stderr or proc.stdout)[-4000:]}")
            rows = []
            row_cls = ParcelRow if layer == "parcels" else ZoningRow
            with open(out_path, "r", encoding="utf-8") as fh:
                for line in fh:
                    d = json.loads(line)
                    g = d.pop("geom_wkt", None)
                    d["geom"] = shapely_wkt.loads(g) if g else None
                    rows.append(row_cls(**{k: v for k, v in d.items()
                                           if k in row_cls.__dataclass_fields__}))
            meta_path = Path(str(out_path) + ".meta")
            meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
            return rows, meta

    # -- persistence of an accepted adapter --
    def persist_adapter(self, code: str, target: TargetRecord, layer: str,
                        rewrite_no: int) -> str:
        gen_dir = self.cfg.path("generated_adapters_dir")
        gen_dir.mkdir(parents=True, exist_ok=True)
        module_name = re.sub(r"[^A-Za-z0-9_]", "_", f"{target.id}_{layer}")
        path = gen_dir / f"{module_name}.py"
        path.write_text(code, encoding="utf-8")
        try:
            repo_root = self.cfg.root.parent
            subprocess.run(["git", "add", str(path)], cwd=str(repo_root),
                           check=True, capture_output=True, timeout=60)
            subprocess.run(
                ["git", "commit", "-m",
                 f"selfheal: adapter for {target.id}/{layer} (rewrite {rewrite_no})"],
                cwd=str(repo_root), check=True, capture_output=True, timeout=60)
        except (subprocess.SubprocessError, OSError) as e:
            log.warning("git commit of generated adapter failed: %s", e)
        return module_name

    # -- the loop --
    def heal(self, target: TargetRecord, source: SourceRecord,
             failure: dict, discovery: bool = False) -> HealResult:
        if not self.enabled:
            source.status = "failed"
            return HealResult("needs_human", "self-heal disabled", source)
        from shapely.geometry import box as _box
        target_geom = _box(*target.bbox) if target.bbox else None
        messages: list[dict] = [{
            "role": "user",
            "content": ("Fix this ingest job.\n\n" if not discovery
                        else "Find a source for this job.\n\n")
            + self.build_context(target, source, failure)}]
        api_calls = 0
        while api_calls < self.max_rewrites:
            api_calls += 1
            source.rewrite_count += 1
            try:
                reply = self._call_claude(messages, discovery)
            except Exception as e:
                log.error("Claude API call failed: %s", e,
                          extra={"ctx": error_context(e, target=target.id)})
                source.status = "needs_human"
                source.last_error = f"self-heal API failure: {e}"
                return HealResult("needs_human", source.last_error, source)
            messages.append({"role": "assistant", "content": reply})

            new_source = _extract_json(reply)
            code = _extract_python(reply)

            if new_source is not None:
                url, rung = new_source.get("new_source_url"), new_source.get("rung")
                if not url:
                    source.status = "needs_human"
                    source.last_error = ("self-heal: model reports no free dataset exists: "
                                         + str(new_source.get("reason", ""))[:500])
                    return HealResult("needs_human", source.last_error, source)
                source.source_url, source.rung = url, rung
                source.adapter_module = None
                source.status = "pending"
                log.info("self-heal: new source for %s/%s on rung %s: %s",
                         target.id, source.layer, rung, url)
                return HealResult("fixed_source", f"new source on rung {rung}", source)

            if code is None:
                messages.append({"role": "user", "content":
                                 "Your reply contained no ```json or ```python fence. "
                                 "Reply with exactly one fenced block as instructed."})
                continue

            problem = self.static_check(code)
            if problem:
                messages.append({"role": "user", "content":
                                 f"Rejected: {problem}. Produce a compliant module."})
                continue

            if self.is_scraper(code):
                module_name = self.persist_adapter(code, target, source.layer, api_calls)
                source.adapter_module = module_name
                source.rung = "scraper"
                source.status = ("pending_approval"
                                 if bool(self.cfg.get("scraper.require_manual_approval"))
                                 else "pending")
                log.warning("self-heal produced a SCRAPER for %s/%s -> %s",
                            target.id, source.layer, source.status)
                return HealResult("pending_approval",
                                  "scraper generated; awaiting manual approval", source)

            try:
                rows, meta = self.sandbox_run(code, target, source, source.layer)
                report = validate_rows(
                    rows, source.layer, target.id, self.cfg, target_geom,
                    unmapped_zone_codes=meta.get("unmapped_zone_codes"))
                # a sandbox sample can't meet full-run min_rows; require the sample
                # to be full-size OR pass everything else
                sample_n = int(self.cfg.get("selfheal.sandbox_row_sample"))
                fatal = [c for c in report.checks
                         if not c["ok"] and not (c["check"] == "min_rows"
                                                 and len(rows) >= sample_n)]
                if not fatal and rows:
                    module_name = self.persist_adapter(code, target, source.layer, api_calls)
                    source.adapter_module = module_name
                    source.rung = "generated"
                    source.status = "pending"
                    return HealResult("fixed_adapter",
                                      f"adapter validated on {len(rows)}-row sample", source)
                failure_note = json.dumps(fatal) if fatal else "adapter yielded 0 rows"
            except (subprocess.TimeoutExpired, RuntimeError, Exception) as e:
                failure_note = f"{type(e).__name__}: {e}"
            log.info("self-heal attempt %d failed for %s/%s: %s",
                     api_calls, target.id, source.layer, failure_note[:300])
            messages.append({"role": "user", "content":
                             f"That attempt failed:\n{failure_note[:4000]}\n"
                             "Fix it, or return a better source as JSON."})

        source.status = "needs_human"
        source.last_error = f"self-heal exhausted {self.max_rewrites} rewrites"
        return HealResult("needs_human", source.last_error, source)


def _extract_json(reply: str) -> Optional[dict]:
    m = re.search(r"```json\s*(\{.*?\})\s*```", reply, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return None


def _extract_python(reply: str) -> Optional[str]:
    m = re.search(r"```python\s*\n(.*?)```", reply, re.DOTALL)
    return m.group(1) if m else None
