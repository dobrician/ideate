#!/usr/bin/env bash
# restore.sh — Restore SQLite database to Docker volume
# Usage: ./scripts/restore.sh [staging|dev] <backup-file>
#
# Stops the container, replaces the database, and restarts it.

set -euo pipefail

SERVICE="${1:-}"
BACKUP_FILE="${2:-}"
CONTAINER_NAME="ideate-${SERVICE}"
DB_PATH="/app/data/ideate.db"

if [ -z "$SERVICE" ] || [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <staging|dev> <backup-file>"
  exit 1
fi

if [ "$SERVICE" != "staging" ] && [ "$SERVICE" != "dev" ]; then
  echo "Error: Service must be 'staging' or 'dev'"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file '$BACKUP_FILE' not found"
  exit 1
fi

# Verify the backup is a valid SQLite database
if ! sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" 2>/dev/null | grep -q "ok"; then
  echo "Error: Backup file is not a valid SQLite database"
  exit 1
fi

echo "WARNING: This will replace the ${SERVICE} database with ${BACKUP_FILE}"
read -rp "Continue? (y/N) " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "Aborted"
  exit 0
fi

echo "Stopping ${CONTAINER_NAME}..."
docker stop "$CONTAINER_NAME"

echo "Restoring database..."
docker cp "$BACKUP_FILE" "${CONTAINER_NAME}:${DB_PATH}"

# Remove WAL and SHM files to avoid conflicts
docker start "$CONTAINER_NAME"
docker exec "$CONTAINER_NAME" rm -f "${DB_PATH}-wal" "${DB_PATH}-shm"

echo "Restarting ${CONTAINER_NAME}..."
docker restart "$CONTAINER_NAME"

# Wait for container to be healthy
echo "Waiting for health check..."
for i in $(seq 1 30); do
  if docker inspect "$CONTAINER_NAME" --format '{{.State.Health.Status}}' 2>/dev/null | grep -q "healthy"; then
    echo "Container is healthy. Restore complete."
    exit 0
  fi
  sleep 2
done

echo "Warning: Container did not become healthy within 60s. Check logs with: docker logs $CONTAINER_NAME"
exit 1
