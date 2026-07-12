"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { Verse } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────

type Tab = "commentary" | "wbw" | "translations" | "audio";

interface TafsirEntry {
  source:       { slug: string; name: string; language: string };
  content:      string;
  contentHtml?: string;
  fromCache:    boolean;
  error?:       string;
}

interface SourceMeta {
  slug:       string;
  name:       string;
  nameArabic: string | null;
  language:   string;
  type:       string;
}

interface Props {
  open:     boolean;
  verseKey: string | null;  // ayah to jump to when triggered externally
  verses:   Verse[];
  onClose:  () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

// ── Static lists ───────────────────────────────────────────────────────────

const TRANSLATIONS_LIST = [
  { name: "Saheeh International", sub: "EN · literal",     active: true },
  { name: "Abdel Haleem",         sub: "EN · contemporary"              },
  { name: "M.A.S. Pickthall",    sub: "EN · early 20th c."             },
  { name: "Yusuf Ali",            sub: "EN · explanatory"               },
];

const RECITERS = [
  { name: "Mishary Rashid Alafasy",        sub: "Kuwait · Ḥafṣ ʿan ʿĀṣim" },
  { name: "ʿAbd al-Bāsiṭ ʿAbd al-Ṣamad", sub: "Egypt · murattal"          },
  { name: "Maher Al Muaiqly",              sub: "Makkah · tarāwīḥ"          },
];

const LS_SOURCE_KEY = "tl-tafsir-source";
const LS_LANG_KEY   = "tl-tafsir-lang";

type LangFilter = "all" | "en" | "ar";

// ── Component ──────────────────────────────────────────────────────────────

export default function TafsirDrawer({ open, verseKey, verses, onClose }: Props) {
  const { openWordPanel } = useAppStore();

  // ── Core state ──────────────────────────────────────────────────────────
  const [tab,         setTab]       = useState<Tab>("commentary");
  const [activeAyah,  setActiveAyah] = useState<string | null>(verseKey);
  const [sources,     setSources]   = useState<SourceMeta[]>([]);
  const [sourceSlug,  setSourceSlug] = useState<string>(() =>
    (typeof window !== "undefined" ? localStorage.getItem(LS_SOURCE_KEY) : null)
    ?? "ibn-kathir-en"
  );
  const [langFilter,  setLangFilter] = useState<LangFilter>(() => {
    if (typeof window === "undefined") return "all";
    const stored = localStorage.getItem(LS_LANG_KEY);
    return stored === "en" || stored === "ar" ? stored : "all";
  });

  // ── Fetch state ──────────────────────────────────────────────────────────
  const [entry,   setEntry]   = useState<TafsirEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Ref so we can scroll the active ayah button into view
  const activeBtnRef = useRef<HTMLButtonElement | null>(null);

  // ── Sync active ayah when triggered externally ───────────────────────────
  useEffect(() => {
    if (verseKey) setActiveAyah(verseKey);
  }, [verseKey]);

  // ── Scroll active ayah into view in the nav ──────────────────────────────
  useEffect(() => {
    activeBtnRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeAyah]);

  // ── Provision + load sources on first open ───────────────────────────────
  useEffect(() => {
    if (!open) return;
    fetch("/api/tafsir/sources")
      .then((r) => r.json())
      .then((data: { sources?: SourceMeta[] }) => {
        if (!data.sources?.length) return;
        setSources(data.sources);
        // If the stored source is no longer in the list, fall back to first
        const stored = localStorage.getItem(LS_SOURCE_KEY);
        if (stored && !data.sources.find((s) => s.slug === stored)) {
          setSourceSlug(data.sources[0].slug);
        }
      })
      .catch(() => {/* non-fatal */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Persist source choice ────────────────────────────────────────────────
  function switchSource(slug: string) {
    setSourceSlug(slug);
    localStorage.setItem(LS_SOURCE_KEY, slug);
  }

  // ── Language filter (All / English / Arabic) ─────────────────────────────
  const filteredSources = useMemo(
    () => langFilter === "all" ? sources : sources.filter((s) => s.language === langFilter),
    [sources, langFilter],
  );

  function switchLang(lang: LangFilter) {
    setLangFilter(lang);
    localStorage.setItem(LS_LANG_KEY, lang);
    // If the current source falls outside the filter, jump to the first match
    if (lang !== "all") {
      const cur = sources.find((s) => s.slug === sourceSlug);
      if (cur && cur.language !== lang) {
        const first = sources.find((s) => s.language === lang);
        if (first) switchSource(first.slug);
      }
    }
  }

  // ── Fetch tafsir whenever ayah or source changes ─────────────────────────
  useEffect(() => {
    if (!activeAyah || !open) return;
    setLoading(true);
    setError(null);
    setEntry(null);

    const urlKey = activeAyah.replace(":", "_");
    fetch(`/api/tafsir/${urlKey}?sources=${sourceSlug}`)
      .then((r) => r.json())
      .then((data: { entries?: TafsirEntry[]; error?: string }) => {
        if (data.error) { setError(data.error); return; }
        const e = data.entries?.[0] ?? null;
        if (!e)       { setError("No tafsir available for this verse."); return; }
        if (e.error)  { setError(e.error); return; }
        setEntry(e);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [activeAyah, sourceSlug, open]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const activeVerse = useMemo(
    () => verses.find((v) => v.verse_key === activeAyah) ?? null,
    [verses, activeAyah],
  );

  const words = useMemo(
    () => activeVerse?.words?.filter((w) => w.char_type_name === "word") ?? [],
    [activeVerse],
  );

  const sourceName = sources.find((s) => s.slug === sourceSlug)?.name
    ?? (sourceSlug === "maarif-en" ? "Maʿārif al-Qurʾān (English)" : "Ibn Kathīr (English)");

  const TABS: { id: Tab; label: string }[] = [
    { id: "commentary",   label: "Commentary"   },
    { id: "wbw",          label: "Word-by-word" },
    { id: "translations", label: "Translations" },
    { id: "audio",        label: "Recitation"   },
  ];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="drawer-overlay" data-open={open ? "true" : "false"}>

      {/* ── Header ── */}
      <div className="drawer-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="drawer-head-title">Tafsīr · Classical Commentary</div>
          {activeAyah && (
            <div className="drawer-head-ref">{activeAyah} · Al-Qurʾān</div>
          )}
        </div>
        <button className="drawer-close" onClick={onClose} title="Close">
          <X size={14} />
        </button>
      </div>

      {/* ── Source selector ── */}
      <div className="drawer-source-bar">
        <span className="drawer-source-label">Source</span>
        <div className="drawer-lang-chips" role="tablist" aria-label="Tafsir language">
          {([["all", "All"], ["en", "EN"], ["ar", "AR"]] as [LangFilter, string][]).map(([id, label]) => (
            <button
              key={id}
              className="drawer-lang-chip"
              data-active={langFilter === id ? "true" : "false"}
              onClick={() => switchLang(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="drawer-source-select-wrap">
          <select
            className="drawer-source-select"
            value={sourceSlug}
            onChange={(e) => switchSource(e.target.value)}
          >
            {filteredSources.length === 0 ? (
              <option value="ibn-kathir-en">Ibn Kathīr (English)</option>
            ) : (
              filteredSources.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}{langFilter === "all" ? ` · ${s.language.toUpperCase()}` : ""}
                </option>
              ))
            )}
          </select>
          <svg className="drawer-source-chevron" width="11" height="11" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="drawer-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className="drawer-tab"
            data-active={tab === t.id ? "true" : "false"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Split: ayah navigator + content ── */}
      <div className="drawer-split">

        {/* Ayah navigator */}
        <div className="drawer-ayah-nav scroll">
          {verses.map((v) => {
            const n        = parseInt(v.verse_key.split(":")[1], 10);
            const isActive = v.verse_key === activeAyah;
            return (
              <button
                key={v.verse_key}
                ref={isActive ? activeBtnRef : null}
                className="drawer-ayah-btn"
                data-active={isActive ? "true" : "false"}
                onClick={() => setActiveAyah(v.verse_key)}
                title={`Ayah ${n}`}
              >
                {n}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="drawer-body scroll">

          {/* Verse preview */}
          {activeVerse && (
            <div className="drawer-verse">
              <div className="drawer-verse-arabic">{activeVerse.text_uthmani}</div>
              {activeVerse.translations?.[0]?.text && (
                <div className="drawer-verse-translation">
                  {stripTags(activeVerse.translations[0].text)}
                </div>
              )}
            </div>
          )}

          {/* ── Commentary ── */}
          {tab === "commentary" && (
            <>
              {loading && (
                <div className="drawer-skeleton">
                  {[88, 70, 93, 62, 80, 75, 55, 85].map((w, i) => (
                    <div key={i} className="drawer-sk-line" style={{ width: `${w}%` }} />
                  ))}
                </div>
              )}

              {!loading && error && (
                <div className="drawer-error">{error}</div>
              )}

              {!loading && !error && entry && (
                <div className="commentary-section">
                  <div className="commentary-author">
                    <div className="commentary-avatar">
                      {sourceName.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="commentary-name">{sourceName}</div>
                      <div className="commentary-sub">
                        {entry.fromCache ? "Cached" : "Live"} · {entry.source.language.toUpperCase()}
                      </div>
                    </div>
                  </div>
                  <div
                    className="commentary-body"
                    dir="auto"
                    dangerouslySetInnerHTML={{
                      __html: entry.contentHtml
                        ?? entry.content
                            .replace(/\n{2,}/g, "</p><p>")
                            .replace(/\n/g, "<br />"),
                    }}
                  />
                </div>
              )}

              {!loading && !error && !entry && (
                <div className="drawer-empty">Select an ayah to view commentary.</div>
              )}
            </>
          )}

          {/* ── Word-by-word ── */}
          {tab === "wbw" && (
            activeVerse ? (
              <div className="wbw">
                {words.map((w, i) => (
                  <button
                    key={i}
                    className="wbw-cell"
                    onClick={() => openWordPanel(`${activeAyah}:${w.position}`)}
                    title="Open in word panel"
                  >
                    <div className="wbw-ar">{w.text}</div>
                    <div className="wbw-tr">{w.transliteration?.text}</div>
                    <div className="wbw-en">{w.translation?.text}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="drawer-empty">Select an ayah to view word breakdown.</div>
            )
          )}

          {/* ── Translations ── */}
          {tab === "translations" && (
            <div className="lang-list">
              {TRANSLATIONS_LIST.map((t) => (
                <div
                  key={t.name}
                  className="lang-item lang-item--static"
                  data-active={t.active ? "true" : "false"}
                >
                  <div>
                    <div className="lang-item-name">{t.name}</div>
                    <div className="lang-item-sub">{t.sub}</div>
                  </div>
                  {t.active && <span className="lang-item-active-badge">active</span>}
                </div>
              ))}
              <p className="drawer-coming-soon">Translation switching — coming soon.</p>
            </div>
          )}

          {/* ── Audio ── */}
          {tab === "audio" && (
            <div className="audio-list">
              {RECITERS.map((r, i) => (
                <div key={i} className="lang-item">
                  <div>
                    <div className="lang-item-name">{r.name}</div>
                    <div className="lang-item-sub">{r.sub}</div>
                  </div>
                  <span className="lang-item-sub lang-item-soon">soon</span>
                </div>
              ))}
              <p className="drawer-coming-soon">Audio recitation — coming soon.</p>
            </div>
          )}

        </div>{/* end .drawer-body */}
      </div>{/* end .drawer-split */}
    </div>
  );
}
