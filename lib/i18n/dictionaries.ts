/**
 * UI dictionaries — English (default), Arabic, Urdu.
 *
 * Flat keys, grouped by prefix. en is the source of truth: missing keys in
 * other locales fall back to en at lookup time, so partial translations are
 * always safe. Add a locale by adding a Dict here + an entry in LOCALES.
 */

export type Locale = "en" | "ar" | "ur";

export const LOCALES: { code: Locale; label: string; rtl: boolean }[] = [
  { code: "en", label: "English", rtl: false },
  { code: "ar", label: "العربية", rtl: true },
  { code: "ur", label: "اردو",   rtl: true },
];

export function isRtl(locale: Locale): boolean {
  return LOCALES.find((l) => l.code === locale)?.rtl ?? false;
}

type Dict = Record<string, string>;

const en: Dict = {
  // ── Login ──
  "login.subtitle":        "Your personal Qurʾān study space",
  "login.google":          "Continue with Google",
  "login.microsoft":       "Continue with Microsoft",
  "login.signingIn":       "Signing in…",
  "login.footer":          "Your notes and workspaces are private and synced to your account.",
  "login.demoCode":        "Demo code",
  "login.openDemo":        "Open demo",
  "login.opening":         "Opening…",

  // ── Home ──
  "home.welcomeBack":      "Welcome back",
  "home.welcomeBackName":  "Welcome back, {name}",
  "home.continueStudying": "Continue studying",
  "home.continueBoard":    "Continue on your board",
  "home.resume":           "Resume Study",
  "home.blankBoard":       "Blank board",
  "home.yourWorkspaces":   "Your workspaces",
  "home.createFirst":      "Create your first workspace",

  // ── Workspace home ──
  "ws.notes":              "Notes",
  "ws.blankBoard":         "◇ Blank board",
  "ws.rename":             "Rename",
  "ws.settings":           "Settings",
  "ws.newWorkspace":       "+ New workspace",
  "ws.surahsInProgress":   "{n} surahs in progress",
  "ws.filter.all":         "All",
  "ws.filter.started":     "Started",
  "ws.filter.notStarted":  "Not started",
  "ws.startStudying":      "Start studying",
  "ws.open":               "Open",

  // ── Boards home ──
  "boards.badge":          "Boards",
  "boards.count":          "{n} boards",
  "boards.new":            "◇ New board",
  "boards.namePlaceholder":"Board name (e.g. this week's topic)",
  "boards.create":         "Create board →",
  "boards.creating":       "Creating…",
  "boards.cancel":         "Cancel",
  "boards.emptyTitle":     "No boards yet",
  "boards.emptyBody":      "Create a blank board for this week's notes — pull in verses & tafsīr, and annotate freely.",

  // ── Top bar ──
  "topbar.editor":         "Editor",
  "topbar.canvas":         "Canvas",
  "topbar.split":          "Split",
  "topbar.board":          "Board",
  "topbar.formatting":     "Formatting",
  "topbar.tafsir":         "Tafsīr",
  "topbar.export":         "Export",

  // ── Sidebar ──
  "sidebar.workspaceHome": "Workspace home",
  "sidebar.allNotes":      "All notes",
  "sidebar.search":        "Search…",

  // ── New workspace modal ──
  "modal.newWorkspace":    "New workspace",
  "modal.name":            "Name",
  "modal.namePlaceholder": "e.g. Al-Baqarah Study Group",
  "modal.type":            "Type",
  "modal.private":         "Private",
  "modal.privateDesc":     "Only visible to you",
  "modal.group":           "Group",
  "modal.groupDesc":       "Shared with members",
  "modal.whatFor":         "What is it for?",
  "modal.study":           "Qurʾān study",
  "modal.studyDesc":       "All 114 sūrahs + a blank board",
  "modal.boards":          "Blank boards",
  "modal.boardsDesc":      "Several free whiteboards, e.g. a weekly class",
  "modal.books":           "Book study",
  "modal.booksDesc":       "Annotate PDFs — a library of texts, or upload your own",
  "modal.cancel":          "Cancel",
  "modal.create":          "Create workspace",
  "modal.creating":        "Creating…",

  // ── Tafsir drawer ──
  "drawer.title":          "Tafsīr · Classical Commentary",
  "drawer.source":         "Source",
  "drawer.language":       "Language",
  "drawer.all":            "All",
  "drawer.commentary":     "Commentary",
  "drawer.wordByWord":     "Word-by-word",
  "drawer.translations":   "Translations",
  "drawer.recitation":     "Recitation",

  // ── Whiteboard ──
  "wb.hintTitle":          "Blank whiteboard",
  "wb.backTitle":          "Whiteboard",

  // ── Common ──
  "common.loading":        "Loading…",
  "common.language":       "Language",
};

