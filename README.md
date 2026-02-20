# Offers Base

Веб‑приложение для учета ИП: организации, клиенты, выполненные работы, акты и счета, файлы в GridFS.

## Быстрый старт (Docker)

```bash
docker compose up --build
```

- Web: http://localhost:3000
- API: http://localhost:3001
- Healthcheck: http://localhost:3001/health

По умолчанию при первой инициализации базы создается пользователь `admin/admin`.

## Данные и тома Docker

`docker compose up --build` **не очищает** базу. Данные хранятся в именованных томах:
- `offers-base_mongo_data`
- `offers-base_redis_data`
- `offers-base_es_data`

Полезные команды:

```bash
# Перезапуск без удаления данных
docker compose down
docker compose up --build

# Полный сброс всех данных (Mongo, Redis, Elasticsearch)
docker compose down -v
docker compose up --build

# Сброс только MongoDB
docker compose down
docker volume rm offers-base_mongo_data
docker compose up --build
```

## Бэкап базы (браузер и консоль)

### Из браузера

1. Откройте `Профиль`.
2. Нажмите `Скачать бэкап`.
3. Будет скачан архив вида `offers-base-backup-YYYYMMDD-HHMMSS.json.gz`.

### Восстановление из браузера

`Внимание:` восстановление очищает текущие данные в MongoDB и заменяет их содержимым файла бэкапа.

1. Откройте `Профиль`.
2. В блоке бэкапа выберите файл `.json.gz` (или `.json`).
3. Нажмите `Восстановить из бэкапа`.
4. После восстановления проверьте данные в разделах `Организации`, `Клиенты`, `Работы`.

Поиск в Elasticsearch после восстановления пересобирается автоматически.

### Из консоли

```bash
bash scripts/backup-db.sh
```

По умолчанию скрипт использует:
- `API_URL=http://localhost:3001`
- `BACKUP_USERNAME=admin`
- `BACKUP_PASSWORD=admin`
- `BACKUP_OUTPUT_DIR=./backups`

Пример с переопределением:

```bash
API_URL=http://localhost:3001 BACKUP_USERNAME=admin BACKUP_PASSWORD=admin BACKUP_OUTPUT_DIR=./my-backups bash scripts/backup-db.sh
```

### Восстановление из консоли

`Внимание:` восстановление очищает текущие данные в MongoDB и заменяет их содержимым файла бэкапа.

```bash
RESTORE_CONFIRM=YES bash scripts/restore-db.sh ./backups/offers-base-backup-20260220-100000.json.gz
```

По умолчанию скрипт использует:
- `API_URL=http://localhost:3001`
- `BACKUP_USERNAME=admin`
- `BACKUP_PASSWORD=admin`
- `RESTORE_CONFIRM=YES` (обязательно, иначе команда не запустится)

Пример с переопределением:

```bash
API_URL=http://localhost:3001 BACKUP_USERNAME=admin BACKUP_PASSWORD=admin RESTORE_CONFIRM=YES bash scripts/restore-db.sh ./my-backups/backup.json.gz
```

## Локальная разработка

```bash
# API
cd apps/api
npm install
npm run start:dev

# Web
cd apps/web
npm install
npm run dev
```

## Переменные окружения

API (apps/api/.env):
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `PORT`

Web (apps/web/.env.local):
- `NEXT_PUBLIC_API_URL`
