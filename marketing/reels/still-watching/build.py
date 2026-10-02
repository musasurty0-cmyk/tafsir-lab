"""Generate marketing/reels/still-watching/index.html.

Three inputs, none of them this file:
  transcript.json — the measured word list, from the rendered audio
  script.json     — which words sit on which line, in which beat, and what the
                    ochre bar marks
  style.css       — the design: the sibling reel's, plus the motion the new
                    marks need

The page is GENERATED. Edit the data or this generator, never index.html.
"""
import io
import json
import pathlib
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

P = pathlib.Path(__file__).parent
TR = json.loads((P / "transcript.json").read_text(encoding="utf-8"))
WORDS = TR["words"]
DOC = json.loads((P / "script.json").read_text(encoding="utf-8"))
CSS = (P / "style.css").read_text(encoding="utf-8")

BEATS = DOC["beats"]
DUR = BEATS[-1]["to"]
SPEECH_END = DOC["audio"]["speechEnd"]

# Every word a line claims must exist, and no word may be claimed twice: a
# caption that says one thing while the karaoke lights another is the failure
# this check exists to make impossible.
claimed = {}
for b in BEATS:
    for ln in b.get("lines", []):
        lo, hi = ln["range"]
        assert 0 <= lo <= hi < len(WORDS), "range %s outside the word list" % (ln["range"],)
        for i in range(lo, hi + 1):
            assert i not in claimed, "word %d claimed by %s and %s" % (i, claimed[i], b["id"])
            claimed[i] = b["id"]
        if "mark" in ln:
            m0, m1 = ln["mark"]
            assert lo <= m0 <= m1 <= hi, "mark %s outside its line %s" % (ln["mark"], ln["range"])

# Beats must tile: no gap to cut into, no overlap to collide in.
for a, b in zip(BEATS, BEATS[1:]):
    assert abs(a["to"] - b["from"]) < 1e-9, "gap between %s and %s" % (a["id"], b["id"])

# The drawn marks, as SVG. Defined here because the block loop below builds
# them into the page before anything else needs them.
GLYPH = {
    # A mihrab: the niche a congregation prays towards. From the sibling reel.
    "salah": '<path class="ic-ink" d="M24 84 V46 a24 24 0 0 1 48 0 V84"/><line class="ic-ink" x1="14" y1="84" x2="82" y2="84"/><path class="ic-acc" d="M38 84 V50 a10 10 0 0 1 20 0 V84"/>',
    # A mushaf open on its rehal, the folding X-stand it is read from.
    "rehal": '<path class="ic-ink" d="M12 36 C26 30 38 30 48 37 C58 30 70 30 84 36 L84 50 C70 44 58 44 48 51 C38 44 26 44 12 50 Z"/><line class="ic-ink" x1="48" y1="37" x2="48" y2="51"/><line class="ic-acc" x1="26" y1="56" x2="66" y2="86"/><line class="ic-acc" x1="70" y1="56" x2="30" y2="86"/>',
    # The watchers: three figures, each its own group so they can leave one
    # at a time when he says "nobody".
    "people": '<g class="fig"><circle class="ic-acc" cx="22" cy="46" r="7"/><path class="ic-acc" d="M9 74 a13 13 0 0 1 26 0"/></g><g class="fig"><circle class="ic-ink" cx="48" cy="36" r="8"/><path class="ic-ink" d="M33 68 a15 15 0 0 1 30 0"/></g><g class="fig"><circle class="ic-acc" cx="74" cy="46" r="7"/><path class="ic-acc" d="M61 74 a13 13 0 0 1 26 0"/></g>',
    # A count of five, drawn one stroke per word as he counts.
    "tally": '<line class="ic-ink tl" x1="24" y1="22" x2="24" y2="74"/><line class="ic-ink tl" x1="38" y1="22" x2="38" y2="74"/><line class="ic-ink tl" x1="52" y1="22" x2="52" y2="74"/><line class="ic-ink tl" x1="66" y1="22" x2="66" y2="74"/><line class="ic-acc tl" x1="12" y1="62" x2="78" y2="32"/>',
    # A window, with three ochre strokes inside it that leave through it.
    "window": '<rect class="ic-ink" x="22" y="14" width="52" height="68" rx="2"/><line class="ic-ink" x1="48" y1="14" x2="48" y2="82"/><line class="ic-ink" x1="22" y1="48" x2="74" y2="48"/><line class="ic-acc fl" x1="32" y1="24" x2="32" y2="40"/><line class="ic-acc fl" x1="38" y1="58" x2="38" y2="74"/><line class="ic-acc fl" x1="62" y1="26" x2="62" y2="42"/>',
    # Renewal: a circle that comes back round on itself. The head sits on the
    # arc's own tangent at its end, so it points the way the line was drawn.
    "renew": '<path class="ic-ink rn" d="M74 48 A26 26 0 1 1 64 27.5"/><path class="ic-acc rn" d="M59.9 16.2 L64 27.5 L52.1 26.3"/>',
}

