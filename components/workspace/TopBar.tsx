"use client";

/**
 * TopBar — workspace page header.
 *
 * Breadcrumbs are clickable Links.
 * Share button removed (was never implemented).
 * Mode toggle: Editor | Canvas | Split.
 */

import Link from "next/link";
import type { Chapter } from "@/lib/types";
import PresenceBar from "./PresenceBar";
import BookmarkButton from "@/components/BookmarkButton";
import Recitation from "./Recitation";
import type { PresenceData } from "@/lib/collab/usePresence";
import { useT } from "@/lib/i18n/LocaleProvider";

// ── Icons ──────────────────────────────────────────────────────────────────

/* Editor = typing, so a keyboard. The pen moved to Canvas, where you draw. */
const KeyboardIcon = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2"/>
    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>
  </svg>
);

const PenIcon = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
);

const SplitIcon = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3"  y="3" width="8" height="18" rx="1"/>
    <rect x="13" y="3" width="8" height="18" rx="1"/>
  </svg>
);

const BookOpenIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);

const FormattingIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7V4h16v3"/>
    <path d="M9 20h6"/>
    <path d="M12 4v16"/>
  </svg>
);

// ── Types ──────────────────────────────────────────────────────────────────

export type ViewMode = "editor" | "canvas" | "split" | "board" | "read";

const SparkleIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
    <path d="M18 15l.8 2L21 17.8l-2.2.8L18 21l-.8-2.4L15 17.8l2.2-.8z" />
  </svg>
);

const ScriptIcon = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <path d="M9 7h7M9 11h5" />
  </svg>
);

const BoardIcon = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="14" rx="2"/>
    <path d="M7 21l2-3M17 21l-2-3"/>
  </svg>
);

