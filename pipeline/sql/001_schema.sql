CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE counties (
  fips            char(5) PRIMARY KEY,
  state           char(2) NOT NULL,
  name            text NOT NULL,
  population      integer,
  rank            integer,
  bbox            geometry(Polygon, 4326)
);

CREATE TABLE jurisdictions (            -- Census Places inside a county, plus one 'unincorporated' row per county
  id              text PRIMARY KEY,     -- place GEOID or '<fips>-UNINC'
  fips            char(5) NOT NULL REFERENCES counties(fips),
  name            text NOT NULL,
  kind            text NOT NULL,        -- city | town | cdp | unincorporated
  geom            geometry(MultiPolygon, 4326)
);

CREATE TABLE sources (                  -- one row per (target, layer)
  id              bigserial PRIMARY KEY,
  target_id       text NOT NULL,        -- county fips or jurisdiction id
  layer           text NOT NULL,        -- parcels | zoning
  rung            text,                 -- bulk_download | arcgis_rest | socrata | ckan | statewide | scraper | generated
  source_url      text,
  adapter_module  text,
  status          text NOT NULL DEFAULT 'pending',  -- pending | pending_approval | ok | failed | needs_human
  last_success_at timestamptz,
  last_error      text,
  rewrite_count   integer NOT NULL DEFAULT 0,
  rungs_tried     jsonb,                -- {rung: reason_it_failed}
  UNIQUE (target_id, layer)
);

CREATE TABLE parcels (
  fips            char(5) NOT NULL REFERENCES counties(fips),
  apn             text NOT NULL,
  owner_name      text,
  owner_mail_addr text,
  situs_addr      text,
  situs_city      text,
  situs_zip       text,
  land_use_code   text,
  land_use_desc   text,
  zoning          text,
  zoning_source   text,                 -- source | joined | null
  assessed_land   numeric,
  assessed_impr   numeric,
  assessed_total  numeric,
  last_sale_date  date,
  last_sale_price numeric,
  year_built      integer,
  sqft_bldg       numeric,
  sqft_lot        numeric,
  units           integer,
  raw             jsonb,
  geom            geometry(MultiPolygon, 4326),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fips, apn)
);
CREATE INDEX parcels_geom_gix ON parcels USING GIST (geom);
CREATE INDEX parcels_zip_idx ON parcels (situs_zip);
CREATE INDEX parcels_sale_idx ON parcels (fips, last_sale_date DESC);
CREATE INDEX parcels_zoning_idx ON parcels (fips, zoning);

CREATE TABLE zoning (
  id              bigserial PRIMARY KEY,
  fips            char(5) NOT NULL REFERENCES counties(fips),
  jurisdiction_id text NOT NULL REFERENCES jurisdictions(id),
  zone_code       text NOT NULL,
  zone_desc       text,
  zone_category   text,                 -- normalized: residential | multifamily | commercial | industrial | mixed | ag | other
  overlay         boolean DEFAULT false,
  ordinance_url   text,
  effective_date  date,
  source_key      text,                 -- source's own row id, for upsert
  raw             jsonb,
  geom            geometry(MultiPolygon, 4326),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (jurisdiction_id, source_key)
);
CREATE INDEX zoning_geom_gix ON zoning USING GIST (geom);
CREATE INDEX zoning_code_idx ON zoning (fips, zone_code);

CREATE TABLE ingest_runs (
  id              bigserial PRIMARY KEY,
  source_id       bigint REFERENCES sources(id),
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  status          text,
  rows_in         integer,
  rows_upserted   integer,
  error           text,
  error_context   jsonb,
  adapter_module  text,
  rung            text
);
CREATE INDEX ingest_runs_source_idx ON ingest_runs (source_id, started_at DESC);
