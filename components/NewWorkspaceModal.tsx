"use client";

/**
 * NewWorkspaceModal — shared modal for creating a workspace.
 * Used in Rail, WorkspacePicker, WorkspaceHome, and the root 0-workspace screen.
 *
 * On success: navigates to the new workspace and calls onClose.
 * Dismiss: Escape key or clicking the backdrop.
 */

import { pushWithSplash } from "@/lib/nav-splash";
import { useT } from "@/lib/i18n/LocaleProvider";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDismissable } from "@/lib/use-dismissable";
import { Check, Lock, Users } from "lucide-react";

interface Props {
  onClose: () => void;
  /** Viewport centre of the control that opened this, so the card can grow
   *  from there instead of arriving from nowhere. Optional — without it the
   *  card simply scales from its own centre. */
  originPoint?: { x: number; y: number } | null;
}

export default function NewWorkspaceModal({ onClose, originPoint }: Props) {
  const router   = useRouter();
  const t        = useT();
  const inputRef = useRef<HTMLInputElement>(null);

  const [name,    setName]    = useState("");
  const [type,    setType]    = useState<"private" | "group">("private");
  const [kind,    setKind]    = useState<"study" | "boards" | "books" | "nawawi">("study");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  /* Focus lands after the entrance settles. Focusing on the very first frame
     scrolls the field into place mid-animation on tablets and fights the
     transform; 180ms in, the card has arrived but the user has not yet
     started typing. preventScroll stops any residual jump. */
  useEffect(() => {
    const t = window.setTimeout(
      () => inputRef.current?.focus({ preventScroll: true }),
      180,
    );
    return () => window.clearTimeout(t);
  }, []);

  /* Escape closes, and focus returns to whatever opened this. Shared so the
     two workspace dialogs behave identically — this one used to close on
     Escape and the Join dialog beside it did not. */
  useDismissable(onClose);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError("Name is required"); return; }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/workspaces", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: trimmed, type, kind }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setError(data.error ?? "Failed to create workspace");
        setLoading(false);
        return;
      }

      const { workspace } = await res.json() as { workspace: { id: string } };
      onClose();
      pushWithSplash(router, `/workspaces/${workspace.id}`);
    } catch {
      setError("Network error — please try again");
      setLoading(false);
    }
  }

  const kinds = [
    { id: "study",  name: t("modal.study"),  caption: t("modal.studyDesc"),  preview: <QuranPreview /> },
    { id: "boards", name: t("modal.boards"), caption: t("modal.boardsDesc"), preview: <CanvasPreview /> },
    { id: "books",  name: t("modal.books"),  caption: t("modal.booksDesc"),  preview: <BookPreview /> },
    { id: "nawawi", name: t("modal.nawawi"), caption: t("modal.nawawiDesc"), preview: <NawawiPreview /> },
  ] as const;
  const kindCaption = kinds.find((k) => k.id === kind)?.caption;

  /* One sheet, sized to the window: the header and the buttons stay put and
     only the middle scrolls, so Create is always within reach. Each choice
     shows its description once, under the row, for whichever option is
     picked — four captions inside four tiles made the dialog taller than a
     laptop screen. */
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card modal-card--ws"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nw-title"
        onClick={(e) => e.stopPropagation()}
        style={
          originPoint
            ? ({
                "--modal-origin-x": `${originPoint.x}px`,
                "--modal-origin-y": `${originPoint.y}px`,
              } as React.CSSProperties)
            : undefined
        }
        data-from-origin={originPoint ? "true" : "false"}
      >
        <form className="nw-form" onSubmit={handleSubmit}>
          <h2 className="nw-title" id="nw-title">{t("modal.newWorkspace")}</h2>

          <div className="nw-body">
            <label className="nw-field">
              <span className="nw-label">{t("modal.name")}</span>
              <input
                ref={inputRef}
                id="ws-name"
                className="nw-input"
                placeholder={t("modal.namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                disabled={loading}
                autoComplete="off"
              />
            </label>

            <div className="nw-field">
              <span className="nw-label" id="nw-type-label">{t("modal.type")}</span>
              <div className="nw-seg" role="radiogroup" aria-labelledby="nw-type-label">
                {(["private", "group"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={type === v}
                    className="nw-seg-btn"
                    data-active={type === v ? "true" : "false"}
                    onClick={() => setType(v)}
                    disabled={loading}
                  >
                    {v === "private"
                      ? <Lock size={14} strokeWidth={2.1} aria-hidden />
                      : <Users size={15} strokeWidth={2.1} aria-hidden />}
                    {v === "private" ? t("modal.private") : t("modal.group")}
                  </button>
                ))}
              </div>
              <p className="nw-hint">{type === "private" ? t("modal.privateDesc") : t("modal.groupDesc")}</p>
            </div>

            <div className="nw-field">
              <span className="nw-label" id="nw-kind-label">{t("modal.whatFor")}</span>
              <div className="nw-kinds" role="radiogroup" aria-labelledby="nw-kind-label">
                {kinds.map((k) => (
                  <KindCard
                    key={k.id}
                    active={kind === k.id}
                    disabled={loading}
                    onSelect={() => setKind(k.id)}
                    name={k.name}
                    caption={k.caption}
                    preview={k.preview}
                  />
                ))}
              </div>
              <p className="nw-hint">{kindCaption}</p>
            </div>

            {error && <p className="modal-error">{error}</p>}
          </div>

          <div className="nw-foot">
            <button
              type="button"
              className="nw-btn nw-btn--quiet"
              onClick={onClose}
              disabled={loading}
            >
              {t("modal.cancel")}
            </button>
            <button
              type="submit"
              className="nw-btn nw-btn--primary"
              disabled={loading || !name.trim()}
            >
              {loading ? t("modal.creating") : t("modal.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Workspace kind cards ──────────────────────────────────────────────────
   Three emoji beside three labels asked the reader to imagine the difference
   between a mushaf, a blank canvas and a book. A drawing of each shows it, and
   the choice stops being a guess made before you have seen either.

   The previews are inline SVG rather than screenshots: they inherit the
   theme's own tokens, cost no request, and cannot go stale when the thing they
   depict is restyled. */

function KindCard({
  active, disabled, onSelect, name, caption, preview,
}: {
  active: boolean; disabled: boolean; onSelect: () => void;
  name: string; caption: string; preview: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      title={caption}
      className="nw-kind"
      data-active={active ? "true" : "false"}
      onClick={onSelect}
      disabled={disabled}
    >
      <span className="nw-kind-preview" aria-hidden>{preview}</span>
      <span className="nw-kind-name">{name}</span>
      <span className="nw-kind-check" aria-hidden><Check size={11} strokeWidth={3} /></span>
    </button>
  );
}

/* Right-aligned lines, because that is the one feature that reads as Arabic
   at thumbnail size — the glyphs themselves would be illegible. */
function QuranPreview() {
  return (
    <svg viewBox="0 0 120 84" className="kind-svg">
      <rect x="0" y="0" width="120" height="84" rx="5" className="kp-page" />
      {[14, 24, 34, 44, 54, 64].map((y, i) => (
        <rect key={y} x={i % 3 === 2 ? 34 : 20} y={y} rx="1.5"
              width={i % 3 === 2 ? 66 : 80} height="4" className="kp-line" />
      ))}
      <rect x="20" y="8" width="80" height="3" rx="1.5" className="kp-rule" />
      <circle cx="14" cy="26" r="3" className="kp-mark" />
      <circle cx="14" cy="46" r="3" className="kp-mark kp-mark--2" />
    </svg>
  );
}

/* Forty-two numbered narrations, stacked. Deliberately NOT the Qurʾān
   preview with different line lengths: the whole point of the card is that
   this is a different text with a different shape. */
function NawawiPreview() {
  return (
    <svg viewBox="0 0 120 84" className="kind-svg">
      <rect x="0" y="0" width="120" height="84" rx="5" className="kp-page" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle cx="18" cy={20 + i * 22} r="6.5" className="kp-mark" />
          <rect x="31" y={16 + i * 22} width="70" height="4" rx="2" className="kp-line" />
          <rect x="31" y={24 + i * 22} width="46" height="3" rx="1.5" className="kp-rule" />
        </g>
      ))}
    </svg>
  );
}

function CanvasPreview() {
  return (
    <svg viewBox="0 0 120 84" className="kind-svg">
      <rect x="0" y="0" width="120" height="84" rx="5" className="kp-page" />
      <rect x="16" y="16" width="34" height="24" rx="3" className="kp-note" />
      <rect x="58" y="30" width="42" height="18" rx="3" className="kp-note kp-note--2" />
      <rect x="26" y="52" width="38" height="18" rx="3" className="kp-note" />
      <path d="M50 28 L58 38" className="kp-link" />
      <path d="M45 40 L45 52" className="kp-link" />
    </svg>
  );
}

function BookPreview() {
  return (
    <svg viewBox="0 0 120 84" className="kind-svg">
      <rect x="0" y="0" width="120" height="84" rx="5" className="kp-page" />
      <rect x="18" y="12" width="38" height="60" rx="3" className="kp-note" />
      <rect x="64" y="12" width="38" height="60" rx="3" className="kp-note kp-note--2" />
      {[22, 30, 38, 46].map((y) => (
        <rect key={y} x="70" y={y} width="26" height="3" rx="1.5" className="kp-line" />
      ))}
      <rect x="24" y="22" width="26" height="18" rx="2" className="kp-rule" />
    </svg>
  );
}
