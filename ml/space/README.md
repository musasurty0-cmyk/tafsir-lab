# Tafsir Lab — model service (OPTIONAL)

> **You do not need this.** Hugging Face began requiring a paid plan to create
> a compute Space, so the query half of semantic search moved into the reader's
> browser — see `lib/tafsir/browser-embed.ts`. That path needs no host, no
> account and no bill, and it is what the deployed app uses.
>
> This Space is kept for anyone who would rather run it server-side: a paid HF
> plan, or the same two files on any host that will run Python. Set
> `TAFSIR_MODEL_SPACE` and the app prefers it over the browser. Nothing breaks
> if you never do.

The half of semantic search that does not live in the database.

Embedding the corpus (done, in Colab or locally) turns 78,000 commentary
passages into vectors. Searching them needs the *question* turned into a vector
by **the same model** — otherwise the two live in different spaces and the
nearest neighbours are noise. This Space is what does that.

Until it exists, the app falls back to keyword search. That works, and says so
in the trace, but it can only find passages that share a word with the question:
searching for *patience* will never surface "he did not weaken".

## Deploying it

1. **huggingface.co** → your profile → **New Space** — note this now needs a
   paid plan; CPU Basic has no hourly cost but creating a compute Space is
   gated. This is the step that made the browser the default instead.
2. Name it anything. SDK: **Gradio**. Hardware: **CPU basic**.
3. Upload `app.py` and `requirements.txt` from this folder.
4. Wait for the build. A few minutes: it installs torch, which is the slow part.
5. Copy the Space URL, e.g. `https://your-name-tafsir-lab.hf.space`
6. In Vercel → Settings → Environment Variables, add:

   ```
   TAFSIR_MODEL_SPACE = https://your-name-tafsir-lab.hf.space
   ```

   Tick Production, Preview and Development. Then redeploy.

That is the whole setup. The app detects the variable and switches retrieval
from keyword-only to hybrid; nothing else changes.

## What it serves

| Endpoint | Purpose |
|---|---|
| `/embed` | A question → a 384-dim vector. The one the app needs. |
| `/translate` | Arabic → English, via `Helsinki-NLP/opus-mt-ar-en`. |
| `/chat` | A grounded answer from supplied passages. **Needs `llama-cpp-python`, which requirements.txt deliberately omits** — Groq already does this and does it faster. Add the package back if you want it. |
| `/health` | Which models are loaded, so a cold Space is distinguishable from a slow one. |

## Two things that will bite

**The `query: ` prefix is not optional.** e5 was trained with asymmetric
prefixes and the corpus was embedded with `passage: `. Using the wrong one here
does not error — it quietly returns worse neighbours, which reads as "the search
is a bit rubbish" for months. `embed()` applies it; do not remove it.

**A free Space sleeps when idle.** The first request after a nap pays the model
load, which is tens of seconds. Every request after it is warm. The app treats a
slow or absent embedding service as a fallback to keyword search rather than as
an error, so a sleeping Space degrades the results rather than breaking the page.
