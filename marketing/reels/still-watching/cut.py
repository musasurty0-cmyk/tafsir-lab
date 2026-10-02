"""
Cut the khutbah excerpt and bring it to the series' level.

One clip, one run of speech. It is trimmed at both ends, not cut inside:

  in   2.40  the trough before "Tawheed". The clip opens on the tail of the
             previous sentence ("...dependent upon Allah.") and then "And
             finally," -- a sentence that starts with "finally" makes a viewer
             feel they have missed the beginning, so the film starts on the
             subject itself.
  out 36.20  the trough after "...is still watching you." What follows is
             "'ibad Allah" -- the formula that opens his next section, and the
             only Arabic in the clip. Kept, it would be the first two words of
             a thought the film does not contain.

and one cut inside, a false start:

  21.74-23.23  "If our intention is..." -- he stops, and begins the sentence
             again. The recogniser DROPPED the first attempt rather than
             transcribing it, so it showed up only as one word stretched to
             1.7s; splitting the window in two is what heard it. Left in, the
             karaoke would sit on "our" through a phrase that is not on screen.

All points are the quietest 40 ms in their neighbourhood (trough.py), not the
recogniser's word times, which drift.

Level: the clip reads -17.0 LUFS as stereo but is dual-mono, so folded to one
channel it is -20.3 -- the number that matters, since the reel's audio is mono.
It also peaks 20 dB above its own loudness -- plosives, recorded close on a
phone -- so a limiter alone would have to take ~15 dB off every transient to
reach the series level, which is distortion. A 3:1 compressor goes first and
does the levelling; the limiter is left to catch what gets past it.

A gate goes first of all. The compressor's makeup gain is ~+24 dB, which would
bring the hall between his sentences up to about -19 dBFS -- louder than the
nasheed bed. Measured on this clip: gaps have a mean of -38 and peaks of -30,
speech a mean of -19. The threshold sits between at -29 dB (0.035).

The gain into the limiter (-1.5 dBFS ceiling, as the sibling reels) is SOLVED
for, not set: the limiter takes back part of whatever is added, so the gain
that lands on target is found by measuring the result and correcting. The
target is whatever makes the RENDER match the sibling reel's -12.0 LUFS.

The file is written as STEREO (the same signal in both channels), not mono:
the first render, from a mono file, came out at -9.1 LUFS beside the sibling's
-12.0, because the renderer copies a mono track into both of its channels and
loudness counts both. From stereo, the render lands within 0.1 dB of the file.
"""
import pathlib
import re
import subprocess

P = pathlib.Path(__file__).parent
SRC = "C:/Users/musas/Downloads/WhatsApp Video 2026-10-02 at 20.28.31.mp4"
OUT = P / "audio" / "khutbah.flac"

# Source-time spans kept, in order.
KEEP = [(2.40, 21.74), (23.23, 36.20)]
LEAD = 0.25          # a beat of room before he speaks
# The level the RENDER should land at is the sibling reel's measured -12.0.
# What the file must be to get there was measured, not assumed: this file at
# -11.0 rendered at -10.9, so the renderer adds ~0.1 here rather than taking the
# 1.1 dB the sibling reel lost.
TARGET = -12.0 - 0.1


def lufs(path):
    out = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(path), "-af", "ebur128=peak=true",
         "-f", "null", "-"], capture_output=True, text=True).stderr
    tail = out[out.rindex("Summary:"):]
    return (float(re.search(r"I:\s*(-?\d+\.\d+)", tail).group(1)),
            float(re.search(r"LRA:\s*(-?\d+\.\d+)", tail).group(1)),
            float(re.search(r"Peak:\s*(-?\d+\.\d+)", tail).group(1)))


GATE = ("agate=threshold=0.035:ratio=4:detection=rms:link=average:"
        "attack=10:release=250:knee=6:range=0.06")
COMP = "acompressor=threshold=-30dB:ratio=3:attack=4:release=140:knee=6"
LIM = "alimiter=limit=0.841:attack=2:release=60:level=disabled"


def render(gain, out=OUT, chain=None):
    # Each span gets 25 ms fades: every cut is in a pause, but a hard edge on
    # room tone still ticks.
    ins, parts = [], []
    for k, (t0, t1) in enumerate(KEEP):
        ins += ["-ss", "%.3f" % t0, "-to", "%.3f" % t1, "-i", SRC]
        d = t1 - t0
        parts.append("[%d:a]pan=mono|c0=0.5*c0+0.5*c1,afade=t=in:st=0:d=0.025,"
                     "afade=t=out:st=%.3f:d=0.04[s%d]" % (k, d - 0.04, k))
    cat = "".join("[s%d]" % k for k in range(len(KEEP)))
    post = chain if chain is not None else "%s,%s,volume=%.2fdB,%s" % (GATE, COMP, gain, LIM)
    graph = ";".join(parts) + ";%sconcat=n=%d:v=0:a=1,adelay=%d:all=1,%s[o]" % (
        cat, len(KEEP), LEAD * 1000, post)
    subprocess.run(["ffmpeg", "-y", "-v", "error", *ins, "-filter_complex", graph,
                    "-map", "[o]", "-ac", "2", "-ar", "48000", "-c:a", "flac", str(out)], check=True)
    return lufs(out)[0]


gain = TARGET - (-32.2)   # -32.2: the compressed level, before makeup
for _ in range(4):
    got = render(gain)
    if abs(got - TARGET) < 0.15:
        break
    gain += TARGET - got
print("gain %+.2f dB" % gain)

dur = float(subprocess.run(
    ["ffprobe", "-v", "error", "-show_entries", "format=duration",
     "-of", "default=nw=1:nk=1", str(OUT)], capture_output=True, text=True,
    check=True).stdout)
i, lra, pk = lufs(OUT)
print("khutbah: %.2fs  %.1f LUFS  LRA %.1f  peak %.1f dBFS" % (dur, i, lra, pk))
print("  (renders at ~%.1f LUFS)" % (i + 0.1))
