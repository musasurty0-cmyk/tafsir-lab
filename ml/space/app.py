"""
Tafsir Lab model service — a Hugging Face Space on the free CPU tier.

Two jobs, and deliberately only two:

    POST /embed      a question -> a 384-dim vector, to search with
    POST /translate  Arabic     -> English

Both are small enough to be fast on two shared vCPUs. What is NOT here is a
chat model: a 7B would not fit in this tier's memory and would take tens of
seconds per reply if it did. That absence is the design, not a gap — the
assistant answers by QUOTING retrieved passages, so the only generation
anywhere in the system is machine translation of text that already exists.
Nothing here can invent a tafsir.

Models are loaded lazily and cached. A free Space sleeps when idle, so the
first request after a nap pays the load cost; every one after it is warm.
"""

from __future__ import annotations

import os
import re
import threading

import gradio as gr

EMBED_MODEL = "intfloat/multilingual-e5-small"
# Helsinki's Arabic->English model. ~300 MB, CPU-friendly, and a real MT model
# rather than an LLM asked to translate — which matters, because an LLM will
# happily "improve" a passage while translating it and we need the translation
# to track the source.
TRANSLATE_MODEL = "Helsinki-NLP/opus-mt-ar-en"

# Shared, because Gradio serves requests on threads and loading the same model
# twice on a 16 GB box is how a free Space starts OOMing.
_lock = threading.Lock()
_embedder = None
_translator = None


def embedder():
    global _embedder
    with _lock:
        if _embedder is None:
            from sentence_transformers import SentenceTransformer
            _embedder = SentenceTransformer(EMBED_MODEL, device="cpu")
    return _embedder


def translator():
    global _translator
    with _lock:
        if _translator is None:
            from transformers import pipeline
            _translator = pipeline("translation", model=TRANSLATE_MODEL, device=-1)
    return _translator


def embed(text: str) -> dict:
    """
    Embed a question.

    The 'query: ' prefix is not optional. e5 was trained with asymmetric
    prefixes, and the corpus was embedded with 'passage: '; using the wrong one
    here does not error, it just quietly returns worse neighbours — the kind of
    bug that looks like "the search is a bit rubbish" for months.
    """
    text = (text or "").strip()
    if not text:
        return {"error": "empty text"}
    if len(text) > 2000:
        text = text[:2000]

    vec = embedder().encode("query: " + text, normalize_embeddings=True)
    return {"model": EMBED_MODEL, "dim": len(vec), "embedding": [float(x) for x in vec]}


# opus-mt is a sentence-level model. Handing it a 1,200-char passage silently
# truncates at the model's max length, losing the tail with no error at all —
# so split, translate, and rejoin.
_SENTENCE_SPLIT = re.compile(r"(?<=[.!؟۔?])\s+")


def translate(text: str) -> dict:
    text = (text or "").strip()
    if not text:
        return {"error": "empty text"}
    if len(text) > 6000:
        text = text[:6000]

    # Arabic script present at all? If not, there is nothing to do, and saying
    # so is better than returning a garbled "translation" of English input.
    if not re.search(r"[؀-ۿ]", text):
        return {"model": None, "translation": text, "note": "no Arabic detected; returned unchanged"}

    parts = [p.strip() for p in _SENTENCE_SPLIT.split(text) if p.strip()]
    # Group short sentences so the model is not called once per clause, but
    # never exceed its comfortable input length.
    batches: list[str] = []
    cur = ""
    for p in parts:
        if cur and len(cur) + len(p) + 1 > 400:
            batches.append(cur)
            cur = p
        else:
            cur = f"{cur} {p}".strip()
    if cur:
        batches.append(cur)

    out = translator()(batches, max_length=512)
    return {
        "model": TRANSLATE_MODEL,
        "translation": " ".join(o["translation_text"] for o in out).strip(),
        "segments": len(batches),
    }


def health() -> dict:
    return {
        "ok": True,
        "embed_model": EMBED_MODEL,
        "translate_model": TRANSLATE_MODEL,
        # Reported so the caller can tell a cold Space from a warm one rather
        # than guessing from latency.
        "embed_loaded": _embedder is not None,
        "translate_loaded": _translator is not None,
    }


with gr.Blocks(title="Tafsir Lab models") as demo:
    gr.Markdown(
        "## Tafsir Lab — model service\n"
        "Embeddings and Arabic→English translation. No chat model, on purpose: "
        "the assistant answers by quoting retrieved passages, so nothing here "
        "generates tafsīr."
    )

    with gr.Tab("Embed"):
        q = gr.Textbox(label="Question", lines=2)
        eo = gr.JSON(label="Vector")
        gr.Button("Embed").click(embed, q, eo, api_name="embed")

    with gr.Tab("Translate"):
        a = gr.Textbox(label="Arabic", lines=6)
        to = gr.JSON(label="English")
        gr.Button("Translate").click(translate, a, to, api_name="translate")

    with gr.Tab("Health"):
        ho = gr.JSON(label="Status")
        gr.Button("Check").click(health, None, ho, api_name="health")

if __name__ == "__main__":
    # A free Space provides the port; the default is for running it locally.
    demo.queue(max_size=32).launch(
        server_name="0.0.0.0",
        server_port=int(os.environ.get("PORT", 7860)),
    )
