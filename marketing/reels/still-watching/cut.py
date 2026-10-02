"""
Cut the khutbah excerpt. One continuous take, as recorded.

  in   1.495  the silence after "...dependent upon Allah.", so the film opens
              on "And finally, Tawheed means". An earlier cut came in at
              "Tawheed", which is mid-sentence and mid-breath.
  out 36.20   the silence after "...is still watching you." What follows is
              "'ibad Allah" -- the formula that opens his next section, and the
              only Arabic in the clip.

Both points are the quietest 40 ms in their neighbourhood (trough.py).

Nothing is cut INSIDE the take. A first version removed his false start ("If
our intention is... if our intention becomes wrong") and gated the room out
between phrases; the owner heard both as the audio being cut between breaths.
The breaths and the room are part of the recording.

Nothing is done to the SOUND either, beyond level. The first version folded it
to mono and ran it through a gate, a 3:1 compressor and ~24 dB of makeup into a
limiter, and it came out thin. Two causes, both measured:

  - It is real stereo, not dual-mono: the channels correlate at 0.66. Summed to
    mono, the differences between them cancel and the voice goes phasey. So it
    stays stereo.
  - The compression flattened it to LRA 1.4 and pulled the hall up with it.

So: +3 dB and a ceiling at -1 dBFS. Only 176 samples in the take (0.006%) go
above -3 dBFS, so the limiter touches a handful of plosives and nothing else.
That leaves it about 2 dB quieter than the sibling reel, which is the trade for
keeping the recording as it sounded.
"""
import pathlib
import re
import subprocess

P = pathlib.Path(__file__).parent
SRC = "C:/Users/musas/Downloads/WhatsApp Video 2026-10-02 at 20.28.31.mp4"
OUT = P / "audio" / "khutbah.flac"

T_IN, T_OUT = 1.495, 36.20
LEAD = 0.25          # a beat of room before he speaks
GAIN = 3.0
LIM = "alimiter=limit=0.891:attack=1:release=50:level=disabled"   # -1 dBFS


def lufs(path):
    out = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(path), "-af", "ebur128=peak=true",
         "-f", "null", "-"], capture_output=True, text=True).stderr
    tail = out[out.rindex("Summary:"):]
    return (float(re.search(r"I:\s*(-?\d+\.\d+)", tail).group(1)),
            float(re.search(r"LRA:\s*(-?\d+\.\d+)", tail).group(1)),
            float(re.search(r"Peak:\s*(-?\d+\.\d+)", tail).group(1)))


d = T_OUT - T_IN
subprocess.run([
    "ffmpeg", "-y", "-v", "error", "-ss", "%.3f" % T_IN, "-to", "%.3f" % T_OUT,
    "-i", SRC, "-vn",
    # 25 ms fades: the cut points sit in silence, but a hard edge on room tone
    # still ticks.
    "-af", ("afade=t=in:st=0:d=0.025,afade=t=out:st=%.3f:d=0.06,"
            "adelay=%d:all=1,volume=%.2fdB,%s" % (d - 0.06, LEAD * 1000, GAIN, LIM)),
    "-ac", "2", "-ar", "48000", "-c:a", "flac", str(OUT),
], check=True)

dur = float(subprocess.run(
    ["ffprobe", "-v", "error", "-show_entries", "format=duration",
     "-of", "default=nw=1:nk=1", str(OUT)], capture_output=True, text=True,
    check=True).stdout)
i, lra, pk = lufs(OUT)
print("khutbah: %.2fs  %.1f LUFS  LRA %.1f  peak %.1f dBFS" % (dur, i, lra, pk))
