const { useState: uS, useEffect: uE, useMemo: uM } = React;

function App() {
  // ---- Tweaks state ----
  const [tw, setTw] = uS(() => {
    try {
      const saved = localStorage.getItem("tafsirlab.tweaks");
      if (saved) return { ...window.__TWEAKS__, ...JSON.parse(saved) };
    } catch {}
    return window.__TWEAKS__;
  });
  const updateTw = (patch) => {
    setTw((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem("tafsirlab.tweaks", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // ---- App state ----
  const [showTweaks, setShowTweaks] = uS(false);
  const [activePage, setActivePage] = uS("p-names");
  const [drawerRef, setDrawerRef]   = uS(null);
  const [activeBlockId, setActiveBlockId] = uS(null);

  const openVerse = (ref) => { setDrawerRef(ref); };
  const closeDrawer = () => setDrawerRef(null);

  const doc = uM(() => buildFatihaNamesDoc(openVerse), []);

  const activeVerseRef = drawerRef;

  return (
    <div
      className="app"
      data-theme={tw.theme}
      data-accent={tw.accent}
      data-density={tw.density}
      data-canvas={tw.canvasWidth}
      data-glass={tw.glass}
    >
      <Rail active="notes" onSelect={() => {}} />
      <Sidebar activeId={activePage} onSelect={setActivePage} />

      <main className="canvas scroll">
        <div className="topbar">
          <div className="crumbs">
            <span className="crumb">Tafsir Scholars</span>
            <span className="crumb-sep">/</span>
            <span className="crumb">Quranic Studies</span>
            <span className="crumb-sep">/</span>
            <span className="crumb">Surah Al-Fatiha</span>
            <span className="crumb-sep">/</span>
            <span className="crumb" data-current="true">Names of the Surah</span>
          </div>

          <div className="topbar-actions">
            <button className="tb-icon" title="Comments"><Icons.Comment size={15} /></button>
            <button className="tb-icon" title="History"><Icons.History size={15} /></button>
            <button className="tb-icon" title="Copy link"><Icons.Link size={15} /></button>
            <div className="tb-divider" />
            <button
              className="tb-btn"
              data-active={showTweaks}
              onClick={() => setShowTweaks((v) => !v)}
              title="Tweak design"
            >
              <Icons.Sliders size={14} /> Tweaks
            </button>
            <button
              className="tb-btn"
              data-active={!!drawerRef}
              onClick={() => setDrawerRef(drawerRef ? null : "Q 1:1–7")}
              title="Toggle tafsīr panel"
            >
              <Icons.Book size={14} /> Tafsīr
            </button>
            <button className="tb-share" title="Share">
              <Icons.Share size={13} /> Share
            </button>
          </div>
        </div>

        <Editor
          doc={doc}
          openVerse={openVerse}
          activeVerseRef={activeVerseRef}
          activeBlockId={activeBlockId}
          onActivateBlock={setActiveBlockId}
        />
      </main>

      <Drawer openRef={drawerRef} onClose={closeDrawer} />
      {showTweaks && <Tweaks state={tw} onChange={updateTw} onClose={() => setShowTweaks(false)} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
