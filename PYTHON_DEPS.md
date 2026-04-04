# Зависимости Python (корень `intelligent-ai-search`)

Один файл **[requirements.txt](requirements.txt)** — см. таблицу ниже и комментарии в самом файле.

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
| **sentence-transformers** | Эмбеддинги для семантического поиска СТЕ |
| **numpy** | Косинусы при группировке карточек |
| **gunicorn** | WSGI в Docker |
| **python-dotenv** | `.env` |

```bash
cd intelligent-ai-search
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python beckend/manage.py runserver 0.0.0.0:8000
```

После загрузки данных в Postgres: `python beckend/manage.py rebuild_ste_index` (нужен доступный Elasticsearch).
