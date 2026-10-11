import type { Metadata } from "next";
import { preload } from "react-dom";
import "./youth-majlis.css";
import "./youth-majlis-motion.css";
import "./youth-majlis-organise.css";
import "./youth-majlis-prepare.css";

/* Private to the cohort: never indexed, never followed. */
export const metadata: Metadata = {
  title: "Youth Majlis · TafsirLab",
  description: "Youth Majlis with Shaykh Omid Azizi — powered by TafsirLab.",
  robots: { index: false, follow: false },
};

export default function YouthMajlisLayout({ children }: { children: React.ReactNode }) {
  /* Every word of Arabic here is set in the King Fahd Complex's Uthmanic Hafs
     face, so it is fetched up front rather than discovered by the stylesheet
     after the page has already painted in a fallback. */
  preload("/fonts/UthmanicHafs1Ver18.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return (
    <div className="y">
      {/* Marks the page as scripted before anything below it paints, so
          content waiting to rise into view starts hidden instead of
          flashing in place first. Without script it simply stays visible. */}
      <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('y-js')" }} />
      {children}
    </div>
  );
}
