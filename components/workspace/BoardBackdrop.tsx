"use client";

/**
 * BoardBackdrop — the imported file, drawn in world space behind the ink.
 *
 * PDFs reuse PdfPages, the same rasteriser the book reader uses, so a board
 * import and a book behave identically under the pen rather than being two
 * subtly different surfaces.
 *
 * The object URL is revoked when the attachment changes or the component goes
 * away. Without that, every board visit would leak the whole file for the life
 * of the tab — which for a 60 MB PDF is exactly the kind of leak nobody
 * notices until the tab is unusable.
 */

import { useEffect, useState } from "react";
import PdfPages from "./PdfPages";
import { getAttachment, type Attachment } from "@/lib/books/attachment-store";

interface Props {
  pageId: string;
  /** Changing this re-reads the store — how an import shows without a reload. */
  version?: number;
  /** Told what is missing, so the board can offer to re-pick the file. */
  onMissing?: (missing: boolean) => void;
}

type Loaded =
  | { kind: "none" }
  | { kind: "pdf"; data: ArrayBuffer }
  | { kind: "image"; url: string; name: string };

export default function BoardBackdrop({ pageId, version = 0, onMissing }: Props) {
  const [state, setState] = useState<Loaded>({ kind: "none" });

  useEffect(() => {
    let live = true;
    let url: string | null = null;

    (async () => {
      const a: Attachment | null = await getAttachment(pageId);
      if (!live) return;

      if (!a) { setState({ kind: "none" }); onMissing?.(false); return; }

      if (a.kind === "pdf") {
        const buf = await a.blob.arrayBuffer();
        if (!live) return;
        setState({ kind: "pdf", data: buf });
      } else {
        url = URL.createObjectURL(a.blob);
        setState({ kind: "image", url, name: a.name });
      }
      onMissing?.(false);
    })().catch(() => { if (live) setState({ kind: "none" }); });

    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [pageId, version, onMissing]);

  if (state.kind === "none")  return null;
  if (state.kind === "pdf")   return <PdfPages src={state.data} />;

  return (
    <div className="bb-image">
      <img src={state.url} alt={state.name} draggable={false} />
    </div>
  );
}
