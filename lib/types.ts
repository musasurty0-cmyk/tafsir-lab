// ---- Quran API types ----

export interface Chapter {
  id: number;
  revelation_place: "makkah" | "madinah";
  bismillah_pre: boolean;
  name_simple: string;        // "Al-Fatihah"
  name_arabic: string;        // "الفاتحة"
  name_complex: string;       // "Al-Fātiĥah"
  translated_name: { name: string; language_name: string };
  verses_count: number;
  pages: [number, number];
}

export interface WordTranslation {
  text: string;
  language_name: string;
}

export interface Word {
  id: number;
  position: number;
  audio_url: string | null;
  char_type_name: "word" | "end" | "pause";
  text: string;              // Arabic display text
  transliteration: { text: string };
  translation: WordTranslation;
}

export interface Verse {
  id: number;
  verse_number: number;
  verse_key: string;          // "1:1"
  text_uthmani: string;
  words: Word[];
  translations: { resource_id: number; text: string }[];
}

export interface VerseResponse {
  verses: Verse[];
  // API may return either `pagination` or `meta` depending on endpoint version
  pagination?: { per_page: number; current_page: number; next_page: number | null; total_pages: number; total_records: number };
  meta?: { current_page: number; next_page: number | null; total_pages: number; total_count: number };
}

// ---- Drawing types ----

export type DrawMode = "hand" | "pen" | "eraser" | "highlighter";

export interface Point {
  x: number;
  y: number;
  pressure: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
  opacity: number;
  mode: "pen" | "highlighter";
}

// ---- Notes ----

export interface QuestionNoteData {
  surahId: number;
  question: number;
  content: string;
  updatedAt: string;
}

// ---- Study questions ----

export const STUDY_QUESTIONS: { n: number; label: string }[] = [
  { n: 1, label: "What does the surah primarily discuss?" },
  { n: 2, label: "What names/titles does the surah have, and why?" },
  { n: 3, label: "Key linguistic features and vocabulary" },
  { n: 4, label: "Thematic connections to other surahs" },
  { n: 5, label: "Classical scholars' positions and commentary" },
  { n: 6, label: "Lessons and extracted rulings (fiqh)" },
  { n: 7, label: "Spiritual and practical applications" },
  { n: 8, label: "Personal reflections and questions" },
];
