"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { TAFSIR_LANGUAGE_NAMES } from "@/lib/tafsir/spa5k-catalog";
import { useT } from "@/lib/i18n/LocaleProvider";
import { sanitizeTafsirHtml } from "@/lib/sanitize-html";
import { formatPlainTafsir } from "@/lib/tafsir/format-content";
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

/** "all" or an ISO language code present in the source list. */
type LangFilter = string;

// ── Component ──────────────────────────────────────────────────────────────

export default function TafsirDrawer({ open, verseKey, verses, onClose }: Props) {
  const { openWordPanel } = useAppStore();
  const t = useT();

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
    return localStorage.getItem(LS_LANG_KEY) ?? "all";
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
        // Stored language filter no longer present → fall back to All
        setLangFilter((cur) =>
          cur !== "all" && !data.sources!.some((s) => s.language === cur) ? "all" : cur);
      })
      .catch(() => {/* non-fatal */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Persist source choice ────────────────────────────────────────────────
  function switchSource(slug: string) {
    setSourceSlug(slug);
    localStorage.setItem(LS_SOURCE_KEY, slug);
  }

  // ── Language filter — dynamic: every language present in the catalog ─────
  // English + Arabic pinned first, the rest by how many sources they have.
  const languages = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sources) counts.set(s.language, (counts.get(s.language) ?? 0) + 1);
    const langs = [...counts.entries()].sort((a, b) => {
      const pin = (l: string) => (l === "en" ? 0 : l === "ar" ? 1 : 2);
      return pin(a[0]) - pin(b[0]) || b[1] - a[1] || a[0].localeCompare(b[0]);
    });
    return langs; // [code, count][]
  }, [sources]);

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
    { id: "commentary",   label: t("drawer.commentary")   },
    { id: "wbw",          label: t("drawer.wordByWord") },
    { id: "translations", label: t("drawer.translations") },
    { id: "audio",        label: t("drawer.recitation")   },
  ];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="drawer-overlay" data-open={open ? "true" : "false"}>

      {/* ── Header ── */}
      <div className="drawer-head">
        <div className="drawer-head-text">
          <div className="drawer-head-title">{t("drawer.title")}</div>
          {/* Source mode, then the reference: three quiet levels rather than a
              modal title bar. Both truncate — source and Surah names are
              arbitrarily long. */}
          <div className="drawer-head-sub">{sourceName}</div>
          {activeAyah && (
            <div className="drawer-head-ref">Al-Qurʾān {activeAyah}</div>
          )}
        </div>
        <button className="drawer-close" onClick={onClose} title="Close" aria-label="Close Tafsīr">
          <X size={14} />
        </button>
      </div>

      {/* ── Source selector ── */}
      <div className="drawer-source-bar">
        {/* The uppercase "SOURCE" label is dropped: the row is self-evident,
            and the group keeps an accessible name. */}
        <div className="drawer-lang-chips" role="tablist" aria-label="Tafsir language">
          <button
            className="drawer-lang-chip"
            data-active={langFilter === "all" ? "true" : "false"}
            onClick={() => switchLang("all")}
          >
            All
          </button>
          {languages.map(([code, count]) => (
            <button
              key={code}
              className="drawer-lang-chip"
              data-active={langFilter === code ? "true" : "false"}
              onClick={() => switchLang(code)}
              title={`${TAFSIR_LANGUAGE_NAMES[code] ?? code} · ${count} source${count !== 1 ? "s" : ""}`}
            >
              {TAFSIR_LANGUAGE_NAMES[code] ?? code.toUpperCase()}
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
            <section className="drawer-verse" aria-label="Ayah">
              <p className="drawer-verse-arabic" dir="rtl" lang="ar">{activeVerse.text_uthmani}</p>
              {activeVerse.translations?.[0]?.text && (
                <p className="drawer-verse-translation">
                  {stripTags(activeVerse.translations[0].text)}
                </p>
              )}
            </section>
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
                  {/* A citation, not an author row. The initials disc and the
                      Cached/Live badge made delivery status look like content;
                      it moves to the title attribute, where it is still
                      discoverable but no longer a headline. */}
                  <div
                    className="commentary-cite"
                    title={entry.fromCache ? "Served from cache" : "Fetched live"}
                  >
                    <cite className="commentary-name">{sourceName}</cite>
                    <span className="commentary-sub">
                      {TAFSIR_LANGUAGE_NAMES[entry.source.language]
                        ?? entry.source.language.toUpperCase()} commentary
                    </span>
                  </div>
                  <div
                    className="commentary-body"
                    dir="auto"
                    // contentHtml is third-party; content is plain text whose
                    // tags must not survive the <p>/<br> re-wrapping either.
                    dangerouslySetInnerHTML={{
                      /* Sources that ship their own HTML keep it — their markup
                         is authoritative and is only styled, never rewritten.
                         Plain-text sources (Ibn Kathīr among them) were wrapped
                         into one undifferentiated run of <p>, which is why
                         section titles read exactly like prose and Arabic
                         ḥadīth ran left-to-right in the Latin serif. */
                      __html: entry.contentHtml
                        ? sanitizeTafsirHtml(entry.contentHtml)
                        : formatPlainTafsir(entry.content),
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
