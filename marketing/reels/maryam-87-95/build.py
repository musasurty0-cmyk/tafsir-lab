"""Generate marketing/reels/maryam-87-95/index.html from verses.json.

The verse data is INLINED into the page rather than fetched: a render-time
fetch is non-deterministic and the framework forbids it. verses.json stays as
the record of where the text came from."""
import json, pathlib, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

P = pathlib.Path(r"C:\Users\musas\Tafsir Lab\marketing\reels\maryam-87-95")
doc = json.loads((P / "verses.json").read_text(encoding="utf-8"))
V = doc["verses"]

AR_DIGITS = "٠١٢٣٤٥٦٧٨٩"
def arabic_num(n):
    return "".join(AR_DIGITS[int(c)] for c in str(n))

REC_END = doc["audio"]["duration"]      # 58.60
CLOSE_IN, DUR = 59.00, 61.00
# Set per āyah rather than by one rule. There are nine of them and their
# lengths differ by a factor of four, so one size either leaves the short ones
# looking timid in the frame or breaks the long ones with a single word orphaned
# on its own line. A typesetter would set nine lines nine ways; so do we.
SIZE = {87: 54, 88: 72, 89: 78, 90: 49, 91: 72, 92: 60, 93: 52, 94: 72, 95: 63}

cards, tweens = [], []
for i, v in enumerate(V):
    n = v["n"]
    px = SIZE[n]
    en2 = ('\n              <p class="aya-en aya-en2" id="en2-%d">%s</p>' % (n, v["english2"])) if "english2" in v else ""
    cards.append("""          <div class="beat" id="a%d" data-layout-allow-overlap="true">
            <div class="bmv">
              <div class="aya-num"><i></i><span>%s</span><i></i></div>
              <p class="aya-ar" style="font-size:%dpx" dir="rtl" lang="ar">%s</p>
              <div class="aya-rule" id="rule-%d"></div>
              <p class="aya-en" id="en-%d">%s</p>%s
            </div>
          </div>""" % (n, arabic_num(n), px, v["arabic"], n, n, v["english"], en2))

    start, end = v["start"], v["end"]
    in_at = max(0.0, round(start - 0.02, 2))
    out_at = round(end - 0.18, 2)
    # Every ayah card leaves, including the last: the closing card is the only
    # thing that holds, and 95 clearing first is what gives it an empty page.
    tweens.append('      card("#a%d", %.2f, %.2f, true);' % (n, in_at, out_at))
    # The rule draws under the Arabic, then the meaning arrives. Arabic first,
    # then what it means -- never both at once.
    tweens.append('      tl.to("#rule-%d", { scaleX: 1, duration: 0.42, ease: "power2.out" }, %.2f);' % (n, round(start + 0.30, 2)))
    tweens.append('      reveal("#en-%d", %.2f);' % (n, round(start + 0.55, 2)))
    if "english2" in v:
        tweens.append('      reveal("#en2-%d", %.2f);   // his breath inside the ayah' % (n, v["split"]))

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

         Sūrat Maryam 87–95, recited, set as pages of the Mushaf view: warm
         paper, the āyah in Uthmani script, its number between two rules, the
         meaning beneath.

         THE ARABIC DOES NOT MOVE. It arrives, and then it is still. There is
         no word-by-word lighting on it — the recitation is being heard, the
         eye follows the ear, and highlighting parts of Qurʾānic text on a
         timing I cannot verify to the word would be a claim I cannot make.
         What is timed is what I measured: which āyah is on screen, and when
         the meaning arrives under it.

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

        --sans:   "Inter", -apple-system, "Segoe UI", system-ui, Arial, sans-serif;
        --serif:  "Literata", Georgia, serif;
        --brand:  "Source Serif 4", Georgia, serif;
        /* Scheherazade New, not Amiri Quran. Amiri Quran is the obvious pick
           for Uthmani text and it is what the app lists first — but the build
           Google Fonts serves has broken mark attachment in Chrome: the
           ḥarakāt render in a detached row floating above the letters instead
           of sitting on them. Verified side by side in a real browser, and
           self-hosting the same woff2 did not fix it, so it is the font build
           and not the delivery. Scheherazade New sets the same text correctly
           and is already the app's own fallback for Uthmani script
           (`--font-uthmanic` in app/globals.css). */
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
        background-size: 30px 30px;
        /* Static. Nothing in the background moves. */
      }

      .rail { position: absolute; left: 96px; right: 96px; top: 300px; display: flex; align-items: center; }
      .rail-track { position: relative; flex: 1; height: 2px; background: var(--line); }
      .rail-fill {
        position: absolute; inset: 0; background: var(--accent); opacity: 0.55;
        transform-origin: 0%% 50%%; transform: scaleX(0);
      }

      .stage { position: absolute; left: 70px; right: 70px; top: 500px; height: 940px; }
      .beat {
        position: absolute; left: 0; right: 0; top: 50%%; transform: translateY(-50%%);
        display: flex; flex-direction: column; align-items: center;
        text-align: center; opacity: 0;
      }
      .bmv { display: flex; flex-direction: column; align-items: center; width: 100%%; }

      /* The āyah number, held between two hairlines — the Mushaf's own way of
         marking one off, not a badge borrowed from a UI. */
      .aya-num { display: flex; align-items: center; gap: 22px; margin-bottom: 40px; }
      .aya-num i { display: block; width: 110px; height: 1px; background: var(--line); }
      .aya-num span {
        font-family: var(--quran); font-size: 42px; color: var(--accent);
        line-height: 1; padding-bottom: 6px;
      }

      .aya-ar {
        font-family: var(--quran); line-height: 2.0;
        color: var(--ink); direction: rtl; max-width: 940px;
        word-spacing: 0.04em;
      }

      /* No `transform: scaleX(0)` here: GSAP animates scaleX on this class and
         would overwrite the whole CSS transform. The closed state is set on the
         timeline at t=0 instead, which is the one place that owns it. */
      .aya-rule {
        width: 300px; height: 2px; background: var(--accent); opacity: 0.45;
        margin: 46px 0 40px; transform-origin: 50%% 50%%;
      }

      .aya-en {
        font-family: var(--serif); font-weight: 400; font-size: 50px;
        line-height: 1.5; color: var(--ink-2); max-width: 880px;
        letter-spacing: -0.012em;
      }
      .aya-en2 { margin-top: 14px; }

      /* ── The closing card ───────────────────────────────────────────── */
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
        margin: 40px 0 22px; transform-origin: 50%% 50%%; transform: scaleX(0);
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

        <div class="rail"><div class="rail-track"><div class="rail-fill" id="rail-fill"></div></div></div>

        <div class="stage" id="stage">
