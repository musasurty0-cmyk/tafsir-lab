import json, warnings
warnings.filterwarnings("ignore")
import whisper
m = whisper.load_model("medium")
r = m.transcribe("clip.wav", language="ar", task="transcribe",
                 word_timestamps=True, condition_on_previous_text=False, verbose=False)
words = [{"w": w["word"].strip(), "s": round(w["start"], 2), "e": round(w["end"], 2)}
         for seg in r["segments"] for w in seg.get("words", [])]
json.dump(words, open("words.json", "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print(f"{len(words)} words")
