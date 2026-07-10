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
import FreeTextBox from "./FreeTextBox";
import DrawingCanvas, { type DrawTool, type DrawingCanvasHandle } from "./DrawingCanvas";
import CanvasToolRail, {
  DEFAULT_PEN_COLOR,
  DEFAULT_PEN_SIZE,
  DEFAULT_HIGHLIGHT_COLOR,
  DEFAULT_HIGHLIGHT_SIZE,
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
  h: "hand", p: "pen", l: "highlight", a: "arrow", e: "eraser", t: "text",
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
  roomSocket?:      import("partysocket").default | null;
  onOpenTafsir:     (verseKey: string) => void;
  onNoteCreated?:   (note: NoteData) => void;
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
  roomSocket,
  onOpenTafsir,
  onNoteCreated,
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
  // availablePages contains only pages that have at least one verse from
  // THIS surah — so navigation never lands on a page with no surah content.
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

  // Free text boxes live in canvas space — visible on every Mushaf page.
  // anchorType "editor" boxes belong to the Mode A freeform layer (their
  // coordinates are editor content space, not canvas world space).
  const textBoxNotes = useMemo(
    () => notes.filter((n) => n.noteType === "textbox" && n.anchorType !== "editor"),
    [notes],
  );

  // Show page-anchored notes only on the first page of the chapter
  // (free text boxes are rendered separately as FreeTextBox)
  const pageNotes = useMemo(
    () => notes.filter((n) => {
      if (n.noteType === "textbox") return false;
      if (n.anchorType === "page") return currentMushafahPage === availablePages[0];
      return n.ayahNumber != null && pageAyahSet.has(n.ayahNumber);
    }),
    [notes, pageAyahSet, currentMushafahPage, availablePages],
  );

  // ── Word highlight for notes (fix #7) ────────────────────────────────
  // Any word with at least one note gets a persistent subtle highlight in
  // QCFMushafPage.  We use ALL notes (not just pageNotes) so the set is
  // stable across page changes; QCFMushafPage only renders the current page.
  const notedWordKeys = useMemo<ReadonlySet<string>>(() => {
    const keys = new Set<string>();
    for (const note of notes) {
      if (note.anchorType === "word" && note.ayahNumber != null && note.wordPosition != null) {
        keys.add(`${note.ayahNumber}:${note.wordPosition}`);
      }
    }
    return keys;
  }, [notes]);

  const openFocus = useCallback((verseKey: string, wordPos: number | null) => {
    setFocusAnchor({ verseKey, wordPos });
    // Signal Mode A to highlight this verse when in split view
    onAyahSelect?.(verseKey);
  }, [onAyahSelect]);

  const closeFocus = useCallback(() => setFocusAnchor(null), []);

  // ── QCF page data (fetched client-side when the page changes) ─────────
  // Fix #1 — surah page filtering: the page API returns ALL verses on a
  // Mushaf page (potentially from multiple surahs). We filter to only the
  // current chapter so that border pages show only this surah's content.
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
          // Keep only verses that belong to this surah (fix #1)
          const surahPrefix = `${chapter.id}:`;
          const filtered = (data.verses ?? []).filter(
            (v) => v.verse_key.startsWith(surahPrefix),
          );
          setQcfVerses(filtered);
          setQcfLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setQcfLoading(false);
      });

    return () => { cancelled = true; };
  // chapter.id is stable per workspace page — safe to include
  }, [currentMushafahPage, chapter.id]);

  // ── Viewport ──────────────────────────────────────────────────────────
  const [viewport, setViewport] = useState<CanvasViewport>(() => ({
    x:    userPrefs?.canvasViewport?.x    ?? 40,
    y:    userPrefs?.canvasViewport?.y    ?? 40,
    zoom: userPrefs?.canvasViewport?.zoom ?? 1,
  }));
  const viewportRef = useRef(viewport);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);

  // ── Centering helper (fix #2) ─────────────────────────────────────────
  // Returns the viewport x that centres the Mushaf card (720 px wide) in
  // the canvas container, with at least 20 px padding on each side.
  const centeredX = useCallback((zoom = 1) => {
    const el = containerRef.current;
    const containerW = el ? el.getBoundingClientRect().width : 800;
    return Math.max(20, Math.round((containerW - MUSHAF_CARD_WIDTH * zoom) / 2));
  }, []);

  // Centre the page on first load (if no saved viewport) (fix #2)
  useLayoutEffect(() => {
    if (userPrefs?.canvasViewport) return; // honour saved position
    const x = centeredX(1);
    setViewport({ x, y: 40, zoom: 1 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once after first paint

  // ── Drawing tool + per-tool colour/width settings ────────────────────
  const [tool,     setTool]     = useState<DrawTool>("hand");
  const [penColor, setPenColor] = useState(DEFAULT_PEN_COLOR);
  const [penSize,  setPenSize]  = useState(DEFAULT_PEN_SIZE);
  const [hlColor,  setHlColor]  = useState(DEFAULT_HIGHLIGHT_COLOR);
  const [hlSize,   setHlSize]   = useState(DEFAULT_HIGHLIGHT_SIZE);
  const [canUndo, setCanUndo]   = useState(false);
  const [canRedo, setCanRedo]   = useState(false);
  const drawingRef              = useRef<DrawingCanvasHandle>(null);

  // Active stroke params forwarded to DrawingCanvas
  const strokeColor = tool === "highlight" ? hlColor : penColor;
  const strokeWidth = tool === "highlight" ? hlSize : penSize; // arrow inherits pen width

  // ── Free text box placement (text tool) ───────────────────────────────
  // Click with the text tool → create a "textbox" note at the click's
  // world coordinates, switch back to hand so the new box is editable,
  // and open it in edit mode immediately.
  const [freshTextBoxId, setFreshTextBoxId] = useState<string | null>(null);

  const placeTextBox = useCallback((wx: number, wy: number) => {
    fetch(`/api/pages/${pageId}/notes`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        noteType:   "textbox",
        anchorType: "page",
        content:    { type: "doc", content: [{ type: "paragraph" }] },
        offsetX:    Math.round(wx),
        offsetY:    Math.round(wy),
        width:      220,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { note?: NoteData } | null) => {
        if (!d?.note) return;
        onNoteCreated?.(d.note);
        setFreshTextBoxId(d.note.id);
        setTool("hand"); // hand mode lets clicks reach the new box for editing
      })
      .catch(() => {});
  }, [pageId, onNoteCreated]);

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
    // Centre the new page (fix #2)
    const z    = viewportRef.current.zoom;
    const next: CanvasViewport = { x: centeredX(z), y: 40, zoom: z };
    setViewport(next);
    patchViewport(next);
  }, [pageId, patchViewport, centeredX]);

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

  // ── Touch pan / pinch-zoom — native touch events ─────────────────────────
  //
  // DrawingCanvas calls touchstart.preventDefault() to block the iOS callout
  // and prevent browser gesture recognition from firing pointercancel mid-stroke.
  // That preventDefault also cancels pointer-event generation for touch input, so
  // we cannot use pointer events for touch panning — we use native touch events
  // instead, which still fire after preventDefault on a child element.

  useEffect(() => {
    const elOrNull = containerRef.current;
    if (!elOrNull) return;
    const el = elOrNull; // narrowed; closures below cannot see the earlier null-check

    // Local touch-point map (lives inside the effect, no stale-closure risk)
    const pts = new Map<number, { x: number; y: number }>();
    let panStart:   { tx: number; ty: number; vx: number; vy: number } | null = null;
    let pinchStart: { dist: number; zoom: number; worldX: number; worldY: number } | null = null;

    function startPanFromPts() {
      if (pts.size !== 1) return;
      const [p] = pts.values();
      panStart = { tx: p.x, ty: p.y, vx: viewportRef.current.x, vy: viewportRef.current.y };
    }

    function startPinchFromPts() {
      if (pts.size < 2) return;
      const [a, b] = pts.values();
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const rect = el.getBoundingClientRect();
      const cx = (a.x + b.x) / 2 - rect.left;
      const cy = (a.y + b.y) / 2 - rect.top;
      const vp = viewportRef.current;
      pinchStart = { dist, zoom: vp.zoom, worldX: (cx - vp.x) / vp.zoom, worldY: (cy - vp.y) / vp.zoom };
    }

    // A touch on a button / role=button / link must NOT have preventDefault called —
    // that would kill the browser's click event and break tool-rail buttons and
    // Quran word taps.  We skip both preventDefault and pan-state setup for those.
    function isInteractive(e: TouchEvent) {
      return !!(e.target as HTMLElement).closest(
        'button, a, input, select, textarea, [role="button"]',
      );
    }

    function onTouchStart(e: TouchEvent) {
      if (isInteractive(e)) return; // let click fire normally
      // A pen is drawing (flag set by DrawingCanvas's capture handlers) —
      // its Android compat-touches must never start a pan.
      if (el.dataset.penActive === "1") { e.preventDefault(); return; }
      // Apple Pencil on iOS 13+ fires touchType:"stylus" touch events alongside
      // its pointer events.  If we preventDefault here, the companion pointer
      // event (pointerType:"pen") is cancelled and DrawingCanvas never draws.
      // Skip the whole touch event for stylus — pointer events handle drawing.
      for (let i = 0; i < e.changedTouches.length; i++) {
        if ((e.changedTouches[i] as Touch & { touchType?: string }).touchType === "stylus") return;
      }
      e.preventDefault();
      for (const t of e.changedTouches) pts.set(t.identifier, { x: t.clientX, y: t.clientY });
      if (pts.size === 1) { pinchStart = null; startPanFromPts(); }
      else                { panStart  = null; startPinchFromPts(); }
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      // Only update pts entries that were registered on touchstart (i.e. non-interactive)
      for (const t of e.changedTouches) {
        if (pts.has(t.identifier)) pts.set(t.identifier, { x: t.clientX, y: t.clientY });
      }

      if (pts.size >= 2 && pinchStart) {
        const [a, b] = pts.values();
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const rect = el.getBoundingClientRect();
        const cx = (a.x + b.x) / 2 - rect.left;
        const cy = (a.y + b.y) / 2 - rect.top;
        const { dist: bd, zoom: bz, worldX: wx, worldY: wy } = pinchStart;
        const newZoom = clamp(bz * (dist / bd), ZOOM_MIN, ZOOM_MAX);
        const next: CanvasViewport = { zoom: newZoom, x: cx - wx * newZoom, y: cy - wy * newZoom };
        setViewport(next); patchViewport(next);
      } else if (pts.size === 1 && panStart) {
        const [p] = pts.values();
        const next: CanvasViewport = {
          ...viewportRef.current,
          x: panStart.vx + (p.x - panStart.tx),
          y: panStart.vy + (p.y - panStart.ty),
        };
        setViewport(next); patchViewport(next);
      }
    }

    function onTouchEnd(e: TouchEvent) {
      // Don't preventDefault for interactive-element taps — the browser needs to
      // fire a click event for tool buttons and Quran word taps to work.
      if (!isInteractive(e)) e.preventDefault();
      for (const t of e.changedTouches) pts.delete(t.identifier);
      if (pts.size < 2) { pinchStart = null; }
      if (pts.size === 1 && panStart === null) startPanFromPts();
      if (pts.size === 0) { panStart = null; el.removeAttribute("data-panning"); }
    }

    el.addEventListener("touchstart",  onTouchStart,  { passive: false });
    el.addEventListener("touchmove",   onTouchMove,   { passive: false });
    el.addEventListener("touchend",    onTouchEnd,    { passive: false });
    el.addEventListener("touchcancel", onTouchEnd,    { passive: false });
    return () => {
      el.removeEventListener("touchstart",  onTouchStart);
      el.removeEventListener("touchmove",   onTouchMove);
      el.removeEventListener("touchend",    onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [patchViewport]); // setViewport + viewportRef are stable; patchViewport stable per pageId

  // ── Mouse / Apple Pencil pan (pointer events only — touch handled above) ──

  const isDragging = useRef(false);
  const dragStart  = useRef<{ mx: number; my: number; vx: number; vy: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    // Fix #3 — pen tool selection bug:
    // If the pointer lands on a button / link / interactive element, do NOT
    // call preventDefault or setPointerCapture. preventDefault on pen events
    // prevents the browser from generating click events, so tool-rail buttons
    // would never fire their onClick and the tool change would be lost.
    const isInteractiveTarget = !!(e.target as HTMLElement).closest(
      'button, a, input, select, textarea, [role="button"]',
    );
    if (isInteractiveTarget) return;

    if (focusAnchor || e.pointerType === "touch") return;
    // Prevent iOS long-press callout / compat mouse events for stylus
    if (e.pointerType === "pen") e.preventDefault();
    if (tool !== "hand" || e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isDragging.current = true;
    containerRef.current?.setAttribute("data-panning", "true");
    dragStart.current = { mx: e.clientX, my: e.clientY, vx: viewportRef.current.x, vy: viewportRef.current.y };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (e.pointerType === "touch" || tool !== "hand" || !isDragging.current || !dragStart.current) return;
    const next: CanvasViewport = {
      ...viewportRef.current,
      x: dragStart.current.vx + (e.clientX - dragStart.current.mx),
      y: dragStart.current.vy + (e.clientY - dragStart.current.my),
    };
    setViewport(next); patchViewport(next);
  }

  function onPointerUp(e: React.PointerEvent) {
    // Don't preventDefault for interactive elements (tool-rail buttons, word spans,
    // links) — that would kill click synthesis and break onClick handlers.
    // Belt-and-suspenders: CanvasToolRail already stops pointer-up propagation,
    // but guard here too in case any interactive child bubbles through.
    const isInteractiveTarget = !!(e.target as HTMLElement).closest(
      'button, a, input, select, textarea, [role="button"]',
    );
    // Prevent mouseup / click compat events after each pen stroke,
    // but only when the pointer-up is on the canvas surface itself.
    if (!isInteractiveTarget && e.pointerType === "pen") e.preventDefault();
    if (e.pointerType === "touch") return;
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
          notedWordKeys={notedWordKeys}
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

        {/* Free text boxes — write anywhere on the canvas */}
        {textBoxNotes.map((note) => (
          <FreeTextBox
            key={note.id}
            note={note}
            startEditing={note.id === freshTextBoxId}
            onUpdated={onNoteUpdated}
            onDeleted={(id) => {
              if (id === freshTextBoxId) setFreshTextBoxId(null);
              onNoteDeleted(id);
            }}
          />
        ))}
      </div>

      {/* ── Drawing canvas overlay ── */}
      {/* mushafPage scopes drawings to the current Mushaf page (fix #8) */}
      <DrawingCanvas
        ref={drawingRef}
        pageId={pageId}
        mushafPage={currentMushafahPage}
        tool={tool}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
        viewport={viewport}
        roomSocket={roomSocket ?? null}
        onHistoryChange={handleHistory}
        onTextPlace={placeTextBox}
      />

      {/* ── Vertical tool rail (left side) ── */}
      <CanvasToolRail
        activeTool={tool}
        onToolChange={setTool}
        penColor={penColor}
        onPenColorChange={setPenColor}
        highlightColor={hlColor}
        onHighlightColorChange={setHlColor}
        strokeSize={tool === "highlight" ? hlSize : penSize}
        onStrokeSizeChange={tool === "highlight" ? setHlSize : setPenSize}
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
        <button className="mode-b-zoom-btn" title="Reset view" onClick={() => { const next: CanvasViewport = { x: centeredX(1), y: 40, zoom: 1 }; setViewport(next); patchViewport(next); }} style={{ fontSize: "0.7rem" }}>↺</button>
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
