#!/usr/bin/env bash
# Bootstrap the Oracle Cloud always-free ARM VM (Ubuntu) for the Deal Sniper pipeline.
# Installs Postgres 16 + PostGIS, Python 3.12 + venv, tippecanoe (from source),
# nginx (range requests + CORS), PgBouncer, and the cron entry.
#
# Required env (export before running, or put in pipeline/.env and `set -a; . .env; set +a`):
#   DATABASE_URL          e.g. postgresql://dealsniper:PASS@127.0.0.1:5432/dealsniper
#   TILES_DIR             e.g. /srv/tiles
#   NGINX_CORS_ORIGIN     e.g. https://app.dealsniper.example
# Optional tuning:
#   PG_SHARED_BUFFERS (default 4GB)  PG_WORK_MEM (64MB)  PG_MAINTENANCE_WORK_MEM (1GB)
#
# OCI console steps (cannot be scripted from inside the VM) are documented in
# pipeline/README.md: open ingress TCP 80/443 (tiles) and 6432 (PgBouncer, restrict
# to Vercel/Render egress IPs) in the subnet security list.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${TILES_DIR:?TILES_DIR is required}"
: "${NGINX_CORS_ORIGIN:?NGINX_CORS_ORIGIN is required}"
PG_SHARED_BUFFERS="${PG_SHARED_BUFFERS:-4GB}"
PG_WORK_MEM="${PG_WORK_MEM:-64MB}"
PG_MAINTENANCE_WORK_MEM="${PG_MAINTENANCE_WORK_MEM:-1GB}"

PIPELINE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# --- parse DATABASE_URL ---
DB_USER=$(python3 -c "from urllib.parse import urlparse;u=urlparse('$DATABASE_URL');print(u.username)")
DB_PASS=$(python3 -c "from urllib.parse import urlparse;u=urlparse('$DATABASE_URL');print(u.password)")
DB_NAME=$(python3 -c "from urllib.parse import urlparse;u=urlparse('$DATABASE_URL');print(u.path.lstrip('/'))")

echo "== apt packages =="
sudo apt-get update -y
sudo apt-get install -y curl ca-certificates gnupg lsb-release build-essential git \
  python3.12 python3.12-venv python3-pip \
  libsqlite3-dev zlib1g-dev \
  nginx pgbouncer cron

echo "== Postgres 16 + PostGIS (pgdg repo) =="
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -fsSo /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  https://www.postgresql.org/media/keys/ACCC4CF8.asc
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt-get update -y
sudo apt-get install -y postgresql-16 postgresql-16-postgis-3

echo "== Postgres tuning + role/db =="
PGCONF=$(sudo -u postgres psql -tAc "SHOW config_file")
sudo tee -a "$PGCONF" >/dev/null <<EOF

# --- dealsniper pipeline tuning (bootstrap_vm.sh) ---
shared_buffers = ${PG_SHARED_BUFFERS}
work_mem = ${PG_WORK_MEM}
maintenance_work_mem = ${PG_MAINTENANCE_WORK_MEM}
max_wal_size = 4GB
random_page_cost = 1.1
EOF
sudo systemctl restart postgresql
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}'"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
sudo -u postgres psql -d "${DB_NAME}" -c "CREATE EXTENSION IF NOT EXISTS postgis"

echo "== PgBouncer =="
sudo tee /etc/pgbouncer/pgbouncer.ini >/dev/null <<EOF
[databases]
${DB_NAME} = host=127.0.0.1 port=5432 dbname=${DB_NAME}
[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 200
default_pool_size = 20
EOF
sudo tee /etc/pgbouncer/userlist.txt >/dev/null <<EOF
"${DB_USER}" "${DB_PASS}"
EOF
sudo systemctl enable --now pgbouncer && sudo systemctl restart pgbouncer

echo "== tippecanoe (from source) =="
if ! command -v tippecanoe >/dev/null; then
  git clone --depth 1 https://github.com/felt/tippecanoe /tmp/tippecanoe
  make -C /tmp/tippecanoe -j"$(nproc)"
  sudo make -C /tmp/tippecanoe install
fi

echo "== nginx: pmtiles with range requests + CORS =="
sudo mkdir -p "${TILES_DIR}"
sudo tee /etc/nginx/sites-available/tiles >/dev/null <<EOF
server {
    listen 80;
    server_name _;
    location /tiles/ {
        alias ${TILES_DIR}/;
        add_header Access-Control-Allow-Origin "${NGINX_CORS_ORIGIN}" always;
        add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Range" always;
        add_header Access-Control-Expose-Headers "Content-Range, Content-Length, Accept-Ranges" always;
        if (\$request_method = OPTIONS) { return 204; }
        types { application/octet-stream pmtiles; application/json json; }
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/tiles /etc/nginx/sites-enabled/tiles
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo "== python venv + deps =="
python3.12 -m venv "${PIPELINE_DIR}/.venv"
"${PIPELINE_DIR}/.venv/bin/pip" install --upgrade pip
"${PIPELINE_DIR}/.venv/bin/pip" install -r "${PIPELINE_DIR}/requirements.txt"

echo "== cron entry (schedule.cron from config) =="
CRON_EXPR=$("${PIPELINE_DIR}/.venv/bin/python" - <<'PY'
from core.config import Config
print(Config.load().get("schedule.cron"))
PY
)
( crontab -l 2>/dev/null | grep -v run_all.sh ; \
  echo "${CRON_EXPR} ${PIPELINE_DIR}/scripts/run_all.sh >> ${PIPELINE_DIR}/logs/cron.log 2>&1" ) | crontab -

echo "== done. Next: apply migrations + discover + run (see README) =="
