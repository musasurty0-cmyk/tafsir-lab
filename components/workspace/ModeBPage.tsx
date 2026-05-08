"use client";

/**
 * ModeBPage — Mushaf canvas mode (Phase 7 / Phase 9).
 *
 * Notes are now fully controlled: the parent (WorkspacePageView) owns
 * the notes array and passes update/delete callbacks down.
 *
 * Split-view additions (Phase 9):
 *   onAyahSelect   — fired whenever the user opens FocusAnnotation for a
 *                    word or ayah-end; lets Mode A highlight that verse.
 *   scrollToNoteId — when set, the canvas viewport animates to bring that
 *                    note into view (driven by Mode A note-card click).
 */

import {
  useCallback, useEffect, useLayoutEffect, useMemo,
  useRef, useState,
} from "react";

const HINT_KEY        = "tl-word-tap-hint-dismissed";
const MUSHAF_PAGE_KEY = (pageId: string) => `tl-mushaf-page:${pageId}`;
import type { Verse, Chapter, QCFVerse } from "@/lib/types";
import type { ProgressStatus } from "@/lib/services/progress.service";
import type { NoteData } from "./NoteCard";
import QCFMushafPage from "./QCFMushafPage";
import AnchoredNoteCard from "./AnchoredNoteCard";
import DrawingCanvas, { type DrawTool, type DrawingCanvasHandle } from "./DrawingCanvas";
import CanvasToolRail, {
  type ToolSettings,
  DEFAULT_TOOL_SETTINGS,
} from "./CanvasToolRail";
import FocusAnnotation from "./FocusAnnotation";

// ── Re-exported types ──────────────────────────────────────────────────────

export interface CanvasViewport { x: number; y: number; zoom: number; }

export interface PageUserPrefsData {
  pageId:         string;
  userId:         string;
  collapsedAyahs: number[];
  canvasViewport: CanvasViewport | null;
}

// ── Constants ─────────────────────────────────────────────────────────────

const ZOOM_MIN             = 0.3;
const ZOOM_MAX             = 2.5;
const MUSHAF_CARD_WIDTH    = 720;
const VIEWPORT_DEBOUNCE_MS = 800;
const NOTE_GAP             = 40;

// ── Helpers ───────────────────────────────────────────────────────────────

