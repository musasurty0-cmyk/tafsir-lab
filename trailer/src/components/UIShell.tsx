import React from "react";
import { T } from "../tokens";

// Rail icon placeholder
const RailIcon: React.FC<{ active?: boolean; children: React.ReactNode }> = ({
  active,
  children,
}) => (
  <div
    style={{
      width: 36,
      height: 36,
      borderRadius: 8,
      display: "grid",
      placeItems: "center",
      color: active ? T.ink : T.ink3,
      background: active ? T.panel2 : "transparent",
      position: "relative",
    }}
  >
    {active && (
      <div
        style={{
          position: "absolute",
          left: -10,
          top: 8,
          bottom: 8,
          width: 2,
          background: T.accent,
          borderRadius: 2,
        }}
      />
    )}
    {children}
  </div>
);

export const Rail: React.FC = () => (
  <div
    style={{
      width: T.rail,
      background: T.bg,
      borderRight: `1px solid ${T.line}`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "10px 0",
      gap: 4,
      flexShrink: 0,
    }}
  >
    {/* Logo */}
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 9,
        background: T.ink,
        color: T.bg,
        display: "grid",
        placeItems: "center",
        fontFamily: T.fontSerif,
        fontWeight: 600,
        fontSize: 17,
        letterSpacing: "-0.02em",
        marginBottom: 8,
      }}
    >
      T
    </div>

    <RailIcon active>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="5" height="5" rx="1" fill="currentColor" opacity="0.9" />
        <rect x="9" y="2" width="5" height="5" rx="1" fill="currentColor" opacity="0.5" />
        <rect x="2" y="9" width="5" height="5" rx="1" fill="currentColor" opacity="0.5" />
        <rect x="9" y="9" width="5" height="5" rx="1" fill="currentColor" opacity="0.3" />
      </svg>
    </RailIcon>

    <RailIcon>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </RailIcon>

    <RailIcon>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </RailIcon>

    <div style={{ flex: 1 }} />
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${T.accent}, ${T.accentInk})`,
        color: "white",
        display: "grid",
        placeItems: "center",
        fontSize: 11,
        fontWeight: 600,
        fontFamily: T.fontSans,
      }}
    >
      MU
    </div>
  </div>
);

const TreeRow: React.FC<{
  label: string;
  arabic?: string;
  active?: boolean;
  indent?: number;
  count?: string;
}> = ({ label, arabic, active, indent = 0, count }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 4,
      height: 28,
      padding: `0 6px 0 ${6 + indent * 16}px`,
      borderRadius: 5,
      color: active ? T.ink : T.ink2,
      background: active ? T.panel2 : "transparent",
      fontFamily: T.fontSans,
      fontSize: 13,
      fontWeight: active ? 500 : 400,
    }}
  >
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, color: active ? T.accent : T.ink3 }}>
      <path d="M2 3h10M2 7h7M2 11h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {label}
    </span>
    {arabic && (
      <span style={{ fontFamily: T.fontArabic, fontSize: 12, color: T.ink3 }}>{arabic}</span>
    )}
    {count && (
      <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink4 }}>{count}</span>
    )}
  </div>
);

const SurahRow: React.FC<{ label: string; arabic: string; open?: boolean }> = ({
  label,
  arabic,
  open,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 2,
      height: 28,
      padding: "0 6px",
      borderRadius: 5,
      color: T.ink2,
      fontFamily: T.fontSans,
      fontSize: 13,
    }}
  >
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      style={{ flexShrink: 0, color: T.ink4, transform: open ? "rotate(90deg)" : "none" }}
    >
      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, color: T.ink3 }}>
      <rect x="2" y="2" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 7h4M7 5v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
    <span style={{ flex: 1 }}>{label}</span>
    <span style={{ fontFamily: T.fontArabic, fontSize: 13, color: T.ink3 }}>{arabic}</span>
  </div>
);

export const Sidebar: React.FC = () => (
  <div
    style={{
      width: T.sidebar,
      background: T.bg,
      borderRight: `1px solid ${T.line}`,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      flexShrink: 0,
    }}
  >
    {/* Header */}
    <div style={{ padding: "14px 14px 10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "4px 8px 4px 4px",
          borderRadius: 6,
          flex: 1,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            background: `linear-gradient(135deg, ${T.accent}, ${T.accentInk})`,
            color: "white",
            display: "grid",
            placeItems: "center",
            fontSize: 11,
            fontWeight: 600,
            fontFamily: T.fontSans,
          }}
        >
          TL
        </div>
        <span style={{ fontFamily: T.fontSans, fontSize: 13, fontWeight: 500, color: T.ink }}>
          Tafsir Study Group
        </span>
      </div>
    </div>

    {/* Search */}
    <div
      style={{
        margin: "0 10px 6px 10px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        background: T.panel,
        border: `1px solid transparent`,
        borderRadius: 6,
        color: T.ink3,
        fontSize: 13,
        fontFamily: T.fontSans,
      }}
    >
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3" />
        <path d="M8.5 8.5L11 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      <span style={{ color: T.ink4 }}>Search pages…</span>
      <span
        style={{
          marginLeft: "auto",
          fontFamily: T.fontMono,
          fontSize: 11,
          color: T.ink4,
          padding: "1px 5px",
          border: `1px solid ${T.lineStrong}`,
          borderRadius: 4,
        }}
      >
        ⌘K
      </span>
    </div>

    {/* Section label */}
    <div
      style={{
        padding: "10px 10px 4px 16px",
        fontFamily: T.fontSans,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: T.ink4,
      }}
    >
      Surahs
    </div>

    {/* Tree */}
    <div style={{ padding: "0 6px 16px 6px", flex: 1 }}>
      <SurahRow label="Al-Fatihah" arabic="الفاتحة" />
      <SurahRow label="Al-Baqarah" arabic="البقرة" open />
      <TreeRow label="Overview" indent={1} />
      <TreeRow label="Ayat al-Kursi (2:255)" arabic="آية الكرسي" active indent={1} count="12" />
      <TreeRow label="Verses 256–286" indent={1} />
      <SurahRow label="Ali 'Imran" arabic="آل عمران" />
      <SurahRow label="An-Nisa'" arabic="النساء" />
      <SurahRow label="Al-Ma'idah" arabic="المائدة" />
    </div>
  </div>
);

export const Topbar: React.FC<{ title?: string }> = ({ title = "Ayat al-Kursi (2:255)" }) => (
  <div
    style={{
      background: `rgba(250,250,248,0.82)`,
      backdropFilter: "blur(12px)",
      borderBottom: `1px solid ${T.line}`,
      display: "flex",
      alignItems: "center",
      padding: "0 20px",
      gap: 10,
      minHeight: 48,
      flexShrink: 0,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: T.fontSans, fontSize: 13, color: T.ink3, flex: 1 }}>
      <span style={{ padding: "3px 6px", borderRadius: 4 }}>Tafsir Study Group</span>
      <span style={{ color: T.ink4, fontSize: 12 }}>›</span>
      <span style={{ padding: "3px 6px", borderRadius: 4 }}>Al-Baqarah</span>
      <span style={{ color: T.ink4, fontSize: 12 }}>›</span>
      <span style={{ padding: "3px 6px", borderRadius: 4, color: T.ink, fontWeight: 500 }}>{title}</span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {["A", "B"].map((mode, i) => (
        <div
          key={mode}
          style={{
            height: 28,
            padding: "0 10px",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            fontFamily: T.fontSans,
            fontSize: 13,
            color: i === 1 ? T.ink : T.ink2,
            background: i === 1 ? T.panel2 : "transparent",
          }}
        >
          Mode {mode}
        </div>
      ))}
      <div style={{ width: 1, height: 18, background: T.line, margin: "0 4px" }} />
      <div
        style={{
          height: 28,
          padding: "0 12px",
          borderRadius: 6,
          background: T.ink,
          color: T.bg,
          fontFamily: T.fontSans,
          fontSize: 13,
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
        }}
      >
        Share
      </div>
    </div>
  </div>
);
