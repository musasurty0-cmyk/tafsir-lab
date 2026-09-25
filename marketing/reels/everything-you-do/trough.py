"""
Find the quietest moment in a window, so a cut lands in a gap and not in a word.

The recogniser's word timings drift -- on clip 3 they ran nearly half a second
late, which is how a cut at "verily" landed in the middle of it. This reads the
sound instead.

  python trough.py <file> <t0> <t1> [...more pairs]
"""
import array
import math
import subprocess
import sys

SRC = sys.argv[1]
HOP_MS = 5

raw = subprocess.run(
    ["ffmpeg", "-v", "error", "-i", SRC, "-vn",
     "-af", "pan=mono|c0=c0", "-ar", "16000", "-f", "s16le", "-"],
    capture_output=True, check=True).stdout
pcm = array.array("h")
pcm.frombytes(raw)
sr, hop = 16000, 16000 * HOP_MS // 1000

env = []
for i in range(len(pcm) // hop):
    blk = pcm[i * hop:(i + 1) * hop]
    rms = math.sqrt(sum(float(v) * v for v in blk) / len(blk)) if blk else 0
    env.append(20 * math.log10(rms / 32768.0) if rms > 0 else -120.0)

args = sys.argv[2:]
for k in range(0, len(args), 2):
    t0, t1 = float(args[k]), float(args[k + 1])
    i0, i1 = int(t0 / (HOP_MS / 1000)), int(t1 / (HOP_MS / 1000))
    i1 = min(i1, len(env))
    best, bt = 1e9, t0
    # Quietest 40 ms run, i.e. 8 frames -- one frame can be a glottal dip
    # inside a word; 40 ms of quiet is a real gap.
    for i in range(i0, max(i0 + 1, i1 - 8)):
        m = max(env[i:i + 8])
        if m < best:
            best, bt = m, (i + 4) * HOP_MS / 1000
    print("  %6.2f-%6.2f  ->  cut at %6.3f   (quietest 40ms peak %.1f dB)"
          % (t0, t1, bt, best))
