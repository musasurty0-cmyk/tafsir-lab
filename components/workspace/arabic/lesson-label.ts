/** "Level 1 · Lesson 13", or "Level 1 · Revision" for a file that takes no number. */
export function lessonLabel(l: { level: number; number: number | null; kind: string }) {
  return l.number != null ? `Level ${l.level} · Lesson ${l.number}`
       : l.kind === "mine" ? "My words"
       : l.kind === "prep" ? `Level ${l.level} · Preparation`
       : `Level ${l.level} · Revision`;
}
