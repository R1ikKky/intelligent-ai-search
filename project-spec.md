# Проектная документация

## 1. Название проекта

Персонализированный умный поиск продукции по каталогу СТЕ с динамическим ранжированием на основе истории закупок и поведения пользователя.

---

## 2. Цели проекта

Система должна:

1. Принимать поисковый запрос по СТЕ и возвращать персонализированную выдачу.
2. Учитывать историю закупок заказчика и его текущее поведение в поиске.
3. Исправлять опечатки, учитывать синонимы и показывать рекомендации в выпадающем списке.
4. Давать валидные рекомендации даже при первом входе за счёт похожих организаций.
5. Работать полностью на инфраструктуре команды, без внешних API.
6. Масштабироваться и обновлять индекс по мере накопления действий пользователя.

---

## 3. Ключевые ограничения из ТЗ

1. Linux-совместимое развертывание.
2. Веб-интерфейс обязателен.
3. Нельзя использовать внешние поисковые API и внешние LLM API.
4. Допустимы только self-hosted/open-source модели и локальные сервисы.
5. Предпочтительны легковесные технологии и быстрый инференс.

---

## 4. Факты по исходным данным

Анализ выполнен Python-скриптом [`scripts/analyze_datasets.py`](/c:/Users/OLEG/OneDrive/Рабочий%20стол/Новая%20папка%20(2)/scripts/analyze_datasets.py). Результат сохранён в [`analysis_summary.json`](/c:/Users/OLEG/OneDrive/Рабочий%20стол/Новая%20папка%20(2)/analysis_summary.json).

### 4.1 Контракты

- Строк в `Контракты_20260403.csv`: 2 010 224.
- Уникальных `contract_id`: 653 615.
- Уникальных `ste_id`: 498 370.
- Уникальных `customer_inn`: 4 192.
- Уникальных `supplier_inn`: 881.
- `contract_id` не является уникальным идентификатором строки продажи: 198 383 контрактов имеют более одной строки, максимум 330 строк на один `contract_id`.
- Минимальная дата контракта: `2014-04-07`.
- Максимальная дата контракта: `2026-12-25`.
- Найдено 6 дат позже даты выгрузки `2026-04-03`; это нужно считать аномалией источника и логировать при загрузке.

### 4.2 Каталог СТЕ

- Строк в `СТЕ_20260403.csv`: 542 993.
- Уникальных `ste_id`: 537 314.
- Дубликатов строк по `ste_id`: 5 679.
- Уникальных категорий: 6 506.
- У `ste_id` нет конфликтов по `name` и `category`; дубликаты, вероятно, являются повторными строками.

### 4.3 Качество JOIN по `ste_id`

- Пересечение `Контракты.ste_id` и `СТЕ.ste_id`: 496 809.
- `ste_id`, которые есть только в контрактах: 1 561.
- `ste_id`, которые есть только в каталоге: 40 505.

Вывод:

1. Для полной ссылочной целостности нельзя ограничиваться только каталогом СТЕ. Нужно создавать stub-записи для `ste_id`, присутствующих только в контрактах.
2. В поиске должно участвовать и множество СТЕ без истории продаж, иначе каталог будет урезан.

### 4.4 Связь `ste_id -> supplier_inn`

- `ste_id` с ровно одним поставщиком: 333 898.
- `ste_id` с несколькими поставщиками: 164 472.
- Максимум поставщиков на один `ste_id`: 65.

Вывод:

1. Поле `ste.id_supplier` может существовать только как вычисляемый `primary_supplier_id`, а не как истинная бизнес-кардинальность.
2. Обязательно нужна дополнительная таблица связи `ste_supplier_stat`, иначе будут потеряны факты по реальным поставщикам.

### 4.5 Качество сущностей по ИНН

- У заказчиков 17 ИНН имеют несколько вариантов наименований.
- У поставщиков 9 ИНН имеют несколько вариантов наименований.
- У поставщиков 4 ИНН имеют несколько регионов.

Вывод:

1. Нужна канонизация имени и региона.
2. Нужно хранить исходные варианты имён в `jsonb` для трассировки и аудита качества данных.

### 4.6 Признаки производителя в `attributes`

- `ste` с любыми manufacturer-like ключами: 79 215.
- `ste` с явными полями бренда/производителя: 30 525.
- `ste` только со страной происхождения: 27 578.

Вывод:

1. Для большинства СТЕ производитель не задан явно.
2. Группировка строго по производителю возможна только с уровнями уверенности:
   - `manufacturer_attr` — явный производитель/бренд найден в атрибутах.
   - `brand_from_name` — бренд извлечён из имени по словарю.
   - `supplier_fallback` — используем вычисленного primary supplier как замену, если производитель отсутствует.
   - `family_cluster` — fallback-кластер по семейству товара, если производитель не восстановлен.

---

## 5. Рекомендуемый стек

| Слой | Технологии | Обоснование |
|---|---|---|
| Frontend | React / Next.js, либо Angular 20 Standalone + NgRx | SPA с формами, поиском, dropdown подсказок и состоянием выдачи |
| Backend API | Node.js 20, NestJS 11, TypeScript strict | Реализован. Модульный REST API, BullMQ workers, интеграция с ES и ML |
| Основная БД | PostgreSQL 16 в Docker | Транзакционные данные, история продаж, профили, события |
| Расширения Postgres | `pgvector`, `unaccent`, `pgcrypto`, `btree_gin` | Векторный поиск (`pgvector`), токены (`pgcrypto`). `pg_trgm` и `tsvector` — опционально, если ES недостаточен |
| Поисковый движок | **Elasticsearch 8.x** (реализован) | Встроенный `russian` analyzer (морфология без плагинов), fuzzy-поиск, phrase suggester. Лучшая альтернатива `pg_trgm+tsvector` для русского языка в рамках хакатона |
| ML / NLP сервис | Python 3.11, FastAPI, `sentence-transformers`, `pymorphy3` | Генерация эмбеддингов (384d), нормализация, переобучение ranker |
| Очереди | Redis 7 + BullMQ | Реализован. Асинхронный пересчёт `user_product_score` после каждого события |
| ETL | Python-скрипты | Загрузка CSV → PostgreSQL → ES индексация |
| Буферизация событий | `sendBeacon` + `POST /events/bulk` + `localStorage` queue | Batch телеметрия без heartbeat-запросов |

### 5.1 Текущая структура NestJS (реализовано)

Роль NestJS backend:
1. REST API — поиск, подсказки, события, Auth.
2. JWT аутентификация (mock на хакатон, расширяется до real auth).
3. Обработчики поиска, suggest, bulk-events.
4. BullMQ workers для async пересчёта профилей.
5. Интеграция с Python ML service (эмбеддинги, rerank).
6. Admin/debug endpoints.

**Реализованные модули:**

| Модуль | Статус | Endpoints |
|---|---|---|
| `AuthModule` | ✅ Реализован | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` |
| `ProductsModule` | ✅ Реализован | `GET /products/search`, `GET /products/:id`, `POST /products/bulk-import` |
| `SearchModule` | ✅ Реализован | `POST /search/suggest` |
| `UserBehaviorModule` | ✅ Реализован | `POST /events/bulk`, `GET /events/scores/:userId` |
| `IndexingModule` | ✅ Реализован | `POST /indexing/reindex`, `POST /indexing/product/:id` |
| `HealthModule` | ✅ Реализован | `GET /health` |
| `SynonymsModule` (в Search) | ✅ Реализован | `POST/GET/DELETE /synonyms` |

**Запланированные модули (нужно дореализовать):**

| Модуль | Статус | Что нужно |
|---|---|---|
| `ProfileModule` | 🔲 Нужен | `customer_preference_profile`, cold-start по похожим организациям |
| `SearchSessionModule` | 🔲 Нужен | Хранение `search_session`, `search_query` для телеметрии поиска (отдельно от auth) |
| `AdminModule` | 🔲 Опционально | Метрики, просмотр профилей, quality log |

**Инфраструктурный слой (всё уже подключено):**
`@nestjs/config` + Joi, `@nestjs/jwt` + Passport, `class-validator`, `BullMQ`, `TypeORM` (**TypeORM выбран — §24.1 закрыт**).

---

## 6. Целевая архитектура

```mermaid
flowchart LR
    U[Пользователь] --> A[Frontend SPA]
    A -->|REST/JSON| B[NestJS API]
    B --> E[(Elasticsearch 8.x\nrussian analyzer)]
    B --> P[(PostgreSQL 16\n+ pgvector)]
    B --> M[Python FastAPI\nsentence-transformers]
    B --> R[(Redis 7)]
    B --> Q[BullMQ worker]
    Q --> R
    Q --> P
    M --> P
    A -->|POST /events/bulk| B

    subgraph SearchContour[Поисковый контур]
      B --> S1[Нормализация запроса]
      S1 --> S2[Синонимы + suggest\nES phrase suggester]
      S2 --> S3[Лексический recall\nES multi-match + fuzziness]
      S3 --> S4[Semantic rerank top-N\npgvector cosine]
      S4 --> S5[Персонализация\ncontract + behavior affinity]
      S5 --> S6[Группировка\nпо производителю/семейству]
    end
