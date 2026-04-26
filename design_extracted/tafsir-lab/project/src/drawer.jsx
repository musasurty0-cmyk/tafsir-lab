const { useState: useDS } = React;

function Drawer({ openRef, onClose }) {
  const [tab, setTab] = useDS("commentary");

  if (!openRef) return null;
  const data = COMMENTARY[openRef] || COMMENTARY["Q 1:1–7"];

  return (
    <div className="drawer-overlay" data-open={!!openRef}>
      <div className="drawer-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="drawer-head-title">Tafsīr · Classical commentary</div>
          <div className="drawer-head-ref">{openRef} · Al-Fatiha</div>
        </div>
        <button className="drawer-close" title="Expand" onClick={() => {}}>
          <Icons.Expand size={14} />
        </button>
        <button className="drawer-close" onClick={onClose} title="Close">
          <Icons.Close size={14} />
        </button>
      </div>

      <div className="drawer-tabs">
        <button className="drawer-tab" data-active={tab === "commentary"} onClick={() => setTab("commentary")}>Commentary</button>
        <button className="drawer-tab" data-active={tab === "wbw"}        onClick={() => setTab("wbw")}>Word-by-word</button>
        <button className="drawer-tab" data-active={tab === "translations"} onClick={() => setTab("translations")}>Translations</button>
        <button className="drawer-tab" data-active={tab === "audio"}      onClick={() => setTab("audio")}>Recitation</button>
      </div>

      <div className="drawer-body scroll">
        <div className="drawer-verse">
          <div className="drawer-verse-arabic">{data.verse.ar}</div>
          <div className="drawer-verse-translation">
            <i>{data.verse.tl}</i><br/>{data.verse.en}
          </div>
        </div>

        {tab === "commentary" && (
          <>
            {data.sources.map((s, i) => (
              <div key={i} className="commentary-section">
                <div className="commentary-author">
                  <div className="commentary-avatar">{s.initials}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="commentary-name">{s.author}</div>
                    <div className="commentary-sub">{s.years}</div>
                  </div>
                </div>
                <div className="commentary-body">{s.body}</div>
              </div>
            ))}
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16, marginTop: 8 }}>
              <button className="tb-btn" style={{ padding: "6px 12px", border: "1px solid var(--line-strong)" }}>
                <Icons.Plus size={13} /> Add source
              </button>
            </div>
          </>
        )}

        {tab === "wbw" && (
          data.wbw ? (
            <div className="wbw">
              {data.wbw.map((w, i) => (
                <div key={i} className="wbw-cell">
                  <div className="wbw-ar">{w.ar}</div>
                  <div className="wbw-tr">{w.tr}</div>
                  <div className="wbw-en">{w.en}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 20, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
              Word-by-word breakdown not available for this range.
            </div>
          )
        )}

        {tab === "translations" && (
          <div className="lang-list">
            {[
              { name: "Saheeh International", sub: "EN · literal / clear", active: true },
              { name: "Abdel Haleem",         sub: "EN · contemporary" },
              { name: "M.A.S. Pickthall",     sub: "EN · early 20th c." },
              { name: "Yusuf Ali",            sub: "EN · explanatory" },
              { name: "Hamidullah",           sub: "FR · Hamidullah" },
              { name: "Khan & Hilali",        sub: "EN · with bracketed gloss" },
            ].map((t) => (
              <div key={t.name} className="lang-item" data-active={t.active}>
                <div>
                  <div className="lang-item-name">{t.name}</div>
                  <div className="lang-item-sub">{t.sub}</div>
                </div>
                <Icons.Chevron size={14} style={{ color: "var(--ink-4)" }} />
              </div>
            ))}
          </div>
        )}

        {tab === "audio" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { name: "Mishary Rashid Alafasy", sub: "Kuwait · Ḥafṣ ʿan ʿĀṣim" },
              { name: "ʿAbd al-Bāsiṭ ʿAbd al-Ṣamad", sub: "Egypt · murattal" },
              { name: "Maher Al Muaiqly",     sub: "Makkah · tarāwīḥ" },
            ].map((r, i) => (
              <div key={i} className="lang-item">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button style={{
                    width: 30, height: 30, borderRadius: 999,
                    background: "var(--accent)", color: "white",
                    display: "grid", placeItems: "center"
                  }}>
                    <Icons.Play size={12} />
                  </button>
                  <div>
                    <div className="lang-item-name">{r.name}</div>
                    <div className="lang-item-sub">{r.sub}</div>
                  </div>
                </div>
                <span className="lang-item-sub">0:12</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { Drawer });
