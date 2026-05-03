"use client";

export default function SplashScreen() {
  return (
    <div className="splash-screen">
      <div className="splash-logo-wrap">
        <div className="splash-logo-ring" />
        <div className="splash-logo-badge">T</div>
      </div>
      <p className="splash-brand">TafsirLab</p>
      <p className="splash-subtitle">Loading your workspace…</p>
    </div>
  );
}
