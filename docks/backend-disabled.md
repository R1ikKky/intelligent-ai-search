# Отключённые обращения к бэкенду

**Авторизация** (`/auth/*`) на фронте включена. Ниже — что по-прежнему отключено (поиск, телеметрия, nginx).

## `frontend/nginx.conf`

- Закомментирован блок `location ~ ^/(auth|search|products|…)` с `proxy_pass http://app:3000` и заголовками для cookie/прокси.

## `frontend/src/app/features/auth/data-access/auth.api.ts`

- **Включено:** `register`, `login`, `refresh`, `logout` ходят в API с `withCredentials: true` (httpOnly `refreshToken`).
- Базовый URL задаётся в `environment*.ts` (`apiBaseUrl`), плюс интерцептор `api-base-url.interceptor.ts`.

## `frontend/src/app/features/search/data-access/search.api.ts`

- **`suggest`** — закомментирован `this.http.post('/search/suggest', …)`; сейчас возвращается `of([])`.
- **`search`** — закомментирован `this.http.get('/products/search', …)`; сейчас возвращается пустой `SearchResponse` с тем же `buildQueryId`, что и при пустом запросе.

Методы `mapSuggestion` и `mapSearchResponse` сохранены для восстановления вызовов.

## `frontend/src/app/features/search/data-access/telemetry.api.ts`

- **`flush`** — закомментирован `this.http.post('/events/bulk', …)`; при непустом батче возвращается `of(void 0)` без сети.

Маппинг `mapBatch` / `mapEvent` оставлен.

## Не менялись (но относятся к бэкенду)

- `frontend/src/app/core/interceptors/auth.interceptor.ts` — добавление `Authorization` к запросам (при появлении токена).
- `frontend/src/app/core/interceptors/error.interceptor.ts` — проверки URL `/auth/*`.
- `frontend/src/app/features/auth/store/auth.effects.ts` — вызывает `AuthApi` (сеть включена).
- `search.effects.ts` — вызывает `SearchApi` / `TelemetryApi`; для поиска и телеметрии запросы по-прежнему заглушены в соответствующих `*.api.ts`.

Чтобы включить поиск/события: раскомментируйте соответствующие фрагменты в `search.api.ts` / `telemetry.api.ts` и при необходимости включите блок в `nginx.conf`.
