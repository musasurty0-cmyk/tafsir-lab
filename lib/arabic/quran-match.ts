/**
 * Finding a course word in the Qurʾān.
 *
 * The index (public/data/quran-word-index.json, built by
 * scripts/build-quran-index.mts) maps every Qurʾānic word to how often it
 * occurs and where. Course cards are spelt the modern way and often carry a
 * demonstrative ("هَذِهِ أُذُنٌ"); the Qurʾān carries clitics ("وَٱلْأَرْضِ").
 * Both sides are reduced to the same key, so أَرْضٌ on a card finds
 * وَٱلْأَرْضِ in 55:10.
 *
 * The key keeps the vowels. Without them أُذُنٌ (an ear) and أَذِنَ (he
 * permitted) are the same four letters, and an āyah shown as "this word in
 * context" would be teaching the wrong word. What it drops is everything
 * that varies without changing the word: the case ending, tanwīn, sukūn,
 * hamza seats on alif, tatweel, the clitics و ف ب ك ل and the article.
 *
 * Vowels are not enough on their own: عَيْنٌ is an eye and also a spring,
 * and 76:18 means the spring. So each occurrence also carries quran.com's
 * word-by-word meaning, and a place is only offered when that meaning shares
 * a word with the card's. Precision over reach: a word with no agreeing
 * place simply gets no Qurʾān drill.
 */

const HARAKA   = /[ً-ِ]/;            // tanwīn, fatḥa, ḍamma, kasra
const SHADDA   = "ّ";
const SUKUN    = "ْ";
const MARK     = /[ً-ْ]/;
const DROP     = /[ؐ-ؚٓ-ٰٟۖ-ۭـ]/g;

/** A word as letters, each with the vowel marks written on it. */
function clusters(word: string): { ch: string; marks: string }[] {
  const out: { ch: string; marks: string }[] = [];
  for (const c of word.replace(DROP, "")) {
    if (MARK.test(c)) {
      if (out.length && c !== SUKUN) out[out.length - 1].marks += c;
    } else {
      const ch = c.replace(/[أإآٱ]/, "ا").replace("ى", "ي").replace("ة", "ه");
      out.push({ ch, marks: "" });
    }
  }
  return out;
}

const plain = (cs: { ch: string }[]) => cs.map((c) => c.ch).join("");

/**
 * The comparable form of one word. Null when there is not enough of a word
 * left, or when it carries no vowels at all — an unvowelled key would bring
 * back the ear/permission confusion this exists to avoid.
 */
export function wordKey(word: string): string | null {
  let cs = clusters(word.trim());
  if (cs.length === 0) return null;

  // و / ف at the front, when what follows is still a word.
  if (/^[وف]/.test(cs[0].ch) && cs.length > 3) cs = cs.slice(1);
  // بِال / كَال / لِل, then the article.
  const p = plain(cs);
  if (/^[بك]ال/.test(p) && cs.length > 4) cs = cs.slice(3);
  else if (p.startsWith("لل") && cs.length > 3) cs = cs.slice(2);
  else if (p.startsWith("ال") && cs.length > 3) cs = cs.slice(2);
  if (p !== plain(cs) && cs[0]) {
    // The article doubles a sun letter (الشَّمْس); the bare word does not.
    cs = [{ ch: cs[0].ch, marks: cs[0].marks.replace(SHADDA, "") }, ...cs.slice(1)];
  }

  // A final alif of tanwīn al-fatḥ (كِتَابًا) is spelling, not the word.
  if (cs.length > 2 && cs[cs.length - 1].ch === "ا" && /ً/.test(cs[cs.length - 2].marks)) cs = cs.slice(0, -1);
  // The case ending: whatever vowel sits on the last letter.
  const last = cs[cs.length - 1];
  cs = [...cs.slice(0, -1), { ch: last.ch, marks: last.marks.replace(new RegExp(HARAKA.source, "g"), "") }];

  if (cs.length < 2) return null;
  if (!cs.some((c) => HARAKA.test(c.marks))) return null;
  return cs.map((c) => c.ch + [...c.marks].sort().join("")).join("");
}

const FILLER = new Set(["هذا", "هذه", "ذلك", "تلك", "هو", "هي", "ما", "ماذا", "من", "هل", "يا"]);

/**
 * The word a card is about, as an index key, or null when the card is not a
 * single word worth looking up (a sentence, a number, two words side by side).
 */
export function cardHeadword(arabic: string, isSentence: boolean): string | null {
  if (isSentence) return null;
  const words = arabic
    .replace(/[،,.؟?!:؛()٠-٩0-9]/g, " ")
    .split(/\s+/)
    .filter((w) => w && /[ء-ي]/.test(w))
    .filter((w) => !FILLER.has(plain(clusters(w))));
  if (words.length !== 1) return null;
  return wordKey(words[0]);
}

// ── Meanings ──────────────────────────────────────────────────────────────

const STOP = new Set((
  "a an the of and or to in into on at by for from with without as is are was were be been being will " +
  "shall would should can could may might do does did not no nor so then than that this these those " +
  "it its he him his she her they them their we us our you your i me my mine o indeed surely verily " +
  "who whom which what when where there here all some any one ones s"
).split(" "));
// Words a course card uses to label a form, not to say what the word means.
const CARD_STOP = new Set("past present command imperative verbal noun plural singular dual form other forms masculine feminine".split(" "));

function singular(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && /(ss|x|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** The words that carry a meaning: "(the) eyes" → ["eye"], "a spring" → ["spring"]. */
export function meaningWords(text: string, card = false): string[] {
  return text.toLowerCase()
    .replace(/[^a-z\s'-]/g, " ")
    .split(/[\s-]+/)
    .map((w) => w.replace(/'s$|'/g, ""))
    .filter((w) => w.length > 1 && !STOP.has(w) && !(card && CARD_STOP.has(w)))
    .map(singular);
}

export interface QuranIndex {
  /** key → [total, [meaning, count, root, lemma, "s:a:w", …], …] — places shortest āyāt first */
  idx: Record<string, (number | (string | number)[])[]>;
}

export interface QuranHit {
  count: number;
  places: { verseKey: string; word: number }[];
  /** From the Quranic Arabic Corpus, for the most common matching meaning. */
  root: string;
  lemma: string;
}

/**
 * Where a card's word occurs in the Qurʾān with the card's meaning. Null when
 * it does not occur, or only ever with a different meaning.
 */
export function lookup(index: QuranIndex, key: string | null, english: string): QuranHit | null {
  if (!key) return null;
  const row = index.idx[key];
  if (!row) return null;
  const want = new Set(meaningWords(english, true));
  if (want.size === 0) return null;
  let count = 0;
  let root = "", lemma = "";
  const places: { verseKey: string; word: number }[] = [];
  for (const g of row.slice(1) as (string | number)[][]) {
    const words = String(g[0]).split(" ");
    if (!words.some((w) => want.has(w))) continue;
    if (!count) { root = String(g[2] ?? ""); lemma = String(g[3] ?? ""); }
    count += Number(g[1]);
    for (const p of g.slice(4) as string[]) {
      const [s, a, w] = p.split(":");
      places.push({ verseKey: `${s}:${a}`, word: Number(w) });
    }
  }
  return count > 0 ? { count, places, root, lemma } : null;
}
