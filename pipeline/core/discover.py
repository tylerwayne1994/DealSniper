"""Discover: top-N counties from Census, jurisdictions per county from TIGER
Places, and a source per (target, layer) by walking the free-data ladder in
config order. Output is config/sources.yaml (GENERATED). Idempotent and
incremental: already-resolved jobs are kept unless --rediscover.

Ladder (§5): bulk_download -> arcgis_rest -> socrata -> ckan -> statewide.
Scrapers are never created here — a job no rung satisfies is flagged
discovery_mode and handled by self-heal.
"""
from __future__ import annotations

import argparse
import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from pathlib import Path
from typing import Any, Optional

import yaml
from shapely.geometry import Polygon, box, shape
from shapely.geometry.base import BaseGeometry

from .config import Config, ConfigError
from .http import FetchError, Http
from .log import error_context, get_logger, setup_logging
from .models import SourceRecord, TargetRecord
from .registry import Registry

log = get_logger("discover")


# ---------------------------------------------------------------- census helpers

def resolve_vintage(cfg: Config, http: Http) -> str:
    configured = str(cfg.get("target.census_vintage"))
    base = cfg.get("sources.census_population_api")
    dataset = cfg.get("target.census_dataset")
    if configured != "latest":
        return configured
    year = date.today().year - 1
    for y in range(year, year - 5, -1):
        try:
            http.get_json(f"{base}/{y}/{dataset}", params={"get": "NAME", "for": "state:01"})
            return str(y)
        except FetchError:
            continue
    raise ConfigError(f"no usable {dataset} vintage found under {base}")


def load_state_fips(cfg: Config) -> dict[str, str]:
    with open(cfg.root / "config" / "state_fips.yaml", "r", encoding="utf-8") as fh:
        return {str(k): str(v) for k, v in yaml.safe_load(fh).items()}


def top_counties(cfg: Config, http: Http, vintage: str) -> list[dict]:
    base = cfg.get("sources.census_population_api")
    dataset = cfg.get("target.census_dataset")
    var = cfg.get("target.census_population_variable")
    data = http.get_json(f"{base}/{vintage}/{dataset}",
                         params={"get": f"NAME,{var}", "for": "county:*"})
    header, rows = data[0], data[1:]
    idx = {h: i for i, h in enumerate(header)}
    state_abbr = load_state_fips(cfg)
    counties = []
    for r in rows:
        pop = r[idx[var]]
        if pop in (None, ""):
            continue
        state_fips, county_fips = r[idx["state"]], r[idx["county"]]
        counties.append({
            "fips": state_fips + county_fips,
            "state_fips": state_fips,
            "state": state_abbr.get(state_fips, "??"),
            "name": r[idx["NAME"]].split(",")[0].strip(),
            "population": int(pop),
        })
    counties.sort(key=lambda c: c["population"], reverse=True)
    n = int(cfg.get("target.county_count"))
    top = counties[:n]
    for i, c in enumerate(top, 1):
        c["rank"] = i
    return top


# ---------------------------------------------------------------- TIGERweb helpers

def esri_polygon_to_shapely(geom: dict) -> Optional[BaseGeometry]:
    rings = geom.get("rings") or []
    polys = [Polygon(r) for r in rings if len(r) >= 4]
    if not polys:
        return None
    from shapely.ops import unary_union
    try:
        return unary_union(polys)
    except Exception:
        return polys[0]


