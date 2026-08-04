import React from "react";
import { R } from "../reelTokens";
import { APP_W, APP_H, Caret, revealAt } from "./parts";

/**
 * TafsirLab, rebuilt as animatable layers for a 9:16 stage.
 *
 * Laid out for the reel's portrait frame rather than cropped from a desktop
 * screenshot: one column, larger type, and vertical rhythm that reads at
 * phone size. Every label, colour and control is the product's own.
 */

/* ── Chrome ───────────────────────────────────────────────────────────────*/

export const Brand: React.FC = () => (
  <div style={{
    height: 64, display: "flex", alignItems: "center", gap: 12,
    padding: "0 22px", borderBottom: `1px solid ${R.line}`, flexShrink: 0,
  }}>
    <div style={{
      width: 30, height: 30, borderRadius: 8, background: R.ink, color: R.bg,
      display: "grid", placeItems: "center",
      fontFamily: R.fontSans, fontSize: 16, fontWeight: 700,
    }}>T</div>
    <div style={{ fontFamily: R.fontSans, fontSize: 19, fontWeight: 600, color: R.ink }}>
      TafsirLab
    </div>
  </div>
);

export const Crumbs: React.FC<{ trail: string[] }> = ({ trail }) => (
  <div style={{
    height: 48, display: "flex", alignItems: "center", gap: 8,
    padding: "0 22px", borderBottom: `1px solid ${R.line}`, flexShrink: 0,
  }}>
    {trail.map((t, i) => (
      <React.Fragment key={t}>
        {i > 0 && <span style={{ fontFamily: R.fontSans, fontSize: 14, color: R.ink4 }}>/</span>}
        <span style={{
          fontFamily: R.fontSans, fontSize: 14,
          color: i === trail.length - 1 ? R.ink : R.ink3,
          fontWeight: i === trail.length - 1 ? 600 : 400,
          whiteSpace: "nowrap",
        }}>{t}</span>
      </React.Fragment>
    ))}
  </div>
);

export const Rail: React.FC = () => (
  <div style={{
    width: 54, borderRight: `1px solid ${R.line}`,
    display: "flex", flexDirection: "column", alignItems: "center",
    padding: "16px 0", gap: 14, flexShrink: 0,
  }}>
    {[{ g: "⌂", c: R.ink3 }, { g: "◈", c: R.accent }, { g: "▣", c: R.ink2 }, { g: "+", c: R.ink4 }]
      .map((it, i) => (
        <div key={i} style={{
          width: 30, height: 30, borderRadius: 7,
          display: "grid", placeItems: "center",
          fontSize: 16, color: it.c,
          background: i === 2 ? R.panel : "transparent",
        }}>{it.g}</div>
      ))}
  </div>
);

/* ── Slash suggestion — anchored to the caret, never placed by hand ───────
   MENU_H is the rendered height (10 padding x2 + 12 padding x2 + 20 title +
   3 gap + 16 desc, rounded up) and the note reserves exactly this much space
   below the command line while the menu is open. */
export const MENU_H = 104;


