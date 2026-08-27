#!/usr/bin/env bash
# Cron entry point: activate venv, discover if needed (or on --rediscover), then run.
set -euo pipefail
PIPELINE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PIPELINE_DIR}"
source .venv/bin/activate
set -a; [ -f .env ] && . .env; set +a

REDISCOVER=""
for arg in "$@"; do
  [ "$arg" = "--rediscover" ] && REDISCOVER="--rediscover"
done

SOURCES_FILE=$(python - <<'PY'
from core.config import Config
c = Config.load()
print(c.path("sources_file"))
PY
)

if [ ! -f "${SOURCES_FILE}" ] || [ -n "${REDISCOVER}" ]; then
  python -m core.discover ${REDISCOVER}
fi

python -m core.runner "$@"
