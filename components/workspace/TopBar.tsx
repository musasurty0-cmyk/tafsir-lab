"use client";

/**
 * TopBar — workspace page header.
 *
 * Breadcrumbs are clickable Links.
 * Share button removed (was never implemented).
 * Mode toggle: Editor | Canvas | Split.
 */

import Link from "next/link";
import { Sliders } from "lucide-react";
import type { Chapter } from "@/lib/types";
import PresenceBar from "./PresenceBar";
import type { PresenceData } from "@/lib/collab/usePresence";

// ── Icons ──────────────────────────────────────────────────────────────────

const PenIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
);

const GridIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3"  y="3"  width="7" height="7"/>
    <rect x="14" y="3"  width="7" height="7"/>
    <rect x="3"  y="14" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/>
  </svg>
);

const SplitIcon = ({ size = 13 }: { size?: number }) => (
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

export type ViewMode = "editor" | "canvas" | "split";

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
  showTweaks:         boolean;
  onToggleTweaks:     () => void;
  formattingOpen:     boolean;
  onToggleFormatting: () => void;
  /** Live collaborators — provided by WorkspacePageView via usePresence */
  presenceOthers?:    PresenceData[];
  /** Realtime room connection state — drives the Live indicator */
  liveStatus?:        "connecting" | "connected" | "disconnected";
}

// ── Component ─────────────────────────────────────────────────────────────

export default function TopBar({
  workspaceId,
  surahNumber,
  workspaceName,
  chapter,
  activePageTitle,
  mode,
  onSetMode,
  progressLoading,
  tafsirOpen,
  onToggleTafsir,
  showTweaks,
  onToggleTweaks,
  formattingOpen,
  onToggleFormatting,
  presenceOthers = [],
  liveStatus,
}: Props) {
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
          >
            <PenIcon /> Editor
          </button>
          <button
            className="mode-btn"
            data-active={mode === "canvas" ? "true" : "false"}
            onClick={() => mode !== "canvas" && onSetMode("canvas")}
            title="Spatial canvas"
          >
            <GridIcon /> Canvas
          </button>
          <button
            className="mode-btn mode-btn--split"
            data-active={mode === "split" ? "true" : "false"}
            onClick={() => mode !== "split" && onSetMode("split")}
            title="Split — Editor + Canvas"
          >
            <SplitIcon /> Split
          </button>
        </div>

        {/* Formatting toggle — only in editor / split mode */}
        {mode !== "canvas" && (
          <>
            <div className="tb-divider" />
            <button
              className="tb-btn"
              data-active={formattingOpen ? "true" : "false"}
              onClick={onToggleFormatting}
              title={formattingOpen ? "Hide formatting" : "Show formatting"}
            >
              <FormattingIcon /> Formatting
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
          <BookOpenIcon /> Tafsīr
        </button>

        <div className="tb-divider" />

        {/* Visual tweaks */}
        <button
          className="tb-btn"
          data-active={showTweaks ? "true" : "false"}
          onClick={onToggleTweaks}
          title="Visual tweaks"
        >
          <Sliders size={14} /> Tweaks
        </button>
      </div>
    </div>
  );
}
