"""Generate marketing/reels/recitations-trailer/index.html.

The page is GENERATED. Edit this file or script.json, never index.html.

Design comes from the reel series' own stylesheet (style.css, lifted from
../seeing-his-face). What this piece adds is the device: a drawn phone that
holds the app's real captured screens, and the screens entering as navigation
rather than as a slideshow.
"""
import io
import json
import pathlib
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

P = pathlib.Path(__file__).parent
DOC = json.loads((P / "script.json").read_text(encoding="utf-8"))
CSS = (P / "style.css").read_text(encoding="utf-8")

BEATS = DOC["beats"]
DUR = BEATS[-1]["to"]
SPEECH_END = DUR

for a, b in zip(BEATS, BEATS[1:]):
    assert abs(a["to"] - b["from"]) < 1e-9, "gap between %s and %s" % (a["id"], b["id"])

# The device plays ONE continuous recording of the app being used, not a
# sequence of stills. See record.mjs: the first cut of this trailer held four
# screenshots for seven seconds each, which is a slideshow of a product rather
# than a product.
VIDEO = DOC["session"]
assert (P / VIDEO["file"]).exists(), "missing session recording: " + VIDEO["file"]

blocks = []
for b in BEATS:
    lines = "".join(
        '\n            <div class="%s">%s</div>' % (ln.get("cls", "ln"), ln["text"])
        for ln in b.get("lines", []))
    extra = ""
    if b["id"] == "folder":
        extra = ('\n            <div class="files">%s</div>'
                 % "".join('<span class="fn">%s</span>' % f for f in DOC["folder"]))
    if b["id"] == "close":
        extra = (
            '\n            <div class="brand-row">'
            '<div class="tile"><span class="t">T</span></div>'
            '<div class="wm-clip"><div class="wordmark">TafsirLab</div></div></div>'
            '\n            <div class="cobrand"><div class="sgs-clip">'
            '<div class="sgs">Recitations</div></div></div>'
            '\n            <div class="close-rule" id="close-rule"></div>'
            '\n            <div class="url-clip"><div class="close-url">tafsir-lab.com</div></div>')
    blocks.append(
        '        <div class="beat" id="%s" data-layout-allow-overlap="true">'
        '<div class="bmv">%s%s</div></div>' % (b["id"], lines, extra))

screens_html = (
    '            <video class="scr" id="session" src="%s" muted'
    ' data-start="%.2f" data-duration="%.2f"></video>'
    % (VIDEO["file"], VIDEO["from"], VIDEO["duration"]))

enter_js = []
for b in BEATS:
    enter_js.append('        ["#%s", %6.2f, %6.2f, "%s"],'
                    % (b["id"], b["from"], b["to"], b["enter"]))

