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
  page_number: number;        // Mushaf page number (1-604)
  words: Word[];
  translations: { resource_id: number; text: string }[];
}

// ---- QCF (Quran Complex Font) page-mode types ----
// Used for Quran.com-style glyph rendering in Canvas mode.
// Each word carries glyph codes + the page-font index.

export interface QCFWord {
  id:             number;
  position:       number;
  page_number:    number;
  v2_page:        number;          // which font file: p{v2_page}-v2
  line_number?:   number;          // line on the page (used for justified layout)
  code_v2:        string;          // glyph string — render with font p{v2_page}-v2
  text_qpc_hafs:  string;          // Unicode fallback while font loads
  char_type_name: "word" | "end" | "pause";
  translation?:   { text: string; language_name: string };
  transliteration?: { text: string };
}

export interface QCFVerse {
  id:           number;
  verse_number: number;
  verse_key:    string;            // "2:255"
  page_number:  number;
  words:        QCFWord[];
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
