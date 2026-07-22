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

interface Props {
  onClose: () => void;
}

export default function NewWorkspaceModal({ onClose }: Props) {
  const router   = useRouter();
  const t        = useT();
  const inputRef = useRef<HTMLInputElement>(null);

  const [name,    setName]    = useState("");
  const [type,    setType]    = useState<"private" | "group">("private");
  const [kind,    setKind]    = useState<"study" | "boards" | "books">("study");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Auto-focus name input; Escape closes.
  useEffect(() => {
    inputRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
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
          <div className="modal-type-row">
            <button
              type="button"
              className="modal-type-btn"
              data-active={kind === "study" ? "true" : "false"}
              onClick={() => setKind("study")}
              disabled={loading}
            >
              <span className="modal-type-icon">📖</span>
              <div>
                <div className="modal-type-name">{t("modal.study")}</div>
                <div className="modal-type-desc">{t("modal.studyDesc")}</div>
              </div>
            </button>

            <button
              type="button"
              className="modal-type-btn"
              data-active={kind === "boards" ? "true" : "false"}
              onClick={() => setKind("boards")}
              disabled={loading}
            >
              <span className="modal-type-icon">◇</span>
              <div>
                <div className="modal-type-name">{t("modal.boards")}</div>
                <div className="modal-type-desc">{t("modal.boardsDesc")}</div>
              </div>
            </button>

            <button
              type="button"
              className="modal-type-btn"
              data-active={kind === "books" ? "true" : "false"}
              onClick={() => setKind("books")}
              disabled={loading}
            >
              <span className="modal-type-icon">📚</span>
              <div>
                <div className="modal-type-name">{t("modal.books")}</div>
                <div className="modal-type-desc">{t("modal.booksDesc")}</div>
              </div>
            </button>
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
