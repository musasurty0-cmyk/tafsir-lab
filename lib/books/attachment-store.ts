"use client";

/**
 * attachment-store — files imported onto a board, kept in IndexedDB.
 *
 * Same bargain the book PDFs already make (see pdf-store): the bytes live on
 * the device they were imported from, while the annotations drawn over them
 * sync normally. Shipping shared file storage would mean a blob service this
 * app does not have; keeping the bytes local means the feature works today and
 * is honest about where the file is, rather than silently losing it.
 *
 * Its own object store rather than a second use of the books one, so a board
 * import and a book PDF cannot collide on a page id, and so clearing one does
 * not touch the other.
 */

const DB_NAME = "tl-attachments";
const STORE   = "files";
const DB_VER  = 1;

export type AttachmentKind = "pdf" | "image";

export interface Attachment {
  kind: AttachmentKind;
  /** Original filename, shown so a re-import prompt can name what is missing. */
  name: string;
  blob: Blob;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = run(t.objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror   = () => reject(r.error);
    t.oncomplete = () => db.close();
  }));
}

export async function putAttachment(pageId: string, a: Attachment): Promise<void> {
  await tx("readwrite", (s) => s.put(a, pageId));
}

/** null when nothing was imported here, or when this is a different device. */
export async function getAttachment(pageId: string): Promise<Attachment | null> {
  try {
    const v = await tx<Attachment | undefined>("readonly", (s) => s.get(pageId));
    // Guard the shape: a value written by an older version, or a partially
    // written record, must read as "nothing here" rather than crash the board.
    return v && v.blob instanceof Blob ? v : null;
  } catch {
    return null;   // private mode, storage disabled — the board still works
  }
}

export async function deleteAttachment(pageId: string): Promise<void> {
  try { await tx("readwrite", (s) => s.delete(pageId)); } catch { /* ignore */ }
}
