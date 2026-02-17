#!/usr/bin/env bash
# backup-db.sh — Local SQLite database backup with retention
# Usage: npm run db:backup
#        ./scripts/backup-db.sh [backup-dir] [db-path]
#
# Creates a timestamped .sqlite backup using SQLite's .backup command
# for a consistent snapshot (safe during writes). Copies WAL file if present.
# Keeps the last 7 daily backups (configurable via BACKUP_RETENTION_DAYS).

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
DB_PATH="${2:-${DATABASE_URL:-./data/ideate.db}}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/ideate-${TIMESTAMP}.db"

# Strip file: prefix if present (DATABASE_URL format)
DB_PATH="${DB_PATH#file:}"

# Validate source database exists
if [ ! -f "$DB_PATH" ]; then
  echo "Error: Database file not found: ${DB_PATH}"
  echo "Set DATABASE_URL or pass the path as second argument."
  exit 1
fi

# Check sqlite3 is available
if ! command -v sqlite3 &>/dev/null; then
  echo "Error: sqlite3 is not installed"
  exit 1
fi

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "Backing up database: ${DB_PATH}"
echo "Destination: ${BACKUP_FILE}"

# Use SQLite .backup for a consistent snapshot
sqlite3 "$DB_PATH" ".backup '${BACKUP_FILE}'"

# Checkpoint WAL to ensure backup is self-contained
sqlite3 "$DB_PATH" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true

FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup complete: ${BACKUP_FILE} (${FILESIZE})"

# Rotate: keep last N daily backups
DELETED=$(find "$BACKUP_DIR" -name "ideate-*.db" -mtime +"$RETENTION_DAYS" -delete -print 2>/dev/null | wc -l)
if [ "$DELETED" -gt 0 ]; then
  echo "Rotated: removed ${DELETED} backup(s) older than ${RETENTION_DAYS} days"
fi

# Show remaining backups
REMAINING=$(find "$BACKUP_DIR" -name "ideate-*.db" 2>/dev/null | wc -l)
echo "Total backups: ${REMAINING}"
