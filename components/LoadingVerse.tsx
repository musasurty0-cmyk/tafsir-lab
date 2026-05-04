"use client";

import { useEffect, useState } from "react";

const VERSES = [
  {
    arabic:      "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
    translation: "In the name of Allah, the Most Gracious, the Most Merciful",
    ref:         "Al-Fatiha · 1:1",
  },
  {
    arabic:      "اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ",
    translation: "Read in the name of your Lord who created",
    ref:         "Al-ʿAlaq · 96:1",
  },
  {
    arabic:      "وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا",
    translation: "And recite the Quran with measured recitation",
    ref:         "Al-Muzzammil · 73:4",
  },
  {
    arabic:      "وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ",
    translation: "And We have certainly made the Quran easy to remember — so is there anyone who will be reminded?",
    ref:         "Al-Qamar · 54:17",
  },
  {
    arabic:      "إِنَّ هَٰذَا الْقُرْآنَ يَهْدِي لِلَّتِي هِيَ أَقْوَمُ",
    translation: "Indeed, this Quran guides to that which is most suitable",
    ref:         "Al-Isrāʾ · 17:9",
  },
  {
    arabic:      "كِتَابٌ أَنزَلْنَاهُ إِلَيْكَ مُبَارَكٌ لِّيَدَّبَّرُوا آيَاتِهِ",
    translation: "A blessed Book We have revealed to you, so that they may ponder its verses",
    ref:         "Ṣād · 38:29",
  },
  {
    arabic:      "أَفَلَا يَتَدَبَّرُونَ الْقُرْآنَ",
    translation: "Do they not reflect upon the Quran?",
    ref:         "Al-Nisāʾ · 4:82",
  },
];

export default function LoadingVerse() {
  const [idx,     setIdx]     = useState(() => Math.floor(Math.random() * VERSES.length));
  const [visible, setVisible] = useState(true);

  // Remove the navigation splash injected by HomeClient so this screen shows through
  useEffect(() => {
    document.getElementById("tl-nav-splash")?.remove();
    document.getElementById("tl-nav-splash-style")?.remove();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % VERSES.length);
        setVisible(true);
      }, 350);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const verse = VERSES[idx];

  return (
    <div className="lv-screen">
      <p className="lv-brand">TafsirLab</p>

      <div className={`lv-card${visible ? " lv-card--in" : ""}`}>
        <p className="lv-arabic" dir="rtl">{verse.arabic}</p>
        <p className="lv-translation">{verse.translation}</p>
        <p className="lv-ref">{verse.ref}</p>
      </div>

      <div className="lv-dots" aria-hidden="true">
        <span /><span /><span />
      </div>
    </div>
  );
}