export const SlashMenu: React.FC<{ o: number }> = ({ o }) => (
  <div style={{
    /* Sits directly BELOW the line it was typed on: the menu is a child of
       the slash line, so it tracks the text rather than a guessed offset. */
    position: "absolute", top: "100%", left: 0, marginTop: 8,
    width: 470, zIndex: 400,
    background: R.bgElev, border: `1px solid ${R.lineStrong}`,
    borderRadius: R.radiusMd, boxShadow: R.shadowLg, padding: 10,
    opacity: o, transform: `translateY(${(1 - o) * 10}px)`,
    transformOrigin: "top left",
  }}>
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "12px 12px", borderRadius: R.radiusSm, background: R.panel,
    }}>
      <div style={{ fontSize: 22, color: R.iconLink }}>🔗</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: R.fontSans, fontSize: 20, fontWeight: 600, color: R.ink }}>
          Link Qurʾanic passage
        </div>
        <div style={{
          fontFamily: R.fontSans, fontSize: 16, color: R.ink3, marginTop: 3,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          Create a permanent Connection to an āyah, …
        </div>
      </div>
    </div>
  </div>
);

/* ── The note ─────────────────────────────────────────────────────────────*/

export const NoteBody: React.FC<{
  f: number;
  slash?: string;
  caret?: boolean;
  menu?: number;              // slash-menu opacity; the menu hangs off the line
  saved?: React.ReactNode;
  /** Frame the note starts writing itself in. Omit for an already-written note. */
  reveal?: number;
}> = ({ f, slash, caret, menu, saved, reveal }) => {
  const rv = (i: number) => (reveal === undefined ? {} : revealAt(f, reveal, i));
  return (
  <div style={{ padding: "26px 24px 0" }}>
    <div style={{
      fontFamily: R.fontSerif, fontSize: 34, fontWeight: 700,
      color: R.ink, marginBottom: 16, letterSpacing: "-0.01em", lineHeight: 1.25,
      ...rv(0),
    }}>
      3. As-Sabʿ al-Mathānī{" "}
      <span style={{ fontFamily: R.fontArabic, fontWeight: 400 }}>(السبع المثاني)</span>
    </div>

    <div style={{
      fontFamily: R.fontSans, fontSize: 23, lineHeight: 1.65,
      color: R.ink2, marginBottom: 22, ...rv(1),
    }}>
      Seven verses, repeated in every rakʿah of every prayer.
    </div>

    <div style={{ borderLeft: `3px solid ${R.line}`, paddingLeft: 22, marginBottom: 22, ...rv(2) }}>
      <div dir="rtl" style={{
        fontFamily: R.fontArabic, fontSize: 33, lineHeight: 2.0,
        color: R.ink, textAlign: "right",
      }}>
        وَلَقَدْ آتَيْنَاكَ سَبْعًا مِّنَ الْمَثَانِي وَالْقُرْآنَ الْعَظِيمَ
      </div>
      <div style={{
        fontFamily: R.fontSans, fontSize: 20, fontStyle: "italic",
        color: R.ink2, lineHeight: 1.6, marginTop: 12,
      }}>
        And indeed, We have given you the seven oft-repeated verses and the Great Qurʾān.
      </div>
    </div>

    {/* The line the command is typed on — and the menu's anchor.
        marginBottom grows with the menu so the text below is pushed down
        rather than covered: the suggestion opens INTO the document, the way
        the real editor reflows around it. */}
    <div style={{
      position: "relative", minHeight: 38,
      marginBottom: (menu ?? 0) * MENU_H,
      ...rv(3),
    }}>
      <div style={{
        fontFamily: R.fontSans, fontSize: 24, color: R.accentInk, lineHeight: 1.4,
      }}>
        {slash}{caret && <Caret f={f} h={26} />}
      </div>
      {menu !== undefined && menu > 0 && <SlashMenu o={menu} />}
    </div>

    {saved}

    <div style={{
      fontFamily: R.fontSans, fontSize: 20, fontStyle: "italic",
      color: R.ink2, lineHeight: 1.6, marginTop: 26, ...rv(4),
    }}>
      It is called as-Sabʿ al-Mathānī because it is seven verses by consensus,
      and Mathānī because it is repeated in prayer, recited in every rakʿah.
    </div>
    <div style={{ fontFamily: R.fontSans, fontSize: 18, color: R.ink4, marginTop: 10, ...rv(5) }}>
      — Tafsīr al-Baghawī, 1:37
    </div>
  </div>
  );
};

/* ── Create Connection modal ──────────────────────────────────────────────*/

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontFamily: R.fontSans, fontSize: 14, letterSpacing: "0.08em",
    textTransform: "uppercase", color: R.ink4, marginBottom: 8,
  }}>{children}</div>
);

const Field: React.FC<{ v: string; caret?: boolean; f: number; h?: number; focus?: boolean }> =
({ v, caret, f, h, focus }) => (
  <div style={{
    border: `1px solid ${focus ? R.accent : R.lineStrong}`,
    boxShadow: focus ? `0 0 0 4px ${R.accentSoft}` : "none",
    borderRadius: R.radius, background: R.bg,
    padding: "14px 16px", minHeight: h ?? 28,
    fontFamily: R.fontSans, fontSize: 20, color: R.ink, lineHeight: 1.45,
  }}>
    {v}{caret && <Caret f={f} h={22} />}
  </div>
);

