"""
Pass 1: Arabic transcript with word-level timings.

Only ONE Whisper pass is run. The English comes later, written against these
Arabic cues rather than from Whisper's `translate` task â€” two audio passes cost
another hour and produce English on its OWN timeline, which then has to be
force-aligned back onto the Arabic. Translating the Arabic that is already timed
avoids the alignment problem entirely and reads better.

Language is FORCED to Arabic and the detected probability is printed anyway:
auto-detect returned 0.50 on an earlier clip and produced fluent, invented
Arabic, so the confidence figure is something to check rather than to trust.
"""
import json, os, sys, time
from faster_whisper import WhisperModel

SP = os.path.dirname(os.path.abspath(__file__))
t0 = time.time()

model = WhisperModel("large-v3", device="cpu", compute_type="int8", cpu_threads=10)
print(f"[{time.time()-t0:.0f}s] model loaded", flush=True)

segs, info = model.transcribe(
    os.path.join(SP, "audio.wav"),
    language="ar",
    word_timestamps=True,
    vad_filter=True,
    beam_size=5,
    condition_on_previous_text=False,   # stops one bad guess cascading
)
print(f"detected={info.language} p={info.language_probability:.2f} "
      f"duration={info.duration:.0f}s", flush=True)

out = []
for s in segs:
    out.append({
        "i": len(out),
        "s": round(s.start, 2),
        "e": round(s.end, 2),
        "ar": s.text.strip(),
        "words": [{"w": w.word.strip(), "s": round(w.start, 2), "e": round(w.end, 2)}
                  for w in (s.words or [])],
    })
    if len(out) % 25 == 0:
        done = out[-1]["e"]
        rate = done / max(1, time.time() - t0)
        left = (info.duration - done) / max(rate, 0.01)
        print(f"[{time.time()-t0:.0f}s] {len(out)} cues, {done:.0f}/{info.duration:.0f}s "
              f"({rate:.2f}x realtime, ~{left/60:.0f} min left)", flush=True)

json.dump(out, open(os.path.join(SP, "ar.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
words = sum(len(c["words"]) for c in out)
print(f"DONE {len(out)} cues, {words} words, {time.time()-t0:.0f}s wall", flush=True)


