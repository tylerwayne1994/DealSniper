"""Postgres connection + idempotent migrations.

Requires DATABASE_URL (config db.dsn). Everything degrades gracefully when the
runner is invoked with --dry-run: no code path in here is touched.
"""
from __future__ import annotations

from pathlib import Path

from .config import Config, ConfigError
from .log import get_logger

log = get_logger("db")


def get_conn(cfg: Config):
    import psycopg  # imported lazily so dry-run works without the driver configured

    dsn = cfg.get("db.dsn")
    return psycopg.connect(dsn)


def run_migrations(cfg: Config, sql_dir: Path | None = None) -> None:
    sql_dir = sql_dir or (cfg.root / "sql")
    files = sorted(p for p in sql_dir.glob("*.sql"))
    if not files:
        raise ConfigError(f"no migration files found in {sql_dir}")
    with get_conn(cfg) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "CREATE TABLE IF NOT EXISTS schema_migrations ("
                " filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
            )
            cur.execute("SELECT filename FROM schema_migrations")
            applied = {r[0] for r in cur.fetchall()}
            for path in files:
                if path.name in applied:
                    continue
                log.info("applying migration %s", path.name)
                cur.execute(path.read_text(encoding="utf-8"))
                cur.execute(
                    "INSERT INTO schema_migrations (filename) VALUES (%s)", (path.name,)
                )
        conn.commit()