class Tiger:
    def __init__(self, cfg: Config, http: Http):
        self.cfg = cfg
        self.http = http
        self.base = str(cfg.get("sources.census_tiger_base")).rstrip("/")
        self.tol = float(cfg.get("discover.geometry_simplify_tolerance"))
        meta = http.get_json(self.base, params={"f": "json"})
        wanted = cfg.section("sources.census_tiger_layers")
        self.layer_ids: dict[str, int] = {}
        for key, name in wanted.items():
            for lyr in meta.get("layers", []):
                if lyr.get("name", "").strip().lower() == name.strip().lower():
                    self.layer_ids[key] = lyr["id"]
                    break
        missing = [k for k in wanted if k not in self.layer_ids]
        if missing:
            raise ConfigError(
                f"TIGERweb service {self.base} lacks layers {missing}; "
                f"available: {[l.get('name') for l in meta.get('layers', [])][:40]}")

    def _query(self, layer_key: str, params: dict) -> dict:
        url = f"{self.base}/{self.layer_ids[layer_key]}/query"
        data = self.http.get_json(url, params={"f": "json", "outSR": 4326, **params})
        if "error" in data:
            raise FetchError(f"TIGERweb error: {data['error']}", url,
                             body_snippet=str(data)[:2048])
        return data

    def county_geom(self, fips: str) -> Optional[BaseGeometry]:
        data = self._query("counties", {
            "where": f"GEOID='{fips}'", "outFields": "GEOID",
            "returnGeometry": "true", "maxAllowableOffset": self.tol})
        feats = data.get("features", [])
        if not feats:
            return None
        return esri_polygon_to_shapely(feats[0].get("geometry") or {})

    def places(self, layer_key: str, state_fips: str, county_bbox: list) -> list[dict]:
        data = self._query(layer_key, {
            "where": f"STATE='{state_fips}'",
            "geometry": ",".join(str(v) for v in county_bbox),
            "geometryType": "esriGeometryEnvelope", "inSR": 4326,
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": "GEOID,NAME,STATE,LSADC",
            "returnGeometry": "true", "maxAllowableOffset": self.tol})
        out = []
        for f in data.get("features", []):
            attrs = f.get("attributes") or {}
            geom = esri_polygon_to_shapely(f.get("geometry") or {})
            out.append({"geoid": attrs.get("GEOID"), "name": attrs.get("NAME"),
                        "lsadc": str(attrs.get("LSADC") or ""), "geom": geom})
        return out


# ---------------------------------------------------------------- ladder search

def _norm_headers(fields: list[str]) -> list[str]:
    return [re.sub(r"[^a-z0-9]", "", f.lower()) for f in fields]


def _has_key_field(field_names: list[str], layer: str, cfg: Config) -> bool:
    from adapters.base import load_synonyms
    key = "apn" if layer == "parcels" else "zone_code"
    syn = load_synonyms(cfg)[layer][key]
    wanted = {re.sub(r"[^a-z0-9]", "", s.lower()) for s in syn} | {key.replace("_", "")}
    return any(h in wanted for h in _norm_headers(field_names))


def _extent_to_bbox4326(extent: dict) -> Optional[list]:
    try:
        wkid = (extent.get("spatialReference") or {}).get("latestWkid") \
            or (extent.get("spatialReference") or {}).get("wkid") or 4326
        xs = [extent["xmin"], extent["xmax"]]
        ys = [extent["ymin"], extent["ymax"]]
        if int(wkid) not in (4326, 4269):
            from pyproj import Transformer
            tr = Transformer.from_crs(int(wkid), 4326, always_xy=True)
            (x0, x1), (y0, y1) = zip(*[tr.transform(x, y) for x, y in zip(xs, ys)])
            xs, ys = [x0, x1], [y0, y1]
        return [min(xs), min(ys), max(xs), max(ys)]
    except Exception:
        return None


def _name_score(candidate_title: str, target_name: str) -> float:
    from rapidfuzz import fuzz
    t = re.sub(r"\b(county|city|town|village|of)\b", " ", target_name.lower())
    return fuzz.partial_ratio(t.strip(), candidate_title.lower()) / 100.0


