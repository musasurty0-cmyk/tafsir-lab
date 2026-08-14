"""
Build the burned-in subtitle file.

Layout is one Dialogue event per card carrying BOTH languages, Arabic first with
a hard break and a style reset to English. Two separate events stacked by margin
was the earlier approach and it put the Arabic underneath the English whenever
the English wrapped — the order has to be structural, not a hope about margins.

Behind the text sits a single full-width band. A translucent box hugging each
line (ASS BorderStyle 3) is more readable than an outline on this footage, which
is a patterned wall crossed by a dark vest and a white thobe, but it produces two
ragged boxes of different widths. One band reads as deliberate and keeps the text
legible wherever it falls.

The Arabic is set far larger than the English on purpose. Naskh has a small
visible body relative to its em, so Amiri at 88 and Georgia at 30 are closer in
apparent size than the numbers suggest — the ratio is the same one the reels use.

LAST-MILE CORRECTIONS below restore mushaf vocalisation to quotation words the
matcher left bare because they fell at a cue edge. Each is a word inside a verse the matcher either
truncated at a cue edge or never matched at all. Nothing here touches his own
speech; every entry is scripture, checked against the mushaf text in quran.json.
"""
import sys as _sys
if hasattr(_sys.stdout, "reconfigure"):
    _sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import json, io, os

SP = os.path.dirname(os.path.abspath(__file__))

# cue -> [(what Whisper wrote, what the verse says, which verse)]
CORRECTIONS = {}   # session 5: the rule pass + edge trimming covered it

cues = json.load(open(os.path.join(SP, "cues.json"), encoding="utf-8"))
en   = json.load(open(os.path.join(SP, "en.json"), encoding="utf-8"))

applied = 0
for c in cues:
    for wrong, right, key in CORRECTIONS.get(c["i"], []):
        parts = c["ar"].split()
        if wrong in parts:
            c["ar"] = " ".join(right if p == wrong else p for p in parts)
            c["quran"] = c["quran"] or key
            applied += 1
        else:
            print(f"  WARNING cue {c['i']}: expected {wrong!r}, not found — skipped")

NL  = chr(92) + "N"
RST = "{" + chr(92) + "rEN}"

def ts(t):
    cs = int(round(t * 100)); h, cs = divmod(cs, 360000); m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

def clean(s):
    return s.replace("\\", "").replace("{", "(").replace("}", ")").replace("\n", " ").strip()

BAND_TOP, BAND_BOT = 540, 714
band = (f"{{\\p1\\pos(0,{BAND_TOP})}}m 0 0 l 1280 0 1280 {BAND_BOT - BAND_TOP} "
        f"0 {BAND_BOT - BAND_TOP}{{\\p0}}")

out = [
 "[Script Info]", "ScriptType: v4.00+", "PlayResX: 1280", "PlayResY: 720",
 "WrapStyle: 0", "ScaledBorderAndShadow: yes", "YCbCr Matrix: TV.709", "",
 "[V4+ Styles]",
 "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,"
 "Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,"
 "Alignment,MarginL,MarginR,MarginV,Encoding",
 # cream-white Arabic, cooler and slightly dimmer English, both with a soft dark edge
 "Style: AR,Amiri,88,&H00F2F8FA,&H00F2F8FA,&HC0100804,&H00000000,0,0,0,0,100,100,0,0,1,2.4,0,2,60,60,52,1",
 "Style: EN,Georgia,30,&H00C2D8E2,&H00C2D8E2,&HC0100804,&H00000000,0,0,0,0,100,100,0,0,1,2.0,0,2,110,110,52,1",
 "Style: BD,Arial,20,&H8C120A06,&H8C120A06,&H8C120A06,&H8C120A06,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1",
 "",
 "[Events]",
 "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text",
]

for c in cues:
    a, b = ts(c["s"]), ts(c["e"])
    out.append(f"Dialogue: 0,{a},{b},BD,,0,0,0,,{band}")
    text = clean(c["ar"]) + NL + RST + clean(en[str(c["i"])])
    out.append(f"Dialogue: 1,{a},{b},AR,,0,0,0,,{text}")

io.open(os.path.join(SP, "final.ass"), "w", encoding="utf-8").write("\n".join(out) + "\n")

longest = max(cues, key=lambda c: len(c["ar"]))
print(f"  corrections applied : {applied}")
print(f"  events written      : {len(cues)} cards ({len(cues)*2} lines incl. band)")
print(f"  longest Arabic card : {len(longest['ar'])} chars at "
      f"{int(longest['s'])//60:02d}:{int(longest['s'])%60:02d}")
print(f"  longest English     : {max(len(v) for v in en.values())} chars")
print(f"  runs to             : {ts(cues[-1]['e'])}")
