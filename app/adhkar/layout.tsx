import type { Metadata } from "next";
import "./adhkar.css";

/* Public: anyone may read and share it. */
export const metadata: Metadata = {
  title: "Morning and evening adhkār · Tafsir Lab",
  description: "The morning and evening remembrance from Ḥiṣn al-Muslim, fully voweled, with meanings, to read and count.",
};

export default function AdhkarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
