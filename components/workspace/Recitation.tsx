"use client";

/**
 * Recitation — play the sūrah, or one āyah of it.
 *
 * A single <audio> element driven directly rather than through React state for
 * playback position: the element is the source of truth for where it is, and
 * mirroring that into state would mean 60 renders a second to say something
 * the browser already knows. State here holds only what React actually
 * renders — playing or not, which verse, whether it failed.
 *
 * Failure is visible. A recitation that cannot be found says so instead of
 * leaving a play button that silently does nothing.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, X, Loader2 } from "lucide-react";

interface Props {
  surah:      number;
  surahName:  string;
  /** Optional starting āyah — the drawer passes the verse being read. */
  ayah?:      number | null;
}

interface Roster { id: number; name: string }

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; url: string }
  | { kind: "error"; message: string };

export default function Recitation({ surah, surahName, ayah }: Props) {
  const [open, setOpen]       = useState(false);
  const [state, setState]     = useState<State>({ kind: "idle" });
  const [playing, setPlaying] = useState(false);
  const [scope, setScope]     = useState<"surah" | "ayah">(ayah != null ? "ayah" : "surah");
  const [reciter, setReciter] = useState(7);
  const [roster, setRoster]   = useState<Roster[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  const wantAyah = scope === "ayah" ? ayah ?? null : null;

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const qs = new URLSearchParams({ surah: String(surah), reciter: String(reciter) });
    if (wantAyah != null) qs.set("ayah", String(wantAyah));

    const res = await fetch(`/api/quran/audio?${qs}`).catch(() => null);
    if (!res?.ok) {
      setState({ kind: "error", message: "That recitation could not be found." });
      return;
    }
    const d = await res.json() as { url: string; reciters?: Roster[] };
    if (d.reciters) setRoster(d.reciters);
    setState({ kind: "ready", url: d.url });
  }, [surah, reciter, wantAyah]);

  // Re-resolve whenever what is being asked for changes, but only while open —
  // a closed player has no reason to hit the network.
  useEffect(() => {
    if (!open) return;
    setPlaying(false);
    load();
  }, [open, load]);

  // Keep the button in step with the element, including when playback ends or
  // the user uses the OS media keys.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const on  = () => setPlaying(true);
    const off = () => setPlaying(false);
    el.addEventListener("play", on);
    el.addEventListener("pause", off);
    el.addEventListener("ended", off);
    return () => {
      el.removeEventListener("play", on);
      el.removeEventListener("pause", off);
      el.removeEventListener("ended", off);
    };
  }, [state]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => setState({ kind: "error", message: "Playback was blocked." }));
    else el.pause();
  }, []);

  return (
    <>
      <button
        className="tb-btn"
        data-active={open ? "true" : "false"}
        onClick={() => setOpen((v) => !v)}
        title="Recitation"
        aria-label="Recitation"
      >
        <Volume2 size={16} aria-hidden /> Listen
      </button>

      {open && (
        <div className="rec" role="region" aria-label="Recitation player">
          <div className="rec-head">
            <strong className="rec-title">{surahName}</strong>
            <button className="rec-x" onClick={() => setOpen(false)} aria-label="Close player">
              <X size={15} />
            </button>
          </div>

          <div className="rec-scope" role="group" aria-label="What to play">
            <button
              className="rec-chip" data-active={scope === "surah" ? "true" : "false"}
              onClick={() => setScope("surah")}
            >Whole sūrah</button>
            <button
              className="rec-chip" data-active={scope === "ayah" ? "true" : "false"}
              onClick={() => setScope("ayah")}
              disabled={ayah == null}
              title={ayah == null ? "Open a verse first" : `Āyah ${ayah}`}
            >{ayah != null ? `Āyah ${ayah}` : "One āyah"}</button>
          </div>

          {state.kind === "error" && <p className="rec-error">{state.message}</p>}

          <div className="rec-controls">
            <button
              className="rec-play"
              onClick={toggle}
              disabled={state.kind !== "ready"}
              aria-label={playing ? "Pause" : "Play"}
            >
              {state.kind === "loading"
                ? <Loader2 size={18} className="rec-spin" aria-hidden />
                : playing ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
            </button>

            {state.kind === "ready" && (
              /* The native control bar is deliberate: it already gives a
                 scrubber, volume, speed and OS media-key integration, all of
                 them keyboard-accessible. Re-drawing that by hand would be a
                 worse version of something the platform does well. */
              <audio
                ref={audioRef}
                className="rec-audio"
                src={state.url}
                controls
                preload="metadata"
                onError={() => setState({ kind: "error", message: "That file would not play." })}
              />
            )}
          </div>

          {roster.length > 0 && (
            <label className="rec-reciter">
              <span className="an-muted">Reciter</span>
              <select
                className="an-select"
                value={reciter}
                onChange={(e) => setReciter(Number(e.target.value))}
              >
                {roster.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
          )}
        </div>
      )}
    </>
  );
}