const ar: Dict = {
  "login.subtitle":        "مساحتك الخاصة لدراسة القرآن",
  "login.google":          "المتابعة بحساب جوجل",
  "login.microsoft":       "المتابعة بحساب مايكروسوفت",
  "login.signingIn":       "جارٍ تسجيل الدخول…",
  "login.footer":          "ملاحظاتك ومساحات عملك خاصة ومتزامنة مع حسابك.",
  "login.demoCode":        "رمز التجربة",
  "login.openDemo":        "فتح التجربة",
  "login.opening":         "جارٍ الفتح…",

  "home.welcomeBack":      "مرحباً بعودتك",
  "home.welcomeBackName":  "مرحباً بعودتك، {name}",
  "home.continueStudying": "واصل الدراسة",
  "home.continueBoard":    "واصل على لوحتك",
  "home.resume":           "استئناف الدراسة",
  "home.blankBoard":       "لوحة فارغة",
  "home.yourWorkspaces":   "مساحات عملك",
  "home.createFirst":      "أنشئ أول مساحة عمل",

  "ws.notes":              "الملاحظات",
  "ws.blankBoard":         "◇ لوحة فارغة",
  "ws.rename":             "إعادة تسمية",
  "ws.settings":           "الإعدادات",
  "ws.newWorkspace":       "+ مساحة جديدة",
  "ws.surahsInProgress":   "{n} سورة قيد الدراسة",
  "ws.filter.all":         "الكل",
  "ws.filter.started":     "بدأت",
  "ws.filter.notStarted":  "لم تبدأ",
  "ws.startStudying":      "ابدأ الدراسة",
  "ws.open":               "افتح",

  "boards.badge":          "لوحات",
  "boards.count":          "{n} لوحة",
  "boards.new":            "◇ لوحة جديدة",
  "boards.namePlaceholder":"اسم اللوحة (مثل موضوع هذا الأسبوع)",
  "boards.create":         "إنشاء لوحة ←",
  "boards.creating":       "جارٍ الإنشاء…",
  "boards.cancel":         "إلغاء",
  "boards.emptyTitle":     "لا توجد لوحات بعد",
  "boards.emptyBody":      "أنشئ لوحة فارغة لملاحظات هذا الأسبوع — أدرج الآيات والتفسير ودوّن بحرية.",

  "topbar.editor":         "المحرّر",
  "topbar.canvas":         "اللوحة",
  "topbar.split":          "مقسّم",
  "topbar.board":          "سبورة",
  "topbar.formatting":     "التنسيق",
  "topbar.tafsir":         "التفسير",
  "topbar.export":         "تصدير",

  "sidebar.workspaceHome": "الصفحة الرئيسية",
  "sidebar.allNotes":      "كل الملاحظات",
  "sidebar.search":        "بحث…",

  "modal.newWorkspace":    "مساحة عمل جديدة",
  "modal.name":            "الاسم",
  "modal.namePlaceholder": "مثال: حلقة سورة البقرة",
  "modal.type":            "النوع",
  "modal.private":         "خاصة",
  "modal.privateDesc":     "مرئية لك فقط",
  "modal.group":           "جماعية",
  "modal.groupDesc":       "مشتركة مع الأعضاء",
  "modal.whatFor":         "ما الغرض منها؟",
  "modal.study":           "دراسة القرآن",
  "modal.studyDesc":       "السور الـ114 كاملة + لوحة فارغة",
  "modal.boards":          "لوحات فارغة",
  "modal.boardsDesc":      "عدة سبورات حرة، مثل درس أسبوعي",
  "modal.books":           "دراسة الكتب",
  "modal.booksDesc":       "التعليق على ملفات PDF — مكتبة من المتون أو ارفع كتابك",
  "modal.cancel":          "إلغاء",
  "modal.create":          "إنشاء مساحة العمل",
  "modal.creating":        "جارٍ الإنشاء…",

  "drawer.title":          "التفسير · شروح كلاسيكية",
  "drawer.source":         "المصدر",
  "drawer.language":       "اللغة",
  "drawer.all":            "الكل",
  "drawer.commentary":     "التفسير",
  "drawer.wordByWord":     "كلمة بكلمة",
  "drawer.translations":   "الترجمات",
  "drawer.recitation":     "التلاوة",

  "wb.hintTitle":          "سبورة فارغة",
  "wb.backTitle":          "السبورة",

  "common.loading":        "جارٍ التحميل…",
  "common.language":       "اللغة",
};

