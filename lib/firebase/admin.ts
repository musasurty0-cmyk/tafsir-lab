/**
 * Firebase Admin SDK — server-only, verifies ID tokens.
 *
 * Required env vars (Vercel + .env.local):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY    ← include \n literal newlines from service account JSON
 */

import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

function getAdminApp(): App {
  if (getApps().length) return getApp();

  return initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      // Vercel stores multiline secrets with literal \n — convert back to newlines
      privateKey:  process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    }),
  });
}

export async function verifyFirebaseToken(idToken: string): Promise<DecodedIdToken> {
  const auth = getAuth(getAdminApp());
  return auth.verifyIdToken(idToken);
}
