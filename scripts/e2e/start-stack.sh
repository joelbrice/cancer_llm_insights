#!/usr/bin/env bash
# Start a self-contained Stepwell stack on the test-fixture corpus for end-to-end tests.
#   scripts/e2e/start-stack.sh            # API :8000 + web :3000 (web must be built: pnpm --filter @stepwell/web build)
#   scripts/e2e/start-stack.sh stop
# Requires the backend installed (pip install -e backend) and Node/pnpm. Uses a throwaway data directory.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="${E2E_WORKDIR:-${TMPDIR:-/tmp}/stepwell-e2e}"
PIDS="$WORK/pids"

# Each server runs in its own process group (setsid), so stopping it also stops the children that npx/uvicorn
# spawn (otherwise an orphaned next-server keeps the port and serves a stale build).
stop() {
  if [[ -f "$PIDS" ]]; then
    while read -r pid; do kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true; done < "$PIDS"
    rm -f "$PIDS"
  fi
  for _ in $(seq 1 20); do
    curl -fsS "http://localhost:${API_PORT:-8000}/healthz" >/dev/null 2>&1 || curl -fsS "http://localhost:${WEB_PORT:-3000}" >/dev/null 2>&1 || return 0
    sleep 0.5
  done
}

if [[ "${1:-start}" == "stop" ]]; then
  stop; exit 0
fi
stop  # a previous run that was not stopped
for port in "${API_PORT:-8000}" "${WEB_PORT:-3000}"; do
  if curl -fsS "http://localhost:$port" >/dev/null 2>&1 || curl -fsS "http://localhost:$port/healthz" >/dev/null 2>&1; then
    echo "port $port is already in use by another process; stop it first" >&2; exit 1
  fi
done

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
# E2E_DATABASE_URL runs the stack on PostgreSQL (an empty database) instead of SQLite; E2E_REDIS_URL backs the rate
# limiter with Redis. Both are how production runs.
export DATA_DIR="$WORK/data" DATA_SOURCES_FILE="$WORK/sources.yaml" DATABASE_URL="${E2E_DATABASE_URL:-sqlite:///$WORK/data/app.db}" \
       ENVIRONMENT=development RUN_SCHEDULER=false RATE_LIMIT_PER_MINUTE=100000 CHAT_RATE_LIMIT_PER_MINUTE=100000 \
       COMMUNITY_POSTS_PER_HOUR=1000 COMMUNITY_REPLIES_PER_HOUR=1000
[[ -n "${E2E_REDIS_URL:-}" ]] && export REDIS_URL="$E2E_REDIS_URL"
PY="${PYTHON:-python}"
(cd "$ROOT/backend" && "$PY" -m app.cli ingest >"$WORK/ingest.log" 2>&1)
# `cd` first, then background only the server, so $! is the server's own process group (not a subshell)
(cd "$ROOT/backend" || exit 1; setsid nohup "$PY" -m app.cli serve --port "${API_PORT:-8000}" >"$WORK/api.log" 2>&1 & echo $! >>"$PIDS")
(cd "$ROOT/web" || exit 1; API_INTERNAL_URL="http://localhost:${API_PORT:-8000}" setsid nohup npx next start -p "${WEB_PORT:-3000}" >"$WORK/web.log" 2>&1 & echo $! >>"$PIDS")
for _ in $(seq 1 60); do
  if curl -fsS "http://localhost:${API_PORT:-8000}/healthz" >/dev/null 2>&1 && curl -fsS "http://localhost:${WEB_PORT:-3000}/en" >/dev/null 2>&1; then
    echo "stack ready (workdir $WORK)"; exit 0
  fi
  sleep 1
done
echo "stack failed to start; see $WORK/*.log" >&2; exit 1
