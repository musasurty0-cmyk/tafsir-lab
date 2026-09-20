"""Generate marketing/reels/maryam-87-95/index.html from verses.json.

The verse data is INLINED into the page rather than fetched: a render-time
fetch is non-deterministic and the framework forbids it. verses.json stays as
the record of where the text came from."""
import json, pathlib, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

P = pathlib.Path(__file__).parent
doc = json.loads((P / "verses.json").read_text(encoding="utf-8"))
V = doc["verses"]

AR_DIGITS = "٠١٢٣٤٥٦٧٨٩"
arabic_num = lambda n: "".join(AR_DIGITS[int(c)] for c in str(n))

REC_END = doc["audio"]["duration"]      # 58.60
CLOSE_IN, DUR = 59.00, 61.00

# Nine ayat whose lengths differ by a factor of four. One size would leave the
# short ones timid in the frame and break the long ones with a word orphaned,
# so each is set on its own.
SIZE = {87: 54, 88: 72, 89: 78, 90: 56, 91: 72, 92: 60, 93: 52, 94: 72, 95: 63}


def mark_arabic(text):
    """Colour the ayah's closing rhyme word — the fasila the passage is built on."""
    toks = text.split()
    return " ".join(toks[:-1]) + (" " if len(toks) > 1 else "") + \
        '<span class="mk">%s</span>' % toks[-1]


def mark_english(text, phrase):
    assert text.count(phrase) == 1, "en mark %r not unique in %r" % (phrase, text)
    return text.replace(phrase, '<span class="mk">%s</span>' % phrase, 1)


cards, tweens, spine = [], [], []
total = sum(v["end"] - v["start"] for v in V)

for v in V:
    n, px = v["n"], SIZE[v["n"]]
    split = "arabic2" in v

    # The rhyme lives in the last part, so only that part carries the colour.
    ar1 = mark_arabic(v["arabic"]) if not split else v["arabic"]
    ar2 = mark_arabic(v["arabic2"]) if split else None
    en1 = v["english"] if split else mark_english(v["english"], v["enMark"])
    en2 = mark_english(v["english2"], v["enMark"]) if split else None

    ar_html = '<p class="ar" id="ar-%d" style="font-size:%dpx" dir="rtl" lang="ar">%s</p>' % (n, px, ar1)
    if split:
        ar_html += '\n                <p class="ar ar2" id="ar2-%d" style="font-size:%dpx" dir="rtl" lang="ar">%s</p>' % (n, px, ar2)
    en_html = '<p class="en" id="en-%d">%s</p>' % (n, en1)
    if split:
        en_html += '\n                <p class="en en2" id="en2-%d">%s</p>' % (n, en2)

    cards.append("""          <div class="beat" id="a%d" data-layout-allow-overlap="true">
            <div class="num">%s</div>
            <div class="arwrap">
                %s
            </div>
            <div class="rulewrap"><div class="rule" id="rule-%d"></div></div>
            <div class="enwrap">
                %s
            </div>
          </div>""" % (n, arabic_num(n), ar_html, n, en_html))

    start, end = v["start"], v["end"]
    in_at, out_at = max(0.0, round(start - 0.02, 2)), round(end - 0.18, 2)
    tweens.append('      card("#a%d", %.2f, %.2f);' % (n, in_at, out_at))
    tweens.append('      tl.to("#rule-%d", { scaleX: 1, duration: 0.42, ease: "power2.out" }, %.2f);'
                  % (n, round(start + 0.30, 2)))
    tweens.append('      reveal("#en-%d", %.2f);' % (n, round(start + 0.55, 2)))
    if split:
        # He stops here; the cut lands in both scripts, not just the English.
        tweens.append('      reveal("#ar2-%d", %.2f);' % (n, v["split"]))
        tweens.append('      reveal("#en2-%d", %.2f);' % (n, round(v["split"] + 0.25, 2)))

    # One spine segment per ayah, its width the share of the recitation it takes.
    spine.append('          <div class="seg" style="flex-grow:%.3f"><div class="segfill" id="seg-%d"></div></div>'
                 % ((end - start) / total * 100, n))
    tweens.append('      tl.fromTo("#seg-%d", { scaleX: 0 }, { scaleX: 1, duration: %.2f, ease: "none", immediateRender: false }, %.2f);'
                  % (n, end - start, start))

