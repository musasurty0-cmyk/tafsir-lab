#!/usr/bin/env python
"""
Run the Arabic half of the subtitle pipeline over a playlist, unattended.

Stops at cues.json. It does NOT write English and it does NOT burn video --
en.json is written by hand against the Arabic cues (that is the whole reason
transcription is one pass and not two), so an unattended run can only take
each lecture as far as "ready for English". Burning also needs the 720p source,
which is 11.8 GB for this playlist against 43 GB free, so that stays a
per-lecture decision made while someone is looking.

Two things here are scar tissue, and both cost hours the last time:

  IT MUST SURVIVE THE SESSION -- AND ONLY THE TASK SCHEDULER MANAGES THAT.
  Three launchers have now been tried and two of them lost a night:

    nohup bash chain.sh &                  died with its parent; 1 of 3 jobs ran
    Start-Process -WindowStyle Hidden      died with its parent; 8 min in
    schtasks                               survives

  Start-Process is the one that looks right and is not. It detaches from the
  *shell*, but the shell was a child of the agent process, and on Windows that
  whole tree sits in a Job Object which is killed when the agent exits. The
  giveaway is an EMPTY stderr next to a truncated log: a tree kill leaves no
  error because nothing failed. A scheduled task's parent is the Task Scheduler
  service, so it is outside that job entirely.

  Two further things bite when you move to schtasks, and both did:
    * `schtasks /create` defaults DisallowStartIfOnBatteries to TRUE. On a
      laptop on battery the task goes to Queued and silently never starts.
      Register-ScheduledTask with -AllowStartIfOnBatteries
      -DontStopIfGoingOnBatteries -ExecutionTimeLimit 0.
    * Task Scheduler hands the process a MINIMAL environment. python, yt-dlp
      and ffmpeg are all absent from its PATH. Set PATH explicitly in the .cmd
      and capture the .cmd's own output -- a "not recognized" goes to cmd's
      stderr, and if only the inner commands are redirected you get exit 1 and
      an empty error file.

  See tafsir-source/night.cmd, which carries all three fixes.

  GATE ON THE ARTEFACT, NOT ON THE PROCESS. A previous supervisor waited for
  "no python running" before starting the next job, and zombie ctranslate2
  workers -- 0.015s of CPU across 80 minutes, but still in the process table --
  held that gate shut for about 90 minutes of a finite night. Every gate below
  is `does the output file exist`. A file either got written or it did not.

Ordering is the pipeline's own dependency chain, confirmed against a completed
job's file timestamps:

    audio.wav -> transcribe.py    -> ar.json
    ar.json   -> match_quran.py   -> matches.json
    matches   -> classify.py      -> classified.json
    classified-> apply_mushaf.py  -> words.json
    words+wav -> segment.py       -> cues.json

Transcription is the whole cost: measured 0.45x realtime on this machine, so a
30-minute lecture is about 67 minutes. Everything after it is seconds. With
7.3 GB of RAM and large-v3 int8 resident at ~2 GB, jobs run ONE AT A TIME --
parallelism here buys thrash, not throughput.

    python scripts/subs_night.py <playlist> --pipeline <a finished job dir>

Drop a file named STOP in the destination to make it finish the lecture it is
on and then exit cleanly.
"""

import json
import os
import shutil
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ytpl import index, have_ids, free_gb, DEFAULT_DEST, yt  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# (script, output it must produce). Order is the dependency chain.
STAGES = [
    ("transcribe.py",   "ar.json"),
    ("match_quran.py",  "matches.json"),
    ("classify.py",     "classified.json"),
    ("apply_mushaf.py", "words.json"),
    ("segment.py",      "cues.json"),
]

PARTS = ["arabic.py", "classify.py", "segment.py", "match_quran.py",
         "apply_mushaf.py", "transcribe.py", "build_ass.py", "quran.json",
         "test_arabic.py"]

MIN_FREE_GB = 6.0     # below this, stop rather than wedge the machine


def log(dest, msg):
    line = "%s  %s" % (time.strftime("%H:%M:%S"), msg)
    print(line, flush=True)
    with open(os.path.join(dest, "night.log"), "a", encoding="utf-8") as f:
        f.write(line + "\n")


