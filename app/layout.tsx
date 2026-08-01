import type { Metadata } from "next";
import {
  IBM_Plex_Sans, IBM_Plex_Serif, IBM_Plex_Mono,
  Caveat, Patrick_Hand, Comic_Neue,
} from "next/font/google";
import NavSplashCleaner from "@/components/NavSplashCleaner";
import AppearanceBoot from "@/components/AppearanceBoot";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import "./globals.css";

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});
const plexSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-serif",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});
/* Handwriting faces, offered per-selection in the editor toolbar. Margin
   notes on the Mushaf read as annotations rather than typed text when they
   are set in a hand.

   --font-hand stays pointed at Caveat. Notes already saved carry the literal
   string "var(--font-hand), ..." in their textStyle mark, so repointing this
   variable silently restyles existing handwriting — the marker face gets its
   own variable instead of taking this one over. */
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-hand",
  display: "swap",
});
/* Rounded marker hand. Comic Sans MS is the face itself but does not ship on
   iPadOS — the primary drawing device here — so Comic Neue backs it up. */
const comicNeue = Comic_Neue({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-marker",
  display: "swap",
});
const patrickHand = Patrick_Hand({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-hand-print",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TafsirLab",
  description: "Collaborative Quranic research workspace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Amiri Quran — editor Arabic text */}
        <link
          href="https://fonts.googleapis.com/css2?family=Amiri+Quran&display=swap"
          rel="stylesheet"
        />
        {/* Scheherazade New — Uthmanic Hafs canvas font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Scheherazade+New:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${plex.variable} ${plexSerif.variable} ${plexMono.variable} ${caveat.variable} ${comicNeue.variable} ${patrickHand.variable}`}
        style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}
      >
        <LocaleProvider>
          <NavSplashCleaner />
          <AppearanceBoot />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