class LadderSearch:
    def __init__(self, cfg: Config, http_factory):
        self.cfg = cfg
        self.http_factory = http_factory
        self.threshold = float(cfg.get("discover.candidate_score_threshold"))
        self.max_checked = int(cfg.get("discover.max_candidates_checked"))
        self._statewide_cache: dict[tuple[str, str], Optional[dict]] = {}

    # ---- rung: arcgis_rest (also classifies hub download results -> bulk) ----
    def hub_candidates(self, http: Http, query: str) -> list[dict]:
        api = str(self.cfg.get("sources.arcgis_hub_search_api")).rstrip("/")
        try:
            data = http.get_json(f"{api}/datasets", params={
                "q": query, "page[size]": 20,
                "fields[datasets]": "name,url,type,recordCount,owner"})
        except FetchError as e:
            log.warning("hub search failed for %r: %s", query, e)
            return []
        out = []
        for item in data.get("data", []):
            a = item.get("attributes") or {}
            out.append({"id": item.get("id"), "title": a.get("name") or "",
                        "url": a.get("url"), "type": a.get("type") or "",
                        "owner": a.get("owner") or "",
                        "record_count": a.get("recordCount")})
        return out

    def _validate_arcgis_layer(self, http: Http, url: str, layer: str,
                               target: TargetRecord) -> tuple[bool, str, dict]:
        try:
            meta = http.get_json(url, params={"f": "json"})
        except FetchError as e:
            return False, f"metadata fetch failed: {e}", {}
        if "error" in meta:
            return False, f"metadata error: {str(meta)[:300]}", {}
        if meta.get("geometryType") != "esriGeometryPolygon":
            return False, f"geometryType={meta.get('geometryType')}", {}
        field_names = [f["name"] for f in meta.get("fields", [])]
        if not _has_key_field(field_names, layer, self.cfg):
            return False, "no key field (apn/zone_code synonym) present", {}
        ext_bbox = _extent_to_bbox4326(meta.get("extent") or {})
        if ext_bbox and target.bbox and not box(*ext_bbox).intersects(box(*target.bbox)):
            return False, f"extent {ext_bbox} does not intersect target bbox", {}
        min_rows = int(self.cfg.get(f"validation.{layer}.min_rows"))
        try:
            cnt = http.get_json(f"{url.rstrip('/')}/query", params={
                "where": "1=1", "returnCountOnly": "true", "f": "json"})
            count = cnt.get("count")
            if count is not None and count < min_rows:
                return False, f"row count {count} < min_rows {min_rows}", {}
        except FetchError:
            count = None
        return True, "ok", {"fields": field_names, "count": count, "extent": ext_bbox}

    def try_arcgis_rest(self, target: TargetRecord, layer: str) -> tuple[Optional[SourceRecord], str]:
        http = self.http_factory()
        keywords = self.cfg.get(f"discover.search_keywords.{layer}")
        seen: set[str] = set()
        reasons: list[str] = []
        checked = 0
        for kw in keywords:
            for cand in self.hub_candidates(http, f"{target.name} {kw}"):
                url = cand.get("url")
                if not url or url in seen or "Feature" not in cand["type"] and "Map" not in cand["type"]:
                    continue
                seen.add(url)
                score = max(_name_score(cand["title"], target.name),
                            _name_score(cand["owner"], target.name))
                if score < self.threshold:
                    continue
                if checked >= self.max_checked:
                    break
                checked += 1
                ok, reason, extra = self._validate_arcgis_layer(http, url, layer, target)
                if ok:
                    return SourceRecord(
                        target_id=target.id, layer=layer, rung="arcgis_rest",
                        source_url=url, status="pending",
                        extra={"title": cand["title"], **extra}), "ok"
                reasons.append(f"{cand['title'][:60]}: {reason}")
        return None, ("; ".join(reasons[:3]) or "no polygon layer matching name+fields found")

    # ---- rung: bulk_download (direct file distributions found via hub items) ----
    def try_bulk_download(self, target: TargetRecord, layer: str) -> tuple[Optional[SourceRecord], str]:
        # Direct downloadable files are rare relative to feature services and
        # hub's download API generates archives asynchronously (unreliable for
        # unattended ingest); we only accept a bulk source when the catalog
        # exposes a stable direct file URL.
        http = self.http_factory()
        keywords = self.cfg.get(f"discover.search_keywords.{layer}")
        for kw in keywords[:1]:
            for cand in self.hub_candidates(http, f"{target.name} {kw}"):
                url = cand.get("url") or ""
                if re.search(r"\.(zip|geojson|gpkg)($|\?)", url, re.I) \
                        and _name_score(cand["title"], target.name) >= self.threshold:
                    return SourceRecord(
                        target_id=target.id, layer=layer, rung="bulk_download",
                        source_url=url, status="pending",
                        extra={"title": cand["title"]}), "ok"
        return None, "no direct downloadable file in catalogs"

    # ---- rung: socrata ----
    def try_socrata(self, target: TargetRecord, layer: str) -> tuple[Optional[SourceRecord], str]:
        http = self.http_factory()
        api = str(self.cfg.get("sources.socrata_discovery_api"))
        keywords = self.cfg.get(f"discover.search_keywords.{layer}")
        reasons: list[str] = []
        for kw in keywords[:2]:
            try:
                data = http.get_json(api, params={
                    "q": f"{target.name} {kw}", "only": "datasets", "limit": 20})
            except FetchError as e:
                return None, f"socrata discovery failed: {e}"
            for res in data.get("results", []):
                resource = res.get("resource") or {}
                dtypes = [d.lower() for d in resource.get("columns_datatype") or []]
                if not any(t in dtypes for t in ("multipolygon", "polygon")):
                    continue
                title = resource.get("name") or ""
                if _name_score(title, target.name) < self.threshold:
                    continue
                domain = (res.get("metadata") or {}).get("domain")
                rid = resource.get("id")
                if not (domain and rid):
                    continue
                src_url = f"https://{domain}/resource/{rid}"
                try:  # confirm the geojson endpoint actually serves polygons
                    sample = http.get_json(f"{src_url}.geojson", params={"$limit": 1})
                    feats = sample.get("features") or []
                    gtype = (feats[0].get("geometry") or {}).get("type", "") if feats else ""
                    if "Polygon" not in gtype:
                        reasons.append(f"{title[:60]}: sample geometry {gtype!r}")
                        continue
                except FetchError as e:
                    reasons.append(f"{title[:60]}: sample fetch failed ({e})")
                    continue
                return SourceRecord(
                    target_id=target.id, layer=layer, rung="socrata",
                    source_url=src_url, status="pending", extra={"title": title}), "ok"
        return None, ("; ".join(reasons[:3]) or "no polygon dataset matching name found")

    # ---- rung: ckan ----
    def try_ckan(self, target: TargetRecord, layer: str) -> tuple[Optional[SourceRecord], str]:
        portals = self.cfg.get("sources.ckan_seed_portals") or []
        if not portals:
            return None, "no CKAN seed portals configured"
        http = self.http_factory()
        keywords = self.cfg.get(f"discover.search_keywords.{layer}")
        for portal in portals:
            try:
                data = http.get_json(f"{str(portal).rstrip('/')}/api/3/action/package_search",
                                     params={"q": f"{target.name} {keywords[0]}", "rows": 10})
            except FetchError:
                continue
            for pkg in (data.get("result") or {}).get("results", []):
                if _name_score(pkg.get("title", ""), target.name) < self.threshold:
                    continue
                for r in pkg.get("resources", []):
                    fmt = (r.get("format") or "").lower()
                    if fmt in ("geojson", "shp", "shapefile", "zip", "gpkg") and r.get("url"):
                        return SourceRecord(
                            target_id=target.id, layer=layer, rung="ckan",
                            source_url=r["url"], status="pending",
                            extra={"title": pkg.get("title", "")}), "ok"
        return None, "no matching CKAN resource in seed portals"

    # ---- rung: statewide ----
    def _statewide_for(self, state: str, state_name_hint: str, layer: str) -> Optional[dict]:
        key = (state, layer)
        if key in self._statewide_cache:
            return self._statewide_cache[key]
        http = self.http_factory()
        result = None
        for kw in self.cfg.get(f"discover.statewide_keywords.{layer}"):
            for cand in self.hub_candidates(http, f"{state_name_hint} {kw}"):
                url = cand.get("url")
                if not url:
                    continue
                try:
                    meta = http.get_json(url, params={"f": "json"})
                except FetchError:
                    continue
                if meta.get("geometryType") != "esriGeometryPolygon":
                    continue
                field_names = [f["name"] for f in meta.get("fields", [])]
                if not _has_key_field(field_names, layer, self.cfg):
                    continue
                fips_field = next(
                    (f for f in field_names
                     if re.search(r"(fips|co(unty)?_?(no|num|code|fips))", f, re.I)), None)
                result = {"url": url, "title": cand["title"], "fips_field": fips_field}
                break
            if result:
                break
        # also honor any operator-configured clearinghouses
        if result is None:
            for ch in self.cfg.get("sources.state_clearinghouses") or []:
                if isinstance(ch, dict) and ch.get("state") == state and ch.get("layer") == layer:
                    result = {"url": ch.get("url"), "title": ch.get("title", "configured"),
                              "fips_field": ch.get("fips_field")}
        self._statewide_cache[key] = result
        return result

    def try_statewide(self, target: TargetRecord, layer: str,
                      state_name_hint: str) -> tuple[Optional[SourceRecord], str]:
        found = self._statewide_for(target.state, state_name_hint, layer)
        if not found or not found.get("url"):
            return None, f"no statewide {layer} dataset found for {target.state}"
        extra: dict[str, Any] = {"kind": "arcgis", "title": found["title"]}
        if found.get("fips_field"):
            extra["filter_field"] = found["fips_field"]
            extra["filter_value"] = target.fips
        elif target.bbox:
            extra["geometry_bbox"] = target.bbox
        return SourceRecord(
            target_id=target.id, layer=layer, rung="statewide",
            source_url=found["url"], status="pending", extra=extra), "ok"

    # ---- walk the ladder ----
    def find(self, target: TargetRecord, layer: str, state_name_hint: str) -> SourceRecord:
        ladder = self.cfg.get("sources.ladder")
        tried: dict[str, str] = {}
        for rung in ladder:
            if rung == "scraper":
                # Scrapers are generated only by self-heal (and gated on approval).
                tried[rung] = "not attempted at discover time; requires self-heal + manual approval"
                continue
            fn = {
                "bulk_download": lambda: self.try_bulk_download(target, layer),
                "arcgis_rest": lambda: self.try_arcgis_rest(target, layer),
                "socrata": lambda: self.try_socrata(target, layer),
                "ckan": lambda: self.try_ckan(target, layer),
                "statewide": lambda: self.try_statewide(target, layer, state_name_hint),
            }.get(rung)
            if fn is None:
                tried[rung] = "unknown rung in config ladder"
                continue
            try:
                rec, reason = fn()
            except Exception as e:  # a rung crashing must not sink the job
                log.warning("rung %s crashed for %s/%s: %s", rung, target.id, layer, e)
                rec, reason = None, f"rung crashed: {type(e).__name__}: {e}"
            if rec is not None:
                rec.rungs_tried = tried
                return rec
            tried[rung] = reason
        return SourceRecord(target_id=target.id, layer=layer, rung=None,
                            status="pending", discovery_mode=True, rungs_tried=tried)


