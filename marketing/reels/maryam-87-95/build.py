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
CLOSE_IN, DUR = 59.10, 61.10

# Nine ayat whose lengths differ by a factor of four; each is set on its own so
# the short ones are not timid and the long ones do not orphan a word.
SIZE = {87: 54, 88: 72, 89: 78, 90: 56, 91: 72, 92: 60, 93: 52, 94: 72, 95: 63}


def mark_arabic(text, n):
    """Wrap the ayah's closing rhyme word so it can take colour when he says it."""
    if n not in MARK:
        return text
    toks = text.split()
    return " ".join(toks[:-1]) + (" " if len(toks) > 1 else "") + \
        '<span class="mk" id="mkar-%d">%s</span>' % (n, toks[-1])


def mark_english(text, phrase, n):
    if n not in MARK:
        return text
    assert text.count(phrase) == 1, "en mark %r not unique in %r" % (phrase, text)
    return text.replace(phrase, '<span class="mk" id="mken-%d">%s</span>' % (n, phrase), 1)


# When he actually reaches the rhyme word. Seven came from word-level
# transcription of each ayah on its own; 89 and 90 the recogniser dropped, so
# they were read off a 5 ms envelope — the last onset before the closing decay
# (14.60 after shay'an lands at 14.26; 27.02 after al-jibal).
MARK = {88: 11.60, 89: 14.60, 90: 27.02, 91: 32.24,
        92: 38.60, 93: 47.25, 94: 51.62, 95: 57.03}
# 87 carries no mark: "a covenant" is not part of what this passage is arguing.

blocks, tweens, spine = [], [], []
total = sum(v["end"] - v["start"] for v in V)
ids = []