def ensure_wav(job, src, dest):
    """16 kHz mono -- what transcribe.py and segment.py's RMS envelope expect."""
    wav = os.path.join(job, "audio.wav")
    if os.path.exists(wav) and os.path.getsize(wav) > 1000:
        return True
    rc = subprocess.call(["ffmpeg", "-v", "error", "-y", "-i", src,
                          "-ac", "1", "-ar", "16000", wav],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if rc != 0 or not os.path.exists(wav):
        log(dest, "  ffmpeg failed on %s" % os.path.basename(src))
        return False
    return True


def prepare(job, pipeline):
    os.makedirs(job, exist_ok=True)
    for p in PARTS:
        tgt = os.path.join(job, p)
        if not os.path.exists(tgt):
            shutil.copy2(os.path.join(pipeline, p), tgt)
    fonts = os.path.join(pipeline, "fonts")
    if os.path.isdir(fonts) and not os.path.isdir(os.path.join(job, "fonts")):
        shutil.copytree(fonts, os.path.join(job, "fonts"))


def run_stage(job, script, out, dest, label):
    """Returns True if `out` exists afterwards. The artefact is the only gate."""
    target = os.path.join(job, out)
    if os.path.exists(target) and os.path.getsize(target) > 2:
        return True
    t0 = time.time()
    logf = os.path.join(job, script.replace(".py", ".log"))
    with open(logf, "w", encoding="utf-8") as f:
        rc = subprocess.call([sys.executable, script], cwd=job, stdout=f,
                             stderr=subprocess.STDOUT)
    ok = os.path.exists(target) and os.path.getsize(target) > 2
    log(dest, "  %-16s %-7s rc=%d  %5.1f min  -> %s" % (
        script, "ok" if ok else "FAILED", rc, (time.time() - t0) / 60,
        out if ok else "(nothing)"))
    return ok


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("playlist")
    ap.add_argument("--pipeline", required=True)
    ap.add_argument("--dest", default=DEFAULT_DEST)
    ap.add_argument("--start", type=int, default=1, help="playlist index to begin at")
    a = ap.parse_args()

    dest = os.path.abspath(a.dest)
    pipeline = os.path.abspath(a.pipeline)
    _, entries = index(a.playlist)
    queue = [(i, e) for i, e in enumerate(entries, 1) if i >= a.start]

    log(dest, "=" * 64)
    log(dest, "night run: %d lectures queued from #%d, %.1f GB free"
        % (len(queue), a.start, free_gb(dest)))
    log(dest, "stops at cues.json -- English and burning are not automated")

    passes = 0
    while passes < 200:
        passes += 1
        did_work = False
        waiting = 0

        for idx, e in queue:
            if os.path.exists(os.path.join(dest, "STOP")):
                log(dest, "STOP file present -- exiting cleanly")
                return
            if free_gb(dest) < MIN_FREE_GB:
                log(dest, "only %.1f GB free -- stopping before it becomes a problem"
                    % free_gb(dest))
                return

            vid = e.get("id")
            job = os.path.join(dest, "v_%s" % vid)
            if os.path.exists(os.path.join(job, "cues.json")):
                continue                       # already ready for English

            # find the downloaded media; if it has not landed yet, come back
            src = None
            for n in os.listdir(dest):
                stem, ext = os.path.splitext(n)
                if stem.endswith(vid) and ext.lower() in (".m4a", ".mp4", ".webm", ".opus"):
                    src = os.path.join(dest, n)
            if not src:
                waiting += 1
                continue

            did_work = True
            log(dest, "#%02d %s  (%.0f min of audio)" % (idx, vid, (e.get("duration") or 0) / 60))
            prepare(job, pipeline)
            if not ensure_wav(job, src, dest):
                continue

            for script, out in STAGES:
                if not run_stage(job, script, out, dest, vid):
                    log(dest, "  -> stopping this lecture, moving to the next")
                    break
            else:
                log(dest, "  #%02d READY FOR ENGLISH" % idx)
                # the WAV is 115 MB/hour and nothing after segment.py reads it
                try:
                    os.remove(os.path.join(job, "audio.wav"))
                except OSError:
                    pass

        done = sum(1 for _, e in queue
                   if os.path.exists(os.path.join(dest, "v_%s" % e.get("id"), "cues.json")))
        log(dest, "pass %d: %d of %d ready for English, %d still downloading"
            % (passes, done, len(queue), waiting))
        if done == len(queue):
            log(dest, "ALL DONE")
            return
        if not did_work:
            time.sleep(120)          # nothing downloaded yet; wait for yt-dlp


if __name__ == "__main__":
    main()
