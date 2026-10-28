import type { Metadata } from "next";
import "./dunya.css";

/* Private: never indexed, never followed. */
export const metadata: Metadata = {
  title: "Dunya · TafsirLab",
  description: "A levels — papers, answers and how each one went.",
  robots: { index: false, follow: false },
};

export default function DunyaLayout({ children }: { children: React.ReactNode }) {
  return <div className="dn">{children}</div>;
}
