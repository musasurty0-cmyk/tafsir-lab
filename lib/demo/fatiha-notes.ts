/**
 * Demo study notes — the names of Sūrat al-Fātiḥah.
 *
 * Seeded into the tutorial workspace so the tour walks REAL content rather
 * than an empty page describing features in the abstract. Written the way the
 * app expects notes to be written: headings for each name, the Arabic evidence
 * as a quotation in its own direction, the translation beneath it, and the
 * citation last and quiet.
 *
 * Returned as TipTap document JSON so it is inserted through the normal editor
 * pipeline — no special-cased rendering path, and everything here is something
 * a user could have typed.
 */

type Node = Record<string, unknown>;

const text = (value: string, marks?: Node[]): Node =>
  marks ? { type: "text", text: value, marks } : { type: "text", text: value };

const ITALIC = [{ type: "italic" }];
const BOLD   = [{ type: "bold" }];
const small  = (px: number) => [{ type: "textStyle", attrs: { fontSize: `${px}px` } }];
const muted  = (px = 12) => [
  { type: "textStyle", attrs: { fontSize: `${px}px`, color: "oklch(0.62 0 0)" } },
];

const p  = (content: Node[]): Node => ({ type: "paragraph", content });
const h  = (level: 1 | 2 | 3, value: string): Node =>
  ({ type: "heading", attrs: { level }, content: [text(value)] });

/** Arabic evidence. Its own direction, so it is never reflowed as Latin. */
const arabic = (value: string): Node => ({
  type: "blockquote",
  content: [{
    type: "paragraph",
    attrs: { dir: "rtl" },
    content: [text(value, small(19))],
  }],
});

const translation = (value: string): Node => p([text(value, ITALIC)]);
const cite        = (value: string): Node => p([text(`— ${value}`, muted())]);

const ayah = (verseKey: string): Node => ({
  type: "ayahBlock",
  attrs: {
    verseKey,
    surahNumber: Number(verseKey.split(":")[0]),
    ayahNumber:  Number(verseKey.split(":")[1]),
    arabicText: "", translationText: "", showTranslation: true,
  },
});

/** Empty contentHtml makes the block fetch the entry itself, exactly as /tafsir does. */
const tafsir = (verseKey: string, sourceName: string, sourceSlug: string): Node => ({
  type: "tafsirBlock",
  attrs: { verseKey, contentHtml: "", sourceName, sourceSlug, partial: false },
});

/** One named section: the name, what it means, then the evidence for it. */
function section(
  index: number, en: string, ar: string, gloss: string,
  evidence: { ar: string; en: string; src: string }[],
): Node[] {
  return [
    h(2, `${index}. ${en} (${ar})`),
    p([text(gloss)]),
    ...evidence.flatMap((e) => [arabic(e.ar), translation(e.en), cite(e.src)]),
  ];
}

