#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
if [[ -f "${ROOT_DIR}/.env" ]]; then
  set -a
  source "${ROOT_DIR}/.env"
  set +a
fi

API_URL="${API_URL:-http://localhost:${API_PORT:-3001}}"
BACKUP_USERNAME="${BACKUP_USERNAME:-${ADMIN_USERNAME:-admin}}"
BACKUP_PASSWORD="${BACKUP_PASSWORD:-${ADMIN_PASSWORD:-admin}}"
BACKUP_OUTPUT_DIR="${BACKUP_OUTPUT_DIR:-./backups}"

mkdir -p "$BACKUP_OUTPUT_DIR"

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

TMP_HEADERS="$(mktemp)"
TMP_BODY="$(mktemp)"

cleanup() {
  rm -f "$TMP_HEADERS" "$TMP_BODY"
}
trap cleanup EXIT

curl -fsS -D "$TMP_HEADERS" "${API_URL}/api/v1/backup/download" \
  -H "Authorization: Bearer ${TOKEN}" \
  -o "$TMP_BODY"

FILENAME="$(
  grep -i "content-disposition:" "$TMP_HEADERS" \
    | sed -n 's/.*filename=\"\([^\"]*\)\".*/\1/p' \
    | tr -d '\r'
)"

if [[ -z "$FILENAME" ]]; then
  FILENAME="offers-base-backup-$(date +%Y%m%d-%H%M%S).json.gz"
fi

TARGET_PATH="${BACKUP_OUTPUT_DIR}/${FILENAME}"
mv "$TMP_BODY" "$TARGET_PATH"

echo "Бэкап сохранен: ${TARGET_PATH}"