const ur: Dict = {
  "login.subtitle":        "قرآن کے مطالعے کی آپ کی ذاتی جگہ",
  "login.google":          "گوگل کے ساتھ جاری رکھیں",
  "login.microsoft":       "مائیکروسافٹ کے ساتھ جاری رکھیں",
  "login.signingIn":       "سائن اِن ہو رہا ہے…",
  "login.footer":          "آپ کے نوٹس اور ورک اسپیس نجی ہیں اور آپ کے اکاؤنٹ سے ہم آہنگ ہیں۔",
  "login.demoCode":        "ڈیمو کوڈ",
  "login.openDemo":        "ڈیمو کھولیں",
  "login.opening":         "کھل رہا ہے…",

  "home.welcomeBack":      "خوش آمدید",
  "home.welcomeBackName":  "خوش آمدید، {name}",
  "home.continueStudying": "مطالعہ جاری رکھیں",
  "home.continueBoard":    "اپنے بورڈ پر جاری رکھیں",
  "home.resume":           "مطالعہ دوبارہ شروع کریں",
  "home.blankBoard":       "خالی بورڈ",
  "home.yourWorkspaces":   "آپ کے ورک اسپیس",
  "home.createFirst":      "اپنا پہلا ورک اسپیس بنائیں",

  "ws.notes":              "نوٹس",
  "ws.blankBoard":         "◇ خالی بورڈ",
  "ws.rename":             "نام بدلیں",
  "ws.settings":           "ترتیبات",
  "ws.newWorkspace":       "+ نیا ورک اسپیس",
  "ws.surahsInProgress":   "{n} سورتیں زیرِ مطالعہ",
  "ws.filter.all":         "سب",
  "ws.filter.started":     "شروع شدہ",
  "ws.filter.notStarted":  "غیر شروع شدہ",
  "ws.startStudying":      "مطالعہ شروع کریں",
  "ws.open":               "کھولیں",

  "boards.badge":          "بورڈز",
  "boards.count":          "{n} بورڈ",
  "boards.new":            "◇ نیا بورڈ",
  "boards.namePlaceholder":"بورڈ کا نام (مثلاً اس ہفتے کا موضوع)",
  "boards.create":         "بورڈ بنائیں ←",
  "boards.creating":       "بن رہا ہے…",
  "boards.cancel":         "منسوخ",
  "boards.emptyTitle":     "ابھی کوئی بورڈ نہیں",
  "boards.emptyBody":      "اس ہفتے کے نوٹس کے لیے خالی بورڈ بنائیں — آیات اور تفسیر شامل کریں اور آزادی سے لکھیں۔",

  "topbar.editor":         "ایڈیٹر",
  "topbar.canvas":         "کینوس",
  "topbar.split":          "تقسیم",
  "topbar.board":          "بورڈ",
  "topbar.formatting":     "فارمیٹنگ",
  "topbar.tafsir":         "تفسیر",
  "topbar.export":         "ایکسپورٹ",

  "sidebar.workspaceHome": "ورک اسپیس ہوم",
  "sidebar.allNotes":      "تمام نوٹس",
  "sidebar.search":        "تلاش…",

  "modal.newWorkspace":    "نیا ورک اسپیس",
  "modal.name":            "نام",
  "modal.namePlaceholder": "مثلاً سورۃ البقرہ اسٹڈی گروپ",
  "modal.type":            "قسم",
  "modal.private":         "نجی",
  "modal.privateDesc":     "صرف آپ کو نظر آئے گا",
  "modal.group":           "گروپ",
  "modal.groupDesc":       "اراکین کے ساتھ مشترک",
  "modal.whatFor":         "کس مقصد کے لیے؟",
  "modal.study":           "قرآن کا مطالعہ",
  "modal.studyDesc":       "تمام 114 سورتیں + ایک خالی بورڈ",
  "modal.boards":          "خالی بورڈز",
  "modal.boardsDesc":      "کئی آزاد وائٹ بورڈ، مثلاً ہفتہ وار کلاس",
  "modal.books":           "کتاب کا مطالعہ",
  "modal.booksDesc":       "PDF پر تشریح — متون کی لائبریری یا اپنی کتاب اپ لوڈ کریں",
  "modal.cancel":          "منسوخ",
  "modal.create":          "ورک اسپیس بنائیں",
  "modal.creating":        "بن رہا ہے…",

  "drawer.title":          "تفسیر · کلاسیکی شروحات",
  "drawer.source":         "ماخذ",
  "drawer.language":       "زبان",
  "drawer.all":            "سب",
  "drawer.commentary":     "تفسیر",
  "drawer.wordByWord":     "لفظ بہ لفظ",
  "drawer.translations":   "تراجم",
  "drawer.recitation":     "تلاوت",

  "wb.hintTitle":          "خالی وائٹ بورڈ",
  "wb.backTitle":          "وائٹ بورڈ",

  "common.loading":        "لوڈ ہو رہا ہے…",
  "common.language":       "زبان",
};

export const DICTIONARIES: Record<Locale, Dict> = { en, ar, ur };
