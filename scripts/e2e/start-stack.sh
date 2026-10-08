#!/usr/bin/env bash
# Start a self-contained Stepwell stack on the test-fixture corpus for end-to-end tests.
#   scripts/e2e/start-stack.sh            # API :8000 + web :3000 (web must be built: pnpm --filter @stepwell/web build)
#   scripts/e2e/start-stack.sh stop
# Requires the backend installed (pip install -e backend) and Node/pnpm. Uses a throwaway data directory.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="${E2E_WORKDIR:-${TMPDIR:-/tmp}/stepwell-e2e}"
PIDS="$WORK/pids"

if [[ "${1:-start}" == "stop" ]]; then
  [[ -f "$PIDS" ]] && xargs -r kill < "$PIDS" 2>/dev/null || true
  rm -f "$PIDS"; exit 0
fi

rm -rf "$WORK" && mkdir -p "$WORK/data"
FIX="$ROOT/backend/tests/fixtures/corpus"
cat > "$WORK/sources.yaml" <<YAML
version: 1
sources:
  - { id: research, name: "Research (fixtures)", uri: "$FIX/research", defaults: { source_type: auto, credibility: peer_reviewed } }
  - { id: guidelines, name: "Guidelines (fixtures)", uri: "$FIX/guidelines", defaults: { source_type: guideline, credibility: authoritative } }
  - { id: web, name: "Institutional web (fixtures)", uri: "$FIX/web", defaults: { source_type: institutional_web, credibility: reputable } }
  - { id: blogs, name: "Blogs (fixtures)", uri: "$FIX/blogs", defaults: { source_type: blog, credibility: general } }
YAML
export DATA_DIR="$WORK/data" DATA_SOURCES_FILE="$WORK/sources.yaml" DATABASE_URL="sqlite:///$WORK/data/app.db" \
       ENVIRONMENT=development RUN_SCHEDULER=false RATE_LIMIT_PER_MINUTE=100000 CHAT_RATE_LIMIT_PER_MINUTE=100000 \
       COMMUNITY_POSTS_PER_HOUR=1000 COMMUNITY_REPLIES_PER_HOUR=1000
PY="${PYTHON:-python}"
(cd "$ROOT/backend" && "$PY" -m app.cli ingest >"$WORK/ingest.log" 2>&1)
(cd "$ROOT/backend" && nohup "$PY" -m app.cli serve --port "${API_PORT:-8000}" >"$WORK/api.log" 2>&1 & echo $! >>"$PIDS")
(cd "$ROOT/web" && API_INTERNAL_URL="http://localhost:${API_PORT:-8000}" nohup npx next start -p "${WEB_PORT:-3000}" >"$WORK/web.log" 2>&1 & echo $! >>"$PIDS")
for _ in $(seq 1 60); do
  if curl -fsS "http://localhost:${API_PORT:-8000}/healthz" >/dev/null 2>&1 && curl -fsS "http://localhost:${WEB_PORT:-3000}/en" >/dev/null 2>&1; then
    echo "stack ready (workdir $WORK)"; exit 0
  fi
  sleep 1
done
echo "stack failed to start; see $WORK/*.log" >&2; exit 1
