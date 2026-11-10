#!/usr/bin/env bash
# Back up Stepwell's state: the PostgreSQL database (insights, reviews, community, sync ciphertext, jobs) and,
# optionally, the Qdrant collection (rebuildable from the library, but slow to rebuild).
#
#   scripts/backup/backup.sh [OUT_ROOT]                 # default OUT_ROOT: ./backups
#   COMPOSE=1 scripts/backup/backup.sh                  # the Docker Compose stack (docker compose exec)
#
# Environment:
#   DATABASE_URL            postgresql[+psycopg]://user:pass@host:5432/db (not needed with COMPOSE=1)
#   QDRANT_URL              http://host:6333 — Qdrant is skipped when unset (and with COMPOSE=1 it is read inside
#                           the api container, which can reach it)
#   QDRANT_API_KEY, QDRANT_COLLECTION
#   BACKUP_AGE_RECIPIENT    age public key (age1…): every file is encrypted; keep the private key offline
#   BACKUP_S3_URI           s3://bucket/prefix — upload with the AWS CLI after a successful backup
#   BACKUP_RETENTION_DAYS   delete local backups older than this (default 14; 0 keeps everything)
#
# Each run writes OUT_ROOT/stepwell-YYYYmmddTHHMMSSZ/ with postgres.dump (pg_dump custom format), qdrant.snapshot,
# table row counts and SHA-256 checksums (manifest.txt), which restore.sh and drill.sh verify.
# This is the logical, second line of defence. Point-in-time recovery (RPO ≤ 15 min, BUILD_SPEC §12) comes from
# the database service itself (managed Postgres PITR, or WAL archiving with CloudNativePG/pgBackRest).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT_ROOT="${1:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DIR="$OUT_ROOT/stepwell-$STAMP"
umask 077
mkdir -p "$DIR"

pg_url() { # SQLAlchemy URL → libpq URL
  local url="${DATABASE_URL:?set DATABASE_URL (or COMPOSE=1)}"
  printf '%s' "${url/postgresql+psycopg:/postgresql:}"
}

psql_q() {
  if [[ "${COMPOSE:-0}" == "1" ]]; then
    docker compose exec -T postgres psql -U stepwell -d stepwell -At -v ON_ERROR_STOP=1 -c "$1"
  else
    psql "$(pg_url)" -At -v ON_ERROR_STOP=1 -c "$1"
  fi
}

echo "postgres: dumping…" >&2
if [[ "${COMPOSE:-0}" == "1" ]]; then
  docker compose exec -T postgres pg_dump -U stepwell -d stepwell -Fc --no-owner > "$DIR/postgres.dump"
else
  pg_dump "$(pg_url)" -Fc --no-owner -f "$DIR/postgres.dump"
fi
# Row counts at dump time, for the restore checks. (Exact counts; the database is small next to the library.)
tables=$(psql_q "select tablename from pg_tables where schemaname = 'public' order by 1")
: > "$DIR/rows.txt"
for t in $tables; do
  printf '%s %s\n' "$t" "$(psql_q "select count(*) from \"$t\"")" >> "$DIR/rows.txt"
done

if [[ "${COMPOSE:-0}" == "1" ]]; then
  echo "qdrant: snapshot via the api container…" >&2
  docker compose exec -T api sh -c 'python - save /tmp/qdrant.snapshot && cat /tmp/qdrant.snapshot && rm -f /tmp/qdrant.snapshot' \
    < "$HERE/qdrant_snapshot.py" > "$DIR/qdrant.snapshot"
  docker compose exec -T api python - count < "$HERE/qdrant_snapshot.py" > "$DIR/qdrant.count"
elif [[ -n "${QDRANT_URL:-}" ]]; then
  python3 "$HERE/qdrant_snapshot.py" save "$DIR/qdrant.snapshot"
  python3 "$HERE/qdrant_snapshot.py" count > "$DIR/qdrant.count"
else
  echo "qdrant: skipped (QDRANT_URL not set)" >&2
fi

if [[ -n "${BACKUP_AGE_RECIPIENT:-}" ]]; then
  for f in "$DIR"/postgres.dump "$DIR"/qdrant.snapshot; do
    [[ -f "$f" ]] || continue
    age -r "$BACKUP_AGE_RECIPIENT" -o "$f.age" "$f" && rm -f "$f"
  done
fi

( cd "$DIR" && sha256sum -- * > manifest.txt )
echo "backup: $DIR" >&2

if [[ -n "${BACKUP_S3_URI:-}" ]]; then
  aws s3 cp --recursive --only-show-errors "$DIR" "${BACKUP_S3_URI%/}/stepwell-$STAMP/"
  echo "uploaded: ${BACKUP_S3_URI%/}/stepwell-$STAMP/" >&2
fi

days="${BACKUP_RETENTION_DAYS:-14}"
if [[ "$days" -gt 0 ]]; then
  find "$OUT_ROOT" -maxdepth 1 -type d -name 'stepwell-*' -mtime +"$days" -exec rm -rf {} + 2>/dev/null || true
fi
echo "$DIR"
