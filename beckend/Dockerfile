FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
# Сборка с GPU: docker compose build --build-arg ENABLE_CUDA_TORCH=1 api
# (нужны драйвер NVIDIA и nvidia-container-toolkit; см. README)
ARG ENABLE_CUDA_TORCH=0
RUN pip install --no-cache-dir -r requirements.txt \
    && if [ "$ENABLE_CUDA_TORCH" = "1" ]; then \
         pip uninstall -y torch torchvision torchaudio 2>/dev/null || true; \
         pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cu124; \
       fi

COPY beckend /app/beckend

WORKDIR /app/beckend

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

# Один worker: sentence-transformers грузит модель в память на процесс.
CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 1 --threads 4"]
