# Обмен индексом `ste_search` между ПК

В **git** не коммитятся ни распакованный репозиторий снимка, ни zip — только скрипты и compose.

## Автоимпорт при `docker compose up`

1. Положите архив в **`data/ste_search_es_snapshot.zip`** (в корне zip — каталог **`repo/`**, как создают `scripts/es-snapshot-export.*`).
2. Имя файла можно переопределить в **`.env`**: `ES_SNAPSHOT_ZIP=my_snapshot.zip`.
3. При старте стека:
   - **`elasticsearch-snapshot-unpack`** — если архив есть, распаковывает в `data/elasticsearch-snapshot-repo/`;
   - **`elasticsearch`** стартует с монтированием этого каталога;
   - **`elasticsearch-snapshot-restore`** — если **нет** файла `data/.ste_search_es_restore_done` и в `repo/` есть снимок, регистрирует репозиторий и восстанавливает **последний** снимок в индекс `ste_search`, затем создаёт маркер.

Повторный импорт того же архива не выполняется, пока существует **`data/.ste_search_es_restore_done`**.  
**Заменили архив в `data/`?** Удалите маркер (и при необходимости очистите том данных ES), затем снова `docker compose up`.

## Когда что делать

| Задача | Действие |
|--------|----------|
| Обычный запуск, индекс уже в томе ES на диске | `docker compose up -d` |
| Пересобрать индекс из Postgres | `docker compose … exec api python manage.py rebuild_ste_index` (образ с ML) |
| Проверка | `verify_ste_index` |
| **Снять снимок + zip в `data/`** | `scripts/es-snapshot-export.ps1` или `.sh` (ES из compose должен быть запущен) |
| Ручной импорт без zip | `scripts/es-snapshot-import.ps1` / `.sh` при уже распакованном `data/elasticsearch-snapshot-repo/repo` |

## Требования

- **Elasticsearch 8.12.2** (образ из `docker-compose.yml`).
- Файл **`docker/elasticsearch/elasticsearch.yml`** с `path.repo` монтируется в сервис `elasticsearch`.

## Экспорт для GitHub Release

1. `docker compose up -d elasticsearch` (или весь стек).
2. Должен существовать индекс `ste_search` (после `rebuild_ste_index`).
3. `powershell -File scripts/es-snapshot-export.ps1` или `bash scripts/es-snapshot-export.sh`.
4. Появится **`data/ste_search_es_snapshot.zip`** — его можно выложить в **Release** (не в историю коммитов).

## Импорт на другом ПК

1. Скопировать **`ste_search_es_snapshot.zip`** в **`data/`** репозитория (или скачать из Release).
2. `docker compose up -d` — распаковка и восстановление выполнятся сами (сервисы `elasticsearch-snapshot-unpack` и `elasticsearch-snapshot-restore`).

## GitHub Actions (по желанию)

Workflow может собирать образ с ML, выполнять `rebuild_ste_index`, затем те же вызовы, что export-скрипт, и прикреплять **`data/ste_search_es_snapshot.zip`** как artifact.
