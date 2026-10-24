"""
Measure every line of every muṣḥaf page in its own font.

  python scripts/audit-mushaf-widths.py [cacheDir]

Run scripts/audit-mushaf.mts first: it writes cacheDir/assembled.json, every
page exactly as /api/quran/page serves it. This fetches the 604 page fonts the
app uses (cached in cacheDir/fonts) and sums each line's glyph advances.

A Muṣḥaf line fills the measure, so a word on the wrong line shows up as one
line overfull and its neighbour short. Also checks that every glyph code
exists in its page font (a missing one draws as nothing, or a box).

Needs fontTools and brotli (pip install fonttools brotli). Exits 1 on findings
other than the known exceptions below.
"""
import json, os, sys, urllib.request
from fontTools.ttLib import TTFont

d = sys.argv[1] if len(sys.argv) > 1 else os.path.join(".cache", "mushaf-audit")
CDN = "https://verses.quran.foundation/fonts/quran/hafs/v2/woff2"
TOLERANCE = 0.04          # lines sit within ±1.5% in practice; 4% is a clear outlier
# Page 254 (13:36–38): lines 6/7 at 94/105% with no arrangement of words that
# does better than 4.5% — a quirk of that page's metrics, not a misplaced word.
# Page 604: the closing lines of al-Ikhlāṣ, al-Falaq and an-Nās are centred.
KNOWN = {254, 604}

pages = json.load(open(os.path.join(d, "assembled.json"), encoding="utf8"))
# The last āyah of each surah: the one line allowed to stop short is the line
# a surah ends on.
final = {}
for ws in pages.values():
    for w in ws:
        s, a = map(int, w["vk"].split(":"))
        final[s] = max(final.get(s, 0), a)
os.makedirs(os.path.join(d, "fonts"), exist_ok=True)
findings, lines_total = [], 0
for p in range(1, 605):
    fp = os.path.join(d, "fonts", f"p{p}.woff2")
    if not os.path.exists(fp):
        urllib.request.urlretrieve(f"{CDN}/p{p}.woff2", fp)
    font = TTFont(fp)
    cmap, hmtx = font.getBestCmap(), font["hmtx"].metrics
    widths, last = {}, {}
    for w in pages[str(p)]:
        for ch in w["code"]:
            if ch == " ":
                continue          # drawn by the browser's own space, not the face
            g = cmap.get(ord(ch))
            if g is None:
                findings.append(f"p{p} {w['vk']}#{w['pos']}: U+{ord(ch):04X} not in its page font")
                continue
            widths[w["line"]] = widths.get(w["line"], 0) + hmtx[g][0]
        last[w["line"]] = w["vk"]
    lines_total += len(widths)
    if p <= 2 or p in KNOWN:
        continue                  # al-Fātiḥah and the opening of al-Baqarah are set centred
    full = sorted(widths.values())[len(widths) // 2]
    for line, wd in sorted(widths.items()):
        r = wd / full
        s, a = map(int, last[line].split(":"))
        ends_surah = a == final[s]
        if r > 1 + TOLERANCE or (r < 1 - TOLERANCE and not ends_surah):
            findings.append(f"p{p} line {line}: {r * 100:.1f}% of the measure (ends {last[line]})")

print(f"{lines_total} lines measured on 604 pages")
if findings:
    print(f"{len(findings)} findings:\n  " + "\n  ".join(findings[:60]))
    sys.exit(1)
print("Every line fills its measure; every glyph is in its page font.")
