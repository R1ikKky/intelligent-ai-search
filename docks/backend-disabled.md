# Отключённые обращения к бэкенду

**Авторизация** (`/auth/*`) и **поиск СТЕ** (`GET /products/search`) на фронте включены. Ниже — что по-прежнему отключено (подсказки suggest, телеметрия, nginx).

## `frontend/nginx.conf`

- Закомментирован блок `location ~ ^/(auth|search|products|…)` с `proxy_pass` на API и заголовками для cookie/прокси. Для прод-сборки с одним origin включите прокси на сервис `api`.

## `frontend/src/app/features/auth/data-access/auth.api.ts`

- **Включено:** `register`, `login`, `refresh`, `logout` с `withCredentials: true` (httpOnly `refreshToken`).
- Базовый URL: `environment*.ts` (`apiBaseUrl`), интерцептор `api-base-url.interceptor.ts`.

## `frontend/src/app/features/search/data-access/search.api.ts`

- **`search`** — `GET /products/search` с `q`, `page`, `limit`; ответ с `cards` (группы СТЕ) и плоским `items`.
- **`suggest`** — по-прежнему `of([])` (отдельный эндпоинт не подключён).

## `frontend/src/app/features/search/data-access/telemetry.api.ts`

- **`flush`** — закомментирован `POST /events/bulk`; при непустом батче возвращается `of(void 0)` без сети.

## Прочее

- `auth.interceptor.ts` — `Authorization: Bearer`.
- `error.interceptor.ts` — refresh при 401 (кроме исключённых URL).
- Индекс Elasticsearch после загрузки данных: `python beckend/manage.py rebuild_ste_index` (в Docker: `docker compose exec api python manage.py rebuild_ste_index`).

Чтобы включить телеметрию / suggest: раскомментируйте вызовы в `telemetry.api.ts` и при необходимости добавьте эндпоинты на бэкенде; для SPA за nginx — включите блок в `nginx.conf`.
