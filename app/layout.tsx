import type { Metadata } from "next";
import {
  IBM_Plex_Sans, IBM_Plex_Serif, IBM_Plex_Mono,
  Caveat, Patrick_Hand,
} from "next/font/google";
import NavSplashCleaner from "@/components/NavSplashCleaner";
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
   are set in a hand — Caveat is a joined script, Patrick Hand a neat print. */
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-hand",
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
        className={`${plex.variable} ${plexSerif.variable} ${plexMono.variable} ${caveat.variable} ${patrickHand.variable}`}
        style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}
      >
        <LocaleProvider>
          <NavSplashCleaner />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
