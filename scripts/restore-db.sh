#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3001}"
BACKUP_USERNAME="${BACKUP_USERNAME:-admin}"
BACKUP_PASSWORD="${BACKUP_PASSWORD:-admin}"
RESTORE_CONFIRM="${RESTORE_CONFIRM:-}"
BACKUP_FILE="${1:-}"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Использование: RESTORE_CONFIRM=YES bash scripts/restore-db.sh <path-to-backup.json.gz>"
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Файл не найден: $BACKUP_FILE"
  exit 1
fi

if [[ "$RESTORE_CONFIRM" != "YES" ]]; then
  echo "Для запуска восстановления укажите RESTORE_CONFIRM=YES"
  exit 1
fi

TOKEN="$(
  curl -fsS -X POST "${API_URL}/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${BACKUP_USERNAME}\",\"password\":\"${BACKUP_PASSWORD}\"}" \
  | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p'
)"

if [[ -z "$TOKEN" ]]; then
  echo "Не удалось получить токен. Проверьте API_URL/BACKUP_USERNAME/BACKUP_PASSWORD."
  exit 1
fi

RESULT="$(
  curl -fsS -X POST "${API_URL}/api/v1/backup/restore" \
    -H "Authorization: Bearer ${TOKEN}" \
    -F "file=@${BACKUP_FILE}"
)"

echo "$RESULT"
