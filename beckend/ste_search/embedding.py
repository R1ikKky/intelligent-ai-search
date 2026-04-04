"""Ленивая загрузка sentence-transformers (один экземпляр на процесс)."""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

_model = None


def get_embedding_model_name() -> str:
    return os.environ.get(
        "STE_EMBEDDING_MODEL",
        "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    )


def resolve_inference_device() -> str:
    """
    CUDA → MPS (Apple Silicon) → CPU.
    Переопределение: STE_EMBEDDING_DEVICE=auto|cuda|mps|cpu
    """
    import torch

    override = os.environ.get("STE_EMBEDDING_DEVICE", "auto").strip().lower()
    if override == "cuda":
        if torch.cuda.is_available():
            return "cuda"
        logger.warning("STE_EMBEDDING_DEVICE=cuda, но CUDA недоступна — используется CPU")
        return "cpu"
    if override == "mps":
        if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            return "mps"
        logger.warning("STE_EMBEDDING_DEVICE=mps, но MPS недоступен — используется CPU")
        return "cpu"
    if override == "cpu":
        return "cpu"
    if override != "auto":
        logger.warning("Неизвестный STE_EMBEDDING_DEVICE=%r, режим auto", override)

    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def get_embedder():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        name = get_embedding_model_name()
        device = resolve_inference_device()
        logger.info("Loading sentence-transformers model: %s (device=%s)", name, device)
        _model = SentenceTransformer(name, device=device)
    return _model


def encode_texts(texts: list[str], batch_size: int | None = None) -> list[list[float]]:
    if not texts:
        return []
    bs = batch_size or int(os.environ.get("STE_EMBEDDING_BATCH_SIZE", "32"))
    model = get_embedder()
    vectors = model.encode(
        texts,
        batch_size=bs,
        show_progress_bar=len(texts) > 500,
        normalize_embeddings=True,
    )
    return vectors.tolist()


def encode_query(text: str) -> list[float]:
    return encode_texts([text], batch_size=1)[0]
