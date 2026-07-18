/**
 * Firebase client SDK — initialised once, safe to import anywhere in client components.
 *
 * Add these env vars to .env.local (and Vercel project settings):
 *   NEXT_PUBLIC_FIREBASE_API_KEY
 *   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *   NEXT_PUBLIC_FIREBASE_APP_ID
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, OAuthProvider, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey:     process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  appId:      process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

// Singleton — reuse the existing app in hot-reload / fast-refresh scenarios
let app:  FirebaseApp;
let auth: Auth;

function getFirebaseClient() {
  if (!app) {
    app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    auth = getAuth(app);
  }
  return { app, auth };
}

export function getFirebaseAuth(): Auth {
  return getFirebaseClient().auth;
}

export const googleProvider = new GoogleAuthProvider();

/**
 * Microsoft sign-in (work/school accounts like @youthmajlis.org AND personal
 * accounts). Requires the Microsoft provider to be enabled in the Firebase
 * Console (Authentication → Sign-in method) with an Azure app registration.
 * tenant "common" = any Azure AD org + personal Microsoft accounts.
 */
export const microsoftProvider = new OAuthProvider("microsoft.com");
microsoftProvider.setCustomParameters({ prompt: "select_account", tenant: "common" });
