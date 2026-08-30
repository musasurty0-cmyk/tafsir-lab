"""
Tafsir Lab model service — a Hugging Face Space on the free CPU tier.

Three jobs:

    POST /embed      a question -> a 384-dim vector, to search with
    POST /translate  Arabic     -> English
    POST /chat       passages + question -> a grounded answer

The chat model is a BASE instruct model, not a fine-tune, and that is the
important decision. Fine-tuning on tafsir would teach it to write LIKE
al-Tabari, which is how invented commentary ends up attributed to a named
scholar; it also cannot cite, because weights carry no provenance. Here the
model never answers from what it knows — it is handed passages retrieved from
the corpus and asked to read them. The facts come from the database; only the
prose comes from the model.

Qwen2.5-3B-Instruct at Q4_K_M is about 2 GB and runs on this tier's two shared
vCPUs at a few tokens a second. Slow, and honestly so; set TAFSIR_LLM_REPO to
the 1.5B build to trade quality for speed.

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

# A base instruct model, quantised. Overridable so the 1.5B can be swapped in
# on a slower box without editing code.
LLM_REPO = os.environ.get("TAFSIR_LLM_REPO", "Qwen/Qwen2.5-3B-Instruct-GGUF")
LLM_FILE = os.environ.get("TAFSIR_LLM_FILE", "qwen2.5-3b-instruct-q4_k_m.gguf")

# Shared, because Gradio serves requests on threads and loading the same model
# twice on a 16 GB box is how a free Space starts OOMing.
_lock = threading.Lock()
_embedder = None
_translator = None
_llm = None


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


def llm():
    """
    Load the GGUF model once.

    n_ctx is 4096 because the prompt carries several retrieved passages and a
    few turns of conversation; 2048 truncates the passages, which would mean
    the model answering from less than it was given without saying so.
    """
    global _llm
    with _lock:
        if _llm is None:
            from llama_cpp import Llama
            _llm = Llama.from_pretrained(
                repo_id=LLM_REPO,
                filename=LLM_FILE,
                n_ctx=4096,
                n_threads=int(os.environ.get("LLM_THREADS", "2")),
                verbose=False,
            )
    return _llm


def chat(messages_json: str) -> str:
    """
    Answer from the supplied passages.

    Takes the full message list as JSON so the instruction, the conversation so
    far and the passages arrive exactly as the app composed them — the prompt is
    written once, in the app, rather than half here and half there where the two
    halves could drift apart.
    """
    import json
    try:
        messages = json.loads(messages_json)
    except Exception:
        return "Could not read the request."

    if not isinstance(messages, list) or not messages:
        return "Could not read the request."

    out = llm().create_chat_completion(
        messages=messages,
        temperature=0.2,      # low: this is reading, not composing
        max_tokens=800,
    )
    return out["choices"][0]["message"]["content"].strip()


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
        "llm_model": LLM_REPO,
        "embed_loaded": _embedder is not None,
        "translate_loaded": _translator is not None,
        "llm_loaded": _llm is not None,
    }


with gr.Blocks(title="Tafsir Lab - model service") as demo:
    gr.Markdown(
        "## Tafsir Lab - model service\n"
        "Embeddings, Arabic to English translation, and a grounded chat model.\n\n"
        "The chat model is a **base instruct model, not a fine-tune**. It never "
        "answers from what it knows: it is handed passages retrieved from the "
        "tafsir corpus and asked to read them, and it must cite each claim."
    )

    with gr.Tab("Embed"):
        q = gr.Textbox(label="Question", lines=2)
        eo = gr.JSON(label="Vector")
        gr.Button("Embed").click(embed, q, eo, api_name="embed")

    with gr.Tab("Translate"):
        a = gr.Textbox(label="Arabic", lines=6)
        to = gr.JSON(label="English")
        gr.Button("Translate").click(translate, a, to, api_name="translate")

    with gr.Tab("Chat"):
        gr.Markdown(
            "Takes the full message list as JSON. The app composes the prompt; "
            "this only runs it."
        )
        m = gr.Textbox(label="messages (JSON)", lines=8)
        co = gr.Textbox(label="Answer", lines=10)
        gr.Button("Answer").click(chat, m, co, api_name="chat")

    with gr.Tab("Health"):
        ho = gr.JSON(label="Status")
        gr.Button("Check").click(health, None, ho, api_name="health")

if __name__ == "__main__":
    # A free Space provides the port; the default is for running it locally.
    demo.queue(max_size=32).launch(
        server_name="0.0.0.0",
        server_port=int(os.environ.get("PORT", 7860)),
    )
