"""Generate marketing/reels/everything-you-do/index.html.

Three inputs, none of them this file:
  transcript.json — the measured word list, from the rendered audio
  script.json     — which words sit on which line, in which beat, and what the
                    ochre bar marks
  style.css       — the design, which is the sibling reel's verbatim

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
ARWORDS = TR["arabic"]["words"]
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
GLYPH = {'salah': '<path class="ic-ink" d="M24 84 V46 a24 24 0 0 1 48 0 V84"/><line class="ic-ink" x1="14" y1="84" x2="82" y2="84"/><path class="ic-acc" d="M38 84 V50 a10 10 0 0 1 20 0 V84"/>', 'beads': '<circle class="ic-acc" cx="74" cy="42" r="4"/><circle class="ic-acc" cx="70.5" cy="29" r="4"/><circle class="ic-acc" cx="61" cy="19.5" r="4"/><circle class="ic-acc" cx="48" cy="16" r="4"/><circle class="ic-acc" cx="35" cy="19.5" r="4"/><circle class="ic-acc" cx="25.5" cy="29" r="4"/><circle class="ic-acc" cx="22" cy="42" r="4"/><circle class="ic-acc" cx="25.5" cy="55" r="4"/><circle class="ic-acc" cx="35" cy="64.5" r="4"/><circle class="ic-acc" cx="61" cy="64.5" r="4"/><circle class="ic-acc" cx="70.5" cy="55" r="4"/><circle class="ic-ink" cx="48" cy="68" r="5"/><line class="ic-ink" x1="48" y1="73" x2="48" y2="86"/>', 'crescent': '<path class="ic-ink" d="M62 14 A34 34 0 1 0 62 80 A26 26 0 1 1 62 14 Z"/>', 'kaaba': '<rect class="ic-ink" x="26" y="24" width="44" height="58"/><line class="ic-acc" x1="26" y1="40" x2="70" y2="40"/><rect class="ic-acc" x="52" y="60" width="11" height="22"/>', 'sunrise': '<path class="ic-ink" d="M28 70 A20 20 0 0 1 68 70"/><line class="ic-ink" x1="12" y1="70" x2="84" y2="70"/><line class="ic-acc" x1="48" y1="34" x2="48" y2="24"/><line class="ic-acc" x1="24" y1="48" x2="17" y2="41"/><line class="ic-acc" x1="72" y1="48" x2="79" y2="41"/>'}

blocks = []
for b in BEATS:
    if "hero" in b:
        h = b["hero"]
        # The Arabic is built from word spans now, so a card with no range is a
        # card that renders EMPTY -- which is exactly what shipped when two
        # beats were keyed ha1/ha2 and the word table called them a1/a2.
        assert "arRange" in h, "hero %s has no arRange: its card would be blank" % b["id"]
        blocks.append(
            '        <div class="beat" id="%s" data-layout-allow-overlap="true">\n'
            '          <div class="bmv">\n'
            '            <div class="%s" dir="rtl" lang="ar"%s id="%s-ar"></div>\n'
            '            <div class="hero-rule" id="%s-rule"></div>\n'
            '            <div class="hero-en">%s</div>\n'
            '          </div>\n'
            '        </div>' % (b["id"], h.get("cls", "hero-ar"),
                                (' style="font-size:%dpx"' % h["sizePx"]) if "sizePx" in h else "",
                                b["id"], b["id"], h["en"]))
    elif b["id"] == "close":
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
                         % (b["id"], ic["key"])) if ic["labelRange"] else ""
                cells.append(
                    '            <div class="ic" id="ic-%s-%s">'
                    '<svg viewBox="0 0 96 96" width="152" height="152">%s</svg>%s</div>'
                    % (b["id"], ic["key"], GLYPH[ic["key"]], label))
            inner = ('\n          <div class="icons">\n%s\n          </div>\n        '
                     % "\n".join(cells))
        blocks.append(
            '        <div class="beat" id="%s" data-layout-allow-overlap="true">'
            '<div class="bmv">%s</div></div>' % (b["id"], inner))


lines_js = []
for b in BEATS:
    for ic in b.get("icons", []):
        if ic["labelRange"]:
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

arwords_js = []
for i in range(0, len(ARWORDS), 3):
    row = ", ".join('[%.2f, %.2f, %s]' % (w[0], w[1], json.dumps(w[2], ensure_ascii=False))
                    for w in ARWORDS[i:i + 3])
    arwords_js.append("        " + row + ",")

arlines_js = []
for b in BEATS:
    h = b.get("hero")
    if h and "arRange" in h:
        arlines_js.append('        { host: "#%s-ar", range: [%d, %d] },'
                          % (b["id"], h["arRange"][0], h["arRange"][1]))

icon_js = []
for b in BEATS:
    for ic in b.get("icons", []):
        icon_js.append('        ["#ic-%s-%s", %.2f],' % (b["id"], ic["key"], ic["at"]))

hero_js = []
for b in BEATS:
    if "hero" in b:
        h = b["hero"]
        hero_js.append('        ["#%s", %.2f, %.2f],'
                       % (b["id"], b["from"] + 0.08, h["enAt"]))

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

        <div class="bookwrap" id="book" aria-hidden="true">
          <svg viewBox="0 0 330 196" width="418" height="248">
            <g id="bk-l">
              <path class="bk-cover" d="M162 26 C126 10 74 5 26 12 L26 170 C74 163 126 168 162 184 Z"/>
              <g class="bk-lines" id="bk-ll">
                <line x1="48" y1="52" x2="140" y2="47"/>
                <line x1="48" y1="78" x2="140" y2="73"/>
                <line x1="48" y1="104" x2="122" y2="100"/>
              </g>
            </g>
            <g id="bk-r">
              <path class="bk-cover" d="M168 26 C204 10 256 5 304 12 L304 170 C256 163 204 168 168 184 Z"/>
              <g class="bk-lines" id="bk-rl">
                <line x1="190" y1="47" x2="282" y2="52"/>
                <line x1="190" y1="73" x2="282" y2="78"/>
                <line x1="190" y1="100" x2="264" y2="104"/>
              </g>
            </g>
            <line class="bk-spine" id="bk-spine" x1="165" y1="24" x2="165" y2="186"/>
          </svg>
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

      /* The Arabic he recites, word by word. Same shape as WORDS and driven
         by the same envelope: the recitation is what animates these cards. */
      const AR = [
%(arwords)s
      ];
      const AR_LINES = [
%(arlines)s
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

      const arEls = new Array(AR.length).fill(null);
      /* Built the same way as a caption line so the ink driver can treat both
         alike. RTL is the container's job -- the spans go in source order and
         the browser lays them right to left. */
      for (const spec of AR_LINES) {
        const host = document.querySelector(spec.host);
        const [from, to] = spec.range;
        for (let i = from; i <= to; i++) {
          const outer = document.createElement("span");
          outer.className = "w";
          const inner = document.createElement("i");
          inner.className = "wi";
          inner.style.fontStyle = "normal";
          inner.textContent = AR[i][2];
          outer.appendChild(inner);
          arEls[i] = inner;
          host.appendChild(outer);
          if (i < to) host.appendChild(document.createTextNode(" "));
        }
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

      /* The hadith cards: the Arabic first, then the transliteration, then
         what it means -- the phrase before its gloss. The gloss lands on the
         word he says it with, so the card reads at his pace and not the
         page's. */
      const HEROES = [
%(heroes)s
      ];
      HEROES.forEach(([h, tRule, tEn]) => {
        tl.set(h + " .hero-rule", { scaleX: 0 }, 0);
        tl.to(h + " .hero-rule", { scaleX: 1, duration: 0.38, ease: "power2.out" }, tRule);
        /* An explicit hidden state at t=0. The card's parent is on screen
           before these two lines are, and a fromTo with immediateRender:false
           paints nothing until its own start -- so without this they simply
           sit there at full opacity. Opacity, not display, so the Arabic
           above them does not move when they arrive. */
        tl.set(h + " .hero-en", { opacity: 0 }, 0);
        tl.fromTo(h + " .hero-en", { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.28, ease: "power2.out", immediateRender: false }, tEn);
      });

      /* Each drawn mark arrives as he names the thing: he is listing, and a
         list read out loud arrives one item at a time. They stay once in, so
         by the end of the line all four are on the page together and the list
         can be seen as a whole. */
      const ICONS = [
%(icons)s
      ];
      ICONS.forEach(([sel, at]) => {
        tl.set(sel, { opacity: 0, scale: 0.7, y: 14 }, 0);
        tl.to(sel, { opacity: 1, scale: 1, y: 0, duration: 0.34,
                     ease: "back.out(1.7)" }, at);
      });

      /* The book, beside the sourcing. It opens as he names the collection and
         shuts as he hands over to the hadith itself. The two covers swing out
         from the spine and the ruled lines draw on afterwards, so it reads as
         a book being opened rather than a picture of one fading up.

         svgOrigin, not transformOrigin: on an SVG group the percentage form is
         resolved against the element's own bounding box, which for the left
         cover is nowhere near the spine — it would swing from its outer edge. */
      const BOOK_IN  = %(bookIn).2f;
      const BOOK_OUT = %(bookOut).2f;
      tl.set("#book", { opacity: 0 }, 0);
      tl.to("#book", { opacity: 1, duration: 0.26, ease: "power2.out" }, BOOK_IN);
      tl.set("#bk-spine", { scaleY: 0, svgOrigin: "165 105" }, 0);
      tl.to("#bk-spine", { scaleY: 1, duration: 0.30, ease: "power2.out" }, BOOK_IN + 0.04);
      ["#bk-l", "#bk-r"].forEach((g) => {
        tl.set(g, { scaleX: 0.03, svgOrigin: "165 105" }, 0);
        tl.to(g, { scaleX: 1, duration: 0.66, ease: "power3.out" }, BOOK_IN + 0.20);
      });
      tl.set(".bk-lines line", { scaleX: 0, transformOrigin: "0%% 50%%" }, 0);
      tl.to(".bk-lines line", { scaleX: 1, duration: 0.42, ease: "power2.out",
                                stagger: 0.10 }, BOOK_IN + 0.76);
      /* It shuts the way it opened, and is gone before the hadith card lands. */
      ["#bk-l", "#bk-r"].forEach((g) => {
        tl.to(g, { scaleX: 0.03, duration: 0.34, ease: "power2.in" }, BOOK_OUT - 0.46);
      });
      tl.to("#book", { opacity: 0, duration: 0.20, ease: "power2.in" }, BOOK_OUT - 0.20);

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
          paint(AR, arEls);
        }
      }, 0);

      tl.seek(0);
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
"""

banner = ("everything-you-do — %.1fs, 1080×1920, LIGHT. "
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
    "arwords": "\n".join(arwords_js),
    "arlines": "\n".join(arlines_js),
    "lines": "\n".join(lines_js),
    "beats": "\n".join(beats_js),
    "sweeps": "\n".join(sweep_js),
    "icons": "\n".join(icon_js),
    "heroes": "\n".join(hero_js),
    "closeIn": BEATS[-1]["from"],
    "bookIn": DOC["book"]["from"],
    "bookOut": DOC["book"]["to"],
    "footL": "An introduction to Tawḥīd",
    "footR": "TafsirLab × SGS ISOC",
}
(P / "index.html").write_text(out, encoding="utf-8")
print("wrote index.html  (%d beats, %d words captioned of %d, %.2fs)"
      % (len(BEATS), len(claimed), len(WORDS), DUR))
