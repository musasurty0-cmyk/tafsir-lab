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
  const [kind,    setKind]    = useState<"study" | "boards" | "books">("study");
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
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
        <h2 className="modal-title">{t("modal.newWorkspace")}</h2>

        <form onSubmit={handleSubmit}>
          <label className="modal-label" htmlFor="ws-name">{t("modal.name")}</label>
          <input
            ref={inputRef}
            id="ws-name"
            className="modal-input"
            placeholder={t("modal.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            disabled={loading}
          />

          <label className="modal-label" style={{ marginTop: 18 }}>{t("modal.type")}</label>
          <div className="modal-type-row">
            <button
              type="button"
              className="modal-type-btn"
              data-active={type === "private" ? "true" : "false"}
              onClick={() => setType("private")}
              disabled={loading}
            >
              <span className="modal-type-icon">🔒</span>
              <div>
                <div className="modal-type-name">{t("modal.private")}</div>
                <div className="modal-type-desc">{t("modal.privateDesc")}</div>
              </div>
            </button>

            <button
              type="button"
              className="modal-type-btn"
              data-active={type === "group" ? "true" : "false"}
              onClick={() => setType("group")}
              disabled={loading}
            >
              <span className="modal-type-icon">👥</span>
              <div>
                <div className="modal-type-name">{t("modal.group")}</div>
                <div className="modal-type-desc">{t("modal.groupDesc")}</div>
              </div>
            </button>
          </div>

          <label className="modal-label" style={{ marginTop: 18 }}>{t("modal.whatFor")}</label>
          <div className="kind-row" role="radiogroup" aria-label={t("modal.whatFor")}>
            <KindCard
              active={kind === "study"} disabled={loading} onSelect={() => setKind("study")}
              name={t("modal.study")} caption={t("modal.studyDesc")}
              preview={<QuranPreview />}
            />
            <KindCard
              active={kind === "boards"} disabled={loading} onSelect={() => setKind("boards")}
              name={t("modal.boards")} caption={t("modal.boardsDesc")}
              preview={<CanvasPreview />}
            />
            <KindCard
              active={kind === "books"} disabled={loading} onSelect={() => setKind("books")}
              name={t("modal.books")} caption={t("modal.booksDesc")}
              preview={<BookPreview />}
            />
          </div>

          {error && <p className="modal-error">{error}</p>}

          <div className="modal-actions">
            <button
              type="button"
              className="modal-btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              {t("modal.cancel")}
            </button>
            <button
              type="submit"
              className="modal-btn-create"
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
      className="kind-card"
      data-active={active ? "true" : "false"}
      onClick={onSelect}
      disabled={disabled}
    >
      <span className="kind-preview" aria-hidden>{preview}</span>
      <span className="kind-name">{name}</span>
      <span className="kind-caption">{caption}</span>
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
