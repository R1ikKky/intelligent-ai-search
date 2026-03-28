# Персонализированный умный поиск продукции

Smart product search backend for zakupki.mos.ru procurement portal.

## Quick Start

### Prerequisites
- Docker + Docker Compose
- Node.js 20 (for local development / seeding)

### 1. Start the stack

```bash
cp .env.example .env
docker compose up -d
```

Services started:
| Service | Port | URL |
|---|---|---|
| NestJS API | 3000 | http://localhost:3000 |
| Swagger UI | 3000 | http://localhost:3000/api |
| PostgreSQL | 5432 | — |
| Elasticsearch | 9200 | http://localhost:9200 |
| Redis | 6379 | — |
| Kibana (optional) | 5601 | `docker compose --profile debug up` |

### 2. Seed the database

```bash
npm install
npm run seed
```

Seeds 500 products into PostgreSQL and Elasticsearch, plus 3 mock users with behavior history.

### 3. Run tests

```bash
npm test
npm run test:cov   # with coverage
```

---

## Architecture Overview

```
src/
├── modules/
│   ├── auth/           # Mock JWT auth (POST /auth/login)
│   ├── products/       # Product catalog + search endpoint
│   ├── search/         # ES search logic + personalization + synonyms CRUD
│   ├── user-behavior/  # Event tracking + score aggregation via BullMQ
│   ├── indexing/       # ES index lifecycle + reindex endpoints
│   └── health/         # GET /health
├── common/
│   ├── decorators/     # @CurrentUser()
│   ├── filters/        # RFC 7807 exception filter
│   └── dto/            # shared pagination DTO
├── config/             # Joi-validated env config
└── seeds/              # products.seed.ts
```

### Personalization Algorithm

```
finalScore = esScore × (1 + personalizationBoost + categoryBoost)

personalizationBoost = clamp(userProductScore / MAX_SCORE × BOOST_MAX, 0, BOOST_MAX)
  MAX_SCORE = 100, BOOST_MAX = 2.0

categoryBoost = 0.3  if user ordered products in this category > 3 times
              = 0.0  otherwise
```

Scores are aggregated over a rolling 90-day window from `user_behavior_events`.
Score updates run asynchronously via BullMQ `score-update` queue after each event.

### Search Features
- **Russian morphology**: Elasticsearch built-in `russian` analyzer on `name` and `description`
- **Typo correction**: `fuzziness: AUTO` on multi-match query
- **Phrase suggestions**: ES phrase suggester returns corrected query as `suggestion` field
- **Synonym expansion**: synonym groups managed via `/synonyms` CRUD API (in-memory for hackathon)

---

## API Examples

### Login (get JWT)

```bash
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"userId": "user-1", "role": "buyer"}'
```

Returns:
```json
{"accessToken": "eyJ...", "userId": "user-1", "role": "buyer"}
```

### Anonymous search

```bash
TOKEN="<paste accessToken here>"

curl "http://localhost:3000/products/search?q=бумага&limit=5" \
  -H "Authorization: Bearer $TOKEN"
```

### Personalized search

```bash
curl "http://localhost:3000/products/search?q=бумага&userId=user-1&limit=5" \
  -H "Authorization: Bearer $TOKEN"
```

Returns ranked results with `personalizedScore` and `isPersonalized: true` for boosted items.

### Record a user event

```bash
curl -X POST http://localhost:3000/behavior/event \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"userId": "user-1", "productId": "<uuid>", "eventType": "order"}'
```

### Full reindex

```bash
curl -X POST http://localhost:3000/indexing/reindex \
  -H "Authorization: Bearer $TOKEN"
```

---

## Environment Variables

See `.env.example` for all variables with defaults.

| Variable | Description |
|---|---|
| `JWT_SECRET` | Secret for JWT signing |
| `POSTGRES_*` | PostgreSQL connection |
| `ELASTICSEARCH_NODE` | ES endpoint |
| `ELASTICSEARCH_INDEX` | Index name (default: `products`) |
| `REDIS_HOST/PORT` | Redis connection |
| `MAX_SCORE` | Normalization constant for personalization (default: 100) |
| `BOOST_MAX` | Max personalization multiplier (default: 2.0) |

---

## Key Dependencies

- **NestJS 11** — framework
- **TypeORM** — PostgreSQL ORM with `synchronize: true` in dev
- **@elastic/elasticsearch 9** — ES 8.x compatible client
- **BullMQ** — async score update jobs
- **Passport JWT** — bearer token auth
- **class-validator** — DTO validation
- **@nestjs/swagger** — auto-generated OpenAPI docs
