FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY docker/dataset-loader/load_datasets.py ./load_datasets.py
COPY beckend/accounts/sql/repair_customer_schema.sql ./repair_customer_schema.sql

CMD ["python", "-u", "load_datasets.py"]
