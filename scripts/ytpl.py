#!/usr/bin/env python
"""
Pull a YouTube playlist down for the subtitling pipeline.

Written because the lectures were being fetched one at a time by hand, which
does not scale to a 41-video series, and because the obvious command --
`yt-dlp <playlist-url>` -- gets three things wrong for this particular job:

  DISK. Anwar al-Anbiya is 22.6 hours. At 720p that is ~13 GB of source, and
  the pipeline then writes a 16 kHz WAV per video (~115 MB/hour) and a burned
  render (200-650 MB each). The whole series end to end is ~30 GB against
  41 GB free. So `fetch` defaults to AUDIO ONLY: transcription, matching,
  cueing and translation never touch the picture, and audio for all 41 videos
  is under half a gig. You pull the video for one lecture at the point you
  burn it, and delete it after.

  NAMING. The pipeline keys everything off the YouTube id -- job dirs are
  v_<id>/. Default yt-dlp names files after the title, which here is Arabic,
  which on this machine's console codepage comes back as mojibake and cannot
  be matched back to anything. Files land as <index>-<id>.<ext>.

  RESUMPTION. A 22-hour pull will be interrupted. Every fetch writes to a
  download-archive, so re-running skips what already landed rather than
  starting over, and one failed video does not abort the other forty.

Usage:
    python scripts/ytpl.py list  <playlist-url-or-id>
    python scripts/ytpl.py fetch <playlist-url-or-id> [--items 1-5] [--video]
    python scripts/ytpl.py jobs  <playlist-url-or-id> --pipeline <dir>

`list` writes a UTF-8 index and prints an ASCII summary -- Arabic titles are
written to the file, never to stdout, because the console mangles them.

If YouTube starts demanding a sign-in ("confirm you're not a bot"), add
--cookies-from-browser chrome. It is not on by default: it reads your browser
profile, and that should be a decision you make rather than one made for you.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys

# This console is cp1252 and every title in this corpus is Arabic. Printing one
# does not garble it, it RAISES -- which is how the first run of this script
# died, three lines after a docstring saying titles go to a file and never to
# stdout. Belt: nothing below prints a title. Braces: if one ever leaks through
# again it degrades to '?' instead of taking a 22-hour download down with it.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
# Deliberately OUTSIDE the repo: this lands tens of gigabytes of source media,
# which has no business near a Next.js checkout or a git index.
DEFAULT_DEST = os.path.join(os.path.expanduser("~"), "tafsir-source")

# 720p is what the subtitle styling was measured against -- see the ASS
# PlayResY and the outline widths, which were checked on a real 720p frame.
# Taking 1080p here would silently change how the burned text reads.
VIDEO_FMT = "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720]/b"
AUDIO_FMT = "ba[ext=m4a]/ba/b"

# MEASURED, not assumed -- the guard below refuses downloads on these numbers,
# so a guess would refuse the wrong things. Video is yt-dlp's own reported
# filesize for the 720p stream plus best audio, on two lectures of different
# lengths (517 and 532 MB/hour). Audio is a real completed m4a: 24.9 MB for
# 1539s. The first draft of this file guessed 16 MB/hour for audio and was
# out by 3.6x.
MB_PER_HOUR_VIDEO = 525
MB_PER_HOUR_AUDIO = 58


def yt(*args, capture=True):
    """Run yt-dlp. Never let the child inherit a mangling codepage."""
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    cmd = ["yt-dlp", *args]
    if capture:
        p = subprocess.run(cmd, capture_output=True, env=env)
        return p.returncode, p.stdout.decode("utf-8", "replace"), p.stderr.decode("utf-8", "replace")
    return subprocess.call(cmd, env=env), "", ""


def url_of(playlist):
    """Accept a full URL, a bare PL... id, or a channel URL."""
    if playlist.startswith("http"):
        return playlist
    if playlist.startswith(("PL", "UU", "OL", "RD")):
        return "https://www.youtube.com/playlist?list=" + playlist
    return playlist


def index(playlist):
    """Flat-list the playlist. One network call; no media touched."""
    rc, out, err = yt("--flat-playlist", "--no-warnings", "-J", url_of(playlist))
    if rc != 0 or not out.strip():
        sys.exit("could not read playlist:\n" + (err.strip() or "(no error text)")[:800])
    d = json.loads(out)
    return d.get("title") or "", d.get("entries") or []


def hours(entries):
    return sum((e.get("duration") or 0) for e in entries) / 3600.0


def write_index(path, title, entries, done_ids):
    with open(path, "w", encoding="utf-8") as f:
        f.write(u"%s\n%d videos, %.1f hours\n\n" % (title, len(entries), hours(entries)))
        for i, e in enumerate(entries, 1):
            f.write(u"%3d %s %-12s %6.1f min  %s\n" % (
                i,
                "[have]" if e.get("id") in done_ids else "      ",
                e.get("id") or "?",
                (e.get("duration") or 0) / 60.0,
                (e.get("title") or "").replace("\n", " "),
            ))


def have_ids(dest):
    """Ids already on disk, by filename -- <index>-<id>.<ext>."""
    ids = set()
    if os.path.isdir(dest):
        for n in os.listdir(dest):
            stem = os.path.splitext(n)[0]
            if "-" in stem:
                ids.add(stem.split("-", 1)[1])
    return ids


def free_gb(path):
    probe = path
    while probe and not os.path.isdir(probe):
        probe = os.path.dirname(probe)
    return shutil.disk_usage(probe or ".").free / 1e9


def cmd_list(a):
    title, entries = index(a.playlist)
    dest = os.path.abspath(a.dest)
    done = have_ids(dest)
    out = os.path.join(dest, "index.txt")
    os.makedirs(dest, exist_ok=True)
    write_index(out, title, entries, done)
    print("%d videos, %.1f hours" % (len(entries), hours(entries)))
    print("already on disk: %d" % sum(1 for e in entries if e.get("id") in done))
    print("est. size  audio %.1f GB   video(720p) %.1f GB" % (
        hours(entries) * MB_PER_HOUR_AUDIO / 1000.0,
        hours(entries) * MB_PER_HOUR_VIDEO / 1000.0))
    print("free on disk: %.1f GB" % free_gb(dest))
    print("titles are Arabic and the console would mangle them -- written to:")
    print("  " + out)


def cmd_fetch(a):
    title, entries = index(a.playlist)
    dest = os.path.abspath(a.dest)
    os.makedirs(dest, exist_ok=True)

    sel = entries
    if a.items:
        rc, out, _ = yt("--flat-playlist", "--no-warnings", "--playlist-items", a.items,
                        "--print", "%(id)s", url_of(a.playlist))
        wanted = set(x.strip() for x in out.split() if x.strip())
        sel = [e for e in entries if e.get("id") in wanted]

    kind = "video" if a.video else "audio"
    need = hours(sel) * (MB_PER_HOUR_VIDEO if a.video else MB_PER_HOUR_AUDIO) / 1000.0
    free = free_gb(dest)
    print("%d of %d videos, %.1f hours, ~%.1f GB %s" % (len(sel), len(entries), hours(sel), need, kind))
    print("free: %.1f GB" % free)
    if need > free * 0.85:
        sys.exit("refusing: ~%.1f GB needed against %.1f GB free. Narrow it with "
                 "--items, or drop --video and pull audio only." % (need, free))

    args = [
        "-f", VIDEO_FMT if a.video else AUDIO_FMT,
        "-o", os.path.join(dest, "%(playlist_index)03d-%(id)s.%(ext)s"),
        "--download-archive", os.path.join(dest, "archive-%s.txt" % kind),
        "--write-info-json",          # keeps the Arabic title next to the file
        "--no-warnings",
        "--ignore-errors",            # one dead video must not stop forty
        "--continue",
        "--retries", "10",
        "--fragment-retries", "10",
        "--concurrent-fragments", "4",
        "--sleep-requests", "1",      # polite, and keeps the throttler off
        "--newline",
    ]
    if a.video:
        args += ["--merge-output-format", "mp4"]
    if a.items:
        args += ["--playlist-items", a.items]
    if a.cookies_from_browser:
        args += ["--cookies-from-browser", a.cookies_from_browser]
    args.append(url_of(a.playlist))

    rc, _, _ = yt(*args, capture=False)
    got = have_ids(dest)
    print("\non disk now: %d of %d" % (sum(1 for e in entries if e.get("id") in got), len(entries)))
    if rc != 0:
        print("yt-dlp exited %d -- some items failed; re-run to retry only those." % rc)


def cmd_jobs(a):
    """Fan the downloaded files out into the pipeline's v_<id>/ job dirs."""
    title, entries = index(a.playlist)
    dest = os.path.abspath(a.dest)
    pipeline = os.path.abspath(a.pipeline)
    if not os.path.isdir(pipeline):
        sys.exit("no pipeline dir at " + pipeline)

    # the scripts a job needs, copied from a previous job dir
    parts = ["arabic.py", "classify.py", "segment.py", "match_quran.py",
             "apply_mushaf.py", "transcribe.py", "build_ass.py", "quran.json",
             "test_arabic.py"]
    missing = [p for p in parts if not os.path.exists(os.path.join(pipeline, p))]
    if missing:
        sys.exit("pipeline dir is missing: " + ", ".join(missing))

    by_id = {}
    for n in os.listdir(dest):
        stem, ext = os.path.splitext(n)
        if "-" in stem and ext.lower() in (".m4a", ".mp4", ".webm", ".mkv", ".opus"):
            by_id[stem.split("-", 1)[1]] = os.path.join(dest, n)

    made = 0
    for e in entries:
        vid = e.get("id")
        if vid not in by_id:
            continue
        job = os.path.join(dest, "v_" + vid)
        if os.path.exists(os.path.join(job, "final.ass")):
            continue                     # already finished
        os.makedirs(job, exist_ok=True)
        for p in parts:
            tgt = os.path.join(job, p)
            if not os.path.exists(tgt):
                shutil.copy2(os.path.join(pipeline, p), tgt)
        fonts = os.path.join(pipeline, "fonts")
        if os.path.isdir(fonts) and not os.path.isdir(os.path.join(job, "fonts")):
            shutil.copytree(fonts, os.path.join(job, "fonts"))
        # A pointer, not a copy: the media is up to half a gig a piece and the
        # job dir has no business holding a second one.
        with open(os.path.join(job, "SOURCE.txt"), "w", encoding="utf-8") as f:
            f.write(by_id[vid] + "\n")
        made += 1
    print("prepared %d job dirs under %s" % (made, dest))
    print("each has SOURCE.txt pointing at its media; run transcribe.py inside one to start.")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--dest", default=DEFAULT_DEST, help="where media lands")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("list", help="show what is in a playlist; downloads nothing")
    p.add_argument("playlist")
    p.set_defaults(fn=cmd_list)

    p = sub.add_parser("fetch", help="download it (audio by default)")
    p.add_argument("playlist")
    p.add_argument("--items", help="yt-dlp range, e.g. 6-10 or 1,3,7")
    p.add_argument("--video", action="store_true", help="720p mp4 instead of audio")
    p.add_argument("--cookies-from-browser", help="chrome / firefox / edge, if YouTube asks you to sign in")
    p.set_defaults(fn=cmd_fetch)

    p = sub.add_parser("jobs", help="fan downloads out into v_<id>/ pipeline dirs")
    p.add_argument("playlist")
    p.add_argument("--pipeline", required=True, help="an existing job dir to copy the scripts from")
    p.set_defaults(fn=cmd_jobs)

    a = ap.parse_args()
    # --dest belongs to the top parser but reads better after the subcommand
    a.fn(a)


if __name__ == "__main__":
    main()
