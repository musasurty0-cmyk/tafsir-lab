"use client";

/**
 * EditorContext — React context that bridges WorkspacePageView state into
 * TipTap NodeViews (AyahBlockView) without prop drilling through the editor.
 *
 * TipTap's ReactNodeViewRenderer creates portals that ARE part of the React
 * tree, so context provided above <EditorContent> propagates correctly.
 */

import { createContext, useContext } from "react";
import type { Verse } from "@/lib/types";
import type { NoteData } from "../NoteCard";
import type { ProgressStatus } from "@/lib/services/progress.service";
import type { MemberRole } from "@/lib/services/workspaces.service";

export interface EditorContextValue {
  pageId:           string;
  surahNumber:      number;
  verses:           Verse[];
  notes:            NoteData[];
  role:             MemberRole;
  personalProgress: Record<string, ProgressStatus>;
  groupProgress:    Record<string, { status: ProgressStatus; lastChangedBy: string }>;
  onNoteCreated:    (note: NoteData) => void;
  onNoteUpdated:    (note: NoteData) => void;
  onNoteDeleted:    (noteId: string) => void;
  onProgressChange: (
    scope: "personal" | "group",
    surahNumber: number,
    ayahNumber: number,
    status: ProgressStatus
  ) => Promise<void>;
  onOpenTafsir:     (verseKey: string) => void;
}

const Ctx = createContext<EditorContextValue | null>(null);

export function EditorContextProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: EditorContextValue;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEditorCtx(): EditorContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useEditorCtx must be inside EditorContextProvider");
  return v;
}

/** Non-throwing variant — returns null when rendered outside a provider. */
export function useEditorCtxOptional(): EditorContextValue | null {
  return useContext(Ctx);
}
