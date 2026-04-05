# Intelligent AI Search

## Запуск и условия

**Команда запуска** (выполнять в каталоге с `docker-compose.yml`):

```bash
docker compose up --build -d
```

**Условия запуска:**

- Установлены **Docker** и **Docker Compose** v2, запущен Docker Engine (на Windows — **Docker Desktop**).
- Свободны порты **5432** (Postgres), **9200** (Elasticsearch) и **4200** (веб-фронт в nginx).
- По желанию: скопируйте `.env.example` в `.env`, чтобы задать `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` и при необходимости **`DOCKER_VOLUME_ROOT`** (по умолчанию том Postgres: `D:/docker-data/intelligent-ai-search/postgres`).
- **Импорт датасета в Postgres:** в папку **`data/`** положите оба файла **`Контракты_20260403.csv`** и **`СТЕ_20260403.csv`** (разделитель `;`, кодировка UTF-8 с BOM, без строки заголовка — см. [docks/datasets.manifest.json](docks/datasets.manifest.json)). После того как контейнер **postgres** станет healthy, один раз отработает **dataset-loader**. Если CSV нет — в логах будет предупреждение, контейнер завершится с кодом 0, **postgres** и **frontend** продолжают работать без заливки таблиц из этих файлов.
- Повторить только загрузку в уже поднятую БД: `docker compose up -d postgres`, затем `docker compose run --rm dataset-loader`.
- **Поиск СТЕ:** сервис **api** ждёт готовый Elasticsearch. Базовый образ **api** собирается **без** PyTorch / sentence-transformers (быстрая сборка). Чтобы индексировать с эмбеддингами, поднимите стек с ML — например  
  `docker compose -f docker-compose.yml -f docker-compose.ml.yml up --build -d`  
  (CPU) или с GPU — см. раздел ниже. Затем после заливки `ste_data` / `history_contract`:  
  `docker compose exec api python manage.py rebuild_ste_index`  
  (первый запуск скачает веса модели — может занять время и трафик).

- Ускорение эмбеддингов на **GPU** (опционально) — см. раздел **«GPU и эмбеддинги (поиск СТЕ)»** ниже.

**После успешного старта:** UI — http://localhost:4200 ; документация API — [Swagger UI (OpenAPI)](http://localhost:3000/schema/swagger-ui/) ; Postgres — `localhost:5432` (значения по умолчанию: пользователь `search_user`, БД `search_db`, пароль `search_pass`).

## GPU и эмбеддинги (поиск СТЕ)

Семантический поиск использует **sentence-transformers** и **PyTorch**. По умолчанию используется **CPU**; если на машине есть подходящий ускоритель, его можно задействовать автоматически или явно.

### Как выбирается устройство

В коде ([`beckend/ste_search/embedding.py`](beckend/ste_search/embedding.py)) порядок такой:

1. **NVIDIA CUDA** — если `torch.cuda.is_available()`.
2. **Apple MPS** — если доступен `torch.backends.mps` (Apple Silicon).
3. Иначе **CPU**.

Переменная окружения **`STE_EMBEDDING_DEVICE`** переопределяет режим: `auto` (по умолчанию), `cuda`, `mps`, `cpu`. Если указано `cuda` или `mps`, а устройства нет, в лог пишется предупреждение и используется CPU.

### Локально (venv, без Docker)

- **Только API и ES без семантики:** `pip install -r requirements.txt`
- **Семантический поиск и индексация:** дополнительно `pip install -r requirements-ml.txt` или сразу `pip install -r requirements-full.txt` (подтянет **CPU torch** и **sentence-transformers**).

