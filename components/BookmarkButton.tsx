"use client";

/**
 * BookmarkButton — save this place.
 *
 * Deliberately fire-and-confirm rather than a toggle. A page can hold many
 * bookmarks (different verses, different mushaf sheets), so "is this page
 * bookmarked" is not a yes/no the button could reflect honestly; pretending
 * otherwise would mean a filled icon that lies as soon as you move down the
 * page. Saving twice is harmless and visible in the rail, and removal lives
 * where the list is.
 */

import { useCallback, useState } from "react";
import { Bookmark, Check } from "lucide-react";
import Toast from "./Toast";

interface Props {
  pageId:      string;
  /** What to call it. Falls back to the page title on the server. */
  label?:      string;
  surahNumber?: number | null;
  ayahNumber?:  number | null;
  mushafPage?:  number | null;
  className?:  string;
  /** Show the word as well as the icon. */
  withLabel?:  boolean;
}

export default function BookmarkButton({
  pageId, label, surahNumber, ayahNumber, mushafPage,
  className = "tb-btn", withLabel = true,
}: Props) {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [toast, setToast] = useState<string | null>(null);

  const save = useCallback(async () => {
    if (state === "saving") return;
    setState("saving");

    const res = await fetch("/api/bookmarks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId, label, surahNumber, ayahNumber, mushafPage }),
    }).catch(() => null);

    if (!res?.ok) {
      setState("idle");
      setToast("Could not save that bookmark.");
      return;
    }

    setState("saved");
    setToast(
      surahNumber != null && ayahNumber != null ? `Bookmarked ${surahNumber}:${ayahNumber}`
      : mushafPage ? `Bookmarked page ${mushafPage}`
      : "Bookmarked",
    );
    // Back to idle so the control stays usable — this is not a toggle, and a
    // permanently ticked button would suggest it were one.
    setTimeout(() => setState("idle"), 1800);
  }, [state, pageId, label, surahNumber, ayahNumber, mushafPage]);

  return (
    <>
      <button
        className={className}
        onClick={save}
        disabled={state === "saving"}
        title="Bookmark this place"
        aria-label="Bookmark this place"
      >
        {state === "saved" ? <Check size={16} aria-hidden /> : <Bookmark size={16} aria-hidden />}
        {withLabel && (state === "saved" ? " Saved" : " Bookmark")}
      </button>
      <Toast message={toast} onDismiss={() => setToast(null)} autoDismissMs={2600} />
    </>
  );
}