blocks = []
for b in BEATS:
    if b["id"] == "close":
        blocks.append(
            '        <div class="beat" id="close" data-layout-allow-overlap="true">\n'
            '          <div class="bmv">\n'
            '            <div class="brand-row">\n'
            '              <div class="tile"><span class="t">T</span></div>\n'
            '              <div class="wm-clip"><div class="wordmark">TafsirLab</div></div>\n'
            '            </div>\n'
            '            <div class="cobrand">\n'
            '              <div class="xm">&#215;</div>\n'
            '              <div class="sgs-clip"><div class="sgs">SGS ISOC</div></div>\n'
            '            </div>\n'
            '            <div class="close-rule" id="close-rule"></div>\n'
            '            <div class="url-clip"><div class="close-url">tafsir-lab.com</div></div>\n'
            '          </div>\n'
            '        </div>')
    else:
        inner = ""
        if "icons" in b:
            cells = []
            for ic in b["icons"]:
                label = ('<div class="ic-label" id="icl-%s-%s"></div>'
                         % (b["id"], ic["key"])) if ic.get("labelRange") else ""
                cells.append(
                    '            <div class="ic" id="ic-%s-%s">'
                    '<svg viewBox="0 0 96 96" width="184" height="184">%s</svg>%s</div>'
                    % (b["id"], ic["key"], GLYPH[ic["key"]], label))
            inner = ('\n          <div class="icons">\n%s\n          </div>\n        '
                     % "\n".join(cells))
        blocks.append(
            '        <div class="beat" id="%s" data-layout-allow-overlap="true">'
            '<div class="bmv">%s</div></div>' % (b["id"], inner))


lines_js = []
for b in BEATS:
    for ic in b.get("icons", []):
        if ic.get("labelRange"):
            lines_js.append('        { host: "#icl-%s-%s", cls: "ic-label", range: [%d, %d] },'
                            % (b["id"], ic["key"], ic["labelRange"][0], ic["labelRange"][1]))
    for ln in b.get("lines", []):
        mark = ', mark: [%d, %d]' % tuple(ln["mark"]) if "mark" in ln else ""
        lines_js.append('        { beat: "%s", cls: "%s", range: [%d, %d]%s },'
                        % (b["id"], ln["cls"], ln["range"][0], ln["range"][1], mark))

beats_js = []
for b in BEATS:
    beats_js.append('        { el: "#%s", from: %6.2f, to: %6.2f, enter: "%s" },'
                    % (b["id"], b["from"], b["to"], b["enter"]))

words_js = []
for i in range(0, len(WORDS), 3):
    row = ", ".join('[%.2f, %.2f, %s]' % (w[0], w[1], json.dumps(w[2], ensure_ascii=False))
                    for w in WORDS[i:i + 3])
    words_js.append("        " + row + ",")

icon_js = []
for b in BEATS:
    for ic in b.get("icons", []):
        icon_js.append('        ["#ic-%s-%s", %.2f],' % (b["id"], ic["key"], ic["at"]))