```

### 6.1 Основные сервисы

1. `frontend-app`
   - Регистрация.
   - Вход.
   - Поиск.
   - Простая пакетная отправка действий пользователя.

2. `api-bff`
   - Auth API.
   - Search API.
   - Suggest API.
   - Events API.
   - Admin/debug API.

3. `postgres`
   - Справочники.
   - История продаж.
   - Профили пользователей.
   - События.
   - Поисковые индексы.

4. `ml-service`
   - Нормализация текста.
   - Генерация эмбеддингов.
   - Переиндексация векторов.
   - Экспериментальный reranker.

5. `worker`
   - BullMQ consumer.
   - Агрегация событий.
   - Пересчёт похожих организаций и cold-start seed profiles.
   - Пересчёт пользовательских профилей.
   - Перестройка персональных весов.
   - Обновление materialized views.

6. `redis`
   - Очереди фоновых задач.
   - Retriable jobs.
   - Краткоживущий кэш suggestions/search fragments при необходимости.

---

## 7. Модель данных PostgreSQL

Ниже описана рекомендованная схема. Она включает обязательные таблицы из запроса пользователя и дополнительные служебные таблицы, без которых полноценно реализовать персонализированный поиск нельзя.

### 7.1 Таблица `customer_data`

Справочник заказчиков, пришедший из исторических контрактов.

| Поле | Тип | Назначение |
|---|---|---|
| `id` | `varchar(12)` PK | `customer_inn` |
| `customer_name` | `text` | Каноническое имя заказчика |
| `customer_name_normalized` | `text` | Нормализованное имя без юр. формы и стоп-слов |
| `customer_region` | `text` | Канонический регион |
| `org_type_primary` | `varchar(64) null` | Основной тип организации: `school`, `clinic`, `hospital`, `college`, `library`, `housing`, ... |
| `org_type_tags` | `text[]` | Набор выявленных тегов типа организации |
| `name_embedding` | `vector(384) null` | Эмбеддинг названия организации для поиска похожих заказчиков |
| `name_variants` | `jsonb` | Исходные варианты имени |
| `source_first_seen_at` | `timestamptz` | Первая дата контракта |
| `source_last_seen_at` | `timestamptz` | Последняя дата контракта |
| `created_at` | `timestamptz` | Техническое поле |
| `updated_at` | `timestamptz` | Техническое поле |

Правило:

- `id = customer_inn`.

### 7.2 Таблица `customer`

Таблица учётных записей для входа в систему.

| Поле | Тип | Назначение |
|---|---|---|
| `id` | `uuid` PK | Идентификатор учётной записи |
| `customer_data_id` | `varchar(12)` FK -> `customer_data.id` | Привязка к заказчику |
| `login` | `varchar(12)` UNIQUE | Равен `customer_inn` |
| `password_hash` | `text` | Argon2id/Bcrypt hash |
| `status` | `varchar(32)` | `active`, `blocked`, `pending` |
| `created_at` | `timestamptz` | Дата регистрации |
| `last_login_at` | `timestamptz` | Последний вход |

Жёсткое правило:

- `login = customer_data_id = customer_inn`.

### 7.3 Таблица `supplier`

Справочник поставщиков.

| Поле | Тип | Назначение |
|---|---|---|
| `id` | `varchar(12)` PK | `supplier_inn` |
| `supplier_name` | `text` | Каноническое имя |
| `supplier_region` | `text` | Канонический регион |
| `name_variants` | `jsonb` | Варианты имен |
| `region_variants` | `jsonb` | Варианты регионов |
| `source_first_seen_at` | `timestamptz` | Первая продажа |
| `source_last_seen_at` | `timestamptz` | Последняя продажа |
| `created_at` | `timestamptz` | Техническое поле |
| `updated_at` | `timestamptz` | Техническое поле |

Правило:

- `id = supplier_inn`.

### 7.4 Таблица `ste`

Нормализованный каталог СТЕ.

| Поле | Тип | Назначение |
|---|---|---|
| `id` | `varchar(32)` PK | `ste_id` |
| `name` | `text` | Наименование СТЕ |
| `category` | `text` | Категория |
| `attributes_raw` | `text` | Сырой текст атрибутов |
| `attributes_jsonb` | `jsonb` | Распарсенные атрибуты |
| `manufacturer_name` | `text null` | Вычисленный производитель/бренд |
| `manufacturer_source` | `varchar(32)` | `manufacturer_attr`, `brand_from_name`, `supplier_fallback`, `family_cluster`, `unknown` |
| `manufacturer_confidence` | `numeric(5,4)` | Доверие к `manufacturer_name` |
| `id_supplier` | `varchar(12) null` FK -> `supplier.id` | Вычисленный primary supplier |
| `supplier_resolution_method` | `varchar(32)` | `top_contracts`, `top_amount`, `latest`, `none` |
| `source_status` | `varchar(32)` | `catalog`, `contracts_stub` |
| `search_text` | `text` | Склеенный текст для индексации |
| `search_vector` | `tsvector` | FTS индекс |
| `embedding` | `vector(384) null` | Семантическое представление |
| `created_at` | `timestamptz` | Техническое поле |
| `updated_at` | `timestamptz` | Техническое поле |

### 7.5 Таблица `ste_supplier_stat`

Дополнительная обязательная таблица, потому что один `ste_id` часто связан с несколькими поставщиками.

| Поле | Тип | Назначение |
|---|---|---|
| `ste_id` | `varchar(32)` FK -> `ste.id` | СТЕ |
| `supplier_id` | `varchar(12)` FK -> `supplier.id` | Поставщик |
| `contracts_count` | `integer` | Сколько строк продаж |
| `contracts_total_amount` | `numeric(18,2)` | Общая сумма |
| `first_contract_at` | `timestamptz` | Первая продажа |
| `last_contract_at` | `timestamptz` | Последняя продажа |
| `rank_in_ste` | `integer` | Позиция поставщика для данного `ste_id` |
| `is_primary` | `boolean` | Флаг primary supplier |

Первичный ключ:

- `(ste_id, supplier_id)`.

Правило вычисления `ste.id_supplier`:

1. Считаем `contracts_count` по паре `(ste_id, supplier_id)`.
2. При равенстве берём максимальную `contracts_total_amount`.
3. При равенстве берём самый поздний `last_contract_at`.
4. При полном равенстве берём минимальный `supplier_id` для детерминированности.

### 7.6 Таблица `sale`

Факты продаж из `Контракты_20260403.csv`.

| Поле | Тип | Назначение |
|---|---|---|
| `id` | `bigserial` PK | Суррогатный идентификатор строки |
| `contract_id` | `varchar(32)` | Идентификатор контракта из источника |
| `ste_id` | `varchar(32)` FK -> `ste.id` | СТЕ |
| `customer_data_id` | `varchar(12)` FK -> `customer_data.id` | Заказчик |
| `supplier_id` | `varchar(12)` FK -> `supplier.id` | Поставщик |
| `procurement_title` | `text` | Наименование закупки |
| `contract_date` | `timestamptz` | Дата контракта |
| `contract_amount` | `numeric(18,2)` | Стоимость |
| `created_at` | `timestamptz` | Техническое поле |

Почему нужен `bigserial id`:

- `contract_id` не уникален в источнике.

### 7.7 Таблица `search_session`

Сессия работы пользователя с поиском.

| Поле | Тип | Назначение |
|---|---|---|
| `id` | `uuid` PK | Идентификатор сессии |
| `customer_id` | `uuid` FK -> `customer.id` | Пользователь |
| `started_at` | `timestamptz` | Начало |
| `finished_at` | `timestamptz null` | Окончание |
| `user_agent` | `text` | Технический контекст |
| `device_type` | `varchar(32)` | `desktop`, `tablet`, `mobile` |
| `app_version` | `varchar(32)` | Версия фронта |

### 7.8 Таблица `search_query`

История поисковых запросов.

| Поле | Тип | Назначение |
|---|---|---|
| `id` | `uuid` PK | Идентификатор запроса |
| `session_id` | `uuid` FK -> `search_session.id` | Сессия |
| `customer_id` | `uuid` FK -> `customer.id` | Пользователь |
| `original_query` | `text` | Введённый текст |
| `normalized_query` | `text` | Нормализованный текст |
| `corrected_query` | `text null` | Исправленная форма |
| `correction_applied` | `boolean` | Было ли исправление |
| `result_count` | `integer` | Сколько найдено |
| `latency_ms` | `integer` | Время ответа |
| `query_source` | `varchar(32)` | `typed`, `suggest`, `history`, `retry` |
| `created_at` | `timestamptz` | Время поиска |

### 7.9 Таблица `search_query_recommendation`

Что именно показали пользователю в автодополнении/подсказках.

| Поле | Тип | Назначение |
|---|---|---|
| `id` | `bigserial` PK | Идентификатор |
| `search_query_id` | `uuid` FK -> `search_query.id` | Запрос |
| `text` | `text` | Текст подсказки |
| `kind` | `varchar(32)` | `history`, `spellfix`, `synonym`, `popular`, `category` |
| `flags` | `text[]` | Набор признаков для фронта |
| `position` | `integer` | Порядок в списке |
| `score` | `numeric(6,4)` | Внутренний скоринг |
| `selected` | `boolean` | Была ли выбрана |
| `created_at` | `timestamptz` | Время показа |

### 7.10 Таблица `user_action`

Универсальная таблица телеметрии действий пользователя.

| Поле | Тип | Назначение |
|---|---|---|
| `id` | `bigserial` PK | Идентификатор |
| `event_id` | `uuid` UNIQUE | Idempotency ключ от фронта |
| `session_id` | `uuid` FK -> `search_session.id` | Сессия |
| `customer_id` | `uuid` FK -> `customer.id` | Пользователь |
| `search_query_id` | `uuid null` FK -> `search_query.id` | Связанный запрос |
| `ste_id` | `varchar(32) null` FK -> `ste.id` | Связанная карточка |
| `event_type` | `varchar(64)` | Тип действия |
| `event_at` | `timestamptz` | Когда произошло |
| `dwell_ms` | `integer null` | Время изучения страницы/блока |
| `active_time_ms` | `integer null` | Время при активной вкладке |
| `result_rank` | `integer null` | Позиция в выдаче |
| `page_no` | `integer null` | Номер страницы выдачи |
| `payload` | `jsonb` | Дополнительные детали |

### 7.11 Таблица `customer_preference_profile`

Агрегированный профиль пользователя для быстрого ранжирования.

| Поле | Тип | Назначение |
|---|---|---|
| `customer_id` | `uuid` PK FK -> `customer.id` | Пользователь |
| `top_categories` | `jsonb` | Веса по категориям |
| `top_manufacturers` | `jsonb` | Веса по производителям |
| `top_suppliers` | `jsonb` | Веса по поставщикам |
| `top_attributes` | `jsonb` | Веса по атрибутам |
| `cold_start_seed_categories` | `jsonb` | Стартовые категории из похожих организаций |
| `cold_start_seed_manufacturers` | `jsonb` | Стартовые бренды/производители из похожих организаций |
| `cold_start_seed_suppliers` | `jsonb` | Стартовые поставщики из похожих организаций |
| `seed_source` | `varchar(64)` | `direct_history`, `similar_organizations`, `popular_in_region`, `global_popular` |
| `negative_patterns` | `jsonb` | Негативные сигналы |
| `query_embedding_centroid` | `vector(384) null` | Семантический профиль |
| `updated_at` | `timestamptz` | Последний пересчёт |

### 7.12 Таблица `customer_similarity_edge`

Связи между похожими заказчиками для cold-start рекомендаций.

| Поле | Тип | Назначение |
|---|---|---|
| `source_customer_data_id` | `varchar(12)` FK -> `customer_data.id` | Для кого считаем похожих |
| `neighbor_customer_data_id` | `varchar(12)` FK -> `customer_data.id` | Похожий заказчик |
| `similarity_score` | `numeric(6,4)` | Итоговая близость |
| `same_region` | `boolean` | Совпадает ли регион |
| `same_org_type` | `boolean` | Совпадает ли тип организации |
| `name_similarity` | `numeric(6,4)` | Близость по названию |
| `purchase_similarity` | `numeric(6,4)` | Близость по структуре контрактов |
| `features` | `jsonb` | Детали расчёта |
| `computed_at` | `timestamptz` | Когда пересчитано |

Первичный ключ:

- `(source_customer_data_id, neighbor_customer_data_id)`.

### 7.13 Таблица `synonym_entry`

Локальный словарь синонимов и аббревиатур.

| Поле | Тип | Назначение |
|---|---|---|
| `id` | `bigserial` PK | Идентификатор |
| `canonical_term` | `text` | Каноническая форма |
| `variant_term` | `text` | Вариант / синоним / аббревиатура |
| `kind` | `varchar(32)` | `manual`, `mined`, `abbreviation` |
| `weight` | `numeric(6,4)` | Вес разворачивания |
| `is_active` | `boolean` | Используется ли запись |
| `created_at` | `timestamptz` | Техническое поле |

---

## 8. ER-диаграмма

```mermaid
erDiagram
    CUSTOMER_DATA ||--o{ CUSTOMER : "has account"
    CUSTOMER_DATA ||--o{ SALE : "buys"
    CUSTOMER_DATA ||--o{ CUSTOMER_SIMILARITY_EDGE : "source"
    CUSTOMER_DATA ||--o{ CUSTOMER_SIMILARITY_EDGE : "neighbor"
    SUPPLIER ||--o{ SALE : "sells"
    STE ||--o{ SALE : "appears in"
    STE ||--o{ STE_SUPPLIER_STAT : "has"
    SUPPLIER ||--o{ STE_SUPPLIER_STAT : "linked"
    CUSTOMER ||--o{ SEARCH_SESSION : "starts"
    SEARCH_SESSION ||--o{ SEARCH_QUERY : "contains"
    SEARCH_QUERY ||--o{ SEARCH_QUERY_RECOMMENDATION : "shows"
    CUSTOMER ||--o{ USER_ACTION : "performs"
    SEARCH_SESSION ||--o{ USER_ACTION : "contains"
    SEARCH_QUERY ||--o{ USER_ACTION : "relates"
    STE ||--o{ USER_ACTION : "viewed"
    CUSTOMER ||--|| CUSTOMER_PREFERENCE_PROFILE : "aggregated to"
```

---

## 9. UML: основные взаимодействия

### 9.1 Диаграмма последовательности: поиск

```mermaid
sequenceDiagram
    actor User as Пользователь
    participant FE as Angular SPA
    participant API as NestJS API
    participant DB as PostgreSQL
    participant ML as Python ML Service
    participant W as Worker

    User->>FE: Вводит текст запроса
    FE->>API: POST /api/search/suggest
    API->>DB: История + словарь + trigram
    API->>ML: Нормализация/лемматизация (опц.)
    API-->>FE: Подсказки с flags

    User->>FE: Нажимает Enter / выбирает подсказку
    FE->>API: POST /api/search
    API->>DB: Лексический recall top-K
    API->>ML: Embedding query + semantic rerank top-N
    API->>DB: Профиль пользователя + похожие организации + события
    API->>DB: Группировка результатов
    API-->>FE: Группы результатов + recommendations
    FE->>API: POST /api/events/bulk (submit/dwell на выдаче и карточке)
    API->>DB: Сохраняет события
    API->>W: Ставит задачу на пересчёт профиля
    W->>DB: Обновляет customer_preference_profile
```

### 9.2 Диаграмма последовательности: регистрация и вход

```mermaid
sequenceDiagram
    actor User as Пользователь
    participant FE as Angular SPA
    participant API as NestJS API
    participant DB as PostgreSQL

    User->>FE: Заполняет форму регистрации (ИНН + пароль)
    FE->>API: POST /auth/register
    API->>DB: bcrypt.hash(password, 12)
    API->>DB: INSERT INTO customer (login=INN, password_hash, status='active')
    API->>DB: INSERT INTO refresh_tokens
    API-->>FE: { accessToken } + Set-Cookie: refreshToken (httpOnly)

    User->>FE: Вводит customer_inn и password
    FE->>API: POST /auth/login
    API->>DB: SELECT customer WHERE login=INN
    API->>DB: bcrypt.compare(password, hash)
    API->>DB: UPDATE customer SET last_login_at
    API->>DB: INSERT INTO refresh_tokens
    API-->>FE: { accessToken } + Set-Cookie: refreshToken (httpOnly)

    Note over FE,API: Access token истекает через 15 минут

    FE->>API: POST /auth/refresh (cookie: refreshToken)
    API->>DB: BEGIN TRANSACTION
    API->>DB: DELETE old refresh_token
    API->>DB: INSERT new refresh_token
    API->>DB: COMMIT
    API-->>FE: { accessToken } + Set-Cookie: refreshToken (новый, httpOnly)

    User->>FE: Выход
    FE->>API: POST /auth/logout (cookie: refreshToken)
    API->>DB: DELETE refresh_token
    API-->>FE: 204 No Content + Clear-Cookie
```

### 9.3 Диаграмма состояний: жизненный цикл взаимодействия с карточкой товара

```mermaid
stateDiagram-v2
    [*] --> SearchResults
    SearchResults --> ProductOpened: click card
    ProductOpened --> ActiveStudy: tab active, active_time_ms на клиенте
    ActiveStudy --> QuickBounce: leave < 8s
    ActiveStudy --> EngagedView: stay 25-60s
    ActiveStudy --> DeepStudy: stay > 60s
    QuickBounce --> SearchResults: back to results
    EngagedView --> SearchResults: back to results
    DeepStudy --> SearchResults: back to results
    SearchResults --> QueryReformulation: change query
    QueryReformulation --> SearchResults: new search
```

---

## 10. BPMN-подобная схема процесса

Эта диаграмма нужна для презентации защиты. Она оформлена в swimlane-стиле и легко переносится в BPMN-редактор.

```mermaid
flowchart LR
    subgraph UserLane[Пользователь]
        U1[Ввод запроса]
        U2[Просмотр подсказок]
        U3[Просмотр выдачи]
        U4[Открытие карточки]
        U5[Уточнение запроса]
    end

    subgraph FrontLane[Frontend]
        F1[Отправка suggest]
        F2[Отрисовка подсказок]
        F3[Отправка search]
        F4[Логирование impression/click/view]
        F5[Пакетная отправка событий]
    end

    subgraph BackLane[Backend]
        B1[Нормализация текста]
        B2[Исправление опечаток]
        B3[Синонимы и история]
        B4[Поиск кандидатов]
        B5[Персонализация]
        B6[Сохранение событий]
        B7[Постановка задачи на пересчёт]
    end

    subgraph DataLane[Data/ML]
        D1[Postgres FTS + trigram]
        D2[pgvector / semantic rerank]
        D3[Пересчёт customer profile]
    end

    U1 --> F1 --> B1 --> B2 --> B3 --> F2 --> U2
    U2 --> F3 --> B4 --> D1 --> D2 --> B5 --> U3
    U3 --> U4 --> F4 --> F5 --> B6 --> B7 --> D3
    U3 --> U5 --> U1
```

---

## 11. Загрузка и преобразование исходных CSV

### 11.1 ETL-пайплайн

1. Загрузить CSV во временные staging-таблицы `stg_contracts` и `stg_ste`.
2. Удалить точные дубликаты по `ste_id` в `stg_ste`.
3. Распарсить `attributes` в `jsonb`.
4. Канонизировать имена заказчиков и поставщиков.
5. Нормализовать `customer_name`, извлечь `org_type_primary`, `org_type_tags`.
6. Построить `customer_data`.
7. Построить `supplier`.
8. Построить `ste` из каталога.
9. Добавить stub-СTЕ для 1 561 `ste_id`, встречающихся только в контрактах.
10. Построить `sale`.
11. Построить `ste_supplier_stat`.
12. Вычислить `ste.id_supplier`.
13. Построить `customer_similarity_edge`.
14. Построить индексы поиска, эмбеддинги и cold-start seed profiles.

### 11.2 Правила канонизации

1. `customer_inn` и `supplier_inn` хранить строкой.
2. ИНН не преобразовывать в integer, чтобы не потерять формат.
3. `customer_name` и `supplier_name` канонизировать по наиболее частому варианту.
4. Для `customer_name` хранить нормализованную форму без юр. форм и стоп-слов.
5. Извлекать тип организации через словарь правил и regex-шаблоны.
6. Если у поставщика несколько регионов, брать наиболее частый и хранить все варианты в `region_variants`.
7. Все аномалии грузить в таблицу `etl_quality_log`.

### 11.3 Отдельная таблица качества загрузки

Рекомендуется служебная таблица `etl_quality_log`:

| Поле | Тип | Назначение |
|---|---|---|
| `id` | `bigserial` PK | Идентификатор |
| `batch_id` | `uuid` | Пакет загрузки |
| `source_name` | `text` | Источник |
| `entity_name` | `text` | Сущность |
| `entity_key` | `text` | Ключ записи |
| `issue_code` | `text` | Тип проблемы |
| `issue_payload` | `jsonb` | Детали |
| `created_at` | `timestamptz` | Время |

---

## 12. Индексация и поиск

### 12.1 Что индексируем

В `ste.search_text` объединяются:

1. `name`
2. `category`
3. ключи и значения из `attributes_jsonb`
4. канонический `manufacturer_name`
5. частотные формулировки из `procurement_title` по этому `ste_id` при необходимости

### 12.2 Индексы

1. `GIN(search_vector)` для полнотекстового поиска.
2. `GIN(name gin_trgm_ops)` для опечаток и prefix-match.
3. `HNSW/IVFFLAT` по `embedding` для семантического поиска.
4. `BTREE(category)`.
5. `BTREE(id_supplier)`.
6. `GIN(attributes_jsonb)` для фильтрации по атрибутам.

### 12.3 Алгоритм поиска

#### Шаг 1. Нормализация

1. Привести текст к нижнему регистру.
2. Заменить `ё` на `е`.
3. Схлопнуть повторяющиеся пробелы.
4. Выделить числовые токены и единицы измерения.
5. Применить словарь сокращений.

#### Шаг 2. Подсказки и исправления

1. Проверить историю запросов пользователя.
2. Проверить словарь синонимов и аббревиатур.
3. Для неизвестных токенов подобрать исправления через `pg_trgm`.
4. Не исправлять числа, артикулы и короткие технические обозначения без подтверждения.

#### Шаг 3. Лексический recall

1. Найти top-K кандидатов через `search_vector`.
2. Добавить кандидатов по trigram similarity.
3. Добавить кандидатов по точному совпадению атрибутов.

#### Шаг 4. Семантический rerank

1. Построить embedding запроса.
2. Пересчитать близость к embedding кандидатов.
3. Переранжировать top-N.

#### Шаг 5. Персонализация

1. Подмешать историю закупок пользователя.
2. Если пользователь новый или у него мало истории, подмешать cold-start prior по похожим организациям.
3. Подмешать affinity по категориям, атрибутам, производителям и поставщикам.
4. Подмешать поведенческие сигналы из текущей и прошлых сессий.
5. Ограничить вклад персонализации, чтобы не ломать релевантность.

#### Шаг 6. Группировка по производителю

1. Сначала группировать по `manufacturer_name`, если `manufacturer_confidence >= 0.75`.
2. Если явного производителя нет, использовать `brand_from_name`.
3. Если и этого нет, использовать `supplier_fallback`, но явно помечать источник.
4. Если и это невозможно, собирать `family_cluster` по категории + нормализованным токенам имени.

---

## 13. Алгоритм группировки по производителю

Из-за неполноты данных предлагается не одна, а четырёхуровневая схема.

### 13.1 Формирование `manufacturer_name`

Приоритет:

1. Явные атрибуты:
   - `Производитель`
   - `Бренд`
   - `Торговая марка`
   - `Марка`
   - `Товарный знак производителя оргтехники`

2. Извлечение бренда из имени СТЕ:
   - по словарю брендов;
   - по частотным uppercase/latin токенам;
   - по устойчивым шаблонам в начале названия.

3. Fallback на `primary_supplier_id`.

4. Fallback на `family_cluster`.

### 13.2 Формирование `family_cluster`

`family_cluster_key` строится из:

1. нормализованной категории;
2. лемм основного имени;
3. исключения чисел, единиц измерения и вариативных атрибутов;
4. ключевых атрибутов, которые задают семейство, а не вариант.

Пример:

- `Резистор ABC 1 Ом`
- `Резистор ABC 2 Ом`
- `Резистор ABC 3 Ом`

Общий `family_cluster_key`:

- `резистор|abc|category:резисторы`

Варианты внутри группы:

- `1 Ом`
- `2 Ом`
- `3 Ом`

### 13.3 Почему так лучше

1. Не ломается поиск в категориях, где производителя нет явно.
2. Можно однозначно определить, за счёт какого источника сформирована группа:
   - по реальному бренду;
   - по бренду из названия;
   - по поставщику;
   - по товарному семейству.

---

## 14. Персонализация и "обучаемость" поиска

### 14.1 Принцип

Персонализация строится в двух контурах:

1. `offline-contract contour`:
   - опирается на историю контрактов;
   - проверяется на предоставленном датасете;
   - является основным формальным benchmark для защиты.

2. `online-behavior contour`:
   - опирается на реальные действия пользователя в поиске;
   - нужен для демонстрации "дообучения" между сессиями;
   - показывает комиссии, что два одинаковых запроса одного и того же пользователя могут давать разную выдачу после новых сигналов.

Дополнительно нужен `cold-start contour` для первого входа:

1. если у пользователя есть исторические контракты по `customer_inn`, используем их сразу;
2. если исторических контрактов нет или их мало, строим начальный профиль по похожим организациям;
3. похожесть определяется по названию организации, типу организации, региону и контрактному профилю ближайших соседей из датасета.

### 14.2 Cold-start по названию организации и похожим заказчикам

Алгоритм cold-start:

1. Нормализовать `customer_name`:
   - убрать юр. формы;
   - убрать стоп-слова;
   - привести к базовой форме;
   - сохранить ключевые токены.
2. Определить `org_type_primary` и `org_type_tags`:
   - школа;
   - детский сад;
   - поликлиника;
   - больница;
   - колледж;
   - университет;
   - библиотека;
   - жилищно-коммунальная организация;
   - и другие типы по словарю правил.
3. Построить `name_embedding` по нормализованному названию организации.
4. Найти ближайших заказчиков в `customer_similarity_edge` по формуле:

```text
org_similarity =
  0.40 * org_type_match +
  0.25 * region_match +
  0.20 * customer_name_embedding_similarity +
  0.15 * purchase_profile_similarity
```

5. Собрать top-K похожих заказчиков.
6. Агрегировать их закупки:
   - топ-категории;
   - топ-атрибуты;
   - топ-производителей;
   - топ-поставщиков;
   - частотные СТЕ.
7. Сформировать стартовый профиль пользователя в `customer_preference_profile` с `seed_source = similar_organizations`.

Принцип работы:

1. На первом входе пользователь ещё ничего не искал на платформе.
2. Но по названию организации можно понять её тип.
3. По типу и региону можно найти похожих заказчиков.
4. Их история закупок используется как prior для рекомендаций и ранжирования.

### 14.3 Контрактные позитивные сигналы

| Сигнал | Правило | Эффект |
|---|---|---|
| `purchase_same_ste` | Пользователь раньше закупал этот `ste_id` | Сильный boost |
| `purchase_same_category` | Повторяющиеся закупки в той же категории | Средний boost |
| `purchase_same_manufacturer` | История по тому же бренду/производителю | Средний boost |
| `purchase_same_supplier` | Повторные закупки у того же поставщика | Небольшой boost |
| `purchase_same_attributes` | Часто встречающиеся атрибуты в истории заказчика | Средний boost |
| `recent_purchase_match` | Сходство с недавними контрактами заказчика | Средний boost |
| `similar_org_category` | Похожим организациям часто нужна эта категория | Средний boost для cold-start |
| `similar_org_supplier` | Похожие организации часто закупают у этого поставщика | Небольшой boost |
| `similar_org_manufacturer` | Похожие организации часто выбирают этот бренд | Небольшой boost |

### 14.4 Контрактные негативные сигналы

| Сигнал | Правило | Эффект |
|---|---|---|
| `stale_purchase_pattern` | Очень старые закупки без повторов | Лёгкий penalty через decay |
| `supplier_drift` | Заказчик перестал закупать у этого поставщика | Лёгкий penalty |
| `category_drift` | Категория давно не закупалась | Лёгкий penalty |
| `weak_neighbor_signal` | Сигнал похожих организаций слишком слабый и размытый | Снижение веса cold-start prior |

### 14.5 Поведенческие сигналы для online-переобучения

| Сигнал | Правило | Эффект |
|---|---|---|
| `long_product_view` | Активный просмотр карточки > 45 сек | Небольшой boost группе/семейству |
| `deep_product_view` | Просмотр > 60 сек | Средний boost |
| `repeat_product_view` | Повторное открытие той же карточки или группы | Boost |
| `suggestion_selected` | Пользователь выбрал подсказку | Boost типу подсказки и близким запросам |
| `quick_bounce` | Открытие карточки и возврат < 8 сек | Заметный penalty |
| `short_view_then_reformulate` | Короткий просмотр и новый запрос | Лёгкий penalty группе |
| `results_no_click_reformulate` | Просмотр выдачи без кликов и смена запроса | Лёгкий penalty исходной ветке выдачи |

### 14.6 Мягкость корректировок

Персонализация должна быть аккуратной. Нельзя резко "ломать" выдачу.

Правило:

- вклад контрактной персонализации ограничивается диапазоном `[-0.20; +0.20]`;
- вклад cold-start контура по похожим организациям ограничивается диапазоном `[-0.10; +0.10]`;
- вклад поведенческого контура на одну сессию ограничивается диапазоном `[-0.12; +0.12]`;
- общий прирост/штраф за одну итерацию дообучения должен быть плавным и монотонным.

### 14.7 Формула ранжирования

Рабочая формула ранжирования:

```text
final_score =
  0.38 * lexical_score +
  0.15 * semantic_score +
  0.16 * purchase_affinity +
  0.08 * org_similarity_affinity +
  0.10 * behavior_affinity +
  0.05 * supplier_affinity +
  0.08 * category_attribute_affinity
```

Где:

- `lexical_score` — совпадение по тексту, морфологии, атрибутам;
- `semantic_score` — близость embedding;
- `purchase_affinity` — история контрактов пользователя;
- `org_similarity_affinity` — стартовый prior по похожим организациям;
- `behavior_affinity` — сигналы взаимодействия из текущей и прошлых сессий;
- `supplier_affinity` — склонность к определённым поставщикам;
- `category_attribute_affinity` — совпадение с предпочитаемыми категориями и атрибутами заказчика.

Правило использования:

1. В offline-проверке по контрактам `behavior_affinity = 0`.
2. В cold-start проверке `purchase_affinity` может быть равен `0`, а `org_similarity_affinity` становится основным персональным сигналом.
3. В live/demo-сценариях `behavior_affinity` включается сразу после поступления событий и пересчёта профиля.

### 14.8 Session-level дообучение

Чтобы две одинаковые сессии одного пользователя давали разную выдачу, нужен быстрый feedback loop:

1. Пользователь выполняет запрос `q`.
2. Открывает карточку/группу товара.
3. Система получает `search_submit`, `search_results_dwell`, `product_view_end` с `dwell_ms` и `active_time_ms` (при необходимости — расширенные события из §17.3, например `query_reformulation`).
4. NestJS кладёт задачу в BullMQ.
5. Worker обновляет:
   - `customer_preference_profile`;
   - краткоживущий `session_feedback_profile`.
6. При следующем таком же запросе:
   - повышаются группы, связанные с длинным просмотром;
   - понижаются позиции с быстрым возвратом.

### 14.9 Time decay

Старые покупки должны постепенно терять вес:

```text
time_weight = exp(-days_since_event / 365)
```

Для очень старых закупок можно использовать два режима:

1. мягкое затухание для повторяющихся категорий;
2. более сильное затухание для точных SKU/STE.

---

## 15. Метрики качества: offline по контрактам и online по поведению

Ниже два набора метрик:

1. оффлайн-метрики по контрактам для формальной проверки качества;
2. online/demo-метрики по поведению для доказательства адаптации между сессиями.

Эти метрики **не являются входом ML-сервиса в рантайме**: Python-сервис получает тексты для нормализации/эмбеддингов и списки кандидатов для rerank. Оффлайн- и online-показатели считаются в скриптах/аналитике по контрактам и по логам событий.

### 15.0 MVP и backlog (объём оценки)

Чтобы не распылять силы на хакатоне, разделяем **обязательный минимум** и **расширение**.

**Оффлайн (MVP для отчёта):** `HitRate@k`, `NDCG@k` или `MRR@k`, плюс по одному показателю из блоков 15.2 и 15.3 (например `Repeat STE HitRate@k` и `Cold-start NDCG@k`). Остальные пункты 15.1–15.3 и детальные срезы 15.6 — **backlog**.

**Online/demo (MVP):** опираются на время на странице выдачи и на странице товара (`dwell_ms`, `active_time_ms`, §17). Достаточно продемонстрировать сценарий 15.8 и сдвиг рангов при повторном запросе; остальные формулировки 15.4–15.5 — по возможности.

### 15.1 Offline ranking-метрики по контрактам

1. `HitRate@k` — попал ли реально закупленный `ste_id` в top-k.
2. `Recall@k` — какая доля целевых закупок попала в top-k.
3. `MRR@k` — насколько высоко находится первая релевантная позиция.
4. `NDCG@k` — качество ранжирования с учётом позиции релевантных результатов.
5. `MAP@k` — средняя точность по всем тестовым запросам.

### 15.2 Offline-метрики персонализации по контрактной истории

1. `Repeat STE HitRate@k` — способен ли поиск вернуть уже закупавшийся `ste_id`.
2. `Same Category HitRate@k` — попадает ли в top-k нужная категория.
3. `Same Manufacturer HitRate@k` — попадает ли производитель/бренд из истории заказчика.
4. `Same Supplier HitRate@k` — попадает ли поставщик, с которым заказчик реально работал.
5. `Attribute Match Rate@k` — совпадают ли ключевые атрибуты закупки с top-k результатами.

### 15.3 Offline-метрики cold-start по похожим организациям

1. `Org-Type HitRate@k` — возвращает ли поиск категории, типичные для организаций такого типа.
2. `Similar Organization HitRate@k` — попадают ли в top-k позиции, характерные для ближайших похожих заказчиков.
3. `Cold-start NDCG@k` — качество ранжирования, если для пользователя использовать только название организации, регион и соседей.
4. `Neighbor Purchase Recovery@k` — восстанавливаются ли реальные закупки пользователя через профиль похожих организаций.
5. `Cold-start Coverage` — для какой доли новых пользователей удаётся построить seed-профиль.

### 15.4 Online/demo-метрики поведенческой адаптации

1. `Repeat Query Rank Shift` — насколько меняется позиция группы после новых поведенческих сигналов при том же запросе.
2. `Positive Signal Promotion Rate` — доля случаев, когда товары с длинным просмотром поднимаются выше в следующей сессии.
3. `Negative Signal Demotion Rate` — доля случаев, когда товары с быстрым возвратом опускаются ниже.
4. `Session Adaptation Latency` — время от прихода события до изменения выдачи.

### 15.5 Метрики полноты и устойчивости

1. `Catalog Coverage@k` — насколько широкий слой каталога реально участвует в выдаче.
2. `Customer Coverage` — для какой доли заказчиков персонализация вообще срабатывает.
3. `Cold-start Success Rate` — качество на заказчиках с короткой историей закупок.
4. `Long-tail Category Recall@k` — качество в редких категориях.

### 15.6 Протокол оффлайн-проверки

1. Делить данные по времени: ранние контракты в train, более поздние в validation/test.
2. Для каждого `customer_inn` скрывать последние 1..N закупок и пытаться восстановить их поиском.
3. Использовать `procurement_title` и нормализованный `ste.name` как тестовые запросы.
4. Отдельно считать метрики для:
   - frequent customers;
   - cold-start customers;
   - частых категорий;
   - редких категорий.

### 15.7 Протокол offline-проверки cold-start по организации

1. Для тестового заказчика скрыть его собственную контрактную историю.
2. Оставить только:
   - `customer_name`;
   - `customer_region`;
   - словарь типов организаций;
   - историю похожих заказчиков.
3. Построить `org_similarity_affinity` через похожие организации.
4. Выполнить поиск по тестовым запросам.
5. Сравнить:
   - baseline без cold-start;
   - cold-start по похожим организациям;
   - cold-start + semantic rerank.

### 15.8 Протокол demo-проверки поведения

1. Создать тестового пользователя с историей контрактов.
2. Выполнить запрос `Q1` и сохранить baseline-выдачу.
3. В первой сессии:
   - долго изучить одну группу товаров;
   - быстро выйти из другой группы;
   - переформулировать запрос.
4. Дождаться пересчёта профиля через BullMQ.
5. Во второй сессии повторить тот же запрос `Q1`.
6. Зафиксировать:
   - какие группы поднялись;
   - какие группы опустились.

### 15.9 Что показывать на защите

Минимум (согласовано с §15.0): пункты 1–4 и 6–7 ниже. Полная таблица из п.4 может содержать только метрики MVP; остальные столбцы — по мере готовности.

1. Сравнение `baseline lexical` против `lexical + personalization`.
2. Сравнение `baseline lexical` против `lexical + cold-start by similar organizations`.
3. Сравнение `lexical + personalization` против `lexical + personalization + semantic rerank`.
4. Таблицу `HitRate@5`, `MRR@10`, `NDCG@10`, `Same Category HitRate@10`, `Cold-start NDCG@10`.
5. Кейс первого входа, где организация без истории на платформе получает рекомендации по похожим заказчикам.
6. Кейс `Session A vs Session B` для одного пользователя и одного запроса.
7. Изменение позиций после длинного просмотра и после быстрого возврата (в т.ч. по `active_time_ms` на выдаче и на карточке товара).

---

## 16. Формат запросов между фронтом и беком

> **Аутентификация:** все защищённые endpoints (кроме `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`) требуют заголовок:
> ```
> Authorization: Bearer <accessToken>
> ```
> `accessToken` получается при входе/регистрации и обновляется через `POST /auth/refresh`. Срок жизни — 15 минут.

> **Примечание:** Backend не использует глобальный `/api` префикс — маршруты начинаются сразу с ресурса (например `POST /auth/login`). Фронтенд должен настроить `baseUrl` в HTTP-клиенте.

### 16.1 Регистрация

`POST /auth/register`

```json
{
  "inn": "7701234567",
  "password": "StrongPassword123!",
  "location": "lol",
  "organization_name":"lol",
}
```

Ответ `201 Created` + `Set-Cookie: refreshToken=<jwt>; HttpOnly; SameSite=Strict`:

```json
{
  "accessToken": "eyJhbGci...",
  "customerId": "7f76d7db-4e58-44a6-b780-8f2d827c8f3b",
  "login": "7701234567"
}
```

### 16.2 Вход

`POST /auth/login`

```json
{
  "inn": "7701234567",
  "password": "StrongPassword123!"
}
```

Ответ `200 OK` + `Set-Cookie: refreshToken=<jwt>; HttpOnly; SameSite=Strict`:

```json
{
  "accessToken": "eyJhbGci...",
  "customerId": "7f76d7db-4e58-44a6-b780-8f2d827c8f3b",
  "login": "7701234567"
}
```

### 16.2а Обновление токена

`POST /auth/refresh` — принимает `refreshToken` из cookie, возвращает новую пару.

Ответ `200 OK`:

```json
{
  "accessToken": "eyJhbGci..."
}
```

### 16.2б Выход

`POST /auth/logout` — удаляет refresh token из БД и очищает cookie.

Ответ `204 No Content`.

### 16.3 Подсказки при вводе

`POST /search/suggest` — требует `Authorization: Bearer <accessToken>`

```json
{
  "query": "резистар 3 ом",
  "limit": 10
}
```

Ответ:

```json
{
  "normalized_query": "резистор 3 ом",
  "items": [
    {
      "text": "резистор 3 ом",
      "kind": "spellfix"
    },
    {
      "text": "резистор 3 ом smd",
      "kind": "history"
    },
    {
      "text": "сопротивление 3 ом",
      "kind": "synonym"
    }
  ]
}
```

### 16.4 Поиск

`GET /products/search?q=...&userId=...&page=...&limit=...&region=...`

*(Реализован. GET вместо POST — проще кэшировать на уровне CDN/nginx. Единственный фильтр — `region` (регион заказчика).)*

Альтернативный POST-вариант (планируется):

```json
{
  "query": "резистар 3 ом",
  "page": 1,
  "page_size": 20,
  "sort": "personalized",
  "filters": {
    "region": ["Москва"]
  }
}
```

Ответ:

```json
{
  "query_id": "29fef2dc-a328-4d1a-83fe-8bdde7ebd345",
  "original_query": "резистар 3 ом",
  "normalized_query": "резистар 3 ом",
  "corrected_query": "резистор 3 ом",
  "corrections": [
    {
      "text": "резистор 3 ом"
    }
  ],
  "recommendations": [
    {
      "text": "резистор 3 ом smd",
      "kind": "history"
    },
    {
      "text": "сопротивление 3 ом",
      "kind": "synonym"
    }
  ],
  "groups": [
    {
      "group_key": "brand:abc|family:resistor",
      "group_title": "ABC",
      "group_type": "manufacturer_attr",
      "collapsed_variants_count": 3,
      "items": [
        {
          "ste_id": "1234567",
          "name": "Резистор ABC 1 Ом",
          "category": "Резисторы",
          "supplier_id": "7701234567",
          "attributes": {
            "Сопротивление": "1 Ом"
          }
        },
        {
          "ste_id": "1234568",
          "name": "Резистор ABC 2 Ом",
          "category": "Резисторы",
          "supplier_id": "7701234567",
          "attributes": {
            "Сопротивление": "2 Ом"
          }
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_groups": 137
  }
}
```

### 16.5 Приём событий с фронта

`POST /events/bulk` *(реализован)* — требует `Authorization: Bearer <accessToken>`

```json
{
  "events": [
    {
      "event_id": "44efc5fa-7e54-4f70-a5fe-f9f7825298e7",
      "event_type": "search_submit",
      "search_query_id": "29fef2dc-a328-4d1a-83fe-8bdde7ebd345",
      "event_at": "2026-04-04T14:10:00Z"
    },
    {
      "event_id": "a9012c3d-1111-4a2b-9c0d-ef1234567890",
      "event_type": "search_results_dwell",
      "search_query_id": "29fef2dc-a328-4d1a-83fe-8bdde7ebd345",
      "event_at": "2026-04-04T14:10:45Z",
      "dwell_ms": 45000,
      "active_time_ms": 32000,
      "payload": {
        "leave_reason": "open_product"
      }
    },
    {
      "event_id": "1d6656a9-8b39-4fc8-9f9d-b1f5f3076862",
      "event_type": "product_view_end",
      "search_query_id": "29fef2dc-a328-4d1a-83fe-8bdde7ebd345",
      "ste_id": "1234567",
      "event_at": "2026-04-04T14:11:08Z",
      "dwell_ms": 58000,
      "active_time_ms": 51000,
      "payload": {
        "result_rank": 2
      }
    }
  ]
}
```

Подробное описание всех полей, типов событий и правил подсчёта времени — в **§17**.

Ответ:

```json
{
  "accepted": 3,
  "queued_profile_recalc": true
}
```

### 16.6 Рекомендации при первом входе

`POST /recommendations/bootstrap` *(планируется — ProfileModule)* — требует `Authorization: Bearer <accessToken>`

```json
{
  "limit": 10
}
```

Ответ:

```json
{
  "seed_source": "similar_organizations",
  "org_type_primary": "clinic",
  "groups": [
    {
      "group_key": "brand:med|family:consumables",
      "group_title": "Расходные материалы для поликлиник",
      "items": [
        {
          "ste_id": "1234567",
          "name": "Перчатки медицинские",
          "category": "Расходные материалы медицинские"
        }
      ]
    }
  ]
}
```

---

## 17. Как отправлять события с фронта

Все события уходят одним пакетом в `POST /events/bulk` с заголовком `Authorization: Bearer <accessToken>`. Никаких heartbeat-запросов каждые N секунд — таймеры копятся на клиенте, в сеть уходит итог при уходе с экрана.

### 17.1 Структура запроса

```
POST /events/bulk
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "events": [
    {
      "event_id": "44efc5fa-7e54-4f70-a5fe-f9f7825298e7",
      "event_type": "search_submit",
      "search_query_id": "29fef2dc-a328-4d1a-83fe-8bdde7ebd345",
      "event_at": "2026-04-04T14:10:00Z"
    },
    {
      "event_id": "a9012c3d-1111-4a2b-9c0d-ef1234567890",
      "event_type": "search_results_dwell",
      "search_query_id": "29fef2dc-a328-4d1a-83fe-8bdde7ebd345",
      "event_at": "2026-04-04T14:10:45Z",
      "dwell_ms": 45000,
      "active_time_ms": 32000,
      "payload": {
        "leave_reason": "open_product"
      }
    },
    {
      "event_id": "1d6656a9-8b39-4fc8-9f9d-b1f5f3076862",
      "event_type": "product_view_end",
      "search_query_id": "29fef2dc-a328-4d1a-83fe-8bdde7ebd345",
      "ste_id": "1234567",
      "event_at": "2026-04-04T14:11:08Z",
      "dwell_ms": 58000,
      "active_time_ms": 51000,
      "payload": {
        "result_rank": 2
      }
    }
  ]
}
```

Ответ:

```json
{
  "accepted": 3,
  "queued_profile_recalc": true
}
```

### 17.2 Описание полей каждого события

#### Общие поля (присутствуют в каждом событии)

| Поле | Тип | Обязателен | Описание |
|------|-----|-----------|----------|
| `event_id` | `uuid` | ✅ | Уникальный идентификатор события, генерируется на **клиенте** (`crypto.randomUUID()`). Используется как idempotency-ключ — дублирующий `event_id` будет молча отброшен, поэтому можно безопасно повторять запрос при сетевой ошибке. |
| `event_type` | `string` | ✅ | Тип события — одно из значений, перечисленных в §17.3. Определяет, какой набор дополнительных полей обязателен. |
| `event_at` | `ISO 8601` | ✅ | Время **на клиенте**, когда событие фактически произошло. Не время отправки пакета — время действия. Например, для `product_view_end` это момент ухода со страницы товара. Используется для упорядочивания событий на сервере и построения временны́х сигналов персонализации. |
| `search_query_id` | `uuid \| null` | ⬜ | ID поискового запроса, возвращённый в поле `query_id` ответа `GET /products/search`. Связывает событие с конкретным поиском, чтобы знать, после какого запроса пользователь открыл карточку или провёл на выдаче время. Для событий вне контекста поиска (например, прямой переход по закладке) — `null`. |
| `ste_id` | `string \| null` | ⬜ | Идентификатор СТЕ из каталога. Обязателен для событий, связанных с конкретной карточкой товара: `product_view_end`, `product_card_click`. Для событий уровня поиска — `null`. |
| `payload` | `object \| null` | ⬜ | Произвольный объект с контекстными данными, специфичными для типа события. Поля внутри описаны в §17.3 для каждого типа. |

#### Поля времени (для событий с `dwell_ms`)

| Поле | Тип | Обязателен | Описание |
|------|-----|-----------|----------|
| `dwell_ms` | `integer` | ✅ для dwell-событий | Полное **календарное** время пребывания на экране в миллисекундах — от первого рендера до ухода (навигация, закрытие вкладки, `beforeunload`). Включает время, когда вкладка была в фоне. |
| `active_time_ms` | `integer` | ✅ для dwell-событий | Время **активного внимания** пользователя в миллисекундах. Отсчитывается только когда: (1) вкладка видима (`document.visibilityState === 'visible'`), (2) пользователь проявлял активность — скролл, движение мыши, клик, нажатие клавиши — за последние 30 секунд. Паузы без активности свыше 30 секунд не добавляются. Используется бэком как главный сигнал интереса: `active_time_ms > 25 000` считается глубоким просмотром, `< 8 000` — быстрым отказом (quick bounce). |

### 17.3 Типы событий и их поля

#### `search_submit`
Отправляется сразу после получения ответа от `GET /products/search`. Связывает пользователя с конкретным поисковым запросом.

| Поле | Обязателен | Значение |
|------|-----------|---------|
| `search_query_id` | ✅ | `query_id` из ответа поиска |
| `event_at` | ✅ | Момент отправки запроса |

---

#### `search_results_dwell`
Одно событие **при уходе** с экрана результатов поиска (переход на карточку, новый запрос, уход с маршрута). Не отправляется при каждом скролле.

| Поле | Обязателен | Значение |
|------|-----------|---------|
| `search_query_id` | ✅ | ID запроса, выдачу которого просматривал |
| `dwell_ms` | ✅ | Полное время на экране выдачи |
| `active_time_ms` | ✅ | Активное время (см. §17.2) |
| `payload.leave_reason` | ⬜ | `"open_product"` / `"new_search"` / `"navigate_away"` |

---

#### `product_view_end`
Одно событие **при уходе** со страницы карточки товара.

| Поле | Обязателен | Значение |
|------|-----------|---------|
| `search_query_id` | ✅ | ID поиска, из которого открыли карточку |
| `ste_id` | ✅ | ID просмотренного СТЕ |
| `dwell_ms` | ✅ | Полное время на карточке |
| `active_time_ms` | ✅ | Активное время (см. §17.2) |
| `payload.result_rank` | ⬜ | Позиция в выдаче, с которой открыли карточку (0-based) |

---

#### `product_card_click` *(опционально)*
Момент клика по карточке в результатах поиска, до перехода на страницу товара.

| Поле | Обязателен | Значение |
|------|-----------|---------|
| `search_query_id` | ✅ | ID поиска |
| `ste_id` | ✅ | ID карточки |
| `payload.result_rank` | ⬜ | Позиция в выдаче |

### 17.4 Что означает `queued_profile_recalc` в ответе

```json
{
  "accepted": 3,
  "queued_profile_recalc": true
}
```

| Поле | Описание |
|------|---------|
| `accepted` | Сколько событий из пакета принято и сохранено. Если `event_id` уже встречался — такое событие пропускается (idempotency), в счётчик не входит. |
| `queued_profile_recalc` | `true` означает, что среди принятых событий оказались «тяжёлые» сигналы (крупные значения `active_time_ms`, тип `product_view_end` и т.п.), которые дают основание пересчитать персональный профиль заказчика (`customer_preference_profile`). Бэк поставил задачу в очередь BullMQ — worker пересчитает веса в фоне и обновит профиль, следующий поисковый запрос вернёт изменённую выдачу. Если `false` — событий недостаточно для перерасчёта, профиль не трогается. Фронту это поле нужно знать, чтобы при необходимости показать пользователю индикатор «выдача обновляется». |

### 17.5 Когда отправлять пакет

Не нужно ждать накопления N событий. Рекомендуемые триггеры отправки:

1. **При уходе с экрана выдачи** — `search_results_dwell` + `search_submit` (если ещё не ушёл) в одном пакете.
2. **При уходе с карточки товара** — `product_view_end` в одном пакете.
3. **По `beforeunload`** / `visibilitychange` → `hidden` — все накопленные, ещё не отправленные события. Использовать `navigator.sendBeacon()` или `fetch({ keepalive: true })`.

Максимальный размер пакета: **50 событий**. Если накопилось больше — разбивать и отправлять последовательно.

### 17.6 Сценарий для демонстрации комиссии

1. **Сессия 1:**
   - пользователь вводит запрос `Q` → событие `search_submit`;
   - просматривает выдачу ~50 с → событие `search_results_dwell` (`active_time_ms ≈ 45 000`);
   - открывает карточку группы A, изучает 70 с → `product_view_end` (`active_time_ms ≈ 65 000`);
   - возвращается, открывает карточку группы B, быстро закрывает → `product_view_end` (`active_time_ms ≈ 5 000`).

2. **Между сессиями:**
   - BullMQ worker агрегирует события по `customer_id`;
   - поднимает вес группы A в `customer_preference_profile`;
   - опускает вес группы B (quick bounce — отрицательный сигнал).

3. **Сессия 2:**
   - тот же пользователь вводит тот же запрос `Q`;
   - группа A занимает более высокую позицию в выдаче;
   - группа B опускается ниже.

Для сценария важны различия в `active_time_ms` между карточками/сессиями — именно этот сигнал двигает ранжирование.

---

## 18. Рекомендуемая реализация ML-части

### 18.1 Реалистичный вариант для хакатона

Первую рабочую версию лучше строить как гибрид:

1. Lexical + trigram + synonyms в Postgres.
2. Embedding rerank для top-N.
3. Heuristic personalization по истории и событиям.

Это даст хороший баланс качества и сложности.

### 18.2 Роль PyTorch

PyTorch можно использовать для:

1. расчёта эмбеддингов запросов и СТЕ;
2. обучения лёгкого reranker во второй итерации;
3. обновления персональных представлений пользователя.

### 18.3 Какие модели подойдут

Базовый вариант:

1. `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
2. либо `intfloat/multilingual-e5-small`

Обе модели можно запускать локально и использовать для русского текста.

### 18.4 Что не стоит делать в первой версии

1. Тяжёлый cross-encoder на весь каталог.
2. Сложный end-to-end LTR без качественной разметки.
3. Развёртывание отдельного тяжёлого поискового движка без необходимости.

---

## 19. Frontend-архитектура Angular

### 19.1 Основные экраны

1. Регистрация.
2. Вход.
3. Поисковая страница.

### 19.2 Основные feature-store модули NgRx

1. `auth`
2. `search`
3. `suggestions`
4. `history`
5. `telemetryQueue`
6. `session`

### 19.3 Что должно быть на поисковой странице

1. Строка поиска.
2. Dropdown подсказок.
3. История запросов.
4. Подсказка с исправлением опечатки.
5. Блок стартовых рекомендаций при первом входе.
6. Группированная выдача по производителю/семейству.
7. Фильтры по категории, региону поставщика, атрибутам.

---

## 20. Безопасность

1. Хранить только `password_hash`, а не пароль.
2. Использовать `Argon2id` как приоритетный алгоритм.
3. Использовать idempotency через `event_id` для событий.
4. Ограничивать rate limit на auth и search endpoints.
5. Логировать подозрительные аномалии по входам и событиям.

---

## 21. Производительность и масштабирование

### 21.1 Что даст быстрый старт

1. Один контейнер Postgres с расширениями.
2. Один контейнер NestJS API.
3. Один контейнер Python ML/ETL.
4. Один контейнер Redis.
5. Один контейнер worker.

### 21.2 Что можно масштабировать позже

1. Вынести worker отдельно.
2. Вынести ML-service отдельно.
3. Перейти на партиционирование `user_action` по месяцам.
4. Добавить read-replica для поисковой нагрузки.

### 21.3 Где основная нагрузка

1. `user_action`
2. `search_query`
3. полнотекстовые поисковые запросы
4. пересчёт профилей

---

## 22. Упрощённый план реализации

### Этап 1. Данные и БД  `[Backend + ML]`

1. ✅ Логическая модель данных утверждена (§7).
2. ✅ Docker-compose с Postgres 16, Elasticsearch 8.x, Redis 7 готов.
3. 🔲 Добавить в образ Postgres расширения `pgvector`, `unaccent`, `pgcrypto`.
4. 🔲 **ML:** ETL-скрипт: CSV → staging → `customer_data`, `supplier`, `ste`, `sale`, `ste_supplier_stat`.
5. 🔲 **ML:** Нормализация `customer_name`, извлечение `org_type_primary`, `org_type_tags`.
6. 🔲 **ML:** Построить `customer_similarity_edge` и seed-профили.
7. 🔲 **ML:** `etl_quality_log` — аномалии, будущие даты, дубликаты.
8. ✅ Redis запущен, BullMQ настроен.

### Этап 2. Backend и Frontend-скелет  `[Backend + Frontend]`

1. ✅ **Backend:** `POST /auth/login` (JWT mock). Дополнить: `POST /auth/register` с `customer_inn` + пароль.
2. ✅ **Backend:** Базовые DTO, guards, модули, глобальный exception filter (RFC 7807).
3. ✅ **Backend:** `POST /events/bulk` с dwell-based weight upgrade.
4. 🔲 **Frontend:** Экраны — регистрация, вход, поиск.
5. 🔲 **Frontend:** State management (NgRx / Zustand) для auth / session / search / telemetryQueue.

### Этап 3. Поисковый MVP  `[Backend + Frontend]`

1. ✅ **Backend:** `GET /products/search` — ES multi-match + russian analyzer + fuzziness.
2. ✅ **Backend:** `POST /search/suggest` — ES prefix + spellfix + synonyms expansion.
3. ✅ **Backend:** `POST/GET/DELETE /synonyms` — CRUD синонимов.
4. 🔲 **Backend:** Группировка результатов по `manufacturer_name` / `family_cluster` (§13).
5. 🔲 **Backend:** Endpoint `POST /recommendations/bootstrap` — cold-start рекомендации для первого входа.
6. 🔲 **Frontend:** Поисковая строка с dropdown подсказок, отрисовка выдачи, блок стартовых рекомендаций.

### Этап 4. Персонализация по контрактам  `[Backend + ML]`

1. 🔲 **Backend:** Entity `customer_preference_profile`.
2. 🔲 **Backend:** Формула ранжирования §14.7 — `purchase_affinity`, `category_affinity`, `org_similarity_affinity`.
3. ✅ **Backend:** `user_product_score` агрегируется BullMQ-воркером с 90-day rolling window.
4. 🔲 **ML:** Оффлайн-скрипт: `HitRate@5`, `NDCG@10`, `MRR@10` на датасете контрактов.
5. 🔲 **ML:** Оффлайн-скрипт: cold-start `NDCG@10` по похожим организациям.

### Этап 5. Поведенческий feedback loop  `[Backend + Frontend]`

1. ✅ **Backend:** `POST /events/bulk` принимает `search_results_dwell`, `product_view_end` с `dwell_ms` / `active_time_ms`.
2. ✅ **Backend:** BullMQ job для пересчёта `user_product_score` после каждого события.
3. 🔲 **Backend:** `behavior_affinity` в формулу ранжирования §14.7.
4. 🔲 **Frontend:** Tracking `dwell_ms` + `active_time_ms` (Page Visibility API), отправка при уходе.
5. 🔲 **Демо:** Сценарий `Session A vs Session B` — одинаковый запрос, разная выдача.

### Этап 6. Семантика и защита  `[ML + Backend]`

1. 🔲 **ML:** Построить embeddings СТЕ (`multilingual-e5-small` или `paraphrase-multilingual-MiniLM-L12-v2`, 384d).
2. 🔲 **ML:** FastAPI endpoint `POST /embed` — эмбеддинг запроса.
3. 🔲 **Backend:** Semantic rerank top-N через `pgvector` cosine similarity.
4. 🔲 **ML:** Сравнение: lexical baseline vs lexical+personalization vs +semantic.
5. 🔲 **Demo:** 3-5 сценариев для защиты (§15.9).

---

## 23. Основные проектные решения

1. `contract_id` не использовать как PK в `sale`.
2. `ste.id_supplier` хранить как вычисленный `primary_supplier_id`, а реальную кратность уносить в `ste_supplier_stat`.
3. Для `ste_id` без каталога создавать stub-СTЕ.
4. Группировку по производителю делать по уровням уверенности.
5. Первую версию умного поиска строить как гибрид правил, FTS и лёгкой семантики.
6. Все рекомендации и исправления отдавать с флагами, чтобы фронт мог показывать разные типы подсказок в одном dropdown.
7. Для первого входа использовать cold-start по похожим организациям на основе `customer_name`, `customer_region` и ближайших заказчиков из датасета.
8. Телеметрия с фронта в MVP — пакетно, с обязательным учётом времени на экране выдачи и на карточке товара (`dwell_ms`, `active_time_ms`); без периодических heartbeat-запросов.

---

## 24. Открытые вопросы — статус

1. ~~Какой ORM фиксируем в NestJS: `Prisma` или `TypeORM`?~~ → **Закрыт: TypeORM.** Уже используется, entity синхронизируются через `synchronize: true` в dev.
2. Допустимо ли группировать по `supplier_fallback` / `family_cluster`, если производитель не найден? → **Да**, согласно §13 — четырёхуровневая схема обязательна. Backend группирует последовательно по `manufacturer_confidence`.
3. Нужна ли отдельная админ-панель? → **Нет (MVP).** Swagger UI (`/api`) + `GET /indexing/reindex` + `GET /health` достаточно для хакатона. AdminModule — в backlog.

---

## 25. Распределение обязанностей по командам

### 25.1 Backend (`backend/`) — NestJS

| Задача | Приоритет | Этап |
|---|---|---|
| `POST /auth/register` (customer_inn + пароль, Argon2id) | 🔴 Высокий | 2 |
| `customer_preference_profile` entity + BullMQ worker | 🔴 Высокий | 4 |
| Группировка выдачи по manufacturer / family_cluster | 🔴 Высокий | 3 |
| `POST /recommendations/bootstrap` (cold-start) | 🟡 Средний | 3 |
| `behavior_affinity` в формулу ранжирования §14.7 | 🟡 Средний | 5 |
| Semantic rerank через ML-сервис + pgvector | 🟡 Средний | 6 |
| `search_session` + `search_query` tracking | 🟡 Средний | 3 |
| Rate limiting на `/auth` и `/products/search` | 🟢 Низкий | MVP |
| Refresh token | 🟢 Низкий | после MVP |

**Уже реализовано:** Auth (mock JWT), ES search + suggest, bulk events + dwell weights, BullMQ score updates, indexing, health, synonyms CRUD, seeds 500 products.

### 25.2 ML (`ml/`) — Python + FastAPI

| Задача | Приоритет | Этап |
|---|---|---|
| ETL: `СТЕ_20260403.csv` → `ste` таблица в Postgres | 🔴 Высокий | 1 |
| ETL: `Контракты_20260403.csv` → `customer_data`, `supplier`, `sale` | 🔴 Высокий | 1 |
| Дедупликация, нормализация имён, `etl_quality_log` | 🔴 Высокий | 1 |
| Построение `ste_supplier_stat`, вычисление `id_supplier` | 🔴 Высокий | 1 |
| `customer_similarity_edge` — похожие организации | 🔴 Высокий | 1 |
| Bulk-индексация СТЕ в Elasticsearch (`POST /indexing/reindex`) | 🔴 Высокий | 1 |
| FastAPI `POST /embed` — эмбеддинг текста (384d) | 🟡 Средний | 6 |
| Генерация `ste.embedding` для всего каталога | 🟡 Средний | 6 |
| Оффлайн-метрики: `HitRate@5`, `NDCG@10`, `MRR@10` | 🟡 Средний | 4 |
| Cold-start скрипт: `org_type_primary`, seed-профили | 🟡 Средний | 4 |
| Лёгкий reranker (опционально, второй итерации) | 🟢 Низкий | 6 |

**Точки интеграции с backend:**
- ML пишет `ste.embedding` в Postgres → backend читает для rerank
- ML пишет `customer_similarity_edge` → backend читает в ProfileModule
- ML предоставляет `POST /embed` endpoint → backend вызывает при поиске

### 25.3 Frontend (`frontend/`) — React/Next.js или Angular

| Задача | Приоритет | Этап |
|---|---|---|
| Экраны: Регистрация, Вход | 🔴 Высокий | 2 |
| Поисковая строка + autocomplete dropdown | 🔴 Высокий | 3 |
| Отрисовка результатов (группы по производителю) | 🔴 Высокий | 3 |
| Telemetry: `dwell_ms` + `active_time_ms` (Page Visibility API) | 🔴 Высокий | 5 |
| `POST /events/bulk` — отправка при уходе с экрана | 🔴 Высокий | 5 |
| Блок стартовых рекомендаций (cold-start, первый вход) | 🟡 Средний | 3 |
| Отображение `corrected_query` / `suggestion` | 🟡 Средний | 3 |
| Фильтры по категории, региону поставщика | 🟡 Средний | 3 |
| LocalStorage очередь событий (offline buffer) | 🟢 Низкий | 5 |
| Объяснение ранжирования (почему этот товар выше) | 🟢 Низкий | 6 |

**Точки интеграции:**
- `baseUrl` = `http://localhost:3000` (или nginx proxy)
- Bearer JWT из `POST /auth/login` в заголовок каждого запроса
- `search_query_id` из ответа `/products/search` → прокидывать в `events/bulk`

---

## 27. Итог

Предложенная архитектура позволяет:

1. Выполнить требования ТЗ.
2. Использовать реальные особенности датасета, а не абстрактную схему.
3. Реализовать "обучаемый" поиск без обязательной тяжёлой ML-модели на первом этапе.
4. Обосновать перед заказчиком, почему система динамически меняет выдачу и как именно это измеряется (в т.ч. время на выдаче и на карточке товара без избыточного трафика событий).