HTML = """<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1080, height=1920">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;0,7..72,700;1,7..72,500&family=Source+Serif+4:ital,opsz,wght@1,8..60,500&family=Scheherazade+New:wght@400;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      /* ══════════════════════════════════════════════════════════════════
         maryam-87-95 — 61s, 1080×1920, LIGHT.

         Sūrat Maryam 87–95, recited, set as pages of the Mushaf view.

         THE ARABIC DOES NOT MOVE once it is up, and there is no word-by-word
         lighting on it: the recitation is being heard, and highlighting parts
         of Qurʾānic text on a per-word timing I cannot verify would be a claim
         I am not able to make. What IS timed is what was measured — which
         āyah is up, when the meaning arrives under it, and the one place he
         stops inside an āyah (19:90, at 23.33), where the cut lands in both
         scripts.

         The frame does not move either. The number, the rule and both text
         blocks sit at fixed positions, so āyah to āyah the page keeps its
         shape and only its contents change — the hairlines either side of the
         number never blink at all. Under it, one spine of nine segments, each
         as wide as the share of the recitation its āyah takes, filling as he
         reads. Something is always advancing.

         No music. Nothing plays under the recitation.
         ══════════════════════════════════════════════════════════════════ */
      * { margin: 0; padding: 0; box-sizing: border-box; }

      :root {
        --bg:     #fcfbf8;
        --ink:    #292621;
        --ink-2:  #57534b;
        --ink-3:  #6e695f;
        --line:   rgba(41, 38, 33, 0.13);
        --accent: #a8762a;
        /* Madder red, for the rhyme. Red is how a printed Mushaf has always
           annotated its own text, and 6.6:1 on this paper. */
        --mark:   #9c3a2c;

        --sans:   "Inter", -apple-system, "Segoe UI", system-ui, Arial, sans-serif;
        --serif:  "Literata", Georgia, serif;
        --brand:  "Source Serif 4", Georgia, serif;
        /* Scheherazade New, not Amiri Quran. The build Google Fonts serves for
           Amiri Quran has broken mark attachment in Chrome — the ḥarakāt come
           out in a detached row floating above the letters. Not the subset
           (every mark here is inside the served unicode-range) and not the
           delivery (self-hosting the same woff2 changed nothing). Scheherazade
           New sets it correctly and is already the app's own Uthmani fallback
           in `--font-uthmanic`. */
        --quran:  "Scheherazade New", serif;
      }

      html, body {
        width: 1080px; height: 1920px; overflow: hidden;
        background: var(--bg); font-family: var(--sans);
        -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
      }
      #root { position: relative; width: 1080px; height: 1920px; background: var(--bg); }
      .clip { position: absolute; inset: 0; overflow: hidden; }

      .paper { position: absolute; inset: 0; background: var(--bg); }
      .dots {
        position: absolute; inset: 0;
        background: radial-gradient(rgba(41, 38, 33, 0.09) 1.5px, transparent 1.5px);
        background-size: 30px 30px;   /* static; nothing in the background moves */
      }

      /* ── The spine: nine segments, one per āyah, each as wide as the share
            of the recitation it takes. 19:90 is a fifth of the passage and
            looks it. ─────────────────────────────────────────────────────── */
      .spine { position: absolute; left: 96px; right: 96px; top: 300px; display: flex; gap: 7px; }
      .seg { position: relative; height: 3px; background: var(--line); }
      .segfill {
        position: absolute; inset: 0; background: var(--accent); opacity: 0.6;
        transform-origin: 0%% 50%%;
      }

      .stage { position: absolute; left: 70px; right: 70px; top: 500px; height: 940px; }

      /* The hairlines live in the SCENE, not in the cards: they are the one
         thing on the page that never moves, blinks or reflows, and every āyah
         arrives inside them. */
      .numframe {
        position: absolute; left: 0; right: 0; top: 100px; height: 56px;
        display: flex; align-items: center; justify-content: center; gap: 22px;
      }
      .numframe i { display: block; width: 110px; height: 1px; background: var(--line); }
      .numframe b { display: block; width: 104px; }

      .beat { position: absolute; inset: 0; opacity: 0; }
      /* Fixed slots. Nothing re-centres between āyāt. */
      .num {
        position: absolute; left: 0; right: 0; top: 100px; height: 56px;
        display: flex; align-items: center; justify-content: center;
        font-family: var(--quran); font-size: 42px; color: var(--accent); line-height: 1;
      }
      .arwrap {
        position: absolute; left: 0; right: 0; top: 196px; height: 340px;
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
      }
      .ar {
        font-family: var(--quran); line-height: 2.0; color: var(--ink);
        direction: rtl; max-width: 940px; word-spacing: 0.04em; text-align: center;
      }
      .rulewrap { position: absolute; left: 0; right: 0; top: 566px; display: flex; justify-content: center; }
      .rule {
        width: 300px; height: 2px; background: var(--accent); opacity: 0.45;
        transform-origin: 50%% 50%%;
      }
      .enwrap { position: absolute; left: 0; right: 0; top: 620px; text-align: center; }
      .en {
        font-family: var(--serif); font-weight: 400; font-size: 50px; line-height: 1.5;
        color: var(--ink-2); max-width: 880px; margin: 0 auto; letter-spacing: -0.012em;
      }
      .en2 { margin-top: 12px; }

      /* The rhyme. Every āyah in this passage closes on the same -an sound;
         colouring it is showing the reader a structure the text already has. */
      .mk { color: var(--mark); }

      /* ── The closing card ───────────────────────────────────────────── */
      .closewrap {
        position: absolute; left: 0; right: 0; top: 150px;
        display: flex; flex-direction: column; align-items: center;
      }
      .brand-row { display: flex; align-items: center; gap: 34px; }
      .tile {
        width: 148px; height: 148px; border-radius: 34px; background: var(--ink);
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 26px 60px rgba(41, 38, 33, 0.22);
      }
      .tile .t {
        font-family: var(--brand); font-style: normal; font-weight: 600;
        font-size: 92px; line-height: 1; color: var(--bg); padding-bottom: 8px;
      }
      .wordmark {
        font-family: var(--brand); font-style: italic; font-weight: 500;
        font-size: 108px; letter-spacing: -0.02em; color: var(--ink); white-space: nowrap;
      }
      .wm-clip { overflow: hidden; padding: 6px 0; }
      .url-clip { overflow: hidden; }
      .close-rule {
        width: 360px; height: 3px; background: var(--accent); opacity: 0.5;
        margin: 40px 0 22px; transform-origin: 50%% 50%%;
      }
      .close-url {
        font-family: var(--sans); font-size: 30px; font-weight: 500;
        letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-3);
      }

      .foot {
        position: absolute; left: 96px; right: 96px; top: 1500px;
        display: flex; align-items: center; justify-content: space-between;
        font-family: var(--sans); font-size: 24px; font-weight: 500;
        letter-spacing: 0.1em; text-transform: uppercase; color: #8a8579;
        padding-top: 22px; border-top: 1px solid var(--line); opacity: 0;
      }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="%(dur).2f"
         data-fps="30" data-width="1080" data-height="1920">

      <div id="scene" class="clip" data-start="0" data-duration="%(dur).2f" data-track-index="1">
        <div class="paper"></div>
        <div class="dots"></div>

        <div class="spine" id="spine">
%(spine)s
        </div>

        <div class="stage" id="stage">
          <div class="numframe" id="numframe"><i></i><b></b><i></i></div>

%(cards)s

          <div class="beat" id="close" data-layout-allow-overlap="true">
            <div class="closewrap">
              <div class="brand-row">
                <div class="tile"><span class="t">T</span></div>
                <div class="wm-clip"><div class="wordmark">TafsirLab</div></div>
              </div>
              <div class="close-rule" id="close-rule"></div>
              <div class="url-clip"><div class="close-url">tafsir-lab.com</div></div>
            </div>
          </div>
        </div>

        <div class="foot" id="foot">
          <span>Sūrat Maryam · 19:87–95</span>
          <span>TafsirLab</span>
        </div>
      </div>

      <audio id="au-rec" data-start="0" data-duration="%(recend).2f" data-volume="1"
             src="audio/recitation.flac"></audio>
    </div>

    <script>
      const DUR = %(dur).2f;
      const tl = gsap.timeline({ paused: true });

      /* A card arrives, holds still, and leaves — the same way every time,
         because no āyah here outranks another and giving one its own entrance
         would be saying that it did. The page's frame does not move at all. */
      function card(sel, inAt, outAt) {
        tl.set(sel, { opacity: 0 }, 0);
        tl.set(sel, { opacity: 1 }, inAt);
        tl.fromTo(sel, { y: 34 }, { y: 0, duration: 0.42, ease: "power3.out",
          immediateRender: false }, inAt);
        if (outAt > 0) {
          tl.to(sel, { y: -26, opacity: 0, duration: 0.16, ease: "power2.in" }, outAt);
          tl.set(sel, { opacity: 0 }, outAt + 0.155);
        }
      }
      function reveal(sel, at) {
        tl.set(sel, { opacity: 0 }, 0);
        tl.fromTo(sel, { y: 18, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.42, ease: "power2.out", immediateRender: false }, at);
      }

      gsap.utils.toArray(".rule").forEach((r) => tl.set(r, { scaleX: 0 }, 0));

      tl.set("#foot", { opacity: 0 }, 0);
      tl.to("#foot", { opacity: 1, duration: 0.6, ease: "power2.out" }, 0.5);
      tl.to("#foot", { opacity: 0, duration: 0.24, ease: "power2.in" }, %(closein).2f - 0.36);
      tl.to("#spine", { opacity: 0, duration: 0.24, ease: "power2.in" }, %(closein).2f - 0.36);
      tl.to("#numframe", { opacity: 0, duration: 0.24, ease: "power2.in" }, %(closein).2f - 0.36);

%(tweens)s

      /* ── The close ───────────────────────────────────────────────────── */
      card("#close", %(closein).2f, 0);
      tl.set("#close .tile",      { scale: 0.82 }, 0);
      tl.set("#close .wordmark",  { xPercent: -106 }, 0);
      tl.set("#close-rule",       { scaleX: 0 }, 0);
      tl.set("#close .close-url", { yPercent: 115 }, 0);
      tl.fromTo("#close .tile", { scale: 0.82 },
        { scale: 1, duration: 0.42, ease: "back.out(1.8)", immediateRender: false }, %(closein).2f + 0.06);
      tl.fromTo("#close .wordmark", { xPercent: -106 },
        { xPercent: 0, duration: 0.44, ease: "power3.out", immediateRender: false }, %(closein).2f + 0.14);
      tl.to("#close-rule", { scaleX: 1, duration: 0.40, ease: "power2.out" }, %(closein).2f + 0.44);
      tl.fromTo("#close .close-url", { yPercent: 115 },
        { yPercent: 0, duration: 0.34, ease: "power3.out", immediateRender: false }, %(closein).2f + 0.64);

      tl.seek(0);
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
"""

out = HTML % {"dur": DUR, "recend": REC_END, "closein": CLOSE_IN,
              "cards": "\n\n".join(cards), "tweens": "\n".join(tweens),
              "spine": "\n".join(spine)}
(P / "index.html").write_text(out, encoding="utf-8")
print("wrote index.html  (%d cards, %.2fs)" % (len(V), DUR))
