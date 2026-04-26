"use client";

import { X } from "lucide-react";

export interface TweaksState {
  theme: "light" | "dark";
  accent: "emerald" | "amber" | "indigo";
  density: "compact" | "cozy" | "roomy";
  canvasWidth: "focused" | "wide";
  glass: "light" | "medium" | "heavy";
}

export const TWEAKS_DEFAULTS: TweaksState = {
  theme: "light",
  accent: "emerald",
  density: "cozy",
  canvasWidth: "focused",
  glass: "light",
};

const ACCENTS = [
  { id: "emerald" as const, color: "oklch(0.55 0.08 160)" },
  { id: "amber"   as const, color: "oklch(0.62 0.11 70)" },
  { id: "indigo"  as const, color: "oklch(0.52 0.12 275)" },
];

interface Props {
  state: TweaksState;
  onChange: (patch: Partial<TweaksState>) => void;
  onClose: () => void;
}

function Seg<T extends string>({
  options, active, onChange,
}: {
  options: { value: T; label: string }[];
  active: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="tw-segments">
      {options.map((o) => (
        <button
          key={o.value}
          className="tw-seg"
          data-active={active === o.value ? "true" : "false"}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function TweaksPanel({ state, onChange, onClose }: Props) {
  return (
    <div className="tweaks-panel">
      <div className="tweaks-head">
        <div className="tweaks-title">Tweaks</div>
        <button className="tweaks-close" onClick={onClose}><X size={13} /></button>
      </div>
      <div className="tweaks-body">
        <div className="tw-row">
          <div className="tw-label">Theme</div>
          <Seg
            options={[{ value: "light", label: "Paper" }, { value: "dark", label: "Slate" }]}
            active={state.theme}
            onChange={(v) => onChange({ theme: v })}
          />
        </div>
        <div className="tw-row">
          <div className="tw-label">Accent</div>
          <div className="tw-swatches">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                className="tw-swatch"
                data-active={state.accent === a.id ? "true" : "false"}
                onClick={() => onChange({ accent: a.id })}
                title={a.id}
              >
                <span className="tw-swatch-dot" style={{ background: a.color }} />
              </button>
            ))}
          </div>
        </div>
        <div className="tw-row">
          <div className="tw-label">Density</div>
          <Seg
            options={[
              { value: "compact", label: "Compact" },
              { value: "cozy",    label: "Cozy" },
              { value: "roomy",   label: "Roomy" },
            ]}
            active={state.density}
            onChange={(v) => onChange({ density: v })}
          />
        </div>
        <div className="tw-row">
          <div className="tw-label">Canvas width</div>
          <Seg
            options={[{ value: "focused", label: "Focused" }, { value: "wide", label: "Wide" }]}
            active={state.canvasWidth}
            onChange={(v) => onChange({ canvasWidth: v })}
          />
        </div>
        <div className="tw-row">
          <div className="tw-label">Drawer blur</div>
          <Seg
            options={[
              { value: "light",  label: "Light" },
              { value: "medium", label: "Medium" },
              { value: "heavy",  label: "Heavy" },
            ]}
            active={state.glass}
            onChange={(v) => onChange({ glass: v })}
          />
        </div>
      </div>
    </div>
  );
}
