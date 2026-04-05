FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_PROGRESS_BAR=on \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt requirements-ml.txt .
# По умолчанию без torch/transformers. ML: WITH_ML=1; CUDA поверх: ENABLE_CUDA_TORCH=1 (см. docker-compose.gpu.yml).
ARG WITH_ML=0
ARG ENABLE_CUDA_TORCH=0
RUN pip install --no-cache-dir -r requirements.txt \
    && echo ">>> [api] базовые зависимости установлены" \
    && if [ "$ENABLE_CUDA_TORCH" = "1" ] && [ "$WITH_ML" != "1" ]; then \
         echo ">>> ERROR: ENABLE_CUDA_TORCH=1 требует WITH_ML=1"; exit 1; \
       fi \
    && if [ "$WITH_ML" = "1" ]; then \
         echo ">>> [api] pip install ML (sentence-transformers, torch…) — может занять много времени"; \
         pip install --no-cache-dir -r requirements-ml.txt \
         && echo ">>> [api] ML-зависимости установлены"; \
         if [ "$ENABLE_CUDA_TORCH" = "1" ]; then \
           echo ">>> [api] замена torch на CUDA (cu124)…"; \
           pip uninstall -y torch torchvision torchaudio 2>/dev/null || true; \
           pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cu124; \
           echo ">>> [api] CUDA torch готов"; \
         fi; \
       else \
         echo ">>> [api] WITH_ML=0 — torch/transformers не ставились; семантика/rebuild_ste_index нужен образ с WITH_ML=1"; \
       fi

COPY beckend /app/beckend

WORKDIR /app/beckend

EXPOSE 8000

# Один worker: sentence-transformers грузит модель в память на процесс.
CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 1 --threads 4"]
