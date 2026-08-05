"use client";

import { create } from "zustand";
import type { DrawMode, Stroke } from "./types";

interface DrawingState {
  mode: DrawMode;
  color: string;
  strokeWidth: number;
  opacity: number;
  strokes: Stroke[];
  undoStack: Stroke[][];
  activeStroke: Stroke | null;
}

interface AppState {
  // active question (0 = Quran text, 1-8 = study questions)
  activeQuestion: number;
  setActiveQuestion: (q: number) => void;

  // drawing
  drawing: DrawingState;
  setDrawMode: (mode: DrawMode) => void;
  setDrawColor: (color: string) => void;
  setStrokeWidth: (w: number) => void;
  setOpacity: (o: number) => void;
  beginStroke: (stroke: Stroke) => void;
  updateActiveStroke: (pts: Stroke["points"]) => void;
  commitStroke: () => void;
  eraseStroke: (id: string) => void;
  undoStroke: () => void;
  clearStrokes: () => void;
  loadStrokes: (strokes: Stroke[]) => void;

}

export const useAppStore = create<AppState>((set, get) => ({
  activeQuestion: 0,
  setActiveQuestion: (q) => set({ activeQuestion: q }),

  drawing: {
    mode: "hand",
    color: "#2563eb",
    strokeWidth: 2,
    opacity: 1,
    strokes: [],
    undoStack: [],
    activeStroke: null,
  },

  setDrawMode: (mode) =>
    set((s) => ({ drawing: { ...s.drawing, mode } })),

  setDrawColor: (color) =>
    set((s) => ({ drawing: { ...s.drawing, color } })),

  setStrokeWidth: (strokeWidth) =>
    set((s) => ({ drawing: { ...s.drawing, strokeWidth } })),

  setOpacity: (opacity) =>
    set((s) => ({ drawing: { ...s.drawing, opacity } })),

  beginStroke: (stroke) =>
    set((s) => ({ drawing: { ...s.drawing, activeStroke: stroke } })),

  updateActiveStroke: (pts) =>
    set((s) => {
      if (!s.drawing.activeStroke) return s;
      return {
        drawing: {
          ...s.drawing,
          activeStroke: { ...s.drawing.activeStroke, points: pts },
        },
      };
    }),

  commitStroke: () =>
    set((s) => {
      const { activeStroke, strokes, undoStack } = s.drawing;
      if (!activeStroke || activeStroke.points.length < 2) {
        return { drawing: { ...s.drawing, activeStroke: null } };
      }
      return {
        drawing: {
          ...s.drawing,
          strokes: [...strokes, activeStroke],
          undoStack: [...undoStack, strokes],
          activeStroke: null,
        },
      };
    }),

  eraseStroke: (id) =>
    set((s) => ({
      drawing: {
        ...s.drawing,
        strokes: s.drawing.strokes.filter((st) => st.id !== id),
        undoStack: [...s.drawing.undoStack, s.drawing.strokes],
      },
    })),

  undoStroke: () =>
    set((s) => {
      const { undoStack } = s.drawing;
      if (undoStack.length === 0) return s;
      const prev = undoStack[undoStack.length - 1];
      return {
        drawing: {
          ...s.drawing,
          strokes: prev,
          undoStack: undoStack.slice(0, -1),
        },
      };
    }),

  clearStrokes: () =>
    set((s) => ({
      drawing: {
        ...s.drawing,
        strokes: [],
        undoStack: [...s.drawing.undoStack, s.drawing.strokes],
        activeStroke: null,
      },
    })),

  loadStrokes: (strokes) =>
    set((s) => ({ drawing: { ...s.drawing, strokes, undoStack: [], activeStroke: null } })),

}));