/** Modal geometry, exported so the cursor can target real controls. */
export const MODAL = {
  x: 34, y: 250, w: 692,
  /* Derived from the stack above: title 60, two endpoint rows 88 each, then
     label 22 + field for each control. */
  nameY: 596, commY: 712, catY: 826, tagsY: 922,
  btnY: 1006, btnX: 600,
};

export const ConnectionModal: React.FC<{
  o: number; f: number;
  name: string; commentary: string; category: boolean; tags: string;
  focus: "name" | "comm" | "cat" | "tags" | null;
  pressed: boolean;
}> = ({ o, f, name, commentary, category, tags, focus, pressed }) => (
  <div style={{
    position: "absolute", inset: 0, zIndex: 600,
    background: `rgba(30,26,20,${0.36 * o})`,
    opacity: o === 0 ? 0 : 1,
  }}>
    <div style={{
      position: "absolute", left: MODAL.x, top: MODAL.y, width: MODAL.w,
      background: R.bgElev, border: `1px solid ${R.lineStrong}`,
      borderRadius: 14, boxShadow: R.shadowLg, padding: 26,
      transform: `scale(${0.97 + o * 0.03})`, opacity: o, transformOrigin: "50% 40%",
    }}>
      <div style={{
        fontFamily: R.fontSerif, fontSize: 30, fontWeight: 600,
        color: R.ink, marginBottom: 24,
      }}>Create Connection</div>

      {[
        { k: "FROM", v: "Al-Fātiḥah 1:1" },
        { k: "TO",   v: "Al-Ḥijr 15:87" },
      ].map((row) => (
        <div key={row.k} style={{
          display: "flex", alignItems: "center", gap: 20,
          background: R.panel, border: `1px solid ${R.line}`,
          borderRadius: R.radius, padding: "14px 18px", marginBottom: 10,
        }}>
          <div style={{
            fontFamily: R.fontSans, fontSize: 14, letterSpacing: "0.08em",
            color: R.ink4, width: 58,
          }}>{row.k}</div>
          <div>
            <div style={{
              fontFamily: R.fontSans, fontSize: 13, letterSpacing: "0.08em", color: R.ink4,
            }}>ĀYAH</div>
            <div style={{ fontFamily: R.fontSans, fontSize: 21, color: R.ink, marginTop: 2 }}>
              {row.v}
            </div>
          </div>
        </div>
      ))}

      <div style={{ marginTop: 22 }}>
        <Label>Connection name</Label>
        <Field v={name} caret={focus === "name"} f={f} focus={focus === "name"} />
      </div>

      <div style={{ marginTop: 18 }}>
        <Label>Commentary</Label>
        <Field v={commentary} caret={focus === "comm"} f={f} h={58} focus={focus === "comm"} />
      </div>

      <div style={{ marginTop: 18 }}>
        <Label>Category</Label>
        <div style={{
          border: `1px solid ${focus === "cat" ? R.accent : R.lineStrong}`,
          boxShadow: focus === "cat" ? `0 0 0 4px ${R.accentSoft}` : "none",
          borderRadius: R.radius, background: R.bg,
          padding: "14px 16px", display: "flex", justifyContent: "space-between",
          fontFamily: R.fontSans, fontSize: 20,
          color: category ? R.ink : R.ink4,
        }}>
          <span>{category ? "Munāsabāt" : "Choose a category"}</span>
          <span style={{ color: R.ink4 }}>⌄</span>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <Label>Tags</Label>
        <Field v={tags} caret={focus === "tags"} f={f} focus={focus === "tags"} />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 28 }}>
        <div style={{
          padding: "14px 24px", borderRadius: R.radius,
          border: `1px solid ${R.lineStrong}`,
          fontFamily: R.fontSans, fontSize: 19, color: R.ink2,
        }}>Cancel</div>
        <div style={{
          padding: "14px 26px", borderRadius: R.radius,
          background: R.accent, color: "#fff",
          fontFamily: R.fontSans, fontSize: 19, fontWeight: 600,
          transform: `scale(${pressed ? 0.96 : 1})`,
          boxShadow: pressed ? "none" : R.shadowSm,
        }}>Create Connection</div>
      </div>
    </div>
  </div>
);

