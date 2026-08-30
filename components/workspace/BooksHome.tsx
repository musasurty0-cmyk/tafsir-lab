"use client";

/**
 * BooksHome — home screen for a "books" workspace (book study).
 *
 * Lists the workspace's books (each a PDF you annotate around) and lets you
 * add one from the built-in library of classical texts, or upload your own.
 * Library PDFs are static files; uploaded PDFs are stored in the browser
 * (IndexedDB) keyed by the new book's id — annotations sync regardless.
 */

import { pushWithSplash } from "@/lib/nav-splash";
import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { MemberRole } from "@/lib/services/workspaces.service";
import { LIBRARY_BOOKS, libraryBookUrl, type LibraryBook } from "@/lib/books/library-catalog";
import { putBookPdf } from "@/lib/books/pdf-store";
import WorkspaceSettings from "./WorkspaceSettings";
import Rail from "./Rail";
import NewWorkspaceModal from "@/components/NewWorkspaceModal";
import Toast from "@/components/Toast";

interface Book {
  id: string; title: string; pdfUrl: string; pdfName: string | null; createdAt: Date | string;
}

interface Props {
  workspaceId: string;
  workspace: { id: string; name: string; type: string; kind: string; ownerId: string; membersCanManagePages: boolean };
  role: MemberRole;
  books: Book[];
}

function fmt(d: Date | string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
}

/* Tone per subject, assigned by the category's position in the catalogue
   rather than by hashing its name: a hash collided on two of the ten subjects
   present, so ʿAqīdah and Ḥadīth came out the same colour. Position spreads
   them evenly and stays stable as long as the catalogue order does, and a new
   category still gets a tone with no lookup table to maintain. */
const SUBJECT_ORDER = [...new Set(LIBRARY_BOOKS.map((b) => b.category))];

function subjectTone(category: string): string {
  const i = SUBJECT_ORDER.indexOf(category);
  return String((i < 0 ? 0 : i) % 5);
}

