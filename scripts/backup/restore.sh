#!/usr/bin/env bash
# Restore a backup made by backup.sh, then check it: checksums before, table row counts and Qdrant point count
# after. Restoring REPLACES the current database contents and the Qdrant collection.
#
#   RESTORE_CONFIRM=yes scripts/backup/restore.sh backups/stepwell-20261017T020000Z
#   COMPOSE=1 RESTORE_CONFIRM=yes scripts/backup/restore.sh backups/stepwell-…
#
# Environment: DATABASE_URL (not with COMPOSE=1), QDRANT_URL / QDRANT_API_KEY / QDRANT_COLLECTION (optional),
# BACKUP_AGE_IDENTITY (age private key file, for encrypted backups). Stop the api and worker first, so nothing
# writes while the restore runs (docker compose stop api worker / kubectl scale --replicas=0).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DIR="${1:?usage: restore.sh BACKUP_DIR}"
[[ "${RESTORE_CONFIRM:-}" == "yes" ]] || { echo "refusing: set RESTORE_CONFIRM=yes (this replaces the current data)" >&2; exit 2; }
[[ -f "$DIR/manifest.txt" ]] || { echo "not a backup directory: $DIR" >&2; exit 2; }

( cd "$DIR" && sha256sum --quiet -c manifest.txt ) || { echo "checksum mismatch: the backup is damaged" >&2; exit 1; }
echo "checksums: ok" >&2

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
plain() { # path of the decrypted file
  local name="$1"
  if [[ -f "$DIR/$name.age" ]]; then
    age -d -i "${BACKUP_AGE_IDENTITY:?encrypted backup: set BACKUP_AGE_IDENTITY}" -o "$WORK/$name" "$DIR/$name.age"
    printf '%s' "$WORK/$name"
  elif [[ -f "$DIR/$name" ]]; then
    printf '%s' "$DIR/$name"
  fi
}

pg_url() { local url="${DATABASE_URL:?set DATABASE_URL (or COMPOSE=1)}"; printf '%s' "${url/postgresql+psycopg:/postgresql:}"; }
psql_q() {
  if [[ "${COMPOSE:-0}" == "1" ]]; then docker compose exec -T postgres psql -U stepwell -d stepwell -At -v ON_ERROR_STOP=1 -c "$1"
  else psql "$(pg_url)" -At -v ON_ERROR_STOP=1 -c "$1"; fi
}

dump="$(plain postgres.dump)"
[[ -n "$dump" ]] || { echo "no postgres.dump in $DIR" >&2; exit 1; }
echo "postgres: restoring…" >&2
if [[ "${COMPOSE:-0}" == "1" ]]; then
  docker compose exec -T postgres pg_restore -U stepwell -d stepwell --clean --if-exists --no-owner --single-transaction < "$dump"
else
  pg_restore -d "$(pg_url)" --clean --if-exists --no-owner --single-transaction "$dump"
fi

failed=0
while read -r table expected; do
  actual="$(psql_q "select count(*) from \"$table\"")"
  if [[ "$actual" == "$expected" ]]; then printf '  %-32s %8s rows  ok\n' "$table" "$actual" >&2
  else printf '  %-32s %8s rows  EXPECTED %s\n' "$table" "$actual" "$expected" >&2; failed=1; fi
done < "$DIR/rows.txt"

snap="$(plain qdrant.snapshot)"
if [[ -n "$snap" && ( -n "${QDRANT_URL:-}" || "${COMPOSE:-0}" == "1" ) ]]; then
  echo "qdrant: restoring…" >&2
  if [[ "${COMPOSE:-0}" == "1" ]]; then
    docker compose cp "$snap" api:/tmp/restore.snapshot
    docker compose exec -T api sh -c 'python - restore /tmp/restore.snapshot; rm -f /tmp/restore.snapshot' < "$HERE/qdrant_snapshot.py"
    points="$(docker compose exec -T api python - count < "$HERE/qdrant_snapshot.py")"
  else
    python3 "$HERE/qdrant_snapshot.py" restore "$snap"
    points="$(python3 "$HERE/qdrant_snapshot.py" count)"
  fi
  expected="$(cat "$DIR/qdrant.count" 2>/dev/null || echo "$points")"
  if [[ "$points" == "$expected" ]]; then echo "  qdrant points: $points  ok" >&2
  else echo "  qdrant points: $points  EXPECTED $expected" >&2; failed=1; fi
elif [[ -n "$snap" ]]; then
  echo "qdrant: snapshot present but QDRANT_URL not set: skipped (vectors can also be rebuilt: cancer-insights ingest --full)" >&2
fi

[[ "$failed" == 0 ]] && echo "restore: ok" >&2 || { echo "restore: FINISHED WITH MISMATCHES" >&2; exit 1; }
