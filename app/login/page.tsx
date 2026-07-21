"use client";

import { useEffect, useState }   from "react";
import { useRouter }             from "next/navigation";
import {
  signInWithPopup, signInWithRedirect, getRedirectResult,
  type AuthProvider, type UserCredential,
} from "firebase/auth";
import { getFirebaseAuth, googleProvider, microsoftProvider } from "@/lib/firebase/client";
import { useT, LanguageSwitcher } from "@/lib/i18n/LocaleProvider";

/**
 * iOS/iPadOS runs EVERY browser (Chrome, Edge, Firefox…) on Apple's WebKit,
 * where signInWithPopup is unreliable and throws a WebKit SyntaxError
 * ("The string did not match the expected pattern"). Detect those devices so
 * we go straight to the full-page redirect flow instead of the popup.
 * iPadOS 13+ masquerades as desktop Safari (platform "MacIntel"), so we also
 * treat a touch-capable Mac as iPad.
 */
function isWebkitTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOS || iPadOS;
}

/** Popup failures that mean "the user aborted" — don't fall back to redirect. */
const USER_ABORTED = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/user-cancelled",
]);

export default function LoginPage() {
  const router                = useRouter();
  const t                     = useT();
  const [loading, setLoading] = useState<"google" | "microsoft" | "demo" | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  // True while completing a redirect sign-in after returning from the provider.
  const [completing, setCompleting] = useState(false);

  // Secret demo flow — tap the logo to reveal the code prompt.
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoCode, setDemoCode] = useState("");

  // Exchange a Firebase credential for our session cookie, then enter the app.
  async function completeSignIn(result: UserCredential) {
    const token = await result.user.getIdToken();
    const res = await fetch("/api/auth/session", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ idToken: token }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(data.error ?? "Sign-in failed");
    }
    router.push("/home");
    router.refresh();
  }

  // On mount, finish any sign-in that used the redirect flow (iOS path).
  useEffect(() => {
    const auth = getFirebaseAuth();
    setCompleting(true);
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) await completeSignIn(result);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Sign-in failed");
      })
      .finally(() => setCompleting(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignIn(provider: AuthProvider, which: "google" | "microsoft") {
    setLoading(which);
    setError(null);
    const auth = getFirebaseAuth();

    // iOS/iPadOS WebKit: skip the flaky popup entirely — redirect navigates
    // the page away and completeSignIn runs via getRedirectResult on return.
    if (isWebkitTouchDevice()) {
      try {
        await signInWithRedirect(auth, provider);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setLoading(null);
      }
      return;
    }

    // Desktop: popup, with a redirect fallback if the popup is unusable
    // (blocked / not supported / a WebKit SyntaxError), but NOT if the user
    // simply closed it.
    try {
      const result = await signInWithPopup(auth, provider);
      await completeSignIn(result);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code && USER_ABORTED.has(code)) { setLoading(null); return; }
      try {
        await signInWithRedirect(auth, provider);
      } catch (err2) {
        setError(err2 instanceof Error ? err2.message : "Something went wrong");
        setLoading(null);
      }
    }
  }

  async function handleDemo() {
    if (loading) return;
    setLoading("demo");
    setError(null);
    try {
      const res = await fetch("/api/auth/demo", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code: demoCode.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "Demo unavailable");
      }
      router.push("/home");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(null);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">

        {/* Logo — secretly toggles the demo-code prompt */}
        <div className="login-logo">
          <div
            className="login-logo-mark"
            onClick={() => setDemoOpen((v) => !v)}
            role="presentation"
          >
            T
          </div>
        </div>

        <h1 className="login-title">TafsirLab</h1>
        <p className="login-subtitle">{t("login.subtitle")}</p>

        <button
          className="login-google-btn"
          onClick={() => handleSignIn(googleProvider, "google")}
          disabled={loading !== null || completing}
        >
          {loading === "google" || completing ? <span className="login-spinner" /> : <GoogleIcon />}
          {loading === "google" || completing ? t("login.signingIn") : t("login.google")}
        </button>

        <button
          className="login-google-btn"
          onClick={() => handleSignIn(microsoftProvider, "microsoft")}
          disabled={loading !== null || completing}
        >
          {loading === "microsoft" ? <span className="login-spinner" /> : <MicrosoftIcon />}
          {loading === "microsoft" ? t("login.signingIn") : t("login.microsoft")}
        </button>

        {/* Hidden demo entry — revealed by tapping the logo */}
        {demoOpen && (
          <div className="login-demo-row">
            <input
              className="login-demo-input"
              type="password"
              inputMode="numeric"
              placeholder={t("login.demoCode")}
              value={demoCode}
              onChange={(e) => setDemoCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleDemo(); }}
              disabled={loading !== null}
              autoFocus
            />
            <button
              className="login-demo-go"
              onClick={handleDemo}
              disabled={loading !== null || !demoCode.trim()}
            >
              {loading === "demo" ? t("login.opening") : t("login.openDemo")}
            </button>
          </div>
        )}

        {error && <p className="login-error">{error}</p>}

        <p className="login-footer">{t("login.footer")}</p>

        <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
          <LanguageSwitcher compact />
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <rect x="1"  y="1"  width="10" height="10" fill="#F25022"/>
      <rect x="13" y="1"  width="10" height="10" fill="#7FBA00"/>
      <rect x="1"  y="13" width="10" height="10" fill="#00A4EF"/>
      <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
    </svg>
  );
}
