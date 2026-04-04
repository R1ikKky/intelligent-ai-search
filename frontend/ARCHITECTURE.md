# Frontend architecture map

This frontend is scaffolded for Angular 20 + Standalone + NgRx and aligned with the current NestJS backend contract.

## Goals

- Keep auth based on `JWT access token + refresh cookie`.
- Separate auth concerns from search analytics sessions.
- Keep a feature-first structure.
- Wire the main auth, search, and telemetry routes without changing the backend.

## Routes

- `/auth/login`
- `/auth/register`
- `/search`

## Layers

### `src/app/core`

Cross-cutting platform concerns:
- route guards
- HTTP interceptors
- token storage
- refresh-token retry service
- application shell
- API base URL token

### `src/app/shared`

Reusable frontend contracts and dumb UI blocks:
- auth/search/telemetry models
- basic section card
- generic search box

### `src/app/features/auth`

JWT authentication feature:
- login page
- register page
- auth facade
- auth API
- auth NgRx actions/reducer/effects/selectors

Frontend auth model:
- frontend stores only `accessToken`
- backend stores `refreshToken` in `HttpOnly` cookie
- `authInterceptor` attaches `Authorization: Bearer <accessToken>`
- `errorInterceptor` retries `401` through `/auth/refresh`
- login/register/refresh endpoints are excluded from bearer injection
- `guestOnlyGuard` prevents authenticated users from seeing login/register
- `authGuard` protects `/search`

### `src/app/features/search`

Main product-search experience:
- search page
- search toolbar wired to suggest/search
- suggestions list with click-to-search
- flat search results list
- telemetry events for `search_submit`, `suggestion_selected`, `product_card_click`
- search facade
- search API
- telemetry API
- search NgRx actions/reducer/effects/selectors

## Store slices

### `auth`
Tracks:
- current authenticated identity
- current `accessToken`
- loading state
- auth error state

### `search`
Tracks:
- suggestions dropdown data
- flat search response
- loading state
- API error state

## Backend contract used by the frontend

Auth:
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

Search:
- `POST /search/suggest`
- `GET /products/search`
- `GET /products/:id`

Telemetry:
- `POST /events/bulk`

## Important distinction

There are two different concepts that must not be mixed:

1. JWT auth tokens
- used for authentication and route protection
- frontend stores only the `accessToken`
- refresh token lives only in backend cookie storage

2. Search session
- used for analytics and behavior tracking
- sent as `session_id` inside telemetry payloads
- not used for route auth

## Current assumptions

- Search results are rendered as a flat list because backend returns flat `items`.
- Bootstrap recommendations are not used.
- Suggestions are requested after the query reaches at least 2 characters.
- Search requests are sent with `page=1` and `limit=20` for now.

## Integration note for local development

If Angular runs on `http://localhost:4200` and NestJS runs on `http://localhost:3000`, cookie-based refresh will only work if backend CORS is configured with explicit origin and `credentials: true`, or if you use a dev proxy / same-origin gateway.

## What is intentionally not implemented yet

- silent auth restore when there is only refresh cookie and no local access token
- `sendBeacon` fallback for telemetry flush
- product details screen integration
- dwell-time / page-leave telemetry
- advanced form validation UX
