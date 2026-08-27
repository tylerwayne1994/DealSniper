"""Structured logging: JSON lines to a rotating file, human-readable console.

Every failure is logged with full context (exception class, traceback, HTTP
status, response body snippet, source URL) via `error_context`, and the same
dict is what lands in ingest_runs.error_context.
"""
from __future__ import annotations

import json
import logging
import logging.handlers
import os
import traceback
from typing import Any

_CONFIGURED = False


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        ctx = getattr(record, "ctx", None)
        if ctx:
            payload["ctx"] = ctx
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def setup_logging(cfg=None) -> None:
    global _CONFIGURED
    if _CONFIGURED:
        return
    level = os.environ.get("LOG_LEVEL", "INFO").upper()
    root = logging.getLogger("pipeline")
    root.setLevel(level)
    console = logging.StreamHandler()
    console.setFormatter(logging.Formatter("%(asctime)s %(levelname)-7s %(name)s: %(message)s"))
    root.addHandler(console)
    if cfg is not None:
        logs_dir = cfg.path("logs_dir")
        logs_dir.mkdir(parents=True, exist_ok=True)
        fh = logging.handlers.RotatingFileHandler(
            logs_dir / "pipeline.jsonl", maxBytes=20_000_000, backupCount=5, encoding="utf-8"
        )
        fh.setFormatter(JsonFormatter())
        root.addHandler(fh)
    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(f"pipeline.{name}")


def error_context(
    exc: BaseException | None = None,
    *,
    source_url: str | None = None,
    http_status: int | None = None,
    response_snippet: str | None = None,
    **extra: Any,
) -> dict[str, Any]:
    """Build the structured failure-context dict used in logs and ingest_runs."""
    ctx: dict[str, Any] = dict(extra)
    if exc is not None:
        ctx["exception"] = f"{type(exc).__name__}: {exc}"
        ctx["traceback"] = "".join(
            traceback.format_exception(type(exc), exc, exc.__traceback__)
        )[-8000:]
    if source_url:
        ctx["source_url"] = source_url
    if http_status is not None:
        ctx["http_status"] = http_status
    if response_snippet:
        ctx["response_snippet"] = response_snippet[:4096]
    return ctx


def tail_log_lines(cfg, n: int) -> list[str]:
    """Last n structured log lines, for the self-heal context bundle."""
    try:
        path = cfg.path("logs_dir") / "pipeline.jsonl"
        if not path.exists():
            return []
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            return fh.readlines()[-n:]
    except Exception:
        return []
