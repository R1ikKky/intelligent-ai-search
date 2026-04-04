FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY etl ./etl
ENV PYTHONUNBUFFERED=1
CMD ["python", "-m", "etl.run"]
