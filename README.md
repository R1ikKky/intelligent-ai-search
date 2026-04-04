# Intelligent AI Search

## Запуск и условия

**Команда запуска** (выполнять в каталоге с `docker-compose.yml`):

```bash
docker compose up --build -d
```

**Условия запуска:**

- Установлены **Docker** и **Docker Compose** v2, запущен Docker Engine (на Windows — **Docker Desktop**).
- Свободны порты **5432** (Postgres) и **4200** (веб-фронт в nginx).
- По желанию: скопируйте `.env.example` в `.env`, чтобы задать `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` и при необходимости **`DOCKER_VOLUME_ROOT`** (по умолчанию том Postgres: `D:/docker-data/intelligent-ai-search/postgres`).
- **Импорт датасета в Postgres:** в папку **`data/`** положите оба файла **`Контракты_20260403.csv`** и **`СТЕ_20260403.csv`** (разделитель `;`, кодировка UTF-8 с BOM, без строки заголовка — см. [docks/datasets.manifest.json](docks/datasets.manifest.json)). После того как контейнер **postgres** станет healthy, один раз отработает **dataset-loader**. Если CSV нет — в логах будет предупреждение, контейнер завершится с кодом 0, **postgres** и **frontend** продолжают работать без заливки таблиц из этих файлов.
- Повторить только загрузку в уже поднятую БД: `docker compose up -d postgres`, затем `docker compose run --rm dataset-loader`.

**После успешного старта:** UI — http://localhost:4200 ; документация API — [Swagger UI (OpenAPI)](http://localhost:3000/schema/swagger-ui/) ; Postgres — `localhost:5432` (значения по умолчанию: пользователь `search_user`, БД `search_db`, пароль `search_pass`).

---

Монорепозиторий: **NestJS backend** (поиск в Elasticsearch, персонализация, auth с refresh-cookie), **ML** (ETL CSV → Postgres, эмбеддинги, cold-start), **Docker Compose** для Postgres, Redis, Elasticsearch.

Подробности по ML: [ml/dock/architecture.md](ml/dock/architecture.md). Документация API и модулей backend: [backend/README.md](backend/README.md).

## Требования

- **Docker** и **Docker Compose** v2
- Для локального backend без Docker: **Node.js 20+**
- Для ETL: CSV из манифеста в `ml/data/` (имена файлов — в `datasets.manifest.json`)

## Быстрый старт (Docker)

1. Создайте файл окружения из примера:

   ```bash
   cp .env.example .env
   ```

   В продакшене задайте надёжные `JWT_ACCESS_SECRET` и `JWT_REFRESH_SECRET` (длинные случайные строки).

2. (Опционально) Папки данных контейнеров по умолчанию монтируются на **`D:/docker-data/intelligent-ai-search`**. Чтобы использовать другой путь:

   ```env
   DOCKER_VOLUME_ROOT=C:/path/to/docker-data/intelligent-ai-search
   ```

3. Положите в **`ml/data/`** файлы **`СТЕ_20260403.csv`** и **`Контракты_20260403.csv`** (как в [datasets.manifest.json](datasets.manifest.json)). Без них ETL с `ETL_SKIP=0` завершится с ошибкой.

4. Чтобы **загрузить данные в Postgres** при старте, в `.env` укажите:

   ```env
   ETL_SKIP=0
   ```

   По умолчанию в compose заданы **ограничения выборки** для ускорения: `ETL_STE_LIMIT=20000`, `ETL_CONTRACT_LIMIT=8000`. Для полного датасета:

   ```env
   ETL_STE_LIMIT=0
   ETL_CONTRACT_LIMIT=0
   ```

5. Поднимите стек:

   ```bash
   docker compose up --build -d
   ```

   Порядок: Postgres → применение схемы (`schema-init`) → одноразовый **etl** (если не пропущен) → Elasticsearch, Redis → **app** (порт **3000**).

6. Сервисы:

   | Сервис        | Порт  | URL / примечание |
   |---------------|-------|------------------|
   | API (Django) | 3000  | http://localhost:3000 |
   | Swagger UI   | 3000  | [Swagger UI](http://localhost:3000/schema/swagger-ui/) |
   | Elasticsearch | 9200  | http://localhost:9200 |
   | Postgres      | 5432  | user/pass/db из compose или `.env` |
   | Redis         | 6379  | — |

7. **ML API** (эмбеддинги) в отдельном профиле:

   ```bash
   docker compose --profile ml up -d ml-api
   ```

   Порт **8000**, эндпоинты `GET /health`, `POST /embed`.

8. **Kibana** (отладка ES):

   ```bash
   docker compose --profile debug up -d kibana
   ```

## Авторизация (кратко)

- Регистрация: `POST /auth/register` — тело с полями `inn`, `password`, `orgName`, `location` (см. [Swagger UI](http://localhost:3000/schema/swagger-ui/)).
- В ответе приходит **access token**; **refresh** выставляется в **httpOnly cookie** `refreshToken`.
- Обновление access: `POST /auth/refresh` (с тем же cookie).
- Выход: `POST /auth/logout`.

## Локальная разработка backend (без Docker)

Из каталога `backend/`:

```bash
cd backend
npm install --legacy-peer-deps
cp ../.env.example ../.env
# Укажите POSTGRES_HOST=localhost, REDIS_HOST=localhost, ELASTICSEARCH_NODE=http://localhost:9200 и секреты JWT в .env
npm run start:dev
```

Сборка и схема БД:

```bash
npm run build
npm run sync-schema
```

## Проверка CSV без загрузки в БД

```bash
cd ml
pip install -r requirements.txt
python -m etl.validate_dataset
```

Переменные `DATA_DIR`, `MANIFEST_PATH`, `ETL_STE_LIMIT`, `ETL_CONTRACT_LIMIT` — как у ETL (см. [ml/dock/architecture.md](ml/dock/architecture.md)).

## Полезные команды

- Остановка: `docker compose down`
- Логи app: `docker compose logs -f app`
- Повторная индексация СТЕ в ES (если API уже запущен): `POST /indexing/reindex` (см. [Swagger UI](http://localhost:3000/schema/swagger-ui/)).

## Переменные окружения

Минимальный набор для приложения в контейнере задаётся в [docker-compose.yml](docker-compose.yml); для переопределения используйте **`.env`** в корне (см. [.env.example](.env.example)). Полный список и валидация — в `backend/src/config/validation.ts`.