function getOffsetRelativeTo(el: HTMLElement, ancestor: HTMLElement): { x: number; y: number } {
  let x = 0, y = 0;
  let cur: HTMLElement | null = el;
  while (cur && cur !== ancestor) { x += cur.offsetLeft; y += cur.offsetTop; cur = cur.offsetParent as HTMLElement | null; }
  return { x, y };
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

// ── Keyboard → tool map ───────────────────────────────────────────────────

const TOOL_HOTKEYS: Record<string, DrawTool> = {
  h: "hand", p: "pen", l: "highlight", a: "arrow", e: "eraser",
};

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  verses:           Verse[];
  pageId:           string;
  surahNumber:      number;
  chapter:          Chapter;
  userPrefs:        PageUserPrefsData | null;
  personalProgress: Record<string, ProgressStatus>;
  groupProgress:    Record<string, { status: ProgressStatus; lastChangedBy: string }>;
  notes:            NoteData[];
  onOpenTafsir:     (verseKey: string) => void;
  onNoteUpdated:    (note: NoteData) => void;
  onNoteDeleted:    (noteId: string) => void;
  // Split-view sync
  onAyahSelect?:    (verseKey: string) => void;
  scrollToNoteId?:  string | null;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function ModeBPage({
  verses, pageId, chapter,
  userPrefs,
  notes,
  onOpenTafsir,
  onNoteUpdated,
  onNoteDeleted,
  onAyahSelect,
  scrollToNoteId,
}: Props) {

  // ── Focus annotation state ────────────────────────────────────────────
  const [focusAnchor, setFocusAnchor] = useState<{
    verseKey: string;
    wordPos:  number | null;
  } | null>(null);

  // ── Word-tap hint chip ────────────────────────────────────────────────
  const [showHint, setShowHint] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem(HINT_KEY)) setShowHint(true);
  }, []);
  function dismissHint() {
    setShowHint(false);
    localStorage.setItem(HINT_KEY, "1");
  }

  // ── Mushaf page navigation ────────────────────────────────────────────
  const availablePages = useMemo(() => {
    const seen = new Set<number>();
    const pages: number[] = [];
    for (const v of verses) {
      if (v.page_number && !seen.has(v.page_number)) {
        seen.add(v.page_number);
        pages.push(v.page_number);
      }
    }
    return pages.sort((a, b) => a - b);
  }, [verses]);

  const [currentMushafahPage, setCurrentMushafahPage] = useState<number>(
    () => chapter.pages[0],
  );

  // Sync from localStorage once on mount, and validate against available pages
  useEffect(() => {
    const stored = localStorage.getItem(MUSHAF_PAGE_KEY(pageId));
    if (stored) {
      const n = Number(stored);
      if (!isNaN(n)) { setCurrentMushafahPage(n); return; }
    }
    setCurrentMushafahPage(chapter.pages[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If stored page is outside this chapter's range, fall back to first page
  useEffect(() => {
    if (availablePages.length > 0 && !availablePages.includes(currentMushafahPage)) {
      setCurrentMushafahPage(availablePages[0]);
    }
  }, [availablePages, currentMushafahPage]);

  const pageVerses = useMemo(
    () => verses.filter((v) => v.page_number === currentMushafahPage),
    [verses, currentMushafahPage],
  );

  const pageAyahSet = useMemo(
    () => new Set(pageVerses.map((v) => v.verse_number)),
    [pageVerses],
  );

  // Show page-anchored notes only on the first page of the chapter
  const pageNotes = useMemo(
    () => notes.filter((n) => {
      if (n.anchorType === "page") return currentMushafahPage === availablePages[0];
      return n.ayahNumber != null && pageAyahSet.has(n.ayahNumber);
    }),
    [notes, pageAyahSet, currentMushafahPage, availablePages],
  );

  const openFocus = useCallback((verseKey: string, wordPos: number | null) => {
    setFocusAnchor({ verseKey, wordPos });
    // Signal Mode A to highlight this verse when in split view
    onAyahSelect?.(verseKey);
  }, [onAyahSelect]);

  const closeFocus = useCallback(() => setFocusAnchor(null), []);

  // ── QCF page data (fetched client-side when the page changes) ─────────
  const [qcfVerses,  setQcfVerses]  = useState<QCFVerse[]>([]);
  const [qcfLoading, setQcfLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setQcfLoading(true);
    setQcfVerses([]);

    fetch(`/api/quran/page/${currentMushafahPage}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data: { verses?: QCFVerse[] }) => {
        if (!cancelled) {
          setQcfVerses(data.verses ?? []);
          setQcfLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setQcfLoading(false);
      });

    return () => { cancelled = true; };
  }, [currentMushafahPage]);

  // ── Viewport ──────────────────────────────────────────────────────────
  const [viewport, setViewport] = useState<CanvasViewport>(() => ({
    x:    userPrefs?.canvasViewport?.x    ?? 40,
    y:    userPrefs?.canvasViewport?.y    ?? 40,
    zoom: userPrefs?.canvasViewport?.zoom ?? 1,
  }));
  const viewportRef = useRef(viewport);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);

  // ── Drawing tool + per-tool colour/width settings ────────────────────
  const [tool, setTool]         = useState<DrawTool>("hand");
  const [settings, setSettings] = useState<ToolSettings>(DEFAULT_TOOL_SETTINGS);
  const [canUndo, setCanUndo]   = useState(false);
  const [canRedo, setCanRedo]   = useState(false);
  const drawingRef              = useRef<DrawingCanvasHandle>(null);

  // Active stroke params forwarded to DrawingCanvas
  const strokeColor =
    tool === "highlight" ? settings.highlight.color : settings.pen.color;
  const strokeWidth =
    tool === "highlight" ? settings.highlight.width
    : tool === "arrow"   ? settings.pen.width        // arrow inherits pen width
    : settings.pen.width;

  const handleHistory = useCallback((u: boolean, r: boolean) => {
    setCanUndo(u);
    setCanRedo(r);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (focusAnchor) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // Tool shortcuts (no modifier)
      if (!e.metaKey && !e.ctrlKey) {
        const t = TOOL_HOTKEYS[e.key.toLowerCase()];
        if (t) { setTool(t); return; }
      }
      // Undo: ⌘/Ctrl + Z
      if (e.key === "z" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault(); drawingRef.current?.undo();
      }
      // Redo: ⌘/Ctrl + Shift + Z  or  ⌘/Ctrl + Y
      if ((e.key === "z" && (e.metaKey || e.ctrlKey) && e.shiftKey) ||
          (e.key === "y" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault(); drawingRef.current?.redo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusAnchor]);

  // ── DOM refs for anchor engine ────────────────────────────────────────
  const innerRef      = useRef<HTMLDivElement>(null);
  const mushafCardRef = useRef<HTMLDivElement>(null);
  const ayahRefs      = useRef(new Map<number, HTMLElement>());
  const wordRefs      = useRef(new Map<string, HTMLElement>());

  const registerAyahRef = useCallback((ayahNum: number, el: HTMLElement | null) => {
    if (el) ayahRefs.current.set(ayahNum, el);
    else    ayahRefs.current.delete(ayahNum);
  }, []);

  const registerWordRef = useCallback((ayahNum: number, wordPos: number, el: HTMLElement | null) => {
    const key = `${ayahNum}:${wordPos}`;
    if (el) wordRefs.current.set(key, el);
    else    wordRefs.current.delete(key);
  }, []);

  // ── Note position resolution ──────────────────────────────────────────
  const [notePositions, setNotePositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  function resolveNotePosition(note: NoteData): { x: number; y: number } | null {
    const inner = innerRef.current;
    if (!inner) return null;
    const cardW = mushafCardRef.current?.offsetWidth ?? MUSHAF_CARD_WIDTH;

    // Clamp offsetX: never behind Mushaf card, max 640 px to the right so
    // notes are reachable without extreme panning on initial load.
    const clampedOffsetX = clamp(note.offsetX ?? 0, 0, 640);
    const noteX = cardW + NOTE_GAP + clampedOffsetX;
    const oy    = note.offsetY ?? 0;

    if (note.anchorType === "page") return { x: noteX, y: Math.max(0, oy) };

    if (note.anchorType === "ayah" && note.ayahNumber != null) {
      const el = ayahRefs.current.get(note.ayahNumber);
      if (!el) return null;
      return { x: noteX, y: Math.max(0, getOffsetRelativeTo(el, inner).y + oy) };
    }

    if (note.anchorType === "word" && note.ayahNumber != null && note.wordPosition != null) {
      const wordEl = wordRefs.current.get(`${note.ayahNumber}:${note.wordPosition}`);
      if (!wordEl) return null;
      return { x: noteX, y: Math.max(0, getOffsetRelativeTo(wordEl, inner).y + oy) };
    }
    return null;
  }

  useLayoutEffect(() => {
    const positions = new Map<string, { x: number; y: number }>();
    for (const note of pageNotes) {
      const pos = resolveNotePosition(note);
      if (pos) positions.set(note.id, pos);
    }
    setNotePositions(positions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNotes]);

  // ── Connector anchor points ───────────────────────────────────────────
  const anchorPoints = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    const inner = innerRef.current;
    if (!inner) return map;
    const cardW = mushafCardRef.current?.offsetWidth ?? MUSHAF_CARD_WIDTH;

    for (const note of pageNotes) {
      if (!notePositions.has(note.id)) continue;
      if (note.anchorType === "page") { map.set(note.id, { x: cardW, y: (notePositions.get(note.id)?.y ?? 0) + 16 }); continue; }
      if (note.anchorType === "ayah" && note.ayahNumber != null) {
        const el = ayahRefs.current.get(note.ayahNumber);
        if (el) map.set(note.id, { x: cardW, y: getOffsetRelativeTo(el, inner).y + 8 });
      }
      if (note.anchorType === "word" && note.ayahNumber != null && note.wordPosition != null) {
        const wEl = wordRefs.current.get(`${note.ayahNumber}:${note.wordPosition}`);
        if (wEl) map.set(note.id, { x: cardW, y: getOffsetRelativeTo(wEl, inner).y + 8 });
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNotes, notePositions]);

  // ── Viewport persistence ──────────────────────────────────────────────
  const vDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const patchViewport = useCallback((vp: CanvasViewport) => {
    if (vDebounceRef.current) clearTimeout(vDebounceRef.current);
    vDebounceRef.current = setTimeout(() => {
      fetch(`/api/pages/${pageId}/prefs`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasViewport: vp }),
      }).catch(() => {});
    }, VIEWPORT_DEBOUNCE_MS);
  }, [pageId]);
  useEffect(() => () => { if (vDebounceRef.current) clearTimeout(vDebounceRef.current); }, []);

  // ── Page navigation callbacks (after patchViewport to avoid TDZ) ──────
  const goToPage = useCallback((p: number) => {
    setCurrentMushafahPage(p);
    localStorage.setItem(MUSHAF_PAGE_KEY(pageId), String(p));
    setFocusAnchor(null);
    // Snap viewport back to top-left so the new page starts in view
    const next: CanvasViewport = { x: 40, y: 40, zoom: viewportRef.current.zoom };
    setViewport(next);
    patchViewport(next);
  }, [pageId, patchViewport]);

  const goToPrevPage = useCallback(() => {
    const idx = availablePages.indexOf(currentMushafahPage);
    if (idx > 0) goToPage(availablePages[idx - 1]);
  }, [availablePages, currentMushafahPage, goToPage]);

  const goToNextPage = useCallback(() => {
    const idx = availablePages.indexOf(currentMushafahPage);
    if (idx < availablePages.length - 1) goToPage(availablePages[idx + 1]);
  }, [availablePages, currentMushafahPage, goToPage]);

  // ── Scroll to note (split-view sync) ─────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollToNoteId) return;
    const pos = notePositions.get(scrollToNoteId);
    if (!pos) return;
    const container = containerRef.current;
    if (!container) return;
    const rect   = container.getBoundingClientRect();
    const z      = viewportRef.current.zoom;
    // Centre the note card (approx 140px half-width) in the canvas pane.
    const targetX = rect.width  / 2 - pos.x * z - 140;
    const targetY = rect.height / 2 - pos.y * z - 40;
    const next: CanvasViewport = { zoom: z, x: targetX, y: targetY };
    setViewport(next);
    patchViewport(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToNoteId]);

  // ── Wheel zoom (hand tool only — prevents accidental zoom while drawing) ─
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (focusAnchor) return;
      if (tool !== "hand") return; // don't zoom while a drawing tool is selected
      e.preventDefault();
      const delta   = -e.deltaY * 0.001 * (e.deltaMode === 1 ? 16 : 1);
      const prev    = viewportRef.current;
      const newZoom = clamp(prev.zoom + prev.zoom * delta * 10, ZOOM_MIN, ZOOM_MAX);
      const rect    = el!.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const scale = newZoom / prev.zoom;
      const next: CanvasViewport = { zoom: newZoom, x: mx - (mx - prev.x) * scale, y: my - (my - prev.y) * scale };
      setViewport(next); patchViewport(next);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [patchViewport, focusAnchor, tool]);

  // ── Pan + pinch-zoom (pointer events — works for mouse, Apple Pencil, touch) ──
  //
  // Routing rules (enforced here + in DrawingCanvas):
  //   pointerType "touch"  → always pan/pinch, regardless of active tool
  //   pointerType "pen"    → draw when tool ≠ hand; pan when tool = hand
  //   pointerType "mouse"  → draw when tool ≠ hand; pan when tool = hand
  //
  // Touch events never reach DrawingCanvas draw logic (DrawingCanvas returns
  // early for pointerType "touch"), so they always bubble here.

  const isDragging = useRef(false);
  const dragStart  = useRef<{ mx: number; my: number; vx: number; vy: number } | null>(null);
  // Per-pointer tracking for multi-touch pinch
  const touchPts   = useRef(new Map<number, { x: number; y: number }>());
  const pinchBase  = useRef<{
    baseDist: number;
    baseZoom: number;
    worldX:   number;  // canvas-world point under the initial pinch midpoint
    worldY:   number;
  } | null>(null);

  function startPan(mx: number, my: number) {
    isDragging.current = true;
    containerRef.current?.setAttribute("data-panning", "true");
    dragStart.current = { mx, my, vx: viewportRef.current.x, vy: viewportRef.current.y };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (focusAnchor) return;
    // Suppress the iOS "Copy / Search with Google" callout on long stylus press.
    // Calling preventDefault on pointerdown prevents touchstart from firing,
    // which is what triggers the system context menu on iOS.
    if (e.pointerType === "pen") e.preventDefault();
    const isTouch  = e.pointerType === "touch";
    const shouldPan = (tool === "hand" && e.button === 0) || isTouch;
    if (!shouldPan) return;

    // Capture so all subsequent move/up events route here regardless of target
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    if (isTouch) {
      touchPts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pts = [...touchPts.current.values()];

      if (pts.length >= 2) {
        // Two-finger pinch — record world point under initial midpoint so zoom
        // keeps that point visually fixed under the pinch center.
        const [p0, p1] = pts;
        const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const cx   = (p0.x + p1.x) / 2 - rect.left;
        const cy   = (p0.y + p1.y) / 2 - rect.top;
        const vp   = viewportRef.current;
        pinchBase.current = {
          baseDist: dist,
          baseZoom: vp.zoom,
          worldX:   (cx - vp.x) / vp.zoom,
          worldY:   (cy - vp.y) / vp.zoom,
        };
        isDragging.current = false;
        dragStart.current  = null;
      } else {
        // Single touch — start pan
        pinchBase.current = null;
        startPan(e.clientX, e.clientY);
      }
    } else {
      // Mouse / stylus hand-tool pan
      startPan(e.clientX, e.clientY);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (e.pointerType === "touch") {
      if (!touchPts.current.has(e.pointerId)) return;
      touchPts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pts = [...touchPts.current.values()];

      if (pts.length >= 2 && pinchBase.current) {
        // Pinch: zoom + simultaneous pan (midpoint tracks your fingers)
        const [p0, p1] = pts;
        const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const cx   = (p0.x + p1.x) / 2 - rect.left;
        const cy   = (p0.y + p1.y) / 2 - rect.top;
        const { baseDist, baseZoom, worldX, worldY } = pinchBase.current;
        const newZoom = clamp(baseZoom * (dist / baseDist), ZOOM_MIN, ZOOM_MAX);
        const next: CanvasViewport = {
          zoom: newZoom,
          x:    cx - worldX * newZoom,
          y:    cy - worldY * newZoom,
        };
        setViewport(next); patchViewport(next);
      } else if (pts.length === 1 && isDragging.current && dragStart.current) {
        // Single-touch pan
        const next: CanvasViewport = {
          ...viewportRef.current,
          x: dragStart.current.vx + (e.clientX - dragStart.current.mx),
          y: dragStart.current.vy + (e.clientY - dragStart.current.my),
        };
        setViewport(next); patchViewport(next);
      }
      return;
    }

    // Mouse / stylus pan
    if (!isDragging.current || !dragStart.current) return;
    const next: CanvasViewport = {
      ...viewportRef.current,
      x: dragStart.current.vx + (e.clientX - dragStart.current.mx),
      y: dragStart.current.vy + (e.clientY - dragStart.current.my),
    };
    setViewport(next); patchViewport(next);
  }

  function onPointerUp(e: React.PointerEvent) {
    // Prevent mouseup / click compat events for stylus (same reason as DrawingCanvas.onUp)
    if (e.pointerType === "pen") e.preventDefault();
    if (e.pointerType === "touch") {
      touchPts.current.delete(e.pointerId);
      const remaining = touchPts.current.size;
      if (remaining < 2) pinchBase.current = null;

      if (remaining === 0) {
        isDragging.current = false;
        dragStart.current  = null;
        containerRef.current?.removeAttribute("data-panning");
      } else if (remaining === 1) {
        // Lifted one finger — transition back to single-touch pan
        const [pt] = touchPts.current.values();
        startPan(pt.x, pt.y);
      }
      return;
    }

    isDragging.current = false;
    dragStart.current  = null;
    containerRef.current?.removeAttribute("data-panning");
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="mode-b-canvas"
      data-tool={tool}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onCopy={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        // Prevent iOS from showing copy/paste/translate popup when palm
        // rests on the canvas — even when DrawingCanvas passes events through
        WebkitTouchCallout: "none",
        WebkitUserSelect:   "none",
        userSelect:         "none",
      } as React.CSSProperties}
    >
      {/* ── Transformed inner layer ── */}
      <div
        ref={innerRef}
        className="mode-b-inner"
        style={{ transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.zoom})`, transformOrigin: "0 0", width: MUSHAF_CARD_WIDTH }}
      >
        <QCFMushafPage
          verses={qcfVerses}
          pageNumber={currentMushafahPage}
          chapter={chapter}
          loading={qcfLoading}
          cardRef={mushafCardRef}
          onRegisterAyahRef={registerAyahRef}
          onRegisterWordRef={registerWordRef}
          onOpenFocus={openFocus}
        />

        {/* SVG connector lines */}
        <svg className="mode-b-connectors" style={{ position: "absolute", top: 0, left: 0, width: 0, height: 0, overflow: "visible", pointerEvents: "none" }} aria-hidden="true">
          {pageNotes.map((note) => {
            const notePos  = notePositions.get(note.id);
            const anchorPt = anchorPoints.get(note.id);
            if (!notePos || !anchorPt) return null;
            return (
              <line key={`conn-${note.id}`} x1={anchorPt.x} y1={anchorPt.y} x2={notePos.x} y2={notePos.y + 16} className="mode-b-connector-line" />
            );
          })}
        </svg>

        {/* Anchored note cards */}
        {pageNotes.map((note) => {
          const pos = notePositions.get(note.id);
          if (!pos) return null;
          return (
            <AnchoredNoteCard
              key={note.id}
              note={note}
              x={pos.x}
              y={pos.y}
              onUpdated={onNoteUpdated}
              onDeleted={onNoteDeleted}
            />
          );
        })}
      </div>

      {/* ── Drawing canvas overlay ── */}
      <DrawingCanvas
        ref={drawingRef}
        pageId={pageId}
        tool={tool}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
        viewport={viewport}
        onHistoryChange={handleHistory}
      />

      {/* ── Vertical tool rail (left side) ── */}
      <CanvasToolRail
        tool={tool}
        onToolChange={setTool}
        settings={settings}
        onSettings={setSettings}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => drawingRef.current?.undo()}
        onRedo={() => drawingRef.current?.redo()}
      />

      {/* ── Zoom HUD ── */}
      <div className="mode-b-zoom-controls">
        <button className="mode-b-zoom-btn" title="Zoom in"  onClick={() => { const next = { ...viewportRef.current, zoom: clamp(viewportRef.current.zoom * 1.2, ZOOM_MIN, ZOOM_MAX) }; setViewport(next); patchViewport(next); }}>+</button>
        <span className="mode-b-zoom-label">{Math.round(viewport.zoom * 100)}%</span>
        <button className="mode-b-zoom-btn" title="Zoom out" onClick={() => { const next = { ...viewportRef.current, zoom: clamp(viewportRef.current.zoom / 1.2, ZOOM_MIN, ZOOM_MAX) }; setViewport(next); patchViewport(next); }}>−</button>
        <button className="mode-b-zoom-btn" title="Reset view" onClick={() => { const next: CanvasViewport = { x: 40, y: 40, zoom: 1 }; setViewport(next); patchViewport(next); }} style={{ fontSize: "0.7rem" }}>↺</button>
      </div>

      {/* ── Mushaf page navigator ── */}
      {availablePages.length > 1 && (
        <div className="mushaf-nav" onPointerDown={(e) => e.stopPropagation()}>
          <button
            className="mushaf-nav-btn"
            disabled={availablePages.indexOf(currentMushafahPage) <= 0}
            onClick={goToPrevPage}
            title="Previous Mushaf page"
            aria-label="Previous page"
          >
            ‹
          </button>
          <div className="mushaf-nav-info">
            <span className="mushaf-nav-page">Page {currentMushafahPage}</span>
            {pageVerses.length > 0 && (
              <>
                <span className="mushaf-nav-sep">·</span>
                <span className="mushaf-nav-surah">{chapter.name_simple}</span>
              </>
            )}
          </div>
          <button
            className="mushaf-nav-btn"
            disabled={availablePages.indexOf(currentMushafahPage) >= availablePages.length - 1}
            onClick={goToNextPage}
            title="Next Mushaf page"
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      )}

      {/* ── Word-tap hint chip ── */}
      {showHint && !focusAnchor && (
        <div className="mode-b-word-hint">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>
          </svg>
          Tap any Arabic word to open a note space for it
          <button className="mode-b-word-hint-dismiss" onClick={dismissHint} title="Dismiss">×</button>
        </div>
      )}

      {/* ── Word/ayah focus annotation (full-screen, shown on demand) ── */}
      {focusAnchor && (
        <FocusAnnotation
          verses={verses}
          verseKey={focusAnchor.verseKey}
          wordPos={focusAnchor.wordPos}
          onClose={closeFocus}
          onOpenTafsir={onOpenTafsir}
        />
      )}
    </div>
  );
}
