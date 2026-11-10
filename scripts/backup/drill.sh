#!/usr/bin/env bash
# Restore drill: restore a backup into a THROWAWAY database (and optionally a throwaway Qdrant) and check it, without
# touching the live system. Run it monthly and after every change to the schema or the backup job; record the date,
# the backup used, the duration and the result in the operations log (BUILD_SPEC §12: RTO ≤ 4 h).
#
#   DRILL_DATABASE_URL=postgresql://…/stepwell_drill scripts/backup/drill.sh backups/stepwell-…
#   (optional) DRILL_QDRANT_URL=http://qdrant-drill:6333 DRILL_QDRANT_API_KEY=…
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DIR="${1:?usage: drill.sh BACKUP_DIR}"
: "${DRILL_DATABASE_URL:?set DRILL_DATABASE_URL to an empty, throwaway database}"
if [[ -n "${DATABASE_URL:-}" && "${DRILL_DATABASE_URL}" == "${DATABASE_URL}" ]]; then
  echo "refusing: DRILL_DATABASE_URL is the live DATABASE_URL" >&2; exit 2
fi
start=$(date +%s)
env -u COMPOSE DATABASE_URL="$DRILL_DATABASE_URL" QDRANT_URL="${DRILL_QDRANT_URL:-}" \
    QDRANT_API_KEY="${DRILL_QDRANT_API_KEY:-}" RESTORE_CONFIRM=yes "$HERE/restore.sh" "$DIR"
echo "drill: ok in $(( $(date +%s) - start )) s using $(basename "$DIR")" >&2
