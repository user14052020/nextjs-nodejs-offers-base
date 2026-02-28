# Offers Base

Веб‑приложение для учета ИП: организации, клиенты, выполненные работы, акты и счета, файлы в GridFS.

## Frontend архитектура (FSD + Mantine)

Frontend собран по принципам **Feature-Sliced Design**:
- `app` — маршрутизация Next.js и layout
- `widgets` — крупные составные блоки страниц (таблицы, навигация)
- `features` — пользовательские сценарии (формы входа/редактирования/печати)
- `entities` — типы и API по сущностям домена (organization/client/work/report)
- `shared` — общие утилиты, UI-обертки, HTTP-клиент

UI-слой переведен на **Mantine** (`@mantine/core`, `@mantine/hooks`) с глобальным `MantineProvider` в `app/layout.tsx`.

## Отчет (аналитика)

В private-зоне доступна отдельная страница `Отчет` по адресу `/report`.

Отчет строится сервером через endpoint `GET /api/v1/works/reports/monthly-clients` и показывает:
- группировку по месяцам;
- для каждого клиента в месяце: `количество работ` и `общая стоимость`;
- сортировку клиентов внутри месяца по убыванию общей суммы;
- итоговую строку `Итого за месяц` по всем клиентам.

Для удобства чтения используется:
- аккордеон по месяцам;
- табличный вид с колонками `Клиент / Количество работ / Общая стоимость / Доля месяца`;
- отдельный текстовый итог общей суммы месяца.

Для производительности отчета и списков в MongoDB используются индексы:
- `works`: `actYear_1_actNumber_1` (unique), `invoiceYear_1_invoiceNumber_1` (unique), `createdAt_-1`, `actDate_-1_clientId_1`;
- `clients`: `createdAt_-1`;
- `organizations`: `createdAt_-1`.

Elasticsearch (`works/clients/organizations`) используется для полнотекстового поиска в списках. Текущий отчет `/report` считается из MongoDB агрегирующим запросом.

## Backend архитектура: что применено из рекомендаций

Ниже адаптация рекомендаций (из Python-контекста) к текущему NestJS/Node проекту.

- `Разделение слоев и отсутствие прямого доступа к БД в роутерах` — **применено**.  
  Контроллеры вызывают сервисы, доступ к Mongo вынесен в репозитории.
- `Unit of Work и транзакционность` — **применено** для основных операций записи.  
  Есть `UnitOfWork` и `withTransaction(...)`, используется в `organizations/clients/works` сервисах.
- `Async БД и вынесенный engine` — **применено с поправкой на стек**.  
  В Node/Mongoose операции изначально async, подключение централизовано в `AppModule` через `MongooseModule.forRoot(...)`.
- `Сервисные исключения + глобальные обработчики` — **применено**.  
  Есть `ServiceException` и наследники, плюс глобальный `ServiceExceptionFilter`.
- `Централизованные зависимости / DI` — **применено**.  
  Используется встроенный DI NestJS (providers/modules), контроллеры не создают подключения вручную.
- `Версионирование API и healthcheck` — **применено**.  
  Глобальный префикс `/api/v1`, отдельный `/health`.
- `Нормализация схем и входных моделей` — **частично применено**.  
  Есть DTO `Create/Update` и глобальная валидация (`ValidationPipe`), но отдельные `Read DTO` и строгие правила для части полей (например, телефон/банковские форматы) можно усилить.
- `Убрать тяжелые вычисления в памяти` — **частично применено**.  
  Поиск вынесен в Elasticsearch, агрегаты номеров документов считаются запросами к БД; при этом есть отдельные участки пост-обработки в памяти (например, сохранение порядка выдачи после ES и стартовая реиндексация).

## Быстрый старт (Docker)

1. Создайте локальный env-файл:

```bash
cp .env.example .env
```

2. Запустите проект:

```bash
docker compose up --build
```

- Web: http://localhost:3000
- API: http://localhost:3001
- Healthcheck: http://localhost:3001/health

При первой инициализации базы создается админ из переменных `ADMIN_USERNAME` и `ADMIN_PASSWORD` в `.env`.

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

Скрипт автоматически читает значения из корневого `.env`.

По умолчанию скрипт использует:
- `API_URL=http://localhost:3001`
- `BACKUP_USERNAME=значение ADMIN_USERNAME`
- `BACKUP_PASSWORD=значение ADMIN_PASSWORD`
- `BACKUP_OUTPUT_DIR=./backups`

Пример с переопределением:

```bash
API_URL=http://localhost:3001 BACKUP_USERNAME=admin BACKUP_PASSWORD=supersecret BACKUP_OUTPUT_DIR=./my-backups bash scripts/backup-db.sh
```

### Восстановление из консоли

`Внимание:` восстановление очищает текущие данные в MongoDB и заменяет их содержимым файла бэкапа.

```bash
RESTORE_CONFIRM=YES bash scripts/restore-db.sh ./backups/offers-base-backup-20260220-100000.json.gz
```

Скрипт автоматически читает значения из корневого `.env`.

По умолчанию скрипт использует:
- `API_URL=http://localhost:3001`
- `BACKUP_USERNAME=значение ADMIN_USERNAME`
- `BACKUP_PASSWORD=значение ADMIN_PASSWORD`
- `RESTORE_CONFIRM=YES` (обязательно, иначе команда не запустится)

Пример с переопределением:

```bash
API_URL=http://localhost:3001 BACKUP_USERNAME=admin BACKUP_PASSWORD=supersecret RESTORE_CONFIRM=YES bash scripts/restore-db.sh ./my-backups/backup.json.gz
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

Используется корневой файл `.env` (см. `.env.example`):

- `WEB_PORT`
- `API_PORT`
- `MONGO_PORT`
- `REDIS_PORT`
- `ELASTICSEARCH_PORT`
- `MONGODB_URI`
- `ELASTICSEARCH_NODE`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `NEXT_PUBLIC_API_URL`
- `BACKUP_OUTPUT_DIR`