HTML = """<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1080, height=1920">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;0,7..72,700;1,7..72,500;1,7..72,600&amp;family=Source+Serif+4:ital,opsz,wght@1,8..60,500&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      /* %(banner)s */
%(css)s

      /* ── The device ───────────────────────────────────────── */
      /* Drawn, not photographed: a rounded rectangle, one dark bezel ring and
         one soft shadow. A photographic phone would drag in a second lighting
         model and a second set of materials, and the rest of this series is
         hairlines on paper. */
      /* The headline sits ABOVE the device, in its own band. The series'
         stage is centred in the frame, which is right when type is all there
         is and wrong the moment a phone is under it. The hook and the close
         carry no device, so they get the whole frame and centre in it. */
      .stage { top: 424px; height: 300px; }
      .stage-centre {
        position: absolute; left: 90px; right: 90px; top: 0; height: 1920px;
      }

      /* The device runs to the bottom edge of the frame rather than sitting
         inside it. A phone shown whole, with a margin all round, reads as a
         picture of a phone; one that leaves the frame reads as the thing in
         your hand. */
      .device {
        position: absolute; left: 50%%; top: 786px;
        width: 560px; height: 1134px; margin-left: -280px;
        border-radius: 60px; background: #fff; overflow: hidden;
        box-shadow: 0 0 0 9px #201d19, 0 36px 80px rgba(41, 38, 33, 0.20);
        opacity: 0;
      }
      .scr {
        position: absolute; left: 0; top: 0; width: 560px; display: block;
      }

      /* The hook: the archive as it is before the app — a folder listing. Set
         in the mono face the app itself uses for numbers, at a size you can
         read but would not want to scan. */
      .files {
        display: flex; flex-direction: column; gap: 16px;
        margin-top: 38px; align-items: flex-start; text-align: left;
      }
      .fn {
        font-family: "JetBrains Mono", ui-monospace, monospace;
        font-size: 34px; color: var(--rest); letter-spacing: -0.01em;
      }
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

        <div class="device" id="device">
%(screens)s
        </div>

        <div class="stage" id="stage">
%(topBlocks)s
        </div>
        <div class="stage-centre" id="stage-centre">
%(midBlocks)s
        </div>
      </div>

      <audio id="au-bed" data-start="0" data-duration="%(dur).2f" data-volume="1"
             src="%(bed)s"></audio>
    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const DUR = %(dur).2f;
      const tl = gsap.timeline({ paused: true });

      const BEATS = [
%(enter)s
      ];
      tl.set("#rail-fill", { scaleX: 0 }, 0);
      tl.to("#rail-fill", { scaleX: 1, duration: %(railEnd).2f, ease: "none" }, 0);
      tl.to(".rail", { opacity: 0, duration: 0.22, ease: "power2.in" }, %(chromeOut).2f);

      /* Every beat travels UP, as the rest of the series does: a spent line
         leaves through the top while its successor arrives from below, so a
         swap reads as one roll rather than two unrelated events. */
      const ENTER = {
        rise: { y: 46, ease: "power3.out",    duration: 0.36 },
        fast: { y: 34, ease: "power4.out",    duration: 0.24 },
        side: { y: 40, ease: "circ.out",      duration: 0.38 },
        slam: { y: 78, ease: "power4.out",    duration: 0.42 }
      };
      BEATS.forEach(([sel, from, to, kind], i) => {
        const mv = sel + " .bmv";
        const spec = ENTER[kind];
        tl.set(sel, { opacity: 0 }, 0);
        tl.set(sel, { opacity: 1 }, Math.max(0, from - 0.02));
        tl.fromTo(mv, { y: spec.y, opacity: 0 },
          { y: 0, opacity: 1, ease: spec.ease, duration: spec.duration,
            immediateRender: false }, Math.max(0, from - 0.02));
        if (i < BEATS.length - 1) {
          tl.to(mv, { y: -34, opacity: 0, duration: 0.16, ease: "power2.in" }, to - 0.16);
          tl.set(sel, { opacity: 0 }, to - 0.005);
        }
      });

      /* The device arrives once and stays for the whole tour; only what is on
         its screen changes. Bringing it back per beat would make it an
         illustration being shown, rather than a thing being used. */
      const DEV_IN = %(devIn).2f, DEV_OUT = %(devOut).2f;
      tl.set("#device", { opacity: 0, y: 70, scale: 0.94 }, 0);
      tl.to("#device", { opacity: 1, y: 0, scale: 1, duration: 0.62,
                         ease: "power3.out" }, DEV_IN);
      tl.to("#device", { opacity: 0, y: -40, scale: 0.97, duration: 0.42,
                         ease: "power2.in" }, DEV_OUT);

      /* Nothing is done to the screen: the recording is already the motion.
         Pushing stills around was the first cut's mistake -- the transitions
         were the only thing moving, so the app looked like a set of pictures
         being flicked through rather than a thing being used. */

      /* The close. Clips, not fades: fading a child inside a group that is
         itself fading compounds the two, and a half-opaque glyph measures as a
         contrast failure mid-entrance even though its resting state is 13:1. */
      const CLOSE_IN = %(closeIn).2f;
      tl.set("#close .tile", { scale: 0.7, opacity: 0 }, 0);
      tl.to("#close .tile", { scale: 1, opacity: 1, duration: 0.42,
                              ease: "back.out(1.6)" }, CLOSE_IN + 0.10);
      tl.set("#close .wordmark", { yPercent: 115 }, 0);
      tl.to("#close .wordmark", { yPercent: 0, duration: 0.46, ease: "power3.out" },
            CLOSE_IN + 0.26);
      tl.set("#close .sgs", { yPercent: 115 }, 0);
      tl.to("#close .sgs", { yPercent: 0, duration: 0.44, ease: "power3.out" },
            CLOSE_IN + 0.58);
      tl.set("#close-rule", { scaleX: 0 }, 0);
      tl.to("#close-rule", { scaleX: 1, duration: 0.42, ease: "power2.out" },
            CLOSE_IN + 0.90);
      tl.set("#close .close-url", { yPercent: 115 }, 0);
      tl.to("#close .close-url", { yPercent: 0, duration: 0.40, ease: "power3.out" },
            CLOSE_IN + 1.06);

      /* The folder listing lands one filename at a time — a list arriving is
         the shape of the problem, and it gives the opening beat something to
         do while it is being read. */
      tl.set(".fn", { opacity: 0, y: 14 }, 0);
      tl.to(".fn", { opacity: 1, y: 0, duration: 0.28, ease: "power2.out",
                     stagger: 0.30 }, 1.15);

      tl.seek(0);
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
"""

banner = ("recitations-trailer — %.1fs, 1080×1920, LIGHT. "
          "A product trailer for Recitations, a Tafsir Lab tool. "
          "Generated by build.py; edit the data, not this." % DUR)

dev_in = VIDEO["from"] - 0.35
dev_out = next(b["from"] for b in BEATS if b["id"] == "close") - 0.45

out = HTML % {
    "banner": banner,
    "css": CSS.rstrip(),
    "dur": DUR,
    "bed": DOC["bed"]["file"],
    "screens": screens_html,
    "topBlocks": "\n".join(b for i, b in enumerate(blocks) if "shows" in BEATS[i]),
    "midBlocks": "\n".join(b for i, b in enumerate(blocks) if "shows" not in BEATS[i]),
    "enter": "\n".join(enter_js),
    "devIn": dev_in,
    "devOut": dev_out,
    "closeIn": BEATS[-1]["from"],
    "railEnd": dev_out + 0.45,
    "chromeOut": dev_out + 0.10,
}
(P / "index.html").write_text(out, encoding="utf-8")
print("wrote index.html  (%d beats, %.1fs of session, %.2fs)"
      % (len(BEATS), VIDEO["duration"], DUR))
