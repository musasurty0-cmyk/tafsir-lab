import type { Metadata } from "next";
import "./youth-majlis.css";

/* Private to the cohort: never indexed, never followed. */
export const metadata: Metadata = {
  title: "Youth Majlis · TafsirLab",
  description: "Youth Majlis with Shaykh Omid Azizi — powered by TafsirLab.",
  robots: { index: false, follow: false },
};

export default function YouthMajlisLayout({ children }: { children: React.ReactNode }) {
  return <div className="ym">{children}</div>;
}
