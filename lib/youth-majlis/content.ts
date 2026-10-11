/**
 * Youth Majlis — the course, as data.
 *
 * Everything the portal shows comes from here, so updating the course is an
 * edit to this file and nothing else. Two values change month to month:
 *
 *   CURRENT_MODULE  — which module the cohort is on now (1-4 in Level 1)
 *   NEXT_MAJLIS     — the next gathering, or null for "to be announced"
 *
 * Nothing here is invented to fill a screen: where a date or a reading has
 * not been set by Shaykh Omid, the portal says so rather than guessing.
 */

export const SHAYKH = "Shaykh Omid Azizi";

/** Which Level 1 module the cohort is studying now. */
export const CURRENT_MODULE = 1;

/** The next gathering. ISO date-time in UK time, or null until it is set. */
export const NEXT_MAJLIS: { when: string; where?: string } | null = null;

export const AIM =
  "To study the Noble Qur’an and seek its guidance and direction on contemporary issues and dilemmas affecting Muslim youth, the Muslim community and wider society.";

export const AIM_DETAIL =
  "Closed, monthly and interactive gatherings with Shaykh Omid Azizi, with an emphasis on developing a deeper connection and relationship with the Book of Allah (SWT) — not only understanding the Qur’an, but reflecting upon what Allah wants from us, and how His guidance should shape us as individuals, our communities and wider society.";

export const METHOD = [
  "Tafsīr-based study",
  "Historical context",
  "Linguistic and rhetorical analysis",
  "Thematic reflection",
  "Personal and communal reflection",
  "Practical exercises and application",
];

/** The common set of questions every module is studied through. */
export const QUESTIONS: { n: number; label: string; q: string }[] = [
  { n: 1,  label: "Identity",    q: "What are the names of the Sūrah, and why?" },
  { n: 2,  label: "Virtues",     q: "What are the merits and virtues of the Sūrah and its āyāt?" },
  { n: 3,  label: "Revelation",  q: "When were these āyāt revealed?" },
  { n: 4,  label: "Context",     q: "Why were these āyāt revealed? What are the Asbāb al-Nuzūl, the historical context and the circumstances of their revelation?" },
  { n: 5,  label: "Language",    q: "What are the linguistic style, rhetorical features and eloquence of these āyāt? Why is Allah (SWT) speaking in this particular manner?" },
  { n: 6,  label: "Structure",   q: "What is the order and structure of these āyāt within the Sūrah and the wider Qur’an? How do they relate to what comes before and after them?" },
  { n: 7,  label: "Message",     q: "What are the core messages of these āyāt? What does Allah (SWT) want from us?" },
  { n: 8,  label: "Rulings",     q: "What jurisprudential rulings and principles can be derived from these āyāt?" },
  { n: 9,  label: "Reflection",  q: "What personal reflections, lessons and anecdotes can be derived from these āyāt?" },
  { n: 10, label: "Application", q: "How can we implement these āyāt in our lives? What are their implications for our personal and communal lives?" },
];

export type Area = "faith" | "worship" | "character" | "dawah";

/** The four broad areas of Qur’anic development the course works through. */
export const AREAS: { id: Area; ar: string; en: string }[] = [
  { id: "faith",     ar: "إِيمَان",  en: "Faith & Belief" },
  { id: "worship",   ar: "عِبَادَة", en: "Worship & Spirituality" },
  { id: "character", ar: "أَخْلَاق", en: "Character & Personality" },
  { id: "dawah",     ar: "دَعْوَة",  en: "Activism & Daʿwah" },
];

export interface Module {
  n:        number;
  surah:    number;          // sūrah number, for opening it in TafsirLab
  surahEn:  string;
  surahAr:  string;
  /** The passage studied, when it is not the whole sūrah. */
  passage?: { from: number; to: number };
  ayat:     number;          // āyāt in the sūrah
  title:    string;
  /** An Arabic heading for the module, when it has one of its own. */
  titleAr?: string;
  themes:   string[];
  exercises: string[];
  /** Which of the four areas the module mainly develops. */
  areas:    Area[];
}

