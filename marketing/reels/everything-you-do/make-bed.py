"""
Build the nasheed bed from the supplied clip.

Two problems with the source. It has a DROPOUT -- 44.92 to 45.90 is digital
silence, a splice in the recording rather than a rest in the music -- and at
51.1s it is shorter than the film. So the bed is built from the clean run
before the dropout, extended by splicing back to an earlier point.

The splice is PHRASE-ALIGNED, not arbitrary. Correlating the loudness envelope
against itself (loop.py in the working notes) puts the repeat at 7.92s, with
2x that the next strongest, so the jump back is exactly three phrases: the
music lands on the same point in the bar and the join passes as a repeat.

Level is set against the voice, not in isolation: 16.3 LU under it, which is
where the sibling reel's bed ended up after the owner asked for it to come
down.
"""
import pathlib
import re
import subprocess

P = pathlib.Path(__file__).parent
SRC = "C:/Users/musas/Downloads/WhatsApp Video 2026-09-25 at 21.15.55.mp4"
OUT = P / "audio" / "bed-nasheed.flac"
TMP = P / "audio" / "_bed_tmp"

PHRASE = 7.92          # measured repeat
A_END = 44.80          # the last clean moment before the dropout
BACK = PHRASE * 3      # 23.76s: three whole phrases
B_IN = A_END - BACK    # 21.04 -- same position in the bar as A_END
B_OUT = 41.50          # still clear of the dropout at 44.92
XF = 1.2               # crossfade at the join
FILM = 63.60
VOICE_LUFS = -11.8
UNDER = 16.3           # LU below the voice

TMP.mkdir(parents=True, exist_ok=True)


def run(args):
    subprocess.run(args, check=True)


def lufs(path):
    out = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(path), "-af", "ebur128=peak=true",
         "-f", "null", "-"], capture_output=True, text=True).stderr
    tail = out[out.rindex("Summary:"):]
    return (float(re.search(r"I:\s*(-?\d+\.\d+)", tail).group(1)),
            float(re.search(r"LRA:\s*(-?\d+\.\d+)", tail).group(1)),
            float(re.search(r"Peak:\s*(-?\d+\.\d+)", tail).group(1)))


a, b = TMP / "a.wav", TMP / "b.wav"
run(["ffmpeg", "-y", "-v", "error", "-to", "%.3f" % A_END, "-i", SRC, "-vn",
     "-ar", "48000", "-ac", "2", "-c:a", "pcm_s24le", str(a)])
run(["ffmpeg", "-y", "-v", "error", "-ss", "%.3f" % B_IN, "-to", "%.3f" % B_OUT,
     "-i", SRC, "-vn", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s24le", str(b)])

joined = TMP / "joined.wav"
run(["ffmpeg", "-y", "-v", "error", "-i", str(a), "-i", str(b),
     "-filter_complex", "[0][1]acrossfade=d=%.2f:c1=tri:c2=tri" % XF,
     "-c:a", "pcm_s24le", str(joined)])

have = float(subprocess.run(
    ["ffprobe", "-v", "error", "-show_entries", "format=duration",
     "-of", "default=nw=1:nk=1", str(joined)], capture_output=True, text=True,
    check=True).stdout)
assert have >= FILM, "bed is %.2fs, film is %.2fs" % (have, FILM)

i, _, _ = lufs(joined)
gain = (VOICE_LUFS - UNDER) - i
print("joined %.2fs at %.1f LUFS -> %+.2f dB for %.1f LUFS" % (have, i, gain, VOICE_LUFS - UNDER))

run(["ffmpeg", "-y", "-v", "error", "-t", "%.3f" % FILM, "-i", str(joined),
     "-af", ("volume=%.2fdB,afade=t=in:st=0:d=1.6,afade=t=out:st=%.2f:d=2.6"
             % (gain, FILM - 2.6)),
     "-ar", "48000", "-c:a", "flac", str(OUT)])

for f in TMP.iterdir():
    f.unlink()
TMP.rmdir()

i, lra, pk = lufs(OUT)
print("bed: %.1f LUFS, LRA %.1f, peak %.1f dBFS, %.2fs" % (i, lra, pk, FILM))
print("     %.1f LU under the voice" % (VOICE_LUFS - i))
