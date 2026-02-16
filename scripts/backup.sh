#!/usr/bin/env bash
# backup.sh — Backup SQLite database from Docker volume
# Usage: ./scripts/backup.sh [staging|dev] [backup-dir]
#
# Creates a timestamped .sqlite backup using SQLite's .backup command
# to ensure a consistent snapshot (safe even during writes).

set -euo pipefail

SERVICE="${1:-staging}"
BACKUP_DIR="${2:-./backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
CONTAINER_NAME="ideate-${SERVICE}"
DB_PATH="/app/data/ideate.db"
BACKUP_FILE="${BACKUP_DIR}/ideate-${SERVICE}-${TIMESTAMP}.db"

if [ "$SERVICE" != "staging" ] && [ "$SERVICE" != "dev" ]; then
  echo "Error: Service must be 'staging' or 'dev'"
  echo "Usage: $0 [staging|dev] [backup-dir]"
  exit 1
fi

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Check container is running
if ! docker inspect "$CONTAINER_NAME" --format '{{.State.Running}}' 2>/dev/null | grep -q true; then
  echo "Error: Container '$CONTAINER_NAME' is not running"
  exit 1
fi

echo "Backing up ${SERVICE} database..."

# Use SQLite .backup for a consistent snapshot
docker exec "$CONTAINER_NAME" sh -c "sqlite3 ${DB_PATH} '.backup /tmp/backup.db'"
docker cp "${CONTAINER_NAME}:/tmp/backup.db" "$BACKUP_FILE"
docker exec "$CONTAINER_NAME" rm -f /tmp/backup.db

# Also backup WAL and SHM if they exist
docker exec "$CONTAINER_NAME" sh -c "test -f ${DB_PATH}-wal && sqlite3 ${DB_PATH} 'PRAGMA wal_checkpoint(TRUNCATE)'" 2>/dev/null || true

FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup complete: ${BACKUP_FILE} (${FILESIZE})"
echo "To restore: ./scripts/restore.sh ${SERVICE} ${BACKUP_FILE}"

# Rotate: delete backups older than 7 days
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
DELETED=$(find "$BACKUP_DIR" -name "ideate-${SERVICE}-*.db" -mtime +"$RETENTION_DAYS" -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
  echo "Rotated: removed ${DELETED} backup(s) older than ${RETENTION_DAYS} days"
fi