export const LEVELS = [
  { n: 1, name: "The Fundamentals" },
  { n: 2, name: "Intermediate" },
  { n: 3, name: "Advanced" },
];

export const MODULES: Module[] = [
  {
    n: 1, surah: 1, surahEn: "Al-Fātiḥah", surahAr: "ٱلْفَاتِحَة", ayat: 7,
    title: "The Foundations",
    themes: [
      "The importance and significance of Sūrah al-Fātiḥah",
      "Monotheism, and reflection upon the Names and Attributes of Allah",
      "Duʿāʾ, devotion and direction",
      "Empowerment and strength",
    ],
    exercises: [
      "Who is Allah, and where is He in my life?",
      "What does true guidance mean?",
    ],
    areas: ["faith", "worship"],
  },
  {
    n: 2, surah: 73, surahEn: "Al-Muzzammil", surahAr: "ٱلْمُزَّمِّل", ayat: 20,
    title: "Spiritual Preparation & Steadfastness",
    themes: [
      "Personal worship strengthens public resilience.",
      "Revival begins with inner strength before outer change.",
    ],
    exercises: [
      "How consistent is my private connection with Allah compared with my public Islamic identity?",
      "What role does spiritual discipline play in sustaining activism and daʿwah?",
    ],
    areas: ["worship", "dawah"],
  },
  {
    n: 3, surah: 25, surahEn: "Al-Furqān", surahAr: "ٱلْفُرْقَان", ayat: 77,
    passage: { from: 63, to: 77 },
    title: "The Servants of the Most Merciful",
    titleAr: "عِبَادُ ٱلرَّحْمَٰنِ",
    themes: [
      "The Qur’an describes believers through their character, worship and social interaction. Revival is therefore built not only upon belief, but upon behaviour.",
      "True empowerment reflects mercy, humility and emotional intelligence — responding to ignorance with peace rather than pride.",
    ],
    exercises: [
      "Which qualities of ʿIbād al-Raḥmān do I already embody, and which require further development?",
      "How does humility protect a revival movement from arrogance and collapse?",
    ],
    areas: ["character", "worship"],
  },
  {
    n: 4, surah: 61, surahEn: "Al-Ṣaff", surahAr: "ٱلصَّفّ", ayat: 14,
    title: "Unity & Sacrifice",
    themes: [
      "Being “a row as if joined firmly” in the cause of Allah",
      "Empowerment through discipline and collective action",
      "The principles and practices of Islamic activism and community empowerment",
      "A Qur’anic blueprint for revival in every age",
    ],
    exercises: [],
    areas: ["dawah", "character"],
  },
];

export const COHORT = [
  "Bilal", "Eissa", "Eesa", "Hadi", "Muhammed Kazim", "Yusuf", "Musa",
  "Labeeb", "Omair", "Ayan", "Ayaan", "Ilyas", "Nur",
];

// ── ʿIlmī ──────────────────────────────────────────────────────────────────

export const ILMI_COHORT = ["Musa", "Ismail", "Yusuf", "Bilal"];

export const ILMI_BOOK = {
  title:  "Principles of Islamic Jurisprudence",
  author: "Mohammad Hashim Kamali",
  note:   "The text Shaykh Omid has chosen to take us through — the same one used at Qatar University and Universiti Malaya.",
};

/** The road map: three madākhil, each its own session. Dates are set by the
 *  Shaykh; until then each reads "date to be confirmed". */
