"""
Cut the khutbah excerpt: six segments from three clips of one khutbah, in the
order the khutbah itself argues them.

  A  3  the premise   worship is not worship without tawhid
  B  8  the question  so what does living la ilaha illa Allah look like?
  C  8  the hadith    innama l-a'malu bi-n-niyyat
  D  7  the examples  sleeping for fajr, revising for the ummah
  E  7  the bridge    these could be your intention in everything you do
  F  7  the close     Islam exists in everything you do

Per-clip gain matches the three to a common level first (they were recorded in
one sitting but exported separately: -21.8 / -22.7 / -23.5 LUFS), so no join
lands on a step in loudness.
"""
import pathlib
import subprocess
import sys

SRC = "C:/Users/musas/Downloads/cleaned-video (%d).mp4"
OUT = pathlib.Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)

# Match the three to -22.7 LUFS, the middle of the three.
TRIM = {3: -0.9, 7: 0.0, 8: +0.8}

# Every in/out point is the quietest 40 ms in its neighbourhood, found by
# trough.py rather than taken from the recogniser. The recogniser drifts: on
# clip 3 its word times run about 0.45s late, which is how the first cut landed
# in the middle of "verily" instead of the silence before it.
SEGS = [
    # Clip 3 opens the film in ARABIC. The first pass at this captioned it in
    # English, because a recogniser asked for English TRANSLATES Arabic rather
    # than admitting it cannot hear it -- 3.7-12.8 came back as fluent English
    # prose that he never says. Asking it to detect the language instead is
    # what caught it: on 12.3-16.6 it gives up and writes the word "Arabic".
    ("a1", 3,  1.940, 10.600),   # al-ibadatu la tusamma ibadatan illa maa at-tawhid
    # The salah/purity half of the maxim is cut: the film makes its point with
    # the first clause and the second was costing 3.6s for a restatement.
    # 10.90-12.46 is him repeating "maa at-tawhid"; the clause itself finishes
    # at 10.60, so the repetition is where the trim comes from.
    ("b",  8,  0.000,  3.670),   # how does it look to live with la ilaha illa Allah
    ("s",  8,  4.610, 14.190),   # first hadith in Nawawi and in Bukhari, one you all know
    ("c",  8, 14.190, 24.890),   # the hadith itself, both halves
    ("d",  7,  3.520, 26.970),   # worship is not limited -- fajr, revising, the ummah
    ("f",  7, 49.760, 51.230),   # Islam exists in everything you do
]

GAP = 0.28   # between segments, so each thought lands before the next starts
LEAD = 0.25  # a beat before he speaks

for name, clip, t0, t1 in SEGS:
    # 25 ms fades at each edge: the cut points sit in pauses, but a hard edge
    # on room tone still ticks.
    d = t1 - t0
    subprocess.run([
        "ffmpeg", "-y", "-v", "error", "-ss", "%.3f" % t0, "-to", "%.3f" % t1,
        "-i", SRC % clip, "-vn",
        "-af", "volume=%.2fdB,afade=t=in:st=0:d=0.025,afade=t=out:st=%.3f:d=0.025"
               % (TRIM[clip], d - 0.025),
        "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le",
        str(OUT / ("seg_%s.wav" % name)),
    ], check=True)
    print("  %s  clip %d  %6.2f-%6.2f  %5.2fs" % (name, clip, t0, t1, d))

for nm, dur in (("gap", GAP), ("lead", LEAD)):
    subprocess.run([
        "ffmpeg", "-y", "-v", "error", "-f", "lavfi",
        "-i", "anullsrc=r=48000:cl=mono", "-t", "%.3f" % dur,
        "-c:a", "pcm_s16le", str(OUT / (nm + ".wav")),
    ], check=True)

order = ["lead"]
for i, (name, _, _, _) in enumerate(SEGS):
    if i:
        order.append("gap")
    order.append("seg_" + name)

listing = "\n".join("file '%s.wav'" % n for n in order) + "\n"
(OUT / "list.txt").write_text(listing, encoding="utf-8")

subprocess.run([
    "ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0",
    "-i", str(OUT / "list.txt"), "-c:a", "pcm_s16le", str(OUT / "joined.wav"),
], check=True)

dur = subprocess.run(
    ["ffprobe", "-v", "error", "-show_entries", "format=duration",
     "-of", "default=nw=1:nk=1", str(OUT / "joined.wav")],
    capture_output=True, text=True, check=True).stdout.strip()
print("joined: %s s" % dur)
