"""parcels <- zoning spatial join (§10).

Populates parcels.zoning from the zoning layer by point-on-surface containment
where the parcel source didn't supply one. Never overwrites a source-supplied
value; prefers the smallest-area containing polygon; overlays never provide the
base zone.
"""
from __future__ import annotations

from .config import Config
from .log import get_logger

log = get_logger("join")

JOIN_SQL = """
UPDATE parcels p
SET zoning = z.zone_code,
    zoning_source = 'joined',
    updated_at = now()
FROM LATERAL (
    SELECT zz.zone_code
    FROM zoning zz
    WHERE zz.fips = p.fips
      AND NOT COALESCE(zz.overlay, false)
      AND ST_Contains(zz.geom, ST_PointOnSurface(p.geom))
    ORDER BY ST_Area(zz.geom) ASC
    LIMIT 1
) z
WHERE p.fips = %s
  AND p.zoning IS NULL
  AND p.geom IS NOT NULL
"""

SPLIT_SQL = """
SELECT COALESCE(zoning_source, 'null') AS src, count(*)
FROM parcels WHERE fips = %s GROUP BY 1
"""


def join_county(conn, cfg: Config, fips: str) -> dict[str, int]:
    with conn.cursor() as cur:
        cur.execute(JOIN_SQL, (fips,))
        joined = cur.rowcount
        cur.execute(SPLIT_SQL, (fips,))
        split = {row[0]: row[1] for row in cur.fetchall()}
    conn.commit()
    log.info("join %s: %d parcels joined; zoning_source split: %s", fips, joined, split)
    return {"joined_now": joined, **split}
