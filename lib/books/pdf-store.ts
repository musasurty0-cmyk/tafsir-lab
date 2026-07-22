"use client";

/**
 * pdf-store — tiny IndexedDB wrapper for user-UPLOADED book PDFs.
 *
 * Library books are static files under /books, but a PDF a student uploads is
 * kept in the browser (no server storage / Vercel Blob needed to ship this).
 * It's keyed by the book's page id, so the reader loads it locally; the
 * annotations (notes + ink) still sync normally through the page APIs.
 *
 * Limitation (intentional for v1): an uploaded PDF lives on the device it was
 * uploaded from. On another device the book card shows a "re-upload here"
 * prompt — the annotations are already there, only the PDF bytes are local.
 */

const DB_NAME  = "tl-books";
const STORE    = "pdfs";
const DB_VER   = 1;

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

/** Store the uploaded PDF bytes for a book (keyed by page id). */
export async function putBookPdf(bookId: string, data: Blob): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(data, bookId);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
  db.close();
}

/** Get the uploaded PDF for a book, or null if not on this device. */
export async function getBookPdf(bookId: string): Promise<Blob | null> {
  const db = await openDB();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(bookId);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror   = () => reject(req.error);
  });
  db.close();
  return blob;
}

/** Remove an uploaded PDF (when a book is deleted). */
export async function deleteBookPdf(bookId: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(bookId);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => resolve();
    });
    db.close();
  } catch { /* best-effort */ }
}