interface Props {
  workspaceId:        string;
  surahNumber:        number;
  workspaceName:      string;
  chapter:            Chapter;
  activePageTitle:    string | null;
  mode:               ViewMode;
  onSetMode:          (mode: ViewMode) => void;
  progressLoading?:   boolean;
  tafsirOpen:         boolean;
  onToggleTafsir:     () => void;
  formattingOpen:     boolean;
  onToggleFormatting: () => void;
  /** Live collaborators — provided by WorkspacePageView via usePresence */
  presenceOthers?:    PresenceData[];
  /** Realtime room connection state — drives the Live indicator */
  liveStatus?:        "connecting" | "connected" | "disconnected";
  /** The page being viewed, so it can be bookmarked. Absent = no page open,
   *  and the control is not rendered rather than rendered inert. */
  activePageId?:      string | null;
  aiOpen?:            boolean;
  onToggleAi?:        () => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function TopBar({
  workspaceId,
  surahNumber,
  workspaceName,
  chapter,
  activePageTitle,
  activePageId,
  aiOpen,
  onToggleAi,
  mode,
  onSetMode,
  progressLoading,
  tafsirOpen,
  onToggleTafsir,
  formattingOpen,
  onToggleFormatting,
  presenceOthers = [],
  liveStatus,
}: Props) {
  const t = useT();
  return (
    <div className="topbar">

      {/* ── Breadcrumbs — every crumb is a real link ── */}
      <div className="crumbs">
        <Link href={`/workspaces/${workspaceId}`} className="crumb crumb--link">
          {workspaceName}
        </Link>

        <span className="crumb-sep">/</span>

        <Link
          href={`/workspaces/${workspaceId}/surahs/${surahNumber}`}
          className="crumb crumb--link"
        >
          {chapter.name_simple}
        </Link>

        {activePageTitle && (
          <>
            <span className="crumb-sep">/</span>
            <span className="crumb" data-current="true">{activePageTitle}</span>
          </>
        )}

        {progressLoading && (
          <span className="topbar-loading" aria-label="Loading progress…">
            <span className="topbar-loading-dot" />
          </span>
        )}
      </div>

      {/* Canvas page navigation portals in here (see ModeBPage). It sits
          directly right of the breadcrumb because it names WHERE you are —
          the same job as the crumbs — rather than what you are doing, which
          is the actions cluster's role. The slot collapses to nothing when
          empty, so other modes get no gap. State stays owned by the canvas. */}
      <div className="tb-canvas-slot" id="topbar-canvas-slot" />

      {/* ── Live status + presence ── */}
      {liveStatus && (
        <span className="live-pill" data-status={liveStatus} title={
          liveStatus === "connected"  ? "Real-time sync active"
        : liveStatus === "connecting" ? "Connecting to live session…"
        :                               "Offline — changes save to the server but won't sync live"
        }>
          <span className="live-pill-dot" />
          {liveStatus === "connected" ? "Live" : liveStatus === "connecting" ? "Connecting" : "Offline"}
        </span>
      )}
      <PresenceBar others={presenceOthers} />

      {/* ── Actions ── */}
      <div className="topbar-actions">

        {/* Mode toggle */}
        <div className="mode-toggle" role="group" aria-label="View mode">
          <button
            className="mode-btn"
            data-active={mode === "editor" ? "true" : "false"}
            onClick={() => mode !== "editor" && onSetMode("editor")}
            title="Document view"
            aria-label="Document view"
          >
            <KeyboardIcon />
          </button>
          <button
            className="mode-btn"
            data-active={mode === "canvas" ? "true" : "false"}
            onClick={() => mode !== "canvas" && onSetMode("canvas")}
            title="Spatial canvas"
            aria-label="Spatial canvas"
          >
            <PenIcon />
          </button>
          <button
            className="mode-btn mode-btn--split"
            data-active={mode === "split" ? "true" : "false"}
            onClick={() => mode !== "split" && onSetMode("split")}
            title="Split — Editor + Canvas"
            aria-label="Split — Editor + Canvas"
          >
            <SplitIcon />
          </button>
          <button
            className="mode-btn"
            data-active={mode === "board" ? "true" : "false"}
            onClick={() => mode !== "board" && onSetMode("board")}
            title="Whiteboard — blank scratch canvas"
            aria-label="Whiteboard — blank scratch canvas"
          >
            <BoardIcon />
          </button>
          <button
            className="mode-btn"
            data-active={mode === "read" ? "true" : "false"}
            onClick={() => mode !== "read" && onSetMode("read")}
            title="Read — Uthmani, Indo-Pak, Tajweed or plain script"
            aria-label="Read — choose a script"
          >
            <ScriptIcon />
          </button>
        </div>

        {/* Formatting toggle — only in editor / split mode */}
        {mode !== "canvas" && mode !== "board" && mode !== "read" && (
          <>
            <div className="tb-divider" />
            <button
              className="tb-btn"
              data-active={formattingOpen ? "true" : "false"}
              onClick={onToggleFormatting}
              title={formattingOpen ? "Hide formatting" : "Show formatting"}
            >
              <FormattingIcon /> {t("topbar.formatting")}
            </button>
          </>
        )}

        <div className="tb-divider" />

        {/* Tafsīr drawer */}
        <button
          className="tb-btn"
          data-active={tafsirOpen ? "true" : "false"}
          onClick={onToggleTafsir}
          title="Toggle Tafsīr drawer"
        >
          <BookOpenIcon /> {t("topbar.tafsir")}
        </button>

        {onToggleAi && (
          <button
            className="tb-btn"
            data-active={aiOpen ? "true" : "false"}
            onClick={onToggleAi}
            title="AI study assistant"
            aria-label="AI study assistant"
          >
            <SparkleIcon /> Ask
          </button>
        )}

        <Recitation surah={surahNumber} surahName={chapter.name_simple} />

        {activePageId && (
          <BookmarkButton
            pageId={activePageId}
            label={activePageTitle ?? chapter.name_simple}
            surahNumber={surahNumber}
          />
        )}

        {/* Tweaks, Export and the language switcher used to sit here. They
            crowded the bar with things that are not per-page actions; language
            and appearance now live in dashboard settings. The trailing
            divider went with them so the bar does not end on a separator. */}
      </div>
    </div>
  );
}
