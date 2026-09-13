#!/usr/bin/env bash

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/sentrix}"
CONTAINER_NAME="${CONTAINER_NAME:-sentrix-db}"
DB_USER="${DB_USER:-sentrix}"
DB_NAME="${DB_NAME:-sentrix}"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
FILENAME="sentrix-${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "Starting backup..."

docker exec "$CONTAINER_NAME" pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --format=custom \
  --file="/tmp/${FILENAME}"

docker cp "${CONTAINER_NAME}:/tmp/${FILENAME}" "${BACKUP_DIR}/${FILENAME}"
docker exec "$CONTAINER_NAME" rm "/tmp/${FILENAME}"

echo "Backup complete:"
echo "${BACKUP_DIR}/${FILENAME}"
