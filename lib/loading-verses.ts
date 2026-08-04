/**
 * The verses the loading screens show.
 *
 * ONE list, in one place, because two loading screens can appear back to back
 * during a single navigation — the nav splash injected on click, then the
 * route's loading.tsx once Next commits. They are meant to read as one screen.
 * While each kept its own copy of this list and picked from it independently,
 * the verse changed halfway through a single load, which reads as a second
 * splash starting rather than the first one continuing.
 */

export interface LoadingVerse {
  arabic:      string;
  translation: string;
  ref:         string;
}

export const LOADING_VERSES: LoadingVerse[] = [
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
