/**
 * Built-in book library — classical Islamic study texts (mutūn) shipped with
 * the app so students can open one and start annotating instantly. Each entry
 * points at a static PDF in /public/books. Students can also upload their own
 * (those live in the browser's IndexedDB — see lib/books/pdf-store).
 */

export interface LibraryBook {
  slug:         string;   // file basename (also the /books/<slug>.pdf path)
  title:        string;
  titleArabic?: string;
  author?:      string;
  category:     string;   // classical science it belongs to
}

/** Path to a library book's static PDF. */
export function libraryBookUrl(slug: string): string {
  return `/books/${slug}.pdf`;
}

export const LIBRARY_BOOKS: LibraryBook[] = [
  {
    slug: "thalathat-al-usool",
    title: "The Three Fundamental Principles",
    titleArabic: "الأصول الثلاثة",
    author: "Muḥammad ibn ʿAbd al-Wahhāb",
    category: "ʿAqīdah",
  },
  {
    slug: "qawaid-al-arba",
    title: "The Four Foundations",
    titleArabic: "القواعد الأربع",
    author: "Muḥammad ibn ʿAbd al-Wahhāb",
    category: "ʿAqīdah",
  },
  {
    slug: "al-aqeedah-al-wasitiyyah",
    title: "Al-ʿAqīdah al-Wāsiṭiyyah",
    titleArabic: "العقيدة الواسطية",
    author: "Ibn Taymiyyah",
    category: "ʿAqīdah",
  },
  {
    slug: "arbaun-an-nawawi",
    title: "The Forty Ḥadīth of an-Nawawī",
    titleArabic: "الأربعون النووية",
    author: "Imām an-Nawawī",
    category: "Ḥadīth",
  },
  {
    slug: "umdat-al-ahkaam",
    title: "ʿUmdat al-Aḥkām",
    titleArabic: "عمدة الأحكام",
    author: "ʿAbd al-Ghanī al-Maqdisī",
    category: "Ḥadīth",
  },
  {
    slug: "al-bayqooniyyah",
    title: "Al-Manẓūmah al-Bayqūniyyah",
    titleArabic: "المنظومة البيقونية",
    author: "ʿUmar al-Bayqūnī",
    category: "Muṣṭalaḥ al-Ḥadīth",
  },
  {
    slug: "al-waraqaat",
    title: "Al-Waraqāt",
    titleArabic: "الورقات",
    author: "Imām al-Ḥaramayn al-Juwaynī",
    category: "Uṣūl al-Fiqh",
  },
  {
    slug: "matn-abi-shujaa",
    title: "Matn Abī Shujāʿ (al-Ghāyah wa-t-Taqrīb)",
    titleArabic: "متن أبي شجاع",
    author: "Abū Shujāʿ al-Iṣfahānī",
    category: "Fiqh (Shāfiʿī)",
  },
  {
    slug: "al-ajrumiyyah",
    title: "Al-Ājurrūmiyyah",
    titleArabic: "الآجرومية",
    author: "Ibn Ājurrūm",
    category: "Naḥw (Grammar)",
  },
  {
    slug: "tadheem-al-ilm",
    title: "Taʿẓīm al-ʿIlm",
    titleArabic: "تعظيم العلم",
    author: "Ṣāliḥ al-ʿUṣaymī",
    category: "Adab & Knowledge",
  },
  {
    slug: "akhlaq-hamalat-al-quran",
    title: "Akhlāq Ḥamalat al-Qurʾān",
    titleArabic: "أخلاق حملة القرآن",
    author: "Imām al-Ājurrī",
    category: "Adab of the Qurʾān",
  },
  {
    slug: "shamaail-muhammadiyyah",
    title: "Ash-Shamāʾil al-Muḥammadiyyah",
    titleArabic: "الشمائل المحمدية",
    author: "Imām at-Tirmidhī",
    category: "Sīrah & Shamāʾil",
  },
  {
    slug: "al-urjuzah-al-miiyyah",
    title: "Al-Urjūzah al-Miʾiyyah",
    titleArabic: "الأرجوزة المئية",
    category: "Sīrah",
  },
];