# ---------------------------------------------------------------- orchestration

def discover(cfg: Config, rediscover: bool = False, county_filter: Optional[str] = None,
             limit: Optional[int] = None) -> Registry:
    setup_logging(cfg)
    cfg.require_env(["discover"])

    def http_factory() -> Http:
        return Http(timeout_s=float(cfg.get("discover.request_timeout_s")),
                    max_retries=int(cfg.get("ingest.max_retries_per_run")),
                    backoff_base_s=float(cfg.get("ingest.backoff_base_s")))

    http = http_factory()
    reg = Registry(cfg)
    cache_dir = cfg.path("discover_cache_dir")
    cache_dir.mkdir(parents=True, exist_ok=True)

    vintage = resolve_vintage(cfg, http)
    log.info("census vintage: %s", vintage)
    counties = top_counties(cfg, http, vintage)
    if county_filter:
        counties = [c for c in counties if c["fips"] == county_filter]
    if limit:
        counties = counties[:limit]
    log.info("top counties resolved: %d", len(counties))

    tiger = Tiger(cfg, http)
    lsad_kinds = {str(k): v for k, v in cfg.section("discover.lsad_kinds").items()}
    tol = float(cfg.get("discover.geometry_simplify_tolerance"))

    # --- geometry + jurisdiction enumeration (sequential; cheap vs ladder) ---
    known_j = {j["id"]: j for j in reg.jurisdictions}
    known_c = {c["fips"]: c for c in reg.counties}
    place_best_overlap: dict[str, float] = {
        j["id"]: j.get("_overlap", 0.0) for j in reg.jurisdictions}

    for c in counties:
        existing = known_c.get(c["fips"])
        if existing and existing.get("bbox") and not rediscover:
            existing.update({k: c[k] for k in ("population", "rank", "name", "state", "state_fips")})
            c = existing
        else:
            geom = tiger.county_geom(c["fips"])
            if geom is None:
                log.error("no TIGER geometry for county %s (%s)", c["fips"], c["name"])
                continue
            c["bbox"] = list(geom.bounds)
            c["geom_wkt"] = geom.simplify(tol).wkt
            if existing:
                existing.update(c)
                c = existing
            else:
                reg.counties.append(c)
                known_c[c["fips"]] = c

        # unincorporated pseudo-jurisdiction
        uninc_id = f"{c['fips']}-UNINC"
        if uninc_id not in known_j:
            j = {"id": uninc_id, "fips": c["fips"], "name": f"{c['name']} (unincorporated)",
                 "kind": "unincorporated", "state": c["state"], "state_fips": c["state_fips"],
                 "bbox": c["bbox"]}
            reg.jurisdictions.append(j)
            known_j[uninc_id] = j

        if any(j.get("fips") == c["fips"] and j["kind"] != "unincorporated"
               for j in reg.jurisdictions) and not rediscover:
            continue  # places for this county already enumerated

        from shapely import wkt as shapely_wkt
        county_geom = shapely_wkt.loads(c["geom_wkt"])
        features = []
        for layer_key in ("incorporated_places", "census_designated_places"):
            try:
                features += [(layer_key, p) for p in
                             tiger.places(layer_key, c["state_fips"], c["bbox"])]
            except FetchError as e:
                log.error("TIGER places query failed for %s/%s: %s", c["fips"], layer_key, e)
        geojson_feats = []
        for layer_key, p in features:
            if not p["geoid"] or p["geom"] is None or not p["geom"].intersects(county_geom):
                continue
            overlap = p["geom"].intersection(county_geom).area
            kind = "cdp" if layer_key == "census_designated_places" \
                else lsad_kinds.get(p["lsadc"], "city")
            prev = known_j.get(p["geoid"])
            if prev is not None and place_best_overlap.get(p["geoid"], 0.0) >= overlap:
                continue  # already assigned to a county it overlaps more
            j = {"id": p["geoid"], "fips": c["fips"], "name": p["name"], "kind": kind,
                 "state": c["state"], "state_fips": c["state_fips"],
                 "bbox": list(p["geom"].bounds), "_overlap": overlap}
            place_best_overlap[p["geoid"]] = overlap
            if prev is not None:
                prev.update(j)
            else:
                reg.jurisdictions.append(j)
                known_j[p["geoid"]] = j
            geojson_feats.append({
                "type": "Feature", "properties": {"id": p["geoid"], "name": p["name"], "kind": kind},
                "geometry": p["geom"].__geo_interface__})
        with open(cache_dir / f"jurisdictions_{c['fips']}.geojson", "w", encoding="utf-8") as fh:
            json.dump({"type": "FeatureCollection", "features": geojson_feats}, fh)
        with open(cache_dir / f"county_{c['fips']}.geojson", "w", encoding="utf-8") as fh:
            json.dump(county_geom.__geo_interface__, fh)
        reg.save()
        log.info("county %s %s: %d jurisdictions", c["fips"], c["name"],
                 sum(1 for j in reg.jurisdictions if j["fips"] == c["fips"]))

    # --- build job list ---
    targets = reg.targets_by_id()
    jobs: list[tuple[TargetRecord, str]] = []
    county_fips_in_scope = {c["fips"] for c in counties}
    for c in reg.counties:
        if c["fips"] not in county_fips_in_scope:
            continue
        jobs.append((targets[c["fips"]], "parcels"))
    for j in reg.jurisdictions:
        if j["fips"] not in county_fips_in_scope or j["kind"] == "cdp":
            continue  # CDPs have no zoning authority; covered by county unincorporated
        jobs.append((targets[j["id"]], "zoning"))

    todo = []
    for target, layer in jobs:
        existing = reg.get_source(target.id, layer)
        if existing and existing.rung and not rediscover:
            continue
        if existing and existing.discovery_mode and not rediscover:
            continue
        todo.append((target, layer))
    log.info("ladder search: %d jobs to resolve (%d total)", len(todo), len(jobs))

    search = LadderSearch(cfg, http_factory)
    max_workers = int(cfg.get("discover.max_concurrent"))
    done = 0
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {
            pool.submit(search.find, target, layer,
                        _state_name_hint(target.state)): (target, layer)
            for target, layer in todo}
        for fut in as_completed(futures):
            target, layer = futures[fut]
            try:
                rec = fut.result()
            except Exception as e:
                log.error("ladder search crashed for %s/%s: %s", target.id, layer, e,
                          extra={"ctx": error_context(e, target=target.id, layer=layer)})
                rec = SourceRecord(target_id=target.id, layer=layer, status="pending",
                                   discovery_mode=True,
                                   rungs_tried={"error": f"{type(e).__name__}: {e}"})
            reg.upsert_source(rec)
            done += 1
            if done % 25 == 0 or done == len(todo):
                reg.save()
                log.info("ladder progress: %d/%d", done, len(todo))
    reg.save()
    return reg


