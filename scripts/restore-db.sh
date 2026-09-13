#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: ./scripts/restore-db.sh /path/to/backup.dump" >&2
  exit 1
fi

BACKUP_FILE="$1"

CONTAINER_NAME="${CONTAINER_NAME:-sentrix-db}"
DB_USER="${DB_USER:-sentrix}"
DB_NAME="${DB_NAME:-sentrix}"

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

echo "Stopping SentriX server before restore is recommended."

docker exec -i "$CONTAINER_NAME" pg_restore \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --clean \
  --if-exists \
  --no-owner \
  < "$BACKUP_FILE"

echo "Restore complete."