export default function BooksHome({ workspaceId, workspace, role, books: initialBooks }: Props) {
  const router = useRouter();

  useLayoutEffect(() => {
    document.getElementById("tl-nav-splash")?.remove();
    document.getElementById("tl-nav-splash-style")?.remove();
  }, []);

  const [books, setBooks]               = useState<Book[]>(initialBooks);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modalOpen, setModalOpen]       = useState(false);
  const [libraryOpen, setLibraryOpen]   = useState(false);
  const [busy, setBusy]                 = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  /* Anything this screen needs to tell the user. Was window.alert(), which
     blocks the page and cannot be styled. */
  const [notice, setNotice] = useState<string | null>(null);

  // Rename workspace (owner)
  const [wsName, setWsName]     = useState(workspace.name);
  const [renaming, setRenaming] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  async function createBook(body: { title: string; pdfUrl: string; pdfName?: string | null }) {
    const res = await fetch(`/api/workspaces/${workspaceId}/books`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null) as { book?: Book } | null;
    return data?.book ?? null;
  }

  async function addLibraryBook(lb: LibraryBook) {
    if (busy) return;
    setBusy(true);
    try {
      const book = await createBook({ title: lb.title, pdfUrl: libraryBookUrl(lb.slug), pdfName: null });
      if (book) pushWithSplash(router, `/workspaces/${workspaceId}/books/${book.id}`);
    } finally { setBusy(false); }
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file || busy) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setNotice("That file isn’t a PDF. Choose a .pdf to add it as a book."); return;
    }
    setBusy(true);
    try {
      const title = file.name.replace(/\.pdf$/i, "");
      const book = await createBook({ title, pdfUrl: "local", pdfName: file.name });
      if (!book) { setNotice("Couldn’t add the book. Please try again."); return; }
      await putBookPdf(book.id, file); // keep the bytes on this device
      pushWithSplash(router, `/workspaces/${workspaceId}/books/${book.id}`);
    } finally { setBusy(false); }
  }

  async function commitRename() {
    const trimmed = wsName.trim();
    if (!trimmed || trimmed === workspace.name) { setWsName(workspace.name); setRenaming(false); return; }
    try {
      await fetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
    } catch {
      /* Reverting alone looked like the rename had simply not taken. */
      setWsName(workspace.name);
      setNotice("Couldn’t rename the workspace. Please try again.");
    }
    setRenaming(false);
  }

  return (
    <div className="workspace-home">
      <Toast message={notice} onDismiss={() => setNotice(null)} />

      {/* .workspace-home is a grid of [rail | content] — the Rail must be the
          first child or the content collapses into the rail column. */}
      <Rail activeWorkspaceId={workspaceId} />

      <div className="workspace-home-content">
        <div className="ws-home-header">
          <div className="ws-home-titles">
            {renaming ? (
              <input
                ref={nameInputRef}
                className="ws-home-name-input"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") { setWsName(workspace.name); setRenaming(false); } }}
                maxLength={80}
              />
            ) : (
              <h1
                className="ws-home-name"
                onClick={() => { if (role === "owner") { setRenaming(true); setTimeout(() => nameInputRef.current?.select(), 0); } }}
                title={role === "owner" ? "Click to rename" : undefined}
                style={{ cursor: role === "owner" ? "text" : "default" }}
              >
                {wsName} <span className="ws-home-kind-badge">📚 Book study</span>
              </h1>
            )}
            <p className="ws-home-sub">{books.length} {books.length === 1 ? "book" : "books"}</p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="ws-new-btn ws-new-btn--ghost" onClick={() => pushWithSplash(router, `/workspaces/${workspaceId}/notes`)}>Notes</button>
            <button className="ws-new-btn ws-new-btn--ghost" onClick={() => setSettingsOpen(true)}>Settings</button>
            <button className="ws-new-btn" onClick={() => setModalOpen(true)}>New workspace</button>
          </div>
        </div>

        {/* Add-book actions */}
        <div className="boards-new-row" style={{ gap: 8, display: "flex" }}>
          <button className="ws-new-btn boards-new-btn" onClick={() => setLibraryOpen(true)} disabled={busy}>
            ＋ Add from library
          </button>
          <button className="ws-new-btn ws-new-btn--ghost" onClick={() => fileRef.current?.click()} disabled={busy}>
            ⬆ Upload a PDF
          </button>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={onUpload} />
        </div>

        {/* Books grid */}
        {books.length === 0 ? (
          <div className="boards-empty">
            <p className="boards-empty-title">No books yet</p>
            <p className="boards-empty-body">Add a classical text from the library, or upload your own PDF — then annotate around it with the pen and note cards.</p>
          </div>
        ) : (
          <div className="boards-grid">
            {books.map((b) => (
              <Link key={b.id} href={`/workspaces/${workspaceId}/books/${b.id}`} className="board-card book-card-tile">
                <span className="board-card-icon">{b.pdfUrl === "local" ? "📄" : "📚"}</span>
                <span className="board-card-title">{b.title}</span>
                <span className="board-card-date">{b.pdfUrl === "local" ? "Uploaded" : "Library"} · {fmt(b.createdAt)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Library picker */}
      {libraryOpen && (
        <div className="modal-backdrop" onClick={() => !busy && setLibraryOpen(false)}>
          <div className="modal-card book-library-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Choose a text</h2>
            <p className="modal-label" style={{ marginTop: -4 }}>Classical mutūn — tap one to add it and start annotating.</p>
            {/* A shelf, not a list of rectangles. Each mutn is a book object:
                a spine, its Arabic name set as the cover title, then the
                English title, subject and author. The tone varies by SUBJECT
                rather than at random, so ʿAqīdah texts sit together visually —
                there is no invented cover art, only the text's own name. */}
            <div className="book-shelf">
              {LIBRARY_BOOKS.map((lb) => (
                <button
                  key={lb.slug}
                  className="book-obj"
                  data-subject={subjectTone(lb.category)}
                  onClick={() => addLibraryBook(lb)}
                  disabled={busy}
                  title={`${lb.title}${lb.author ? " — " + lb.author : ""}`}
                >
                  <span className="book-obj-spine" aria-hidden />
                  <span className="book-obj-face">
                    {lb.titleArabic && (
                      <span className="book-obj-ar" dir="rtl" lang="ar">{lb.titleArabic}</span>
                    )}
                    <span className="book-obj-en">{lb.title}</span>
                    <span className="book-obj-meta">
                      <span className="book-obj-subject">{lb.category}</span>
                      {lb.author && <span className="book-obj-author">{lb.author}</span>}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={() => setLibraryOpen(false)} disabled={busy}>Close</button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <WorkspaceSettings
          workspaceId={workspaceId}
          workspaceName={wsName}
          workspaceType={workspace.type}
          membersCanManagePages={workspace.membersCanManagePages}
          currentUserId={workspace.ownerId}
          currentUserRole={role}
          onClose={() => setSettingsOpen(false)}
          onRenamed={(name) => { setWsName(name); setSettingsOpen(false); }}
          onDeleted={() => { setSettingsOpen(false); pushWithSplash(router, "/home"); }}
        />
      )}
      {modalOpen && <NewWorkspaceModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