_STATE_NAMES = None


def _state_name_hint(usps: str) -> str:
    """Full state name for statewide-dataset searches, from the packaged config."""
    global _STATE_NAMES
    if _STATE_NAMES is None:
        # Derive display names from USPS via the census states endpoint is overkill;
        # a static USPS->name map is standard reference data shipped as config.
        from .config import PIPELINE_ROOT
        path = PIPELINE_ROOT / "config" / "state_names.yaml"
        with open(path, "r", encoding="utf-8") as fh:
            _STATE_NAMES = yaml.safe_load(fh)
    return _STATE_NAMES.get(usps, usps)


def print_histogram(reg: Registry) -> str:
    hist = reg.rung_histogram()
    lines = ["", "Rung histogram (jobs per rung, by layer):"]
    for layer in sorted(hist):
        lines.append(f"  {layer}:")
        for rung, n in sorted(hist[layer].items(), key=lambda kv: -kv[1]):
            lines.append(f"    {rung:16s} {n}")
    text = "\n".join(lines)
    print(text)
    return text


def main() -> None:
    ap = argparse.ArgumentParser(description="Discover counties, jurisdictions, and sources")
    ap.add_argument("--rediscover", action="store_true",
                    help="re-run the ladder for every job, including resolved ones")
    ap.add_argument("--county", help="restrict to one county fips")
    ap.add_argument("--limit", type=int, help="restrict to the top N counties (debugging)")
    args = ap.parse_args()
    cfg = Config.load()
    reg = discover(cfg, rediscover=args.rediscover, county_filter=args.county, limit=args.limit)
    print_histogram(reg)
    n_counties = len(reg.counties)
    n_jur = len(reg.jurisdictions)
    n_sources = len(reg.data.get("sources", []))
    print(f"\ncounties: {n_counties}  jurisdictions: {n_jur}  source jobs: {n_sources}")
    print(f"written: {reg.sources_path}")


if __name__ == "__main__":
    main()