Для **NVIDIA GPU** после этого переустановите torch с CUDA ([страница PyTorch](https://pytorch.org/get-started/locally/)), например CUDA 12.4:

```bash
pip install torch --index-url https://download.pytorch.org/whl/cu124
```

При доступной CUDA модель загрузится на GPU (в логах `device=cuda`).

Файлы: [`requirements.txt`](requirements.txt), [`requirements-ml.txt`](requirements-ml.txt), [`requirements-full.txt`](requirements-full.txt).

### Docker (контейнер `api`)

Build-args в [`beckend/Dockerfile`](beckend/Dockerfile):

| Аргумент | По умолчанию | Смысл |
|----------|--------------|--------|
| `WITH_ML` | `0` | `1` — установить [`requirements-ml.txt`](requirements-ml.txt) (torch, transformers, sentence-transformers) |
| `ENABLE_CUDA_TORCH` | `0` | только при `WITH_ML=1`: заменить torch на сборку **cu124** |

- **Обычный запуск** (`docker compose up --build`): образ **api** **без** torch/transformers — быстрая сборка. Эндпоинты с эмбеддингами и `rebuild_ste_index` вернут понятную ошибку, пока не пересоберёте с ML.
- **Семантика на CPU в Docker:** [`docker-compose.ml.yml`](docker-compose.ml.yml) — `WITH_ML=1`:

  ```bash
  docker compose -f docker-compose.yml -f docker-compose.ml.yml up --build -d
  ```

- **NVIDIA GPU:**
  1. Драйвер NVIDIA и **[NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)**. На Windows: **Docker Desktop** + **WSL2** с GPU.
  2. [`docker-compose.gpu.yml`](docker-compose.gpu.yml): `WITH_ML=1`, `ENABLE_CUDA_TORCH=1`, `NVIDIA_VISIBLE_DEVICES=all`, резервирование GPU.

     ```bash
     docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build -d
     ```

- Вручную: `docker compose build --build-arg WITH_ML=1 api` (CPU torch) или добавьте `--build-arg ENABLE_CUDA_TORCH=1` вместе с `WITH_ML=1`.
- Подробный лог сборки: `docker compose build --progress=plain api`

### Полезные переменные (см. также [.env.example](.env.example))

| Переменная | Назначение |
|------------|------------|
| `STE_EMBEDDING_DEVICE` | `auto` / `cuda` / `mps` / `cpu` (нужен образ с ML) |
| `STE_EMBEDDING_MODEL` | Имя модели sentence-transformers |
| `WITH_ML` / `ENABLE_CUDA_TORCH` | Только **build-arg** в Dockerfile; в compose — [`docker-compose.ml.yml`](docker-compose.ml.yml) и [`docker-compose.gpu.yml`](docker-compose.gpu.yml) |

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

## Сборка Docker: `EOF` / `rpc error ... Unavailable`

Сообщение вроде `target api: failed to receive status: rpc error: code = Unavailable desc = error reading from server: EOF` чаще всего означает не баг приложения, а **обрыв связи с Docker** или **нехватку ресурсов** на шаге долгого `pip install`. Базовый образ **api** без ML лёгкий; тяжёлая сборка — при **`WITH_ML=1`** (torch, sentence-transformers).

Что сделать:

1. **Уменьшить контекст сборки** — в корне репозитория есть [`.dockerignore`](.dockerignore): каталог **`data/`** с большими CSV **не должен** попадать в context образа `api` (раньше это могло грузить гигабайты на каждый `docker compose build` и приводить к таймауту/EOF). Пересоберите: `docker compose build api`.
2. **Docker Desktop → Settings → Resources**: увеличьте **Memory** (например 8–12 GB), **Disk** при необходимости; перезапустите Docker.
3. Соберите только **api** отдельно: `docker compose build api`, затем остальное — `docker compose build`.
4. Повторите сборку после `wsl --shutdown` (если backend WSL2) и перезапуска Docker Desktop.
5. Если падение стабильно на одном слое — временно отключите BuildKit: `set DOCKER_BUILDKIT=0` и снова `docker compose build`.
6. Сборка **с ML** (`docker-compose.ml.yml` / `docker-compose.gpu.yml`) долго молчит — часто качается torch; используйте `docker compose build --progress=plain api`.

## Полезные команды

- Остановка: `docker compose down`
- Логи API: `docker compose logs -f api`
- Повторная индексация СТЕ в ES (если API уже запущен): `POST /indexing/reindex` (см. [Swagger UI](http://localhost:3000/schema/swagger-ui/)).

## Переменные окружения

Минимальный набор для приложения в контейнере задаётся в [docker-compose.yml](docker-compose.yml); для переопределения используйте **`.env`** в корне (см. [.env.example](.env.example)). Полный список и валидация — в `backend/src/config/validation.ts`.
