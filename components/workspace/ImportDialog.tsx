"use client";

/**
 * ImportDialog — bring a PDF or an image onto a board to annotate over.
 *
 * Two things it refuses to fake:
 *
 *   Word and PowerPoint. Rendering those faithfully needs a converter this app
 *   does not have, and accepting the file only to produce a wall of unstyled
 *   text would be worse than declining — so it says what to do instead.
 *
 *   Where the file lives. Imported bytes stay on this device, exactly as
 *   uploaded book PDFs do. The dialog says so before you choose, not after.
 */

import { useCallback, useRef, useState } from "react";
import { Upload, FileText, Image as ImageIcon, X, AlertCircle } from "lucide-react";
import { putAttachment, type AttachmentKind } from "@/lib/books/attachment-store";

/** 60 MB — past this, rasterising in the browser stops being pleasant. */
const MAX_BYTES = 60 * 1024 * 1024;

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"];
const OFFICE_RE = /\.(docx?|pptx?|odt|odp|pages|key)$/i;

interface Props {
  pageId:     string;
  onClose:    () => void;
  /** Called once the file is stored, so the board can show it without a reload. */
  onImported: (kind: AttachmentKind, name: string) => void;
}

function human(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

export default function ImportDialog({ pageId, onClose, onImported }: Props) {
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = useCallback(async (file: File) => {
    setError(null);

    if (OFFICE_RE.test(file.name)) {
      setError(
        "Word and PowerPoint files are not supported yet — they need a converter this app does not have. " +
        "Export to PDF from that app and import the PDF; it will look exactly as it does there.",
      );
      return;
    }

    const isPdf   = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const isImage = IMAGE_TYPES.includes(file.type);
    if (!isPdf && !isImage) {
      setError(`“${file.name}” is not a PDF or an image.`);
      return;
    }

    if (file.size > MAX_BYTES) {
      setError(`That file is ${human(file.size)}. The limit is ${human(MAX_BYTES)} — a bigger one would take longer to draw than to read.`);
      return;
    }

    setBusy(true);
    try {
      const kind: AttachmentKind = isPdf ? "pdf" : "image";
      await putAttachment(pageId, { kind, name: file.name, blob: file });
      onImported(kind, file.name);
      onClose();
    } catch {
      // Storage can refuse in private mode or when the quota is full. Say which
      // rather than a generic failure the user cannot act on.
      setError("This browser would not store the file — private browsing and a full disk both cause that.");
      setBusy(false);
    }
  }, [pageId, onImported, onClose]);

  return (
    <div className="imp-overlay" role="dialog" aria-modal="true" aria-label="Import a file"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="imp">
        <button className="imp-x" onClick={onClose} aria-label="Close"><X size={18} /></button>

        <span className="imp-icon" aria-hidden><Upload size={30} /></span>
        <h2 className="imp-title">Import a file</h2>
        <p className="imp-sub">A PDF or an image, to annotate over on this board.</p>

        <div
          className="imp-drop"
          data-over={over ? "true" : "false"}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) accept(f);
          }}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <p className="imp-drop-title">Storing…</p>
          ) : (
            <>
              <Upload size={26} aria-hidden />
              <p className="imp-drop-title">Drag a file here, or click to choose</p>
              <p className="imp-drop-sub">PDF · PNG · JPEG · WebP — up to {human(MAX_BYTES)}</p>
            </>
          )}
          <input
            ref={inputRef} type="file" hidden
            accept="application/pdf,.pdf,image/png,image/jpeg,image/webp,image/gif,image/avif"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) accept(f); e.target.value = ""; }}
          />
        </div>

        {error && (
          <p className="imp-error"><AlertCircle size={16} aria-hidden /> {error}</p>
        )}

        <div className="imp-kinds">
          <span><FileText size={15} aria-hidden /> Each PDF page becomes a sheet you can draw on</span>
          <span><ImageIcon size={15} aria-hidden /> An image sits behind your ink and notes</span>
        </div>

        <p className="imp-note">
          The file stays on this device. Your annotations sync everywhere as usual —
          on another device the board will ask you to pick the same file again.
        </p>
      </div>
    </div>
  );
}