export function fatihaNotesDoc(): Node {
  return {
    type: "doc",
    content: [
      h(1, "The Names of Sūrat al-Fātiḥah"),
      p([
        text("Seven names, each naming a different ", undefined),
        text("function", ITALIC),
        text(" the sūrah performs — how it opens, what it gathers, and what it does."),
      ]),
      p([text("Type / to see what you can add to a note like this one.", muted(12))]),
      { type: "horizontalRule" },

      ...section(1, "Al-Fātiḥah", "الفاتحة", "It opens the muṣḥaf, the recitation in ṣalāh, and the path of guidance.", [
        {
          ar: "وسميت فاتحة الكتاب لأنها يُفتتح بكتابتها المصاحف، ويقرأ بها في الصلوات.",
          en: "It is called Fātiḥat al-Kitāb because the muṣḥafs are opened with it, and it is recited at the start of the prayers.",
          src: "Tafsīr al-Ṭabarī, Dār Hajr ed., 1:107",
        },
        {
          ar: "يقال لها: الفاتحة… وبها تُفتح القراءة في الصلاة.",
          en: "It is called al-Fātiḥah because the recitation in prayer begins with it.",
          src: "Tafsīr Ibn Kathīr (Dār Ṭayyibah)",
        },
      ]),
      ayah("1:1"),

      ...section(2, "Umm al-Kitāb / Umm al-Qurʾān", "أم الكتاب", "It is the foundation and summary of the Qurʾān, and the basis of prayer.", [
        {
          ar: "إنما قيل لها… أم القرآن، لتسمية العرب كل جامع أمرًا… أو مقدم لأمر… أمًّا.",
          en: "It is called Umm al-Qurʾān because the Arabs call anything that gathers matters comprehensively, or leads other things, an umm (mother).",
          src: "Tafsīr al-Ṭabarī, 1:107",
        },
        {
          ar: "سميت أمَّ القرآن لأنها أوّله ومُتضمِّنةٌ لجميع علومه.",
          en: "It is called the Mother of the Qurʾān because it is its first part and contains the essence of all its knowledge.",
          src: "Tafsīr al-Qurṭubī, 1:112",
        },
        {
          ar: "وسميت أمّ القرآن وأمّ الكتاب: لأنها أصل القرآن… وأمُّ الشيء: أصلُه.",
          en: "It is called Umm al-Qurʾān and Umm al-Kitāb because it is the foundation of the Qurʾān. In Arabic, the umm of a thing is its origin.",
          src: "Tafsīr al-Baghawī, 1:36",
        },
      ]),

      ...section(3, "As-Sabʿ al-Mathānī", "السبع المثاني", "Seven verses, repeated in every rakʿah of every prayer.", [
        {
          ar: "وَلَقَدْ آتَيْنَاكَ سَبْعًا مِّنَ الْمَثَانِي وَالْقُرْآنَ الْعَظِيمَ",
          en: "And indeed, We have given you the seven oft-repeated verses and the Great Qurʾān.",
          src: "Sūrat al-Ḥijr 15:87",
        },
        {
          ar: "والسبع المثاني لأنها سبع آيات باتفاق العلماء، وسُمّيت مثاني لأنها تُثنّى في الصلاة فتُقرأ في كل ركعة.",
          en: "It is called as-Sabʿ al-Mathānī because it is seven verses by consensus, and Mathānī because it is repeated in prayer, recited in every rakʿah.",
          src: "Tafsīr al-Baghawī, 1:37",
        },
      ]),
      p([text("The verse this name comes from is not in al-Fātiḥah at all — it is in al-Ḥijr. Worth linking the two:", undefined)]),
      ayah("15:87"),

      ...section(4, "Al-Ḥamd", "الحمد", "It begins with the words al-ḥamdu lillāh.", [
        {
          ar: "وسميت سورة الحمد؛ لأنها مفتتحة بالحمد لله رب العالمين.",
          en: "It is called Sūrat al-Ḥamd because it opens with “All praise is for Allah, the Lord of the Worlds.”",
          src: "Tafsīr al-Ṭabarī, 1:110",
        },
      ]),

      ...section(5, "Aṣ-Ṣalāh", "الصلاة", "A dialogue between Allah and His servant, and a condition of the prayer.", [
        {
          ar: "قسمت الصلاة بيني وبين عبدي نصفين ولعبدي ما سأل، فإذا قال العبد الحمد لله رب العالمين قال الله: حمدني عبدي.",
          en: "Allah said: “I have divided the prayer between Myself and My servant into two halves, and My servant shall have what he asks. When the servant says ‘All praise is for Allah, the Lord of the Worlds,’ Allah says: ‘My servant has praised Me.’”",
          src: "Ṣaḥīḥ Muslim 395a",
        },
        {
          ar: "فسميت الفاتحة صلاة؛ لأنها شرط فيها.",
          en: "It is called aṣ-Ṣalāh because it is a condition for the validity of the prayer.",
          src: "Tafsīr Ibn Kathīr, 1:42",
        },
      ]),
      p([text("Ibn Kathīr on the opening verse — the commentary this section rests on:", undefined)]),
      tafsir("1:1", "Tafsir Ibn Kathir", "en-tafisr-ibn-kathir"),

      ...section(6, "Ash-Shifāʾ", "الشفاء", "It heals, by Allah’s permission.", [
        {
          ar: "ويقال لها: الشفاء؛ لما رواه الدارمي عن أبي سعيد الخدري قال: فاتحة الكتاب شفاء من كل سم.",
          en: "It is called ash-Shifāʾ, as ad-Dārimī narrated from Abū Saʿīd al-Khudrī that the Opening of the Book is a cure for every poison.",
          src: "Tafsīr Ibn Kathīr, 1:43",
        },
      ]),

      ...section(7, "Ar-Ruqyah", "الرُقية", "The Companions used it as a ruqyah, and the Prophet ﷺ confirmed it.", [
        {
          ar: "ويقال لها: الرقية؛ لحديث أبي سعيد في الصحيح… فقال رسول الله صلى الله عليه وسلم: وما يدريك أنها رُقية؟",
          en: "It is also called ar-Ruqyah, from the ḥadīth of Abū Saʿīd in the Ṣaḥīḥ, where the Prophet ﷺ said: “How did you know that it is a ruqyah?”",
          src: "Tafsīr Ibn Kathīr, 1:43",
        },
        {
          ar: "كيف عرفت أنها رقية؟",
          en: "How did you know that it is a healing incantation?",
          src: "Ṣaḥīḥ al-Bukhārī 2276",
        },
      ]),

      { type: "horizontalRule" },
      h(3, "Where this goes next"),
      {
        type: "bulletList",
        content: [
          "Which names describe the sūrah’s place, and which describe its effect?",
          "Al-Ḥijr 15:87 names it without naming it — worth a Connection.",
          "Aṣ-Ṣalāh and ar-Ruqyah both describe it by what it DOES, not what it contains.",
        ].map((s) => ({
          type: "listItem",
          content: [p([text(s)])],
        })),
      },
      p([text("Try /link to record one of these as a Connection.", muted(12))]),
      p([]),
    ],
  };
}

/**
 * Connections worth existing in the demo, so the map and the list are not
 * empty when the tour reaches them. One crosses Surahs, one stays inside
 * al-Fātiḥah — the map draws those differently, and both cases should be
 * visible.
 */
export const DEMO_CONNECTIONS = [
  {
    sourceType: "surah", sourceKey: "surah:1",
    targetType: "ayah",  targetKey: "ayah:15:87",
    name: "Al-Fātiḥah named as as-Sabʿ al-Mathānī",
    commentary: "Al-Ḥijr 15:87 calls it the seven oft-repeated verses without naming the sūrah, which is where the name is taken from.",
    category: "Thematic",
    tags: ["names", "mathani"],
  },
  {
    sourceType: "ayah", sourceKey: "ayah:1:2",
    targetType: "ayah", targetKey: "ayah:1:5",
    name: "Praise answered by service",
    commentary: "The half that is praise and the half that is petition — the hadith of the divided prayer turns on the move between them.",
    category: "Structural",
    tags: ["salah"],
  },
] as const;