export const ILMI_SESSIONS: {
  n: number; ar: string; en: string; gist: string; date: string | null;
}[] = [
  {
    n: 1, ar: "أُصُولُ ٱلْفِقْه", en: "Uṣūl al-Fiqh",
    gist: "The sources of the law and the method of deriving rulings from them: how a scholar moves from a text of the Qur’an or Sunnah to a ruling — through its wording, its implications, consensus and analogy.",
    date: null,
  },
  {
    n: 2, ar: "ٱلْقَوَاعِدُ ٱلْفِقْهِيَّة", en: "Al-Qawāʿid al-Fiqhiyyah",
    gist: "The legal maxims: short, general statements that gather thousands of particular rulings under one principle — “matters are judged by their purposes”, “certainty is not removed by doubt”, “hardship brings ease”, “harm is to be removed”, “custom is authoritative”.",
    date: null,
  },
  {
    n: 3, ar: "مَقَاصِدُ ٱلشَّرِيعَة", en: "Maqāṣid al-Sharīʿah",
    gist: "The higher objectives of the Sharīʿah — what the law as a whole is for. Classically, the preservation of religion, life, intellect, lineage and wealth, and how keeping those purposes in view shapes the way rulings are understood and applied.",
    date: null,
  },
];

/** Recommended before the first session. Real, findable works only. */
export const ILMI_READING: {
  title: string; author: string; why: string; level: "Start here" | "Alongside" | "Going further";
}[] = [
  {
    title: "Principles of Islamic Jurisprudence — Chapter 1: Introduction to Uṣūl al-Fiqh",
    author: "Mohammad Hashim Kamali",
    why: "The set text. Its first chapter defines the discipline, separates it from fiqh, and sketches its history — the ground the first session stands on.",
    level: "Start here",
  },
  {
    title: "Al-Waraqāt",
    author: "Imām al-Ḥaramayn al-Juwaynī",
    why: "The classic short primer that students have memorised for nine centuries — a few pages that name every core concept. Best read with a commentary or a teacher’s notes.",
    level: "Start here",
  },
  {
    title: "Islamic Jurisprudence (Uṣūl al-Fiqh)",
    author: "Imran Ahsan Khan Nyazee",
    why: "A clear modern English textbook that pairs well with Kamali: where one is unclear, the other usually is not.",
    level: "Alongside",
  },
  {
    title: "Al-Risālah (The Epistle on Legal Theory)",
    author: "Imām al-Shāfiʿī — trans. Joseph E. Lowry",
    why: "The first systematic work of uṣūl. Reading even a part of it shows the questions the whole discipline grew out of.",
    level: "Going further",
  },
  {
    title: "Maqasid al-Shari‘ah Made Simple",
    author: "Mohammad Hashim Kamali",
    why: "A short paper by the same author that prepares the ground for the third session.",
    level: "Going further",
  },
  {
    title: "Maqasid al-Shariah: A Beginner’s Guide",
    author: "Jasser Auda",
    why: "An accessible introduction to the objectives of the Sharīʿah and the classical scholars who developed them, al-Shāṭibī above all.",
    level: "Going further",
  },
];

/** Terms worth knowing before the first session. */
export const ILMI_TERMS: { ar: string; tr: string; en: string }[] = [
  { ar: "فِقْه",       tr: "Fiqh",        en: "The understanding of the practical rulings of the Sharīʿah, derived from their detailed evidences." },
  { ar: "أُصُول",      tr: "Uṣūl",        en: "Roots, foundations — the sources and methods fiqh is built upon." },
  { ar: "حُكْم شَرْعِي", tr: "Ḥukm sharʿī", en: "A legal ruling: obligatory, recommended, permissible, disliked or forbidden — and the conditions that make it so." },
  { ar: "دَلِيل",      tr: "Dalīl",       en: "An evidence or proof from which a ruling is derived." },
  { ar: "إِجْمَاع",     tr: "Ijmāʿ",       en: "The consensus of the qualified scholars of an age on a ruling." },
  { ar: "قِيَاس",      tr: "Qiyās",       en: "Analogy: extending a ruling to a new case that shares its effective cause." },
  { ar: "عِلَّة",       tr: "ʿIllah",      en: "The effective cause of a ruling — what qiyās turns on." },
  { ar: "اِجْتِهَاد",    tr: "Ijtihād",     en: "The qualified scholar’s full effort to derive a ruling from the evidence." },
  { ar: "مَصْلَحَة",    tr: "Maṣlaḥah",    en: "Benefit, public interest — central to the study of the maqāṣid." },
];

export function moduleBySurah(surah: number): Module | undefined {
  return MODULES.find((m) => m.surah === surah);
}
