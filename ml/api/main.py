"""FastAPI: батч-эмбеддинг текста (384d, multilingual MiniLM) для §25.2."""
from __future__ import annotations

import os
from functools import lru_cache

from fastapi import FastAPI
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

MODEL_NAME = os.environ.get(
    "ST_MODEL_NAME",
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
)
MAX_TEXTS = int(os.environ.get("EMBED_MAX_BATCH", "128"))


class EmbedRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, max_length=MAX_TEXTS)


class EmbedResponse(BaseModel):
    dim: int
    vectors: list[list[float]]


@lru_cache(maxsize=1)
def _model() -> SentenceTransformer:
    return SentenceTransformer(MODEL_NAME)


app = FastAPI(title="ML embed", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest) -> EmbedResponse:
    m = _model()
    emb = m.encode(
        req.texts,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    dim = int(emb.shape[1])
    return EmbedResponse(dim=dim, vectors=emb.tolist())
