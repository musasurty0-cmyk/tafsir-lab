/**
 * OGImage — the social preview card for tafsir-lab.com.
 *
 * Standard 1200×630 Open Graph size. Rendered once as a static PNG (no
 * animation — `remotion still` grabs frame 0) and referenced from
 * landing.html's og:image / twitter:image tags. Built from the same
 * theme tokens as the trailer, so the preview matches the site rather than
 * being a separate one-off design.
 *
 * `npm run og:still` writes public/og-image.png.
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { C, FONTS } from "./theme";

export const OG_W = 1200;
export const OG_H = 630;

export const OGImage: React.FC = () => (
  <AbsoluteFill
    style={{
      background: C.dark,
      fontFamily: FONTS.sans,
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(620px 420px at 14% 20%, rgba(62,142,110,0.16), transparent 65%)," +
          "radial-gradient(560px 400px at 90% 88%, rgba(201,138,45,0.12), transparent 62%)",
      }}
    />

    <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
      <div
        style={{
          width: 92, height: 92, borderRadius: 22,
          background: "#F6F4EE", color: C.dark,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: FONTS.serif, fontSize: 52, fontWeight: 700,
        }}
      >
        T
      </div>
      <div style={{ fontFamily: FONTS.serif, fontSize: 88, fontWeight: 600, letterSpacing: "-0.02em", color: "#F6F4EE" }}>
        Tafsir<span style={{ fontStyle: "italic", fontWeight: 400, color: "rgba(246,244,238,0.72)" }}>Lab</span>
      </div>
    </div>

    <div
      style={{
        fontFamily: FONTS.serif, fontSize: 34, color: "rgba(246,244,238,0.82)",
        marginTop: 30, maxWidth: 820, textAlign: "center", lineHeight: 1.35,
      }}
    >
      A study desk for the Qurʾān — Mushaf, notes, ink and classical tafsīr in one workspace.
    </div>

    <div
      style={{
        position: "absolute", bottom: 44,
        fontFamily: FONTS.mono, fontSize: 20, letterSpacing: "0.1em",
        textTransform: "uppercase", color: "rgba(246,244,238,0.5)",
      }}
    >
      tafsir-lab.com
    </div>
  </AbsoluteFill>
);