for i, v in enumerate(V):
    n, px = v["n"], SIZE[v["n"]]
    split = "arabic2" in v
    ids.append("a%d" % n)

    ar1 = v["arabic"] if split else mark_arabic(v["arabic"], n)
    ar2 = mark_arabic(v["arabic2"], n) if split else None
    en1 = v["english"] if split else mark_english(v["english"], v["enMark"], n)
    en2 = mark_english(v["english2"], v["enMark"], n) if split else None

    ar_html = '<p class="ar" style="font-size:%dpx" dir="rtl" lang="ar">%s</p>' % (px, ar1)
    if split:
        ar_html += '\n              <p class="ar" id="ar2-%d" style="font-size:%dpx" dir="rtl" lang="ar">%s</p>' % (n, px, ar2)
    en_html = '<p class="en" id="en-%d">%s</p>' % (n, en1)
    if split:
        en_html += '\n              <p class="en en2" id="en2-%d">%s</p>' % (n, en2)

    # Blocks outside the window are deliberately out of view — the page is
    # longer than the frame. Declared, or the layout check reads every
    # scrolled-past ayah as text hidden under the paper.
    blocks.append("""          <div class="aya" id="a%d" data-layout-allow-occlusion="true" data-layout-allow-overlap="true">
            <div class="num"><i></i><span>%s</span><i></i></div>
            <div class="arwrap">
              %s
            </div>
            <div class="rulewrap"><div class="rule" id="rule-%d"></div></div>
            %s
          </div>""" % (n, arabic_num(n), ar_html, n, en_html))

    start, end = v["start"], v["end"]
    at = round(max(0.0, start - 0.35), 2)
    # The page SCROLLS to the next ayah. Nothing is replaced and nothing
    # disappears: what he has already recited stays above, what is coming waits
    # below, and the column moves the way a reader moves down a page.
    if i == 0:
        tweens.append('      tl.set(col, { y: POS[0] }, 0);')
    else:
        tweens.append('      tl.to(col, { y: POS[%d], duration: 0.78, ease: "power2.inOut" }, %.2f);' % (i, at))
    tweens.append('      focus(%d, %.2f);' % (i, at))
    tweens.append('      tl.to("#rule-%d", { scaleX: 1, duration: 0.42, ease: "power2.out" }, %.2f);'
                  % (n, round(start + 0.30, 2)))
    tweens.append('      reveal("#en-%d", %.2f);' % (n, round(start + 0.55, 2)))
    if split:
        tweens.append('      reveal("#ar2-%d", %.2f);' % (n, v["split"]))
        tweens.append('      reveal("#en2-%d", %.2f);' % (n, round(v["split"] + 0.25, 2)))
    if n in MARK:
        # It turns red as he says it, not before.
        for sel in ("#mkar-%d" % n, "#mken-%d" % n):
            tweens.append('      tl.to("%s", { color: MARK_COLOUR, duration: 0.26, ease: "power2.out" }, %.2f);'
                          % (sel, MARK[n]))

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
         maryam-87-95 — 61.1s, 1080×1920, LIGHT.

         Sūrat Maryam 87–95, recited, as ONE PAGE THAT SCROLLS.

         Not nine cards. All nine āyāt are on a single column that moves the
         way a reader moves down a page: what he has recited stays above,
         faded; what is coming waits below, faded; the āyah he is on sits at
         the reading line in full ink. Nothing is ever replaced and nothing
         disappears, which is the difference between a page and a slideshow.

         THE ARABIC DOES NOT MOVE relative to its page, and there is no
         word-by-word lighting: highlighting parts of Qurʾānic text on a
         per-word timing I cannot verify would be a claim I am not able to
         make. What IS timed is measured — which āyah is at the line, when the
         meaning arrives, the one place he stops inside an āyah (19:90 at
         23.33, where the cut lands in both scripts), and the moment he reaches
         each closing rhyme word, when that word turns red.

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
        /* Madder red, for the rhyme — how a printed Mushaf has always
           annotated its own text. 6.6:1 on this paper. */
        --mark:   #9c3a2c;

        --sans:   "Inter", -apple-system, "Segoe UI", system-ui, Arial, sans-serif;
        --serif:  "Literata", Georgia, serif;
        --brand:  "Source Serif 4", Georgia, serif;
        /* Scheherazade New, not Amiri Quran: the build Google Fonts serves for
           Amiri Quran has broken mark attachment in Chrome — the ḥarakāt come
           out in a detached row above the letters. Not the subset and not the
           delivery (self-hosting the same woff2 changed nothing). Scheherazade
           New is already the app's own Uthmani fallback. */
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

      /* ── The spine: nine segments, each as wide as the share of the
            recitation its āyah takes. 19:90 is a fifth of the passage and
            looks it. It fills continuously, so something is always
            advancing even while an āyah holds. ───────────────────────────── */
      .spine { position: absolute; left: 96px; right: 96px; top: 286px; display: flex; gap: 7px; }
      .seg { position: relative; height: 3px; background: var(--line); }
      .segfill {
        position: absolute; inset: 0; background: var(--accent); opacity: 0.6;
        transform-origin: 0%% 50%%;
      }

      /* The window onto the page. Masked top and bottom so āyāt fade out at
         the edges rather than being cut off by a hard line. */
      .viewport {
        position: absolute; left: 70px; right: 70px; top: 360px; height: 1100px;
        overflow: hidden;
        -webkit-mask-image: linear-gradient(to bottom, transparent 0%%, #000 14%%, #000 86%%, transparent 100%%);
                mask-image: linear-gradient(to bottom, transparent 0%%, #000 14%%, #000 86%%, transparent 100%%);
      }
      .column { position: relative; width: 100%%; }

      .aya { padding-bottom: 96px; opacity: 0.16; }

      .num { display: flex; align-items: center; justify-content: center; gap: 22px; margin-bottom: 34px; }
      .num i { display: block; width: 110px; height: 1px; background: var(--line); }
      .num span {
        font-family: var(--quran); font-size: 42px; color: var(--accent);
        line-height: 1; padding-bottom: 6px;
      }

      .arwrap { display: flex; flex-direction: column; align-items: center; gap: 6px; }
      .ar {
        font-family: var(--quran); line-height: 2.0; color: var(--ink);
        direction: rtl; max-width: 940px; word-spacing: 0.04em; text-align: center;
      }

      .rulewrap { display: flex; justify-content: center; margin: 36px 0 32px; }
      .rule {
        width: 300px; height: 2px; background: var(--accent); opacity: 0.45;
        transform-origin: 50%% 50%%;
      }

      .en {
        font-family: var(--serif); font-weight: 400; font-size: 50px; line-height: 1.5;
        color: var(--ink-2); max-width: 880px; margin: 0 auto; text-align: center;
        letter-spacing: -0.012em;
      }
      .en2 { margin-top: 12px; }

      /* The rhyme. Ink until he reaches it. */
      .mk { color: inherit; }

      /* ── The closing card ───────────────────────────────────────────── */
      .close {
        position: absolute; left: 0; right: 0; top: 700px;
        display: flex; flex-direction: column; align-items: center; opacity: 0;
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
        position: absolute; left: 96px; right: 96px; top: 1520px;
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

        <div class="viewport" id="viewport">
          <div class="column" id="column">
%(blocks)s
          </div>
        </div>

        <div class="close" id="close">
          <div class="brand-row">
            <div class="tile"><span class="t">T</span></div>
            <div class="wm-clip"><div class="wordmark">TafsirLab</div></div>
          </div>
          <div class="close-rule" id="close-rule"></div>
          <div class="url-clip"><div class="close-url">tafsir-lab.com</div></div>
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
      const MARK_COLOUR = "#9c3a2c";
      const IDS = %(ids)s;
      const tl = gsap.timeline({ paused: true });

      const col = document.getElementById("column");
      /* Where the āyah being recited sits inside the window. Measured at BUILD
         time, which is allowed here because this is a single-scene composition
         and every block is laid out before the timeline is built. */
      const READ = 1100 / 2;
      const POS = IDS.map(function (id) {
        const el = document.getElementById(id);
        const y = READ - (el.offsetTop + el.offsetHeight / 2);
        return isFinite(y) ? y : 0;
      });

      /* Bring one āyah to full ink and let the one before it fall back. The
         page keeps everything: the recited stays above, the coming waits
         below, both at a reading-room dimness. */
      function focus(i, at) {
        tl.to("#" + IDS[i], { opacity: 1, duration: 0.55, ease: "power2.out" }, at);
        if (i > 0) tl.to("#" + IDS[i - 1], { opacity: 0.22, duration: 0.55, ease: "power2.out" }, at);
      }
      function reveal(sel, at) {
        tl.set(sel, { opacity: 0 }, 0);
        tl.fromTo(sel, { y: 18, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.42, ease: "power2.out", immediateRender: false }, at);
      }

      IDS.forEach(function (id) { tl.set("#" + id, { opacity: 0.16 }, 0); });
      gsap.utils.toArray(".rule").forEach(function (r) { tl.set(r, { scaleX: 0 }, 0); });
      gsap.utils.toArray(".mk").forEach(function (m) { tl.set(m, { color: "inherit" }, 0); });

      tl.set("#foot", { opacity: 0 }, 0);
      tl.to("#foot", { opacity: 1, duration: 0.6, ease: "power2.out" }, 0.5);

%(tweens)s

      /* ── The close. The page carries on upward and out; it is not cut. ── */
      tl.to(col, { y: POS[POS.length - 1] - 260, duration: 1.0, ease: "power2.in" }, %(closein).2f - 0.70);
      tl.to("#viewport", { opacity: 0, duration: 0.5, ease: "power2.in" }, %(closein).2f - 0.55);
      tl.to("#foot",  { opacity: 0, duration: 0.3, ease: "power2.in" }, %(closein).2f - 0.55);
      tl.to("#spine", { opacity: 0, duration: 0.3, ease: "power2.in" }, %(closein).2f - 0.55);

      tl.set("#close",            { opacity: 1 }, %(closein).2f);
      tl.set("#close .tile",      { scale: 0.82 }, 0);
      tl.set("#close .wordmark",  { xPercent: -106 }, 0);
      tl.set("#close-rule",       { scaleX: 0 }, 0);
      tl.set("#close .close-url", { yPercent: 115 }, 0);
      tl.fromTo("#close", { y: 34 }, { y: 0, duration: 0.5, ease: "power3.out",
        immediateRender: false }, %(closein).2f);
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
              "blocks": "\n\n".join(blocks), "tweens": "\n".join(tweens),
              "spine": "\n".join(spine), "ids": json.dumps(ids)}
(P / "index.html").write_text(out, encoding="utf-8")
print("wrote index.html  (%d āyāt on one scrolling page, %.2fs)" % (len(V), DUR))
