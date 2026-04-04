# Frontend architecture

This folder contains the Angular 20 + Standalone + NgRx frontend scaffold with the main integration layer wired to the current NestJS backend.

Architecture goals:
- JWT-based auth with `accessToken` on the frontend and `refreshToken` in backend `HttpOnly` cookie.
- Feature-first structure for auth and search.
- Flat search UX with suggestions, result list, and telemetry hooks.
- No backend changes; frontend adapts to the current contract.

Layers:
- `src/app/core`: routing guards, interceptors, token storage, refresh retry, app shell.
- `src/app/shared`: reusable models and UI building blocks.
- `src/app/features/auth`: register/login pages, auth state, auth API facade.
- `src/app/features/search`: search page, suggestions, flat results, telemetry API, search state.

Current backend contract used by the frontend:
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /search/suggest`
- `GET /products/search`
- `POST /events/bulk`

Important distinction:
- JWT tokens are used for authentication.
- `search_session` is an analytics entity for search behavior and is not an auth session.

Current frontend assumptions:
- no bootstrap recommendations
- no grouped search results
- suggestions start after 2 characters
- telemetry currently sends `search_submit`, `suggestion_selected`, and `product_card_click`

Local integration note:
- if frontend runs on `localhost:4200` and backend on `localhost:3000`, cookie refresh requires backend CORS with `credentials: true` and an explicit allowed origin, or a same-origin proxy.
