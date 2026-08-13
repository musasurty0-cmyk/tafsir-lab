"""
Transcribe the clip twice: once in Arabic, once translated to English.

Whisper's `translate` task emits English for the same audio, which gives two
timed tracks that line up — the alternative (transcribe, then translate the
text separately) loses the timing and has to be re-aligned by hand.
"""
import json, sys, warnings
warnings.filterwarnings("ignore")
import whisper

model_name = sys.argv[1] if len(sys.argv) > 1 else "small"
print(f"loading {model_name} …", flush=True)
model = whisper.load_model(model_name)

out = {}
for task in ("transcribe", "translate"):
    print(f"{task} …", flush=True)
    r = model.transcribe(
        "clip.wav",
        language="ar",
        task=task,
        verbose=False,
        condition_on_previous_text=False,   # stops one bad guess poisoning the rest
    )
    out[task] = [
        {"start": round(s["start"], 2), "end": round(s["end"], 2), "text": s["text"].strip()}
        for s in r["segments"]
    ]

json.dump(out, open("transcript.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

for task in ("transcribe", "translate"):
    print(f"\n=== {task} ===")
    for s in out[task]:
        print(f"  [{s['start']:6.2f} → {s['end']:6.2f}]  {s['text']}")