%(cards)s

          <div class="beat" id="close" data-layout-allow-overlap="true">
            <div class="bmv">
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
      const REC_END = %(recend).2f;
      const tl = gsap.timeline({ paused: true });

      /* A card arrives, holds perfectly still, and leaves upward — the same
         roll for every āyah, because none of them is more important than
         another and a different entrance each time would be saying so. */
      function card(sel, inAt, outAt, leaves) {
        tl.set(sel, { opacity: 0 }, 0);
        tl.set(sel, { opacity: 1 }, inAt);
        tl.fromTo(sel + " .bmv", { y: 44, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.40, ease: "power3.out", immediateRender: false }, inAt);
        if (leaves) {
          tl.to(sel + " .bmv", { y: -34, opacity: 0, duration: 0.16, ease: "power2.in" }, outAt);
          tl.set(sel, { opacity: 0 }, outAt + 0.155);
        }
      }
      function reveal(sel, at) {
        tl.set(sel, { opacity: 0 }, 0);
        tl.fromTo(sel, { y: 18, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.42, ease: "power2.out", immediateRender: false }, at);
      }

      /* Every rule starts closed. */
      gsap.utils.toArray(".aya-rule").forEach((r) => tl.set(r, { scaleX: 0 }, 0));

      /* The rail tracks the recitation, not the composition — it is full when
         he finishes, and the closing card is not part of the reading. */
      tl.set("#rail-fill", { scaleX: 0 }, 0);
      tl.to("#rail-fill", { scaleX: 1, duration: REC_END, ease: "none" }, 0);

      tl.set("#foot", { opacity: 0 }, 0);
      tl.to("#foot", { opacity: 1, duration: 0.6, ease: "power2.out" }, 0.5);
      tl.to("#foot", { opacity: 0, duration: 0.24, ease: "power2.in" }, %(closein).2f - 0.36);
      tl.to(".rail", { opacity: 0, duration: 0.24, ease: "power2.in" }, %(closein).2f - 0.36);

%(tweens)s

      /* ── The close ───────────────────────────────────────────────────── */
      card("#close", %(closein).2f, 0, false);
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

out = HTML % {
    "dur": DUR, "recend": REC_END, "closein": CLOSE_IN,
    "cards": "\n\n".join(cards), "tweens": "\n".join(tweens),
}
(P / "index.html").write_text(out, encoding="utf-8")
print("wrote index.html  (%d cards, %.2fs)" % (len(V), DUR))
