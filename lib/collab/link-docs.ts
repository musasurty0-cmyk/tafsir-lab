/**
 * Mirror two Yjs documents: the page editor's own, and the one its realtime
 * provider syncs with the room.
 *
 * Why two: the editor must not write into the room before the room has
 * answered. Anything typed into an empty document before the first sync is
 * real Yjs history, and when the room's content (or the seed from the saved
 * snapshot) arrives it merges around it, by client id rather than by intent:
 * the typed lines land above the heading, or into it, or the seed is skipped
 * because the document no longer looks empty. With the editor on a document
 * of its own, nothing reaches the room until PageEditor links the two, after
 * the first sync, when it knows what the room holds.
 *
 * The two share one client id: the provider announces this tab's awareness
 * (its caret) under the room doc's id, and the cursor plugin recognises its
 * own caret by the editor doc's id. That needs care in one place. Yjs treats
 * a REMOTE update carrying a doc's own client id as a clash and renames the
 * doc ("Changed the client-id because another client seems to be using it"),
 * and every update it applies counts as remote: readUpdate forces the
 * transaction non-local, even inside a local one. Renamed, the room doc no
 * longer matches the awareness id, and the provider drops this tab's caret
 * the next time the socket closes. So the relay marks its transaction local
 * again before it finishes, which is the truth: these are this tab's edits.
 * The room doc never writes anything itself, so it cannot clash for real.
 */

import * as Y from "yjs";

/** Origin of every relayed update, so neither side echoes it back. */
export const RELAY = Symbol("tl-relay");

function applyAsLocal(doc: Y.Doc, update: Uint8Array, clientID: number) {
  Y.transact(doc, (tr) => {
    Y.applyUpdate(doc, update, RELAY);
    tr.local = true;
  }, RELAY, true);
  if (doc.clientID !== clientID) doc.clientID = clientID;   // in case Yjs changes how it checks
}

/**
 * Bring each document up to date with the other, then keep them so.
 * Returns the function that stops the mirroring.
 */
export function linkDocs(editorDoc: Y.Doc, roomDoc: Y.Doc): () => void {
  Y.applyUpdate(editorDoc, Y.encodeStateAsUpdate(roomDoc, Y.encodeStateVector(editorDoc)), RELAY);
  const missing = Y.encodeStateAsUpdate(editorDoc, Y.encodeStateVector(roomDoc));
  /* An empty update is two zero bytes (no structs, no deletes). */
  if (missing.length > 2) applyAsLocal(roomDoc, missing, editorDoc.clientID);

  const toRoom   = (u: Uint8Array, origin: unknown) => { if (origin !== RELAY) applyAsLocal(roomDoc, u, editorDoc.clientID); };
  const toEditor = (u: Uint8Array, origin: unknown) => { if (origin !== RELAY) Y.applyUpdate(editorDoc, u, RELAY); };
  editorDoc.on("update", toRoom);
  roomDoc.on("update", toEditor);
  return () => {
    editorDoc.off("update", toRoom);
    roomDoc.off("update", toEditor);
  };
}
