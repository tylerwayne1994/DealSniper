"""Upsert idempotency: in-batch dedupe + ON CONFLICT semantics.

The statement-level checks run everywhere; the true end-to-end idempotency test
runs when DATABASE_URL points at a reachable Postgres+PostGIS (i.e. on the VM)
and is skipped otherwise.
"""
import os

import pytest
from shapely.geometry import MultiPolygon, Polygon

from core.load import PARCEL_SQL, ZONING_SQL, Upserter, zoning_source_key
from core.models import ParcelRow, ZoningRow

SQ = MultiPolygon([Polygon([(0, 0), (0, 1), (1, 1), (1, 0)])])


class RecordingConn:
    def __init__(self):
        self.batches = []

    def cursor(self):
        conn = self

        class Cur:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def executemany(self, sql, params):
                conn.batches.append((sql, params))
        return Cur()


def test_sql_is_upsert_not_insert():
    assert "ON CONFLICT (fips, apn) DO UPDATE" in PARCEL_SQL
    assert "ON CONFLICT (jurisdiction_id, source_key) DO UPDATE" in ZONING_SQL


def test_parcel_in_batch_dedupe_keeps_last(cfg):
    conn = RecordingConn()
    up = Upserter(conn, cfg, "parcels")
    up.add(ParcelRow(apn="A-1", fips="99999", geom=SQ, owner_name="old"))
    up.add(ParcelRow(apn="A-1", fips="99999", geom=SQ, owner_name="new"))
    up.add(ParcelRow(apn="", fips="99999", geom=SQ))       # keyless rows dropped
    up.flush()
    (sql, params), = conn.batches
    assert len(params) == 1
    assert "new" in params[0]


def test_zoning_source_key_fallback_is_deterministic(cfg):
    r1 = ZoningRow(zone_code="R-1", fips="99999", jurisdiction_id="j", jurisdiction="J",
                   geom=SQ, source_key=None)
    r2 = ZoningRow(zone_code="R-1", fips="99999", jurisdiction_id="j", jurisdiction="J",
                   geom=SQ, source_key=None)
    assert zoning_source_key(r1) == zoning_source_key(r2)
    conn = RecordingConn()
    up = Upserter(conn, cfg, "zoning")
    up.add(r1)
    up.add(r2)   # identical -> dedupes in batch
    up.flush()
    (sql, params), = conn.batches
    assert len(params) == 1


@pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                    reason="needs a live Postgres+PostGIS (runs on the VM)")
def test_upsert_idempotent_against_live_db(cfg):
    import psycopg
    from core.db import run_migrations

    run_migrations(cfg)
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO counties (fips, state, name) VALUES ('99999','TS','Test') "
                        "ON CONFLICT DO NOTHING")
            cur.execute("INSERT INTO jurisdictions (id, fips, name, kind) "
                        "VALUES ('99999-UNINC','99999','Test','unincorporated') "
                        "ON CONFLICT DO NOTHING")
        conn.commit()
        for layer, row in (
                ("parcels", ParcelRow(apn="IDEM-1", fips="99999", geom=SQ)),
                ("zoning", ZoningRow(zone_code="R-1", fips="99999",
                                     jurisdiction_id="99999-UNINC", jurisdiction="Test",
                                     geom=SQ, source_key="IDEM-1"))):
            table = layer
            for _ in range(2):   # run twice -> still one row
                up = Upserter(conn, cfg, layer)
                up.add(row)
                up.flush()
                conn.commit()
            with conn.cursor() as cur:
                key = "apn = 'IDEM-1'" if layer == "parcels" else "source_key = 'IDEM-1'"
                cur.execute(f"SELECT count(*) FROM {table} WHERE {key}")
                assert cur.fetchone()[0] == 1
        with conn.cursor() as cur:
            cur.execute("DELETE FROM parcels WHERE fips='99999'")
            cur.execute("DELETE FROM zoning WHERE fips='99999'")
        conn.commit()