# The marks that do more than arrive. Each is keyed by what it does, and the
# times come from script.json -- which come from the word table.
fx_js = []
for b in BEATS:
    for ic in b.get("icons", []):
        sel = "#ic-%s-%s" % (b["id"], ic["key"])
        fx = ic.get("fx")
        if fx == "tally":
            fx_js.append('      tally("%s", %s, %.2f);' % (sel, json.dumps(ic["strokes"]), ic["dimAt"]))
        elif fx == "fly":
            fx_js.append('      fly("%s", %.2f, %.2f);' % (sel, ic["flyFrom"], ic["flyTo"]))
        elif fx == "draw":
            fx_js.append('      draw("%s", %.2f, %.2f);' % (sel, ic["at"], ic["drawFor"]))
        elif fx == "leave":
            fx_js.append('      leave("%s", %.2f);' % (sel, ic["leaveAt"]))
        else:
            assert fx is None, "unknown fx %r" % fx

sweep_js = []
for b in BEATS:
    for ln in b.get("lines", []):
        if "mark" in ln:
            m0, m1 = ln["mark"]
            sweep_js.append('      sweep("#mkbar-%s", %.2f, %.2f);'
                            % (b["id"], WORDS[m0][0], WORDS[m1][1]))

HTML = """<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1080, height=1920">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;0,7..72,700;1,7..72,500;1,7..72,600&amp;family=Source+Serif+4:ital,opsz,wght@1,8..60,500&amp;family=Amiri:wght@400;700&amp;family=Scheherazade+New:wght@400;700&amp;display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      /* %(banner)s */
%(css)s
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="%(dur).2f"
         data-fps="30" data-width="1080" data-height="1920">
      <div id="scene" class="clip" data-start="0" data-duration="%(dur).2f" data-track-index="1">

        <div class="paper"></div>
        <div class="dots"></div>

        <div class="rail">
          <div class="rail-track"><div class="rail-fill" id="rail-fill"></div></div>
        </div>

        <div class="stage" id="stage">
%(blocks)s
        </div>

        <div class="foot" id="foot">
          <span>%(footL)s</span>
          <span>%(footR)s</span>
        </div>
      </div>

      <audio id="au-voice" data-start="0" data-duration="%(speech).2f" data-volume="1"
             src="%(audio)s"></audio>

      <!-- The nasheed, 16.3 LU under him: present enough to carry the paper
           between beats, never near competing with what he is saying. -->
      <audio id="au-bed" data-start="0" data-duration="%(dur).2f" data-volume="1"
             src="%(bed)s"></audio>
    </div>

    <script>
      window.__timelines = window.__timelines || {};

      /* The words he says, with the time he says each one. Measured from the
         rendered audio, not authored: see build.py. */
      const WORDS = [
%(words)s
      ];

      /* Which words sit on which line. `range` is inclusive and indexes
         WORDS, so a caption can never say one thing while the driver lights
         another. `mark` is the sub-range the ochre bar underlines. */
      const LINES = [
%(lines)s
      ];

      const BEATS = [
%(beats)s
      ];

      const DUR = %(dur).2f;
      const SPEECH_END = %(speech).2f;
      const tl = gsap.timeline({ paused: true });

      const stage = document.getElementById("stage");
      const wordEls = new Array(WORDS.length).fill(null);

      function makeWord(i) {
        const outer = document.createElement("span");
        outer.className = "w";
        const inner = document.createElement("i");
        inner.className = "wi";
        inner.style.fontStyle = "normal";
        inner.textContent = WORDS[i][2];
        outer.appendChild(inner);
        wordEls[i] = inner;
        return outer;
      }

      for (const spec of LINES) {
        /* A line normally goes into its beat; a mark's label is already a
           node of its own, and the word spans are built straight into it. */
        const host = spec.host ? document.querySelector(spec.host)
                               : document.querySelector("#" + spec.beat + " .bmv");
        const line = spec.host ? host : document.createElement("div");
        if (!spec.host) line.className = spec.cls;

        const [from, to] = spec.range;
        const mk = spec.mark || null;
        let markHost = null;

        for (let i = from; i <= to; i++) {
          const inMark = mk && i >= mk[0] && i <= mk[1];
          if (mk && i === mk[0]) {
            markHost = document.createElement("span");
            markHost.className = "mk";
            line.appendChild(markHost);
          }
          (inMark ? markHost : line).appendChild(makeWord(i));
          if (inMark && i === mk[1]) {
            const bar = document.createElement("span");
            bar.className = "mk-bar";
            bar.id = "mkbar-" + spec.beat;
            markHost.appendChild(bar);
          }
          /* A space BETWEEN two marked words belongs inside the marked run, or
             the two collide ("noreason"). The space that ENDS the run belongs
             to the line, or the underline stretches past what it marks. */
          if (i < to) {
            const nextInMark = mk && (i + 1) >= mk[0] && (i + 1) <= mk[1];
            (inMark && nextInMark ? markHost : line)
              .appendChild(document.createTextNode(" "));
          }
        }
        if (!spec.host) {
          const row = host.querySelector(".icons");
          if (row) host.insertBefore(line, row); else host.appendChild(line);
        }
      }

      /* The rail advances with the recording, and the foot sits under it.
         Both leave before the card lands, so the mark is alone on the paper
         and the foot's wordmark is not under a second one saying the same. */
      tl.set("#rail-fill", { scaleX: 0 }, 0);
      tl.to("#rail-fill", { scaleX: 1, duration: SPEECH_END, ease: "none" }, 0);
      tl.to(".rail", { opacity: 0, duration: 0.22, ease: "power2.in" }, SPEECH_END + 0.20);

      tl.set("#foot", { opacity: 0 }, 0);
      tl.to("#foot", { opacity: 1, duration: 0.5, ease: "power2.out" }, 0.4);
      tl.to("#foot", { opacity: 0, duration: 0.22, ease: "power2.in" }, SPEECH_END + 0.20);

      /* Distinct entrance per beat, but all of them travel UP: a spent beat
         leaves through the top while its successor arrives from below, so a
         swap reads as one roll rather than two unrelated events. */
      const ENTER = {
        words: { y: 0,  ease: "power3.out",    duration: 0.30 },
        rise:  { y: 46, ease: "power3.out",    duration: 0.34 },
        fast:  { y: 34, ease: "power4.out",    duration: 0.22 },
        side:  { y: 40, ease: "circ.out",      duration: 0.36 },
        tilt:  { y: 52, ease: "power3.out",    duration: 0.38 },
        hero:  { y: 64, ease: "back.out(1.5)", duration: 0.42 },
        slam:  { y: 78, ease: "power4.out",    duration: 0.40 }
      };

      BEATS.forEach((b, bi) => {
        const mv = "#" + b.el.slice(1) + " .bmv";
        /* A beat's last word ends where the next beat's first word starts, so
           there is no silent gap to cut in. The spent beat leaves in the 0.14s
           before the boundary -- four frames early on a word the eye has
           already read, which is how any subtitle sets its out-point -- and
           the new one starts two frames later. Overlap is under one frame. */
        const inAt  = Math.max(0, b.from - 0.02);
        const outAt = b.to - 0.14;
        const spec  = ENTER[b.enter];

        if (b.enter === "words") {
          /* The opening beat has no predecessor to roll off, so its entrance
             IS the speech: each word lifts as he says it. */
          tl.set(b.el, { opacity: 1 }, 0);
          const first = LINES.find((l) => l.beat === b.el.slice(1));
          const last  = LINES.filter((l) => l.beat === b.el.slice(1)).pop();
          for (let i = first.range[0]; i <= last.range[1]; i++) {
            if (!wordEls[i]) continue;
            const at = Math.max(0, WORDS[i][0] - 0.05);
            /* Hidden from t=0. A fromTo with immediateRender:false paints
               nothing before its own start, so without this every word sat on
               the card at full size before he said it, then dropped and rose. */
            tl.set(wordEls[i].parentElement, { y: 52, opacity: 0 }, 0);
            tl.fromTo(wordEls[i].parentElement, { y: 52, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.30, ease: "power3.out",
                immediateRender: false }, at);
          }
        } else {
          tl.set(b.el, { opacity: 0 }, 0);
          tl.set(b.el, { opacity: 1 }, inAt);
          tl.fromTo(mv, { y: spec.y, opacity: 0 },
            { y: 0, opacity: 1, ease: spec.ease, duration: spec.duration,
              immediateRender: false }, inAt);
        }

        /* The last beat holds to the final frame -- a climax that scaled back
           out would take the line away before it had been read. */
        if (bi < BEATS.length - 1) {
          tl.to(mv, { y: -34, opacity: 0, duration: 0.14, ease: "power2.in" }, outAt);
          tl.set(b.el, { opacity: 0 }, b.to - 0.005);
        }
      });

      /* The ochre marker, under the words the sentence turns on. It draws
         across exactly the span of time he spends saying them. */
      function sweep(id, from, to) {
        tl.set(id, { scaleX: 0 }, 0);
        tl.to(id, { scaleX: 1, duration: Math.max(0.18, to - from),
                    ease: "power1.out" }, from);
      }
%(sweeps)s

      /* Each drawn mark arrives as he names the thing. They stay once in, so
         by the end of the line the act and its watchers are on the page
         together and can be read as one picture. */
      const ICONS = [
%(icons)s
      ];
      ICONS.forEach(([sel, at]) => {
        tl.set(sel, { opacity: 0, scale: 0.7, y: 14 }, 0);
        tl.to(sel, { opacity: 1, scale: 1, y: 0, duration: 0.34,
                     ease: "back.out(1.7)" }, at);
      });

      /* A stroke drawn on, rather than faded up: the dash is the path's own
         length, offset by all of it, and run down to nothing. */
      function hideStroke(el) {
        const len = el.getTotalLength();
        tl.set(el, { strokeDasharray: len, strokeDashoffset: len }, 0);
        return len;
      }

      /* The count. One stroke per word as he counts the prayers up, and the
         whole tally greys out on "doesn't matter" -- the number is still
         there, it has just stopped counting for anything. */
      function tally(sel, times, dimAt) {
        document.querySelectorAll(sel + " .tl").forEach((el, k) => {
          hideStroke(el);
          tl.to(el, { strokeDashoffset: 0, duration: 0.16, ease: "power2.out" }, times[k]);
        });
        tl.to(sel + " svg", { opacity: 0.26, duration: 0.5, ease: "power2.out" }, dimAt);
      }

      /* Out the window: the three strokes inside it leave through the glass,
         one after another, while he says it. */
      function fly(sel, from, to) {
        const els = document.querySelectorAll(sel + " .fl");
        const step = (to - from - 0.5) / Math.max(1, els.length - 1);
        els.forEach((el, k) => {
          tl.to(el, { x: 96 - k * 10, y: -30 + k * 8, rotation: 50, opacity: 0,
                      transformOrigin: "50%% 50%%", duration: 0.5,
                      ease: "power2.in" }, from + k * step);
        });
      }

      /* Renew: the circle draws itself round, then the head lands on it. */
      function draw(sel, at, dur) {
        const [arc, head] = document.querySelectorAll(sel + " .rn");
        hideStroke(arc); hideStroke(head);
        tl.to(arc, { strokeDashoffset: 0, duration: dur, ease: "power2.inOut" }, at);
        tl.to(head, { strokeDashoffset: 0, duration: 0.18, ease: "power2.out" }, at + dur - 0.04);
      }

      /* "Nobody is with us": the watchers from the two earlier cards are on
         the page as the line starts, and leave as he says the word. */
      function leave(sel, at) {
        tl.to(sel + " .fig", { y: 16, opacity: 0, duration: 0.42,
                               ease: "power2.in", stagger: 0.12 }, at);
      }
%(fx)s

      /* The close. Both reveals are clips, not fades: fading a child inside a
         group that is itself fading compounds the two, and a half-opaque
         glyph measures as a contrast failure mid-entrance even though its
         resting state is 13:1. A clip slides at full ink the whole way. */
      const CLOSE_IN = %(closeIn).2f;
      tl.set("#close .tile", { scale: 0.7, opacity: 0 }, 0);
      tl.to("#close .tile", { scale: 1, opacity: 1, duration: 0.42,
                              ease: "back.out(1.6)" }, CLOSE_IN + 0.10);
      tl.set("#close .wordmark", { yPercent: 115 }, 0);
      tl.to("#close .wordmark", { yPercent: 0, duration: 0.46, ease: "power3.out" },
            CLOSE_IN + 0.26);
      tl.set("#close .xm", { opacity: 0 }, 0);
      tl.to("#close .xm", { opacity: 1, duration: 0.30, ease: "power2.out" },
            CLOSE_IN + 0.62);
      tl.set("#close .sgs", { yPercent: 115 }, 0);
      tl.to("#close .sgs", { yPercent: 0, duration: 0.44, ease: "power3.out" },
            CLOSE_IN + 0.70);
      tl.set("#close-rule", { scaleX: 0 }, 0);
      tl.to("#close-rule", { scaleX: 1, duration: 0.42, ease: "power2.out" },
            CLOSE_IN + 1.02);
      tl.set("#close .close-url", { yPercent: 115 }, 0);
      tl.to("#close .close-url", { yPercent: 0, duration: 0.40, ease: "power3.out" },
            CLOSE_IN + 1.18);

      /* ONE linear driver for every word: it writes COLOUR ONLY. No glow (a
         dark-mode device, wrong on paper) and no per-word scale (half a pixel
         a frame under a large serif is the sub-pixel shimmer this project has
         already had to remove twice). Ink is enough.

         Three states, each legible on its own: not yet spoken (3.9:1), spoken
         and settled (5.4:1), being spoken (13:1). */
      const ATTACK = 0.05;
      const RELEASE = 0.34;
      const REST_LEVEL = 0.35;
      const REST_RGB = { r: 0x7e, g: 0x7a, b: 0x6f };
      const INK_RGB  = { r: 0x29, g: 0x26, b: 0x21 };

      function envelope(t, start, end) {
        if (t < start) return 0;
        if (t < end) return Math.min((t - start) / ATTACK, 1);
        const releaseEnd = end + RELEASE;
        if (t < releaseEnd) return 1 - ((t - end) / RELEASE) * (1 - REST_LEVEL);
        return REST_LEVEL;
      }
      function chan(a, b, t) { return Math.round(a + (b - a) * t); }

      const driver = { t: 0 };
      tl.to(driver, {
        t: DUR, duration: DUR, ease: "none",
        onUpdate: () => {
          const paint = (tbl, els) => {
            for (let i = 0; i < tbl.length; i++) {
              const el = els[i];
              if (!el) continue;
              const e = envelope(driver.t, tbl[i][0], tbl[i][1]);
              el.style.color = "rgb(" + chan(REST_RGB.r, INK_RGB.r, e) + ","
                                      + chan(REST_RGB.g, INK_RGB.g, e) + ","
                                      + chan(REST_RGB.b, INK_RGB.b, e) + ")";
            }
          };
          paint(WORDS, wordEls);
        }
      }, 0);

      tl.seek(0);
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
"""

banner = ("still-watching — %.1fs, 1080×1920, LIGHT. "
          "TafsirLab × SGS ISOC. Generated by build.py; edit the data, not this."
          % DUR)

out = HTML % {
    "banner": banner,
    "css": CSS.rstrip(),
    "dur": DUR,
    "speech": SPEECH_END,
    "audio": DOC["audio"]["file"],
    "bed": DOC["bed"]["file"],
    "blocks": "\n".join(blocks),
    "words": "\n".join(words_js),
    "lines": "\n".join(lines_js),
    "beats": "\n".join(beats_js),
    "sweeps": "\n".join(sweep_js),
    "icons": "\n".join(icon_js),
    "fx": "\n".join(fx_js),
    "closeIn": BEATS[-1]["from"],
    "footL": DOC["title"],
    "footR": "TafsirLab × SGS ISOC",
}
(P / "index.html").write_text(out, encoding="utf-8")
print("wrote index.html  (%d beats, %d words captioned of %d, %.2fs)"
      % (len(BEATS), len(claimed), len(WORDS), DUR))
