# Персонализированный умный поиск продукции

> Smart product search for zakupki.mos.ru

## Structure

```
.
├── backend/     # NestJS API (Node.js 20, TypeScript)
├── frontend/    # React / Next.js
├── ml/          # Python: embedding model, ranker
├── docker-compose.yml
└── .env.example
```

Each app is independently runnable. `docker-compose.yml` at root boots the full stack.

## Quick start

```bash
cp .env.example .env
docker compose up -d          # postgres + elasticsearch + redis + backend
```

### Backend (NestJS)

```bash
cd backend
npm install
npm run seed        # populate 500 products + mock users
npm run start:dev   # http://localhost:3000
# Swagger: http://localhost:3000/api
```

### Frontend

```bash
cd frontend
# see frontend/README.md
```

### ML

```bash
cd ml
# see ml/README.md
```

## Ports

| Service | Port |
|---|---|
| Backend API | 3000 |
| Swagger UI | 3000/api |
| PostgreSQL | 5432 |
| Elasticsearch | 9200 |
| Redis | 6379 |
| Kibana | 5601 (`docker compose --profile debug up`) |
