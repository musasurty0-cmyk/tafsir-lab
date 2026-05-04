"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

/* ─────────────────────────────────────────────
   Feature data
───────────────────────────────────────────── */
const FEATURES = [
  {
    n: "01",
    title: "Collaborative tafsir",
    body: "Write and refine commentary alongside your study circle in real time. See every cursor, every keystroke, live — the way scholarship is meant to happen.",
  },
  {
    n: "02",
    title: "Mushaf annotation",
    body: "Draw directly on the Mushaf page. Circle a verse, underline a word, sketch a margin note. Your annotations persist and sync across every device.",
  },
  {
    n: "03",
    title: "Structured workspaces",
    body: "Organise surahs, pages, and notes into named workspaces. Share a workspace with a teacher, a class, or keep one private for personal reflection.",
  },
];

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */
export default function LandingPage() {
  const featuresRef = useRef<HTMLDivElement>(null);

  /* Load fonts + set body background */
  useEffect(() => {
    if (!document.getElementById("lp-fonts")) {
      const link = document.createElement("link");
      link.id = "lp-fonts";
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,300;0,400;1,300;1,400&family=Sora:wght@300;400;500&family=Scheherazade+New:wght@400;700&display=swap";
      document.head.appendChild(link);
    }
    const prev = document.body.style.background;
    document.body.style.background = "oklch(0.11 0.008 80)";
    return () => {
      document.body.style.background = prev;
    };
  }, []);

  /* Scroll-reveal for feature cards */
  useEffect(() => {
    const cards = featuresRef.current?.querySelectorAll<HTMLElement>(".lp-feat");
    if (!cards) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset.visible = "true";
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  return (
    <div className="lp">
      {/* ── Nav ── */}
      <nav className="lp-nav">
        <span className="lp-wordmark">TafsirLab</span>
        <Link href="/beta" className="lp-nav-cta">
          Sign in
        </Link>
      </nav>

      {/* ── Hero ── */}
      <section className="lp-hero">
        {/* Decorative watermark */}
        <span className="lp-bismillah" aria-hidden="true">
          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
        </span>

        <div className="lp-hero-inner">
          <p className="lp-eyebrow">Collaborative Qurʾān study</p>
          <h1 className="lp-headline">
            Where tafsir
            <br />
            <em>comes alive.</em>
          </h1>
          <p className="lp-subhead">
            Write commentary, annotate the Mushaf, and study together — in real
            time, from anywhere.
          </p>

          <div className="lp-cta-row">
            <Link href="/beta" className="lp-btn-primary">
              Try now →
            </Link>
          </div>
        </div>

        {/* Decorative verse strip */}
        <div className="lp-verse-strip" aria-hidden="true">
          <span className="lp-verse-ar">
            اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ
          </span>
          <span className="lp-verse-en">
            Read in the name of your Lord who created — 96:1
          </span>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="lp-features-section" ref={featuresRef}>
        <h2 className="lp-section-label">What you get</h2>
        <div className="lp-features-grid">
          {FEATURES.map((f) => (
            <article key={f.n} className="lp-feat">
              <span className="lp-feat-num">{f.n}</span>
              <h3 className="lp-feat-title">{f.title}</h3>
              <p className="lp-feat-body">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Pull quote ── */}
      <section className="lp-quote-section">
        <blockquote className="lp-quote">
          <p className="lp-quote-ar">
            اقْرَأْ وَرَبُّكَ الْأَكْرَمُ ۙ الَّذِي عَلَّمَ بِالْقَلَمِ
          </p>
          <footer className="lp-quote-footer">
            <cite>Al-ʿAlaq 96:3–4</cite>
            <span className="lp-quote-tr">
              Read, and your Lord is the Most Generous — who taught by the pen.
            </span>
          </footer>
        </blockquote>
      </section>

      {/* ── Final CTA ── */}
      <section className="lp-final-cta">
        <h2 className="lp-final-headline">
          Begin your study today.
        </h2>
        <Link href="/beta" className="lp-btn-primary lp-btn-lg">
          Open TafsirLab →
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <span className="lp-wordmark lp-wordmark-sm">TafsirLab</span>
        <span className="lp-footer-copy">
          Built for students of the Qurʾān.
        </span>
      </footer>
    </div>
  );
}
