---
title: Tafsir Lab Models
emoji: 📖
colorFrom: green
colorTo: gray
sdk: gradio
app_file: app.py
pinned: false
---

# Tafsir Lab — model service

Two endpoints, on the free CPU tier:

| Endpoint | Model | Job |
|---|---|---|
| `/embed` | `intfloat/multilingual-e5-small` | question → 384-dim vector |
| `/translate` | `Helsinki-NLP/opus-mt-ar-en` | Arabic → English |

There is **no chat model here, deliberately.** The assistant answers by quoting
passages that were retrieved from the corpus, so the only generation anywhere in
the system is machine translation of text that already exists. Nothing in this
Space can invent a tafsīr, because nothing in it writes prose.

Both models are small enough to be quick on two shared vCPUs. A 7B chat model
would not fit in this tier and would take tens of seconds a reply if it did.

## Deploying

1. Create a Space → Gradio → **CPU basic (free)**
2. Upload `app.py`, `requirements.txt`, this `README.md`
3. Copy the Space URL into `TAFSIR_MODEL_SPACE` in the app's environment

## Notes

- A free Space **sleeps when idle**. The first call after a nap pays the model
  load; the caller in Tafsir Lab handles that with a longer first-call timeout
  and falls back to keyword search rather than failing the question.
- `query:` / `passage:` prefixes are required by e5 and must match how the
  corpus was embedded. `/embed` applies `query:`; the Colab job applies
  `passage:`. Changing one without the other degrades results silently.
