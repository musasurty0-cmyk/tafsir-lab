"use client";

import Link from "next/link";
import type { Chapter } from "@/lib/types";

const PLACE: Record<string, string> = { makkah: "Makki", madinah: "Madani" };

export default function SurahGrid({ chapters }: { chapters: Chapter[] }) {
  return (
    <div className="surah-grid-page">
      <div className="surah-grid-header">
        <h1>TafsirLab</h1>
        <p>Select a Surah to open the study workspace</p>
      </div>
      <div className="surah-grid">
        {chapters.map((ch) => (
          <Link key={ch.id} href={`/workspace/${ch.id}`} className="surah-card">
            <div className="surah-card-num">
              {ch.id} · {PLACE[ch.revelation_place] ?? ch.revelation_place} · {ch.verses_count} verses
            </div>
            <div className="surah-card-name">{ch.name_simple}</div>
            <div className="surah-card-arabic">{ch.name_arabic}</div>
            <div className="surah-card-meta">{ch.translated_name.name}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