/* ── Saved Connection card ────────────────────────────────────────────────*/

export const SavedCard: React.FC<{ o: number }> = ({ o }) => (
  <div style={{
    marginTop: 16,
    border: `1px solid ${R.lineStrong}`, borderRadius: R.radius,
    background: R.bgElev, padding: "18px 20px", boxShadow: R.shadowSm,
    opacity: o, transform: `translateY(${(1 - o) * 10}px)`,
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
      <div style={{ fontFamily: R.fontSans, fontSize: 22, fontWeight: 600, color: R.ink }}>
        The seven oft-repeated verses
      </div>
      <div style={{ fontSize: 19, color: R.iconLink }}>🔗</div>
    </div>
    <div style={{
      display: "flex", alignItems: "center", gap: 12, marginTop: 10,
      fontFamily: R.fontSans, fontSize: 19, color: R.ink2,
    }}>
      <span>Al-Fātiḥah 1:1</span>
      <span style={{ color: R.iconLink }}>↔</span>
      <span>Al-Ḥijr 15:87</span>
    </div>
    <div style={{
      fontFamily: R.fontSans, fontSize: 19, color: R.ink2, marginTop: 10, lineHeight: 1.5,
    }}>Al-Fātiḥah is referred to here in Sūrah al-Ḥijr.</div>
    <div style={{ fontFamily: R.fontSans, fontSize: 17, color: R.ink4, marginTop: 12 }}>
      Munāsabāt · al-Fātiḥah, structure
    </div>
  </div>
);

/* ── Connections page ─────────────────────────────────────────────────────*/

export const ConnectionsHead: React.FC<{ count: number; surahs: number }> = ({ count, surahs }) => (
  <div style={{ padding: "22px 24px 0" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ fontFamily: R.fontSerif, fontSize: 36, fontWeight: 600, color: R.ink }}>
        Connections
      </div>
      <div style={{
        minWidth: 32, height: 32, padding: "0 10px", borderRadius: 999,
        background: R.panel2, display: "grid", placeItems: "center",
        fontFamily: R.fontSans, fontSize: 17, color: R.ink2,
      }}>{count}</div>
    </div>

    <div style={{ display: "flex", gap: 6, marginTop: 18 }}>
      {["List", "Map"].map((t) => (
        <div key={t} style={{
          padding: "9px 20px", borderRadius: R.radiusSm,
          fontFamily: R.fontSans, fontSize: 18,
          background: t === "Map" ? R.ink : "transparent",
          color: t === "Map" ? R.bg : R.ink3,
          fontWeight: t === "Map" ? 600 : 400,
        }}>{t}</div>
      ))}
    </div>

    <div style={{
      display: "flex", gap: 22, marginTop: 16,
      fontFamily: R.fontSans, fontSize: 18, color: R.ink3,
    }}>
      <span>{count} Connection{count === 1 ? "" : "s"}</span>
      <span>{surahs} Surah{surahs === 1 ? "" : "s"}</span>
    </div>
  </div>
);

const Page: React.FC<{ trail: string[]; children: React.ReactNode }> = ({ trail, children }) => (
  <div style={{
    width: APP_W, height: APP_H, background: R.bg,
    display: "flex", flexDirection: "column",
  }}>
    <Brand />
    <Crumbs trail={trail} />
    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      <Rail />
      <div style={{ flex: 1, position: "relative", minWidth: 0 }}>{children}</div>
    </div>
  </div>
);

export const EditorPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Page trail={["Tutorial Workspace", "Al-Fātiḥah", "The Names of al-Fātiḥah"]}>{children}</Page>
);

export const MapPage: React.FC<{ count: number; surahs: number; children: React.ReactNode }> =
({ count, surahs, children }) => (
  <Page trail={["Tutorial Workspace", "Connections"]}>
    <ConnectionsHead count={count} surahs={surahs} />
    {children}
  </Page>
);
