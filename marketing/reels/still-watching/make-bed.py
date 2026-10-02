"""
Build the nasheed bed: the same nasheed as the sibling reel, so the two read
as one series.

The source has a dropout at 44.92-45.90 (a splice in the recording, not a rest
in the music). This film is 38.2s, so it needs only the clean run before it --
no loop, no join.

Level is set against the voice, not in isolation: 16.3 LU under it, where the
sibling reel's bed ended up after the owner asked for it to come down. Plus the
1.1 dB the renderer takes from each track once there are two.
"""
import json
import pathlib
import re
import subprocess

P = pathlib.Path(__file__).parent
SRC = "C:/Users/musas/Downloads/WhatsApp Video 2026-09-25 at 21.15.55.mp4"
OUT = P / "audio" / "bed-nasheed.flac"
DOC = json.loads((P / "script.json").read_text(encoding="utf-8"))

FILM = DOC["beats"][-1]["to"]
CLEAN_UNTIL = 44.80
VOICE_LUFS = -11.8
UNDER = DOC["bed"]["under"]
RENDER_LOSS = 1.1

assert FILM <= CLEAN_UNTIL, "film %.2fs runs into the dropout" % FILM


def lufs(path):
    out = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(path), "-af", "ebur128=peak=true",
         "-f", "null", "-"], capture_output=True, text=True).stderr
    tail = out[out.rindex("Summary:"):]
    return (float(re.search(r"I:\s*(-?\d+\.\d+)", tail).group(1)),
            float(re.search(r"LRA:\s*(-?\d+\.\d+)", tail).group(1)),
            float(re.search(r"Peak:\s*(-?\d+\.\d+)", tail).group(1)))


def render(gain):
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-t", "%.3f" % FILM, "-i", SRC, "-vn",
         "-af", ("volume=%.2fdB,afade=t=in:st=0:d=1.6,afade=t=out:st=%.2f:d=2.6"
                 % (gain, FILM - 2.6)),
         "-ar", "48000", "-ac", "2", "-c:a", "flac", str(OUT)], check=True)
    return lufs(OUT)


target = VOICE_LUFS - UNDER + RENDER_LOSS
i, _, _ = render(0.0)
i, lra, pk = render(target - i)
print("bed: %.1f LUFS, LRA %.1f, peak %.1f dBFS, %.2fs" % (i, lra, pk, FILM))
print("     renders %.1f LU under the voice" % (VOICE_LUFS - (i - RENDER_LOSS)))
