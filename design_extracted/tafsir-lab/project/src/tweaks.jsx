const { useState: useTS, useEffect: useTE } = React;

function Tweaks({ state, onChange, onClose }) {
  return (
    <div className="tweaks-panel">
      <div className="tweaks-head">
        <div className="tweaks-title">Tweaks</div>
        <button className="tweaks-close" onClick={onClose} title="Hide">
          <Icons.Close size={13} />
        </button>
      </div>
      <div className="tweaks-body">
        <div className="tw-row">
          <div className="tw-label">Theme</div>
          <div className="tw-segments">
            {["light", "dark"].map((v) => (
              <button key={v} className="tw-seg" data-active={state.theme === v}
                onClick={() => onChange({ theme: v })}>
                {v === "light" ? "Paper" : "Slate"}
              </button>
            ))}
          </div>
        </div>

        <div className="tw-row">
          <div className="tw-label">Accent</div>
          <div className="tw-swatches">
            {[
              { id: "emerald", color: "oklch(0.55 0.08 160)", label: "Emerald" },
              { id: "amber",   color: "oklch(0.62 0.11 70)",  label: "Amber"  },
              { id: "indigo",  color: "oklch(0.52 0.12 275)", label: "Indigo" },
            ].map((a) => (
              <button key={a.id} className="tw-swatch" data-active={state.accent === a.id}
                onClick={() => onChange({ accent: a.id })} title={a.label}>
                <span className="tw-swatch-dot" style={{ background: a.color }} />
              </button>
            ))}
          </div>
        </div>

        <div className="tw-row">
          <div className="tw-label">Density</div>
          <div className="tw-segments">
            {["compact", "cozy", "roomy"].map((v) => (
              <button key={v} className="tw-seg" data-active={state.density === v}
                onClick={() => onChange({ density: v })}>
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="tw-row">
          <div className="tw-label">Canvas width</div>
          <div className="tw-segments">
            {["focused", "wide"].map((v) => (
              <button key={v} className="tw-seg" data-active={state.canvasWidth === v}
                onClick={() => onChange({ canvasWidth: v })}>
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="tw-row">
          <div className="tw-label">Drawer blur</div>
          <div className="tw-segments">
            {["light", "medium", "heavy"].map((v) => (
              <button key={v} className="tw-seg" data-active={state.glass === v}
                onClick={() => onChange({ glass: v })}>
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Tweaks });
