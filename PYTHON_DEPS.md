# Зависимости Python (корень `intelligent-ai-search`)

| Файл | Назначение |
|------|------------|
| **[requirements.txt](requirements.txt)** | Django, ES, numpy — **без** torch / sentence-transformers (быстрый Docker-образ **api**) |
| **[requirements-ml.txt](requirements-ml.txt)** | только sentence-transformers; **torch** ставьте отдельно (CPU — см. ниже) |
| **[requirements-full.txt](requirements-full.txt)** | `requirements.txt` + `requirements-ml.txt` — **перед ним** нужен CPU torch (иначе на Linux скачается CUDA с PyPI) |

### Состав `requirements.txt`

| Пакет | Назначение |
|-------|------------|
| **psycopg[binary]** | PostgreSQL (Django, dataset-loader) |
| **Django** | API |
| **djangorestframework** | REST |
| **djangorestframework-simplejwt** | JWT |
| **drf-spectacular** | OpenAPI / Swagger |
| **django-cors-headers** | CORS |
| **django-elasticsearch-dsl** | Связка Django ↔ Elasticsearch (документы, индекс) |
| **elasticsearch** | Клиент ES 8 |
| **numpy** | Косинусы при группировке карточек |
| **gunicorn** | WSGI в Docker |
| **python-dotenv** | `.env` |

### Локально

```bash
cd intelligent-ai-search
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements-ml.txt
python beckend/manage.py runserver 0.0.0.0:8000
```

Либо одной строкой после `requirements.txt`:  
`pip install torch --index-url https://download.pytorch.org/whl/cpu && pip install -r requirements-ml.txt`

Только API без семантики: `pip install -r requirements.txt`.

После загрузки данных в Postgres: `python beckend/manage.py rebuild_ste_index` (нужны Elasticsearch и установленный **requirements-ml**).

### Docker

Образ **api** по умолчанию ставит только `requirements.txt`. ML: [`docker-compose.ml.yml`](docker-compose.ml.yml) (`WITH_ML=1`); GPU: [`docker-compose.gpu.yml`](docker-compose.gpu.yml) (`WITH_ML=1`, `ENABLE_CUDA_TORCH=1`).
