/* Productivity · Tafsir Lab
 *
 * A private timetable that runs on without an end. The half term was drafted
 * day by day; every other day is made from the weekly pattern below the
 * moment you look at it, and becomes a saved day of its own the first time
 * you change anything on it. Saved days live in this browser and, on
 * tafsir-lab.com, in your account's copy, so every device shows the same plan.
 *
 * Blocks are minutes after midnight; a day runs 05:00 to 01:00, so anything
 * after midnight is stored past 24:00 (Sleep at 24:30).
 *
 * The timetable never shows two things in the same place. A prayer that falls
 * inside a study block splits it, the prayer sitting in the gap; one inside a
 * fixed event (mosque, school, a trip) is written into that event instead.
 * Moving or growing a block nudges whatever it lands on later in the day, and
 * never onto a fixed event.
 */
(() => {
  "use strict";

  const BOOT = (() => {
    const el = document.getElementById("pd-boot");
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch { return null; }
  })();
  const WEB = !!BOOT;
  const DRAFT = WEB ? BOOT.draft : window.PRODUCTIVITY_DRAFT;
  const SITE = WEB ? "" : "https://www.tafsir-lab.com";
  const KEY = "tl-productivity:half-term:v1";
  const UI_KEY = "tl-productivity:ui";
  const PRAYER_KEY = "tl-productivity:prayers";
  const T0 = 5 * 60, T1 = 25 * 60;   // 05:00 to 01:00
  const SNAP = 5;
  const PPM = 1.2;                   // pixels per minute, day view
  const PPM_W = 0.62;                // week view
  const START = DRAFT.from;          // the first day there is anything to plan

  const SURAHS = [
    ["Al-Fatihah", "الفاتحة"],
    ["Al-Baqarah", "البقرة"],
    ["Ali 'Imran", "آل عمران"],
    ["An-Nisa", "النساء"],
    ["Al-Ma'idah", "المائدة"],
    ["Al-An'am", "الأنعام"],
    ["Al-A'raf", "الأعراف"],
    ["Al-Anfal", "الأنفال"],
    ["At-Tawbah", "التوبة"],
    ["Yunus", "يونس"],
    ["Hud", "هود"],
    ["Yusuf", "يوسف"],
    ["Ar-Ra'd", "الرعد"],
    ["Ibrahim", "ابراهيم"],
    ["Al-Hijr", "الحجر"],
    ["An-Nahl", "النحل"],
    ["Al-Isra", "الإسراء"],
    ["Al-Kahf", "الكهف"],
    ["Maryam", "مريم"],
    ["Taha", "طه"],
    ["Al-Anbya", "الأنبياء"],
    ["Al-Hajj", "الحج"],
    ["Al-Mu'minun", "المؤمنون"],
    ["An-Nur", "النور"],
    ["Al-Furqan", "الفرقان"],
    ["Ash-Shu'ara", "الشعراء"],
    ["An-Naml", "النمل"],
    ["Al-Qasas", "القصص"],
    ["Al-'Ankabut", "العنكبوت"],
    ["Ar-Rum", "الروم"],
    ["Luqman", "لقمان"],
    ["As-Sajdah", "السجدة"],
    ["Al-Ahzab", "الأحزاب"],
    ["Saba", "سبإ"],
    ["Fatir", "فاطر"],
    ["Ya-Sin", "يس"],
    ["As-Saffat", "الصافات"],
    ["Sad", "ص"],
    ["Az-Zumar", "الزمر"],
    ["Ghafir", "غافر"],
    ["Fussilat", "فصلت"],
    ["Ash-Shuraa", "الشورى"],
    ["Az-Zukhruf", "الزخرف"],
    ["Ad-Dukhan", "الدخان"],
    ["Al-Jathiyah", "الجاثية"],
    ["Al-Ahqaf", "الأحقاف"],
    ["Muhammad", "محمد"],
    ["Al-Fath", "الفتح"],
    ["Al-Hujurat", "الحجرات"],
    ["Qaf", "ق"],
    ["Adh-Dhariyat", "الذاريات"],
    ["At-Tur", "الطور"],
    ["An-Najm", "النجم"],
    ["Al-Qamar", "القمر"],
    ["Ar-Rahman", "الرحمن"],
    ["Al-Waqi'ah", "الواقعة"],
    ["Al-Hadid", "الحديد"],
    ["Al-Mujadila", "المجادلة"],
    ["Al-Hashr", "الحشر"],
    ["Al-Mumtahanah", "الممتحنة"],
    ["As-Saf", "الصف"],
    ["Al-Jumu'ah", "الجمعة"],
    ["Al-Munafiqun", "المنافقون"],
    ["At-Taghabun", "التغابن"],
    ["At-Talaq", "الطلاق"],
    ["At-Tahrim", "التحريم"],
    ["Al-Mulk", "الملك"],
    ["Al-Qalam", "القلم"],
    ["Al-Haqqah", "الحاقة"],
    ["Al-Ma'arij", "المعارج"],
    ["Nuh", "نوح"],
    ["Al-Jinn", "الجن"],
    ["Al-Muzzammil", "المزمل"],
    ["Al-Muddaththir", "المدثر"],
    ["Al-Qiyamah", "القيامة"],
    ["Al-Insan", "الانسان"],
    ["Al-Mursalat", "المرسلات"],
    ["An-Naba", "النبإ"],
    ["An-Nazi'at", "النازعات"],
    ["'Abasa", "عبس"],
    ["At-Takwir", "التكوير"],
    ["Al-Infitar", "الإنفطار"],
    ["Al-Mutaffifin", "المطففين"],
    ["Al-Inshiqaq", "الإنشقاق"],
    ["Al-Buruj", "البروج"],
    ["At-Tariq", "الطارق"],
    ["Al-A'la", "الأعلى"],
    ["Al-Ghashiyah", "الغاشية"],
    ["Al-Fajr", "الفجر"],
    ["Al-Balad", "البلد"],
    ["Ash-Shams", "الشمس"],
    ["Al-Layl", "الليل"],
    ["Ad-Duhaa", "الضحى"],
    ["Ash-Sharh", "الشرح"],
    ["At-Tin", "التين"],
    ["Al-'Alaq", "العلق"],
    ["Al-Qadr", "القدر"],
    ["Al-Bayyinah", "البينة"],
    ["Az-Zalzalah", "الزلزلة"],
    ["Al-'Adiyat", "العاديات"],
    ["Al-Qari'ah", "القارعة"],
    ["At-Takathur", "التكاثر"],
    ["Al-'Asr", "العصر"],
    ["Al-Humazah", "الهمزة"],
    ["Al-Fil", "الفيل"],
    ["Quraysh", "قريش"],
    ["Al-Ma'un", "الماعون"],
    ["Al-Kawthar", "الكوثر"],
    ["Al-Kafirun", "الكافرون"],
    ["An-Nasr", "النصر"],
    ["Al-Masad", "المسد"],
    ["Al-Ikhlas", "الإخلاص"],
    ["Al-Falaq", "الفلق"],
    ["An-Nas", "الناس"],
  ];
  const surahName = (n) => (SURAHS[n - 1] || [`Sūrah ${n}`])[0];

  const CATS = [
    ["arabic", "Arabic"], ["maths", "Maths"], ["biology", "Biology"], ["chemistry", "Chemistry"],
    ["tafsir", "Tafsīr"], ["islamic", "Islamic studies"], ["gym", "Gym"], ["fixed", "Fixed"],
    ["routine", "Routine"], ["prayer", "Prayer"], ["other", "Other"],
  ];
  const CAT_LABEL = Object.fromEntries(CATS);
  const STUDY = ["arabic", "maths", "biology", "chemistry", "tafsir", "islamic"];
  const TRACKED = [...STUDY, "gym"];
  const SUBJECTS = [["Maths", "maths"], ["Biology", "biology"], ["Chemistry", "chemistry"]];

  /* The Islamic studies programme: three tracks, each a run of courses with
     their recorded length in minutes. A session moves you through them in
     order, so a block can say which course you're on. Precision in Knowledge
     begins at Aqeedah: Tawhid, the introduction, is already done. */
  const TRACKS = {
    usul: { name: "Usul al-Ilm", short: "Usul al-Ilm", courses: [
      ["Introduction to the Programme", 178], ["Tadheem ul Ilm", 750]] },
    precision: { name: "Precision in Knowledge", short: "Precision", courses: [
      ["Aqeedah", 900], ["Qawaid al-Fiqhiyyah", 394], ["Usool", 261], ["Furu'", 1069], ["Tafseer", 18],
      ["Tajweed", 119], ["Adaab", 491], ["Usool at-Tafseer", 633], ["Mustalah al-Hadith", 281],
      ["Shurooh al-Hadith", 1250], ["Shamaail", 1235], ["Seerah", 289],
      ["Introduction to Student Etiquette", 566], ["Adab", 967]] },
    amar: { name: "AMAR Exclusives", short: "AMAR", courses: [
      ["The Beautiful Names of Allah", 140], ["The Character of the Bearers of the Qur'an", 327],
      ["Prerequisites to Seeking Knowledge", 255], ["The Rights in Islam", 209],
      ["Ta'iyyah of Abu Ishaq al-Ilbiri", 139], ["Lamiyyat Ibn al-Wardi", 87],
      ["Tasfiyah and Tarbiyah", 224], ["Majma' al-Usul", 457], ["Unwan al-Hikam", 79]] },
  };
  const PROGRAMME_FROM = "2026-10-26";

  /* School holidays, as best guessed for 2026–27; any single day can be
     switched between a school day and a day off from its own panel. */
  const TERM_FROM = "2026-11-02";
  const HOLIDAYS = [
    ["2026-12-19", "2027-01-03"], ["2027-02-13", "2027-02-21"], ["2027-03-26", "2027-04-11"],
    ["2027-05-03", "2027-05-03"], ["2027-05-29", "2027-06-06"], ["2027-07-22", "2027-09-01"],
  ];

  /* ── helpers ── */
  const $ = (s) => document.querySelector(s);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const toMin = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
  const raw = (x) => `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
  const clock = (x) => `${String(Math.floor(x / 60) % 24).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const dur = (b) => toMin(b.end) - toMin(b.start);
  const isBand = (b) => b.cat === "prayer" && dur(b) <= 30;
  /** Fixed things: nothing is moved onto them, and prayers inside them are written in, not drawn over. */
  const isWall = (b) => !isBand(b) && (b.locked || b.anchor || b.cat === "fixed" || b.cat === "gym" || b.title === "Sleep" || /^Wake/.test(b.title));
  const fmtDur = (m) => {
    if (m <= 0) return "0m";
    const h = Math.floor(m / 60), r = m % 60;
    return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`;
  };
  const fmtHours = (m) => (Math.round((m / 60) * 2) / 2).toString() + "h";
  let seq = 0;
  const newId = () => "u" + Date.now().toString(36) + (seq++).toString(36);
  const dateObj = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
  const isoOf = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const addDays = (iso, n) => { const d = dateObj(iso); d.setDate(d.getDate() + n); return isoOf(d); };
  const daysBetween = (a, b) => Math.round((dateObj(b) - dateObj(a)) / 864e5);
  const weekStart = (iso) => addDays(iso, -((dateObj(iso).getDay() + 6) % 7));
  const weekdayLong = (iso) => dateObj(iso).toLocaleDateString("en-GB", { weekday: "long" });
  // The planner's day runs 05:00 to 05:00, as the timeline does: at half past
  // midnight you are still in last night, not the start of tomorrow.
  const todayIso = () => isoOf(new Date(Date.now() - 5 * 3600e3));
  const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes() + (n.getHours() < 5 ? 1440 : 0); };
  /** The same, to the second, so the line can glide rather than jump a minute at a time. */
  const nowExact = () => { const n = new Date(); return nowMin() + n.getSeconds() / 60; };
  const MONTH = (iso) => dateObj(iso).toLocaleDateString("en-GB", { month: "long" });
  const shortDate = (iso) => `${dateObj(iso).getDate()} ${MONTH(iso).slice(0, 3)}`;
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  /* ── state ── */
  // Edits belong to one draft: a redrafted plan starts clean rather than
  // mixing with changes made to the old one.
  const DRAFT_KEY = `${DRAFT.from}/${DRAFT.version || 0}`;
  function fresh() { const s = clone(DRAFT); s.draftFrom = DRAFT_KEY; s.savedAt = 0; return s; }
  const valid = (s) => s && Array.isArray(s.days) && s.draftFrom === DRAFT_KEY;
  let local = null;
  try { local = JSON.parse(localStorage.getItem(KEY)); } catch { /* storage unavailable */ }
  const server = WEB ? BOOT.state : null;
  let state = [server, local].filter(valid).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))[0] || fresh();

  const ui = { date: null, view: "day", sel: null, month: null };
  try { const u = JSON.parse(localStorage.getItem(UI_KEY)) || {}; if (u.view) ui.view = u.view; if (/^\d{4}-\d\d-\d\d$/.test(u.date || "")) ui.date = u.date; } catch {}
  ui.date = todayIso() >= START ? todayIso() : START;
  // A link can open a day or the week: #2026-10-23, #week
  const hash = decodeURIComponent(location.hash.slice(1));
  if (/^\d{4}-\d\d-\d\d$/.test(hash) && hash >= START) { ui.date = hash; ui.view = "day"; }
  if (hash === "week") ui.view = "week";
  ui.month = ui.date.slice(0, 7);

  /* ── the calendar: saved days, and the rest made from the weekly pattern ── */
  let index = null, indexFor = null;
  function saved() {
    if (indexFor !== state || !index || index.size !== state.days.length) {
      index = new Map(state.days.map((d) => [d.date, d])); indexFor = state;
    }
    return index;
  }
  const genCache = new Map();      // date → { d, pristine }

  // Prayer times: London, Moonsighting Committee, standard Asr, by the month.
  let prayerStore = {};
  try { prayerStore = JSON.parse(localStorage.getItem(PRAYER_KEY)) || {}; } catch {}
  for (const d of state.days) if (d.prayers) (prayerStore[d.date.slice(0, 7)] ||= {})[d.date] ||= d.prayers;
  const loadingMonths = new Set();
  // Looking far ahead (when will the course end?) shouldn't fetch a year of
  // prayer times; only days you actually look at ask for theirs.
  let quiet = false;
  function prayersFor(iso) {
    const ym = iso.slice(0, 7), month = prayerStore[ym];
    if (month && month[iso]) return month[iso];
    if (!quiet && (!month || !month.__full)) loadPrayerMonth(ym);
    return null;
  }
  function loadPrayerMonth(ym) {
    if (loadingMonths.has(ym)) return;
    loadingMonths.add(ym);
    const [y, m] = ym.split("-").map(Number);
    fetch(`https://api.aladhan.com/v1/calendarByCity/${y}/${m}?city=London&country=United%20Kingdom&method=15&school=0`)
      .then((r) => r.json())
      .then((j) => {
        const month = { __full: true };
        for (const x of j.data || []) {
          const [dd, mm, yy] = x.date.gregorian.date.split("-");
          const t = {};
          for (const k of ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"]) t[k] = String(x.timings[k]).slice(0, 5);
          month[`${yy}-${mm}-${dd}`] = t;
        }
        prayerStore[ym] = { ...month, ...(prayerStore[ym] || {}), __full: true };
        try { localStorage.setItem(PRAYER_KEY, JSON.stringify(prayerStore)); } catch {}
        for (const [iso, g] of genCache) if (iso.startsWith(ym) && !g.d.prayers) genCache.delete(iso);
        resetProgress();
        render();
      })
      .catch(() => { setTimeout(() => loadingMonths.delete(ym), 30000); });
  }

  function isSchoolDay(iso) {
    const o = state.school && state.school[iso];
    if (o !== undefined) return o;
    const wd = dateObj(iso).getDay();
    if (wd === 0 || wd === 6 || iso < TERM_FROM) return false;
    return !HOLIDAYS.some(([a, b]) => iso >= a && iso <= b);
  }

  /** Lay study tasks into the free time of a day, in order: prayers are pauses inside a block, everything else is a wall. */
  function placeTasks(B, tasks, from, until, mk) {
    for (const t of tasks) {
      let cur = Math.max(from, t.after || 0);
      const bands = B.filter(isBand).map((b) => [toMin(b.start), toMin(b.end)]).sort((a, b) => a[0] - b[0]);
      for (let g = 0; g < 200; g++) {
        for (const [ps, pe] of bands) if (ps - 15 < cur && cur < pe) cur = pe;
        let end = cur + t.dur;
        for (const [ps, pe] of bands) if (cur <= ps && ps < end) end += pe - ps;
        if (end > until) break;
        const hit = B.filter((b) => !isBand(b) && b.title !== "Sleep")
          .map((b) => [toMin(b.start), toMin(b.end) + (STUDY.includes(b.cat) && !b.anchor ? 10 : 0)])
          .filter(([a, z]) => cur < z && end > a);
        if (!hit.length) { mk(t, cur, end); break; }
        cur = Math.max(...hit.map((h) => h[1]));
      }
    }
  }

  /** A day made from the weekly pattern. */
  function generateDay(iso) {
    const dt = dateObj(iso), wd = dt.getDay();
    const fri = wd === 5, sat = wd === 6, sun = wd === 0;
    const school = isSchoolDay(iso);
    const p = prayersFor(iso);
    const B = [], seen = {};
    const add = (title, cat, s, e, x = {}) => {
      const k = slug(title); seen[k] = (seen[k] || 0) + 1;
      const b = { id: `g-${iso}-${k}-${seen[k]}`, title, cat, start: raw(s), end: raw(e), done: false, ...x };
      B.push(b); return b;
    };
    const m = toMin;
    if (p) {
      add("Fajr", "prayer", m(p.Fajr), m(p.Fajr) + 10, { locked: true });
      if (!fri) add("Dhuhr", "prayer", m(p.Dhuhr), m(p.Dhuhr) + 15, { locked: true });
      else if (school) add("Jumuʿah", "prayer", m(p.Dhuhr), m(p.Dhuhr) + 15, { locked: true });
      else add("Jumuʿah", "prayer", m(p.Dhuhr) - 20, m(p.Dhuhr) + 55, { locked: true, note: "Khuṭbah and prayer, with the walk" });
      add("Asr", "prayer", m(p.Asr), m(p.Asr) + 15, { locked: true });
      add("Maghrib", "prayer", m(p.Maghrib), m(p.Maghrib) + 15, { locked: true });
      add("Isha", "prayer", m(p.Isha), m(p.Isha) + 15, { locked: true });
    }

    // The shape of the day.
    let from;
    const gymDay = wd === 2 || wd === 4;
    if (sun) {
      add("Wake up & breakfast", "routine", 480, 520);
      add("Mosque", "fixed", 525, 750, { praysThere: true, where: "at the mosque", note: "09:00–12:15, with the walk there and back" });
      add("Lunch", "routine", 750, 780);
      from = 780;
    } else if (sat) {
      add("Wake up & breakfast", "routine", 570, 600);
      add("Gym", "gym", 660, 800, { note: "Leave 11:00 · home 13:20" });
      add("Lunch", "routine", 820, 850);
      from = 600;
    } else if (school) {
      add("Wake up & get ready", "routine", 410, 460);
      add("School", "fixed", 480, 960, { praysThere: true, where: "at school", note: "Out of the house 08:00 to 16:00" });
      if (gymDay) add("Gym", "gym", 990, 1110, { note: "Leave 16:30 · home about 18:30" });
      from = 960;
    } else {
      add("Wake up & breakfast", "routine", gymDay ? 615 : 630, gymDay ? 645 : 660);
      if (gymDay) add("Gym", "gym", 660, 800, { note: "Leave 11:00 · home 13:20" });
      add("Lunch", "routine", gymDay ? 820 : 840, gymDay ? 850 : 870);
      from = gymDay ? 645 : 660;
    }
    if (wd === 1) add("Tuition", "fixed", 1020, 1080, { note: "Subject to change" });
    if (fri) add("Junayd · tafsīr lesson", "fixed", 1020, 1080);

    // Islamic studies, from the programme's first week.
    if (iso >= PROGRAMME_FROM) {
      const isl = (track, s, e) => add(TRACKS[track].name, "islamic", s, e, { track, anchor: true });
      if (wd === 3) isl("usul", 1260, 1350);
      if (wd === 4) isl("precision", 1260, 1350);
      if (fri) isl("amar", 1260, 1350);
      if (sat) { isl("usul", 1260, 1290); isl("precision", 1290, 1320); isl("amar", 1320, 1350); }
      if (sun) {
        add("Arabic · Lesson", "arabic", 1260, 1320, { anchor: true, note: "Arabic Programme" });
        add("Arabic · Lesson", "arabic", 1320, 1380, { anchor: true, note: "Arabic Programme" });
      }
    }

    // A prayer that comes in just before you'd leave is prayed first: the
    // trip (gym, tuition) starts once it's done rather than cutting across it.
    for (const b of B.filter(isBand)) {
      const w = B.find((x) => isWall(x) && !x.praysThere && x.cat !== "routine" && !x.anchor && m(b.start) < m(x.start) && m(x.start) < m(b.end));
      if (!w) continue;
      const shift = m(b.end) + 5 - m(w.start);
      w.start = raw(m(w.start) + shift); w.end = raw(m(w.end) + shift);
    }
    // Dinner after Isha, clear of anything fixed; sleep earlier before a school day.
    const walls = () => B.filter((b) => isWall(b));
    let dn = Math.max(1125, (p ? m(p.Isha) : 1110) + 20);
    for (let g = 0; g < 10; g++) { const w = walls().find((b) => dn < m(b.end) && dn + 35 > m(b.start)); if (!w) break; dn = m(w.end) + 5; }
    add("Dinner", "routine", dn, dn + 35);
    const until = isSchoolDay(addDays(iso, 1)) ? 1395 : 1470;
    add("Sleep", "routine", until, until + 30, { locked: true });

    // A prayer inside something fixed is prayed there, or straight after.
    for (const b of B.filter(isBand)) {
      const w = B.find((x) => isWall(x) && x.cat !== "routine" && m(x.start) <= m(b.start) && m(b.start) < m(x.end));
      if (!w) continue;
      if (w.praysThere) { b.note = `Prayed ${w.where || "there"}`; continue; }
      const len = dur(b);
      b.note = `Comes in at ${b.start} during ${w.title.split(" ·")[0]}; pray straight after`;
      b.start = w.end; b.end = raw(m(w.end) + len);
    }

    // The day's study.
    const n = Math.max(0, daysBetween(START, iso));
    const subj = (j) => SUBJECTS[(n + j) % 3];
    const arabic = { title: "Arabic · Lesson", cat: "arabic", dur: 60, note: "al-Madrasah al-Raḥmāniyyah. Watch, then write up the rules and new words." };
    const s = (j, len = 60) => ({ title: subj(j)[0], cat: subj(j)[1], dur: len });
    let tasks;
    if (sun) tasks = [s(0, 45), s(1, 45), { title: "Tafsīr", cat: "tafsir", dur: 40 }];
    else if (school) tasks = [arabic, s(0), { title: "Tafsīr", cat: "tafsir", dur: 30 }];
    else tasks = [arabic, s(0), arabic, s(1), { title: "Tafsīr", cat: "tafsir", dur: 40 }];
    placeTasks(B, tasks, from, until - 10, (t, a, z) => add(t.title, t.cat, a, z, t.note ? { note: t.note } : {}));

    B.sort((a, b) => m(a.start) - m(b.start));
    return { date: iso, weekday: weekdayLong(iso), prayers: p, blocks: B, generated: true };
  }

  function getDay(iso) {
    const s = saved().get(iso);
    if (s) return s;
    let g = genCache.get(iso);
    if (!g) { const d = generateDay(iso); g = { d, pristine: JSON.stringify(d) }; genCache.set(iso, g); }
    else if (!g.d.prayers && !quiet) prayersFor(iso);
    return g.d;
  }
  const day = () => getDay(ui.date);
  /** A made day you've changed becomes a saved one. */
  function materialize() {
    let added = false;
    for (const [iso, g] of genCache) {
      if (JSON.stringify(g.d) === g.pristine) continue;
      delete g.d.generated;
      state.days.push(g.d); genCache.delete(iso); added = true;
    }
    if (added) state.days.sort((a, b) => (a.date < b.date ? -1 : 1));
  }

  /* Running totals (lessons, programme minutes) up to any date, so a block
     can say which Arabic lesson or which course it is. */
  let frontier = null; const prefix = new Map();
  function resetProgress() { frontier = null; prefix.clear(); }
  const isLesson = (b) => b.cat === "arabic" && /^Arabic · Lesson/.test(b.title);
  function before(iso) {
    if (iso <= START) return { lessons: 0, usul: 0, precision: 0, amar: 0, lessonsDone: 0 };
    if (prefix.has(iso)) return prefix.get(iso);
    if (!frontier || frontier.iso > iso) frontier = { iso: START, acc: { lessons: 0, usul: 0, precision: 0, amar: 0, lessonsDone: 0 } };
    while (frontier.iso < iso) {
      const d = getDay(frontier.iso), acc = { ...frontier.acc };
      for (const b of d.blocks) {
        if (isLesson(b)) { acc.lessons++; if (b.done) acc.lessonsDone++; }
        if (b.track && acc[b.track] !== undefined) acc[b.track] += dur(b);
      }
      frontier = { iso: addDays(frontier.iso, 1), acc };
      prefix.set(frontier.iso, acc);
    }
    return prefix.get(iso);
  }
  const DONE_BEFORE = () => (state.arabic && state.arabic.doneBefore) ?? 10;
  const COURSE_LEN = () => (state.arabic && state.arabic.total) ?? 60;
  function courseAt(track, mins) {
    let acc = 0;
    for (const [name, len] of TRACKS[track].courses) { if (mins < acc + len) return name; acc += len; }
    return track === "usul" ? "Level 1 and on" : "Review";
  }
  /** What a block is called on screen: lessons numbered, programme sessions named by their course. */
  function displayTitle(b, d) {
    if (isLesson(b)) {
      const k = d.blocks.filter((x) => isLesson(x) && toMin(x.start) < toMin(b.start)).length;
      const n = DONE_BEFORE() + before(d.date).lessons + k + 1;
      return n <= COURSE_LEN() ? `Arabic · Lesson ${n}` : "Arabic · Review";
    }
    if (b.track && TRACKS[b.track] && b.title === TRACKS[b.track].name) {
      const mins = before(d.date)[b.track] + d.blocks.filter((x) => x.track === b.track && toMin(x.start) < toMin(b.start)).reduce((a, x) => a + dur(x), 0);
      return `${TRACKS[b.track].short} · ${courseAt(b.track, mins)}`;
    }
    return b.title;
  }

  /* ── saving: this browser, and TafsirLab ── */
  let pushTimer = 0, pending = false, failing = false;
  function save() {
    materialize();
    resetProgress();
    state.savedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
    saveUi();
    if (WEB) { pending = true; clearTimeout(pushTimer); pushTimer = setTimeout(push, 700); }
  }
  function saveUi() { try { localStorage.setItem(UI_KEY, JSON.stringify({ date: ui.date, view: ui.view })); } catch {} }
  async function push(keepalive = false) {
    if (!pending) return;
    const body = JSON.stringify({ state });
    try {
      const r = await fetch(BOOT.sync, { method: "PUT", headers: { "Content-Type": "application/json" }, body, keepalive });
      if (r.status === 401) { toast("Locked on this device. Reload to enter the password again."); return; }
      if (!r.ok) throw new Error(String(r.status));
      pending = false;
      if (failing) { failing = false; toast("Saved to TafsirLab"); }
    } catch {
      if (!failing) toast("Couldn’t save to TafsirLab. It’s kept here and will try again.");
      failing = true;
      clearTimeout(pushTimer); pushTimer = setTimeout(push, 15000);
    }
  }
  if (WEB) {
    window.addEventListener("pagehide", () => { if (pending) push(true); });
    // Back to this tab: take any newer copy saved from another device.
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState !== "visible" || pending || drag) return;
      try {
        const r = await fetch(BOOT.sync, { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (valid(d.state) && (d.state.savedAt || 0) > (state.savedAt || 0)) {
          state = d.state; genCache.clear(); resetProgress();
          try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
          if (ui.sel && !findBlock(ui.sel)) ui.sel = null;
          render();
        }
      } catch {}
    });
  }

  const undo = [], redo = [];
  function checkpoint() {
    materialize();
    undo.push(JSON.stringify(state));
    if (undo.length > 80) undo.shift();
    redo.length = 0;
  }
  function restore(from, to) {
    if (!from.length) return false;
    to.push(JSON.stringify(state));
    state = JSON.parse(from.pop());
    genCache.clear(); resetProgress();
    if (ui.sel && !findBlock(ui.sel)) ui.sel = null;
    save(); render();
    return true;
  }

  function findBlock(id) {
    for (const d of state.days) { const b = d.blocks.find((x) => x.id === id); if (b) return { b, d }; }
    for (const [, g] of genCache) { const b = g.d.blocks.find((x) => x.id === id); if (b) return { b, d: g.d }; }
    return null;
  }
  const sortDay = (d) => d.blocks.sort((a, b) => toMin(a.start) - toMin(b.start));

  /** Prayers that start inside a block. */
  const prayersInside = (b, d) => d.blocks.filter((p) => isBand(p) && toMin(p.start) >= toMin(b.start) && toMin(p.start) < toMin(b.end));
  /** Prayers written into a fixed event rather than drawn across the day. */
  function absorbed(d) {
    const set = new Set();
    for (const b of d.blocks) if (isWall(b)) for (const p of prayersInside(b, d)) set.add(p.id);
    return set;
  }
  /** Minutes of real work in a block: its length less any prayers inside it. */
  function workMinutes(b, d) {
    let m = dur(b);
    if (!STUDY.includes(b.cat)) return m;
    const s = toMin(b.start), e = toMin(b.end);
    for (const p of d.blocks) {
      if (!isBand(p)) continue;
      m -= Math.max(0, Math.min(e, toMin(p.end)) - Math.max(s, toMin(p.start)));
    }
    return m;
  }
  /** The block as drawn: its time less any prayers drawn across it. */
  function pieces(b, d, hidden) {
    let segs = [[toMin(b.start), toMin(b.end)]];
    if (isWall(b)) return segs;
    for (const p of d.blocks) {
      if (!isBand(p) || hidden.has(p.id)) continue;
      const ps = toMin(p.start), pe = toMin(p.end);
      segs = segs.flatMap(([s, e]) => (pe <= s || ps >= e) ? [[s, e]] : [[s, ps], [pe, e]].filter(([a, z]) => z - a > 0));
    }
    // A sliver of a few minutes either side of a prayer is not worth a box of
    // its own: the block reads as starting (or ending) at the prayer instead.
    const kept = segs.filter(([a, z]) => z - a >= 15);
    return kept.length ? kept : segs.length ? [segs.reduce((x, y) => (y[1] - y[0] > x[1] - x[0] ? y : x))] : [[toMin(b.start), toMin(b.end)]];
  }

  /**
   * Make room for a block that has just been placed: it comes off any fixed
   * event it landed on, and anything else it now covers moves later, in turn,
   * past fixed events too. Returns how many other blocks moved.
   */
  function settle(d, id) {
    const moved = d.blocks.find((x) => x.id === id);
    if (!moved || isBand(moved)) return 0;
    const L = dur(moved);
    const walls = d.blocks.filter((x) => x !== moved && isWall(x));
    const hits = (s, e, list) => list.find((w) => s < toMin(w.end) && e > toMin(w.start));
    if (!isWall(moved)) {
      for (let g = 0; g < 30; g++) {
        const s = toMin(moved.start), w = hits(s, s + L, walls);
        if (!w) break;
        const before = toMin(w.start) - L;
        const goBefore = s + L / 2 < (toMin(w.start) + toMin(w.end)) / 2 && before >= T0 && !hits(before, before + L, walls);
        const ns = Math.min(T1 - L, goBefore ? before : toMin(w.end));
        moved.start = raw(ns); moved.end = raw(ns + L);
        if (ns === T1 - L) break;
      }
    }
    const occ = [...walls, moved].map((x) => [toMin(x.start), toMin(x.end)]);
    let shifted = 0;
    const rest = d.blocks.filter((x) => x !== moved && !isBand(x) && !isWall(x)).sort((a, b) => toMin(a.start) - toMin(b.start));
    for (const o of rest) {
      const ol = dur(o);
      let s = toMin(o.start);
      for (let g = 0; g < 60; g++) {
        const hit = occ.find(([a, z]) => s < z && s + ol > a);
        if (!hit) break;
        s = hit[1];
      }
      s = Math.min(s, T1 - ol);
      if (s !== toMin(o.start)) { o.start = raw(s); o.end = raw(s + ol); shifted++; }
      occ.push([s, s + ol]);
    }
    sortDay(d);
    return shifted;
  }
  const madeRoom = (n) => n ? toast(`Moved ${n} block${n === 1 ? "" : "s"} later to make room`, { label: "Undo", run: () => restore(undo, redo) }) : null;

  /* ── opening a sūrah in TafsirLab ── */
  function openUrl(n) {
    const ws = state.tafsirWorkspace;
    return `${SITE}/productivity/open/${n}${ws ? `?ws=${encodeURIComponent(ws)}` : ""}`;
  }
  function openSurah(b) {
    if (!b.surah) return;
    window.open(openUrl(b.surah), "_blank", "noopener");
  }

  /* ── toast ── */
  let toastTimer = 0;
  function toast(msg, action, ms = 5000) {
    const t = $("#toast");
    t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ""}`;
    t.hidden = false;
    if (action) t.querySelector("button").onclick = () => { t.hidden = true; action.run(); };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      const a = anim(t, [{ opacity: 1, transform: "translate(-50%, 0)" }, { opacity: 0, transform: "translate(-50%, 10px)" }], { duration: 220, easing: "ease-in" });
      if (a) a.onfinish = () => { t.hidden = true; }; else t.hidden = true;
    }, ms);
  }

  /* ── motion ──
     Only where it explains something: paging slides from the side you're
     heading to, an edit glides blocks to where they now belong, a switch of
     view crossfades, and small confirmations pop. One curve throughout, a
     critically damped spring's shape; nothing loops, nothing waits. */
  const EASE = "cubic-bezier(0.2, 0.9, 0.25, 1)";
  const shown = { date: null, view: null, ins: null, cal: null };
  let ringsIn = false;
  const anim = (el, frames, opts) => el && el.animate && el.animate(frames, { duration: 360, easing: EASE, ...opts });
  function paintView(html) {
    const v = $("#view");
    const first = shown.view === null;
    const anchorDate = ui.view === "week" ? weekStart(ui.date) : ui.date;
    const mode = shown.view !== ui.view ? "fade" : shown.date !== anchorDate ? "slide" : "flip";
    const dir = shown.date ? Math.sign(daysBetween(shown.date, anchorDate)) : 0;
    const key = (el) => `${el.dataset.id}:${el.dataset.seg || 0}`;
    const before = new Map();
    if (mode === "flip") v.querySelectorAll(".blk[data-id], .band[data-id]").forEach((el) => before.set(key(el), el.offsetTop));
    v.innerHTML = html;
    shown.view = ui.view; shown.date = anchorDate;
    if (first) return;
    if (mode === "flip") {
      v.querySelectorAll(".blk[data-id], .band[data-id]").forEach((el) => {
        const was = before.get(key(el));
        if (was === undefined) { anim(el, [{ opacity: 0, transform: "scale(0.96)" }, { opacity: 1, transform: "none" }], { duration: 280 }); return; }
        const dy = was - el.offsetTop;
        if (Math.abs(dy) > 1) anim(el, [{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 440 });
      });
      return;
    }
    const from = mode === "slide" && dir ? `translateX(${dir * 28}px)` : "translateY(8px)";
    anim(v.querySelector(".timeline, .week"), [{ opacity: 0, transform: from }, { opacity: 1, transform: "none" }], { duration: 380 });
    const tfrom = mode === "slide" && dir ? `translateX(${dir * 14}px)` : "translateY(4px)";
    for (const el of [$("#day-title"), $("#day-sub")]) anim(el, [{ opacity: 0, transform: tfrom }, { opacity: 1, transform: "none" }], { duration: 320 });
  }
  function pop(el) { anim(el, [{ transform: "scale(0.55)" }, { transform: "scale(1.14)", offset: 0.6 }, { transform: "scale(1)" }], { duration: 380 }); }
  function slideSwitch(sw, on) {
    if (!sw) return;
    try { anim(sw, [{ transform: `translateX(${on ? 0 : 15}px)` }, { transform: `translateX(${on ? 15 : 0}px)` }], { duration: 320, pseudoElement: "::after" }); } catch { /* no pseudo-element animation here */ }
  }

  /* ── sidebar: a month, what's coming up, and the rings ── */
  const dayTasks = (d) => d.blocks.filter((b) => TRACKED.includes(b.cat));
  const inHalfTerm = (iso) => iso >= DRAFT.from && iso <= DRAFT.to;
  function dayKind(iso) {
    if (inHalfTerm(iso)) return `Half term, day ${daysBetween(DRAFT.from, iso) + 1} of ${daysBetween(DRAFT.from, DRAFT.to) + 1}`;
    const wd = dateObj(iso).getDay();
    if (wd === 0 || wd === 6) return "Weekend";
    return isSchoolDay(iso) ? "School day" : "No school";
  }
  function ring(r, frac, cls) {
    const C = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac));
    return `<circle class="rt ${cls}" cx="50" cy="50" r="${r}"/><circle class="rf ${cls}" cx="50" cy="50" r="${r}" stroke-dasharray="${(f * C).toFixed(2)} ${C.toFixed(2)}"/>`;
  }
  const monthName = (ym) => dateObj(`${ym}-01`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  function renderSide() {
    const today = todayIso();
    const first = `${ui.month}-01`;
    const lead = (dateObj(first).getDay() + 6) % 7;      // weeks start on Monday
    const len = new Date(dateObj(first).getFullYear(), dateObj(first).getMonth() + 1, 0).getDate();
    const prevOk = first > START;
    let cal = `<div class="cal-head"><b>${monthName(ui.month)}</b>
        <span class="cal-nav"><button type="button" class="icon-btn" data-cal="-1" aria-label="Previous month" ${prevOk ? "" : "disabled"}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button><button type="button" class="icon-btn" data-cal="1" aria-label="Next month"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button></span>
      </div><p class="cal-status">${esc(dayKind(today >= START ? today : START))}</p>
      <div class="cal-grid">${["M", "T", "W", "T", "F", "S", "S"].map((x) => `<span class="dow">${x}</span>`).join("")}${"<span></span>".repeat(lead)}`;
    for (let i = 1; i <= len; i++) {
      const iso = `${ui.month}-${String(i).padStart(2, "0")}`;
      if (iso < START) { cal += `<span class="cd off"><span>${i}</span><i></i></span>`; continue; }
      const d = getDay(iso), tasks = dayTasks(d), done = tasks.filter((b) => b.done).length;
      const st = tasks.length && done === tasks.length ? "all" : done ? "some" : "none";
      cal += `<button type="button" class="cd" data-date="${iso}" aria-current="${iso === ui.date}" data-today="${iso === today}" data-state="${st}" aria-label="${weekdayLong(iso)} ${shortDate(iso)}, ${done} of ${tasks.length} done"><span>${i}</span><i></i></button>`;
    }
    $("#days").innerHTML = cal + `</div>`;
    if (shown.cal !== null && shown.cal !== ui.date) pop($("#days .cd[aria-current='true'] span"));
    shown.cal = ui.date;

    // Coming up: the one-off fixed things still ahead (a weekly fixture isn't news).
    const nowKey = `${today} ${raw(nowMin())}`;
    const seenTitles = {};
    for (const d of state.days) for (const b of d.blocks) if (b.cat === "fixed") seenTitles[b.title] = (seenTitles[b.title] || 0) + 1;
    const weekly = new Set(["Mosque", "Tuition", "Junayd · tafsīr lesson", "School"]);
    const ups = [];
    for (const d of state.days) for (const b of d.blocks)
      if (b.cat === "fixed" && seenTitles[b.title] === 1 && !weekly.has(b.title) && `${d.date} ${b.end}` > nowKey) ups.push({ d, b });
    ups.sort((x, y) => (`${x.d.date} ${x.b.start}` < `${y.d.date} ${y.b.start}` ? -1 : 1));

    // The rings: the Arabic course, and this week's study and prayers.
    const ws = weekStart(ui.date);
    let prDone = 0, prAll = 0, stPlan = 0, stDone = 0;
    for (let i = 0; i < 7; i++) {
      const iso = addDays(ws, i); if (iso < START) continue;
      const d = getDay(iso);
      for (const b of d.blocks) {
        if (b.cat === "prayer") { prAll++; if (b.done) prDone++; }
        if (STUDY.includes(b.cat)) { const m = workMinutes(b, d); stPlan += m; if (b.done) stDone += m; }
      }
    }
    let arDone = 0;
    for (const d of state.days) for (const b of d.blocks) if (isLesson(b) && b.done) arDone++;
    const A = COURSE_LEN(), now = Math.min(A, DONE_BEFORE() + arDone);
    $("#progress").innerHTML = `
      ${ups.length ? `<section class="side-sec">
        <h4>Coming up</h4>
        ${ups.slice(0, 4).map(({ d, b }) => `<button type="button" class="up" data-goto="${b.id}">
          <span class="up-day"><small>${dateObj(d.date).toLocaleDateString("en-GB", { weekday: "short" })}</small><b>${dateObj(d.date).getDate()}</b></span>
          <span class="up-t"><b>${esc(b.title.replace(/ \((maybe|set the time)\)$/, ""))}</b><small>${b.tentative ? "Time to confirm" : `${clock(toMin(b.start))}–${clock(toMin(b.end))}`}</small></span>
        </button>`).join("")}
      </section>` : ""}
      <section class="side-sec rings-sec">
        <h4>Progress</h4>
        <div class="rings">
          <svg viewBox="0 0 100 100" class="ring-svg" aria-hidden="true">${ring(42, now / A, "r-ar")}${ring(30, stPlan ? stDone / stPlan : 0, "r-st")}${ring(18, prAll ? prDone / prAll : 0, "r-pr")}</svg>
          <dl class="ring-key">
            <div class="k-ar"><dt>Arabic course</dt><dd>${now}<small> of ${A}</small></dd></div>
            <div class="k-st"><dt>Study this week</dt><dd>${fmtHours(stDone)}<small> of ${fmtHours(stPlan)}</small></dd></div>
            <div class="k-pr"><dt>Prayers this week</dt><dd>${prDone}<small> of ${prAll}</small></dd></div>
          </dl>
        </div>
        <p class="ring-note">${courseFinish()}</p>
      </section>`;
  }
  /** When the plan, kept to, reaches the last Arabic lesson. */
  let finishMemo = null;
  function courseFinish() {
    const key = `${state.savedAt}|${Object.keys(prayerStore).length}`;
    if (finishMemo && finishMemo.key === key) return finishMemo.text;
    const need = COURSE_LEN() - DONE_BEFORE();
    let iso = START, text = "";
    quiet = true;
    try {
      for (let i = 0; i < 400; i++, iso = addDays(iso, 1)) {
        const b = before(addDays(iso, 1));
        if (b.lessons >= need) { text = `At this pace the Arabic course ends ${iso === todayIso() ? "today" : `around ${shortDate(iso)}${iso.slice(0, 4) !== todayIso().slice(0, 4) ? ` ${iso.slice(0, 4)}` : ""}`}.`; break; }
      }
    } finally { quiet = false; }
    finishMemo = { key, text };
    return text;
  }

  function fillRings() {
    if (ringsIn) return;
    ringsIn = true;
    document.querySelectorAll("#progress .rf").forEach((c, i) =>
      anim(c, [{ strokeDasharray: `0 ${c.getAttribute("stroke-dasharray").split(" ")[1]}` }, { strokeDasharray: c.getAttribute("stroke-dasharray") }], { duration: 1200, delay: 150 + i * 120, fill: "backwards" }));
  }

  /* ── title ── */
  function renderTop() {
    const d = day();
    const dt = dateObj(d.date);
    if (ui.view === "week") {
      const a = weekStart(ui.date), b = addDays(a, 6);
      $("#day-title").innerHTML = `<b>${a <= todayIso() && todayIso() <= b ? "This week" : "Week"}</b> <span>${shortDate(a)} – ${shortDate(b)}</span>`;
      $("#day-sub").textContent = a <= DRAFT.to && b >= DRAFT.from ? "Half term" : "";
    } else {
      $("#day-title").innerHTML = `<b>${d.date === todayIso() ? "Today" : esc(d.weekday)}</b> <span>${d.date === todayIso() ? `${esc(d.weekday)} ` : ""}${dt.getDate()} ${MONTH(d.date)}${d.date.slice(0, 4) !== todayIso().slice(0, 4) ? ` ${d.date.slice(0, 4)}` : ""}</span>`;
      const tasks = dayTasks(d), done = tasks.filter((b) => b.done).length;
      $("#day-sub").textContent = dayKind(d.date) + (tasks.length ? ` · ${done} of ${tasks.length} done` : " · A free day");
    }
    document.querySelectorAll(".seg button").forEach((b) => b.setAttribute("aria-selected", b.dataset.view === ui.view));
    placeThumb();
    $("#prev").disabled = ui.view === "day" ? ui.date <= START : weekStart(ui.date) <= START;
    $("#next").disabled = false;
    $("#prev").setAttribute("aria-label", ui.view === "week" ? "Previous week" : "Previous day");
    $("#next").setAttribute("aria-label", ui.view === "week" ? "Next week" : "Next day");
    $("#today").disabled = todayIso() < START;
    document.title = ui.view === "week" ? "Productivity" : `${d.weekday} ${dt.getDate()} · Productivity`;
  }

  /* ── day view ── */
  function layoutColumns(blocks) {
    // Only a fallback: settle() keeps blocks apart, but an imported copy may not be.
    const sorted = blocks.slice().sort((a, b) => toMin(a.start) - toMin(b.start) || dur(b) - dur(a));
    const out = new Map();
    let cluster = [], clusterEnd = -1;
    const flush = () => {
      const cols = [];
      for (const b of cluster) {
        let c = cols.findIndex((end) => end <= toMin(b.start));
        if (c < 0) { c = cols.length; cols.push(0); }
        cols[c] = toMin(b.end);
        out.set(b.id, { col: c });
      }
      for (const b of cluster) out.get(b.id).cols = cols.length;
      cluster = []; clusterEnd = -1;
    };
    for (const b of sorted) {
      if (cluster.length && toMin(b.start) >= clusterEnd) flush();
      cluster.push(b); clusterEnd = Math.max(clusterEnd, toMin(b.end));
    }
    if (cluster.length) flush();
    return out;
  }

  const TICK = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
  const ARROW = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>`;

  function blockHTML(b, d, pos, hidden) {
    const segs = pieces(b, d, hidden);
    const title = displayTitle(b, d);
    const meta = `${clock(toMin(b.start))} – ${clock(toMin(b.end))}`;
    const w = 100 / pos.cols;
    const base = ["blk", b.done && "done", b.tentative && "tentative", isWall(b) && b.locked && "locked", b.cat === "routine" && "quiet"].filter(Boolean);
    const open = b.cat === "tafsir"
      ? `<button type="button" class="blk-open" data-open="${b.id}">${b.surah ? `${esc(surahName(b.surah))} ${ARROW}` : "Choose sūrah"}</button>` : "";
    return segs.map(([s, e], k) => {
      const top = (s - T0) * PPM, h = Math.max(14, (e - s) * PPM - 2);
      const first = k === 0, lastSeg = k === segs.length - 1;
      const short = h < 40;
      const cls = [...base, short && "short", !first && "cont"].filter(Boolean).join(" ");
      const body = first
        ? `<button type="button" class="tick" aria-label="${b.done ? "Mark not done" : "Mark done"}">${TICK}</button>
           <div class="blk-t">${esc(title)}${b.tentative ? ` <span class="maybe">maybe</span>` : ""}</div>
           <div class="blk-m">${meta}</div>
           ${open}`
        : `<div class="blk-t">${esc(title)}</div>`;
      return `<div class="${cls}" data-id="${b.id}" data-seg="${k}" data-s="${s}" data-e="${e}" data-cat="${esc(b.cat)}" aria-selected="${ui.sel === b.id}" ${first ? 'tabindex="0"' : ""}
        style="top:${top}px;height:${h}px;left:calc(${w * pos.col}% + ${pos.col ? 3 : 0}px);width:calc(${w}% - ${pos.cols > 1 ? 3 : 0}px)">
        ${body}
        ${lastSeg && !(isWall(b) && b.locked) ? `<span class="grip" aria-hidden="true"></span>` : ""}
      </div>`;
    }).join("");
  }

  function renderDay() {
    const d = day();
    const H = (T1 - T0) * PPM;
    const hidden = absorbed(d);
    let html = `<div class="chrome-space"></div><div class="timeline" style="height:${H}px">`;
    for (let t = T0; t <= T1; t += 60) html += `<div class="hour" style="top:${(t - T0) * PPM}px"><span>${t === 720 ? "Noon" : clock(t)}</span></div>`;
    html += `<div class="lane">`;
    const boxes = d.blocks.filter((b) => !isBand(b));
    const pos = layoutColumns(boxes);
    for (const b of boxes) html += blockHTML(b, d, pos.get(b.id), hidden);
    for (const b of d.blocks.filter((x) => isBand(x) && !hidden.has(x.id))) {
      const top = (toMin(b.start) - T0) * PPM, h = Math.max(13, dur(b) * PPM - 2);
      html += `<div class="band${b.done ? " done" : ""}" data-id="${b.id}" aria-selected="${ui.sel === b.id}" tabindex="0" style="top:${top}px;height:${h}px" title="${esc(b.note || "")}">
        <span class="band-tag"><i></i><b>${esc(b.title)}</b><span class="band-t">${clock(toMin(b.start))}</span></span></div>`;
    }
    html += `</div>`;
    if (d.date === todayIso()) {
      const m = nowMin();
      if (m >= T0 && m <= T1) html += `<div class="now" id="now-line" style="top:${(nowExact() - T0) * PPM}px"><span>${clock(m)}</span></div>`;
    }
    html += `</div>`;
    paintView(html);
  }

  /* ── week view ── */
  function renderWeek() {
    const w0 = weekStart(ui.date);
    const dates = Array.from({ length: 7 }, (_, i) => addDays(w0, i));
    const H = (T1 - T0) * PPM_W;
    let html = `<div class="chrome-space"></div><div class="week"><div class="wh-gap"></div>`;
    dates.forEach((iso) => {
      html += `<button type="button" class="wh" data-date="${iso}" data-sel="${iso === ui.date}" data-today="${iso === todayIso()}" ${iso < START ? "disabled" : ""}><span>${dateObj(iso).toLocaleDateString("en-GB", { weekday: "short" })}</span><b>${dateObj(iso).getDate()}</b></button>`;
    });
    html += `<div class="wgut" style="height:${H}px">`;
    for (let t = T0 + 60; t < T1; t += 120) html += `<span style="top:${(t - T0) * PPM_W}px">${clock(t)}</span>`;
    html += `</div>`;
    dates.forEach((iso) => {
      html += `<div class="wcol" style="height:${H + 8}px">`;
      if (iso < START) { html += `</div>`; return; }
      const d = getDay(iso);
      const hidden = absorbed(d);
      if (d.date === todayIso() && nowMin() >= T0 && nowMin() <= T1) html += `<div class="wnow" id="wnow" style="top:${(nowExact() - T0) * PPM_W}px"></div>`;
      for (let t = T0 + 60; t < T1; t += 120) html += `<div class="wline" style="top:${(t - T0) * PPM_W}px"></div>`;
      for (const b of d.blocks) {
        if (isBand(b)) {
          if (!hidden.has(b.id)) html += `<div class="wband" style="top:${(toMin(b.start) - T0) * PPM_W}px;height:${Math.max(3, dur(b) * PPM_W - 1)}px" title="${esc(b.title)} ${b.start}"></div>`;
          continue;
        }
        const ps = pieces(b, d, hidden);
        const tallest = ps.reduce((best, [s, e], k) => (e - s > ps[best][1] - ps[best][0] ? k : best), 0);
        const label = b.cat === "tafsir" && b.surah ? `Tafsīr · ${surahName(b.surah)}` : displayTitle(b, d);
        for (const [k, [s, e]] of ps.entries()) {
          const top = (s - T0) * PPM_W, h = Math.max(8, (e - s) * PPM_W - 2);
          html += `<button type="button" class="wblk${b.done ? " done" : ""}${b.tentative ? " tentative" : ""}${b.cat === "routine" ? " quiet" : ""}" data-id="${b.id}" data-cat="${esc(b.cat)}" style="top:${top}px;height:${h}px" title="${esc(label)} · ${clock(toMin(b.start))}–${clock(toMin(b.end))}">${h >= 11 && k === tallest ? esc(label) : ""}</button>`;
        }
      }
      html += `</div>`;
    });
    html += `</div>`;
    paintView(html);
  }

  /* ── inspector: grouped, the way Settings is ── */
  const CLOSE = `<button type="button" class="icon-btn" data-act="close" aria-label="Close details"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
  function renderInspector() {
    paintInspector();
    const key = ui.sel ? `b:${ui.sel}` : `g:${ui.date}`;
    if (shown.ins !== null && shown.ins !== key) {
      anim($("#inspector .ins-body"), [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 300 });
      anim($("#inspector .ins-bar"), [{ opacity: 0 }, { opacity: 1 }], { duration: 240 });
    }
    shown.ins = key;
  }
  function paintInspector() {
    const el = $("#inspector");
    const hit = ui.sel && findBlock(ui.sel);
    el.classList.toggle("is-open", !!hit);
    if (!hit) { el.innerHTML = glanceHTML(day()); return; }
    const { b, d } = hit;
    const s = toMin(b.start), e = toMin(b.end);
    const inside = prayersInside(b, d);
    const band = isBand(b);
    const ws = WEB ? BOOT.workspaces || [] : [];
    const track = b.track && TRACKS[b.track];
    el.innerHTML = `
      <header class="ins-bar"><span class="kind" data-cat="${esc(b.cat)}"><i></i>${track ? esc(track.name) : CAT_LABEL[b.cat] || "Other"}${b.tentative ? " · to confirm" : ""}</span>${CLOSE}</header>
      <div class="ins-body">
        <div class="ins-head">
          <input class="ins-name" type="text" data-f="title" value="${esc(displayTitle(b, d))}" aria-label="Title">
          <p class="ins-when">${esc(d.weekday)} ${shortDate(d.date)}, ${clock(s)} to ${clock(e)}</p>
          ${inside.length && isWall(b) ? `<p class="ins-aside">${inside.map((p) => `${esc(p.title)} ${clock(toMin(p.start))}`).join(", ")} ${b.praysThere ? "is prayed there" : "falls during this"}.</p>` : ""}
          ${b.note && !band ? `<p class="ins-aside">${esc(b.note)}</p>` : ""}
        </div>
        ${track ? trackHTML(b, d) : ""}
        ${b.cat === "tafsir" ? `
        <div class="group">
          <label class="row"><span>Sūrah</span><select data-f="surah"><option value="">Choose</option>${SURAHS.map(([n], i) => `<option value="${i + 1}"${b.surah === i + 1 ? " selected" : ""}>${i + 1}. ${esc(n)}</option>`).join("")}</select></label>
          ${b.surah ? `<div class="row row-ar"><span class="surah-ar" lang="ar" dir="rtl">${esc(SURAHS[b.surah - 1][1])}</span></div>` : ""}
          ${ws.length > 1 ? `<label class="row"><span>Workspace</span><select data-f="ws">${ws.map((w) => `<option value="${esc(w.id)}"${state.tafsirWorkspace === w.id ? " selected" : ""}>${esc(w.name)}</option>`).join("")}</select></label>` : ""}
        </div>
        <button type="button" class="btn-fill" data-act="open" ${b.surah ? "" : "disabled"}>Open in TafsirLab ${ARROW}</button>
        ${WEB && !BOOT.signedIn ? `<p class="foot">You’ll be asked to sign in to TafsirLab first.</p>` : ""}` : ""}
        <div class="group">
          <label class="row"><span>Starts</span><input type="time" step="300" data-f="start" value="${clock(s)}"></label>
          <label class="row"><span>Ends</span><input type="time" step="300" data-f="end" value="${clock(e)}"></label>
          <div class="row"><span>Length</span><span class="row-v">${fmtDur(e - s)}${inside.length && STUDY.includes(b.cat) && !isWall(b) ? `, ${fmtDur(workMinutes(b, d))} of work` : ""}</span></div>
        </div>
        <div class="group">
          <div class="row"><span>${band ? "Prayed" : "Done"}</span><button type="button" class="switch" role="switch" aria-checked="${!!b.done}" data-act="done" aria-label="${band ? "Prayed" : "Done"}"></button></div>
          ${band || track ? "" : `<label class="row"><span>Kind</span><span class="kind-pick" data-cat="${esc(b.cat)}"><i></i><select data-f="cat">${CATS.filter(([c]) => c !== "prayer" && c !== "islamic").map(([c, l]) => `<option value="${c}"${b.cat === c ? " selected" : ""}>${l}</option>`).join("")}</select></span></label>`}
          <label class="row"><span>Day</span><input type="date" data-f="date" min="${START}" value="${d.date}"></label>
        </div>
        ${band ? `<p class="foot">Prayer times are set for the day. Change the time here if you pray it later.</p>` : ""}
        <h4 class="group-label">Notes</h4>
        <div class="group"><textarea data-f="note" rows="3" placeholder="Anything to remember">${esc(b.note || "")}</textarea></div>
        <div class="group">
          ${b.tentative ? `<button type="button" class="row row-btn" data-act="confirm">Confirm it</button>` : ""}
          ${band ? "" : `<button type="button" class="row row-btn" data-act="dup">Duplicate</button>`}
          <button type="button" class="row row-btn danger" data-act="delete">Delete</button>
        </div>
      </div>`;
  }
  /** Where a programme session sits: the course, and how far through it. */
  function trackHTML(b, d) {
    const t = TRACKS[b.track];
    const mins = before(d.date)[b.track] + d.blocks.filter((x) => x.track === b.track && toMin(x.start) < toMin(b.start)).reduce((a, x) => a + dur(x), 0);
    let acc = 0, row = null;
    for (const [name, len] of t.courses) { if (mins < acc + len) { row = { name, len, at: mins - acc }; break; } acc += len; }
    if (!row) return `<div class="group"><div class="row"><span>Course</span><span class="row-v">Programme complete</span></div></div>`;
    const p = Math.min(1, (row.at + dur(b)) / row.len);
    return `<div class="group">
      <div class="row"><span>Course</span><span class="row-v">${esc(row.name)}</span></div>
      <div class="row row-progress"><span class="nc-bar"><i style="width:${(p * 100).toFixed(1)}%"></i></span><span class="row-v">${fmtDur(Math.min(row.len, row.at + dur(b)))} of ${fmtDur(row.len)}</span></div>
    </div>`;
  }

  function glanceHTML(d) {
    const prayers = d.blocks.filter((b) => b.cat === "prayer").sort((a, b) => toMin(a.start) - toMin(b.start));
    const totals = {};
    for (const b of d.blocks) if (TRACKED.includes(b.cat)) totals[b.cat] = (totals[b.cat] || 0) + workMinutes(b, d);
    const tasks = dayTasks(d), done = tasks.filter((b) => b.done).length;
    const study = STUDY.reduce((a, c) => a + (totals[c] || 0), 0);
    const kinds = TRACKED.filter((c) => totals[c]);
    const ns = d.date === todayIso() ? nowState() : null;
    const wd = dateObj(d.date).getDay();
    const canSchool = d.generated && wd >= 1 && wd <= 5 && d.date >= TERM_FROM;
    return `
      <header class="ins-bar"><span class="ins-title">${d.date === todayIso() ? "Today" : esc(d.weekday)}</span><span class="ins-meta">${tasks.length ? `${done} of ${tasks.length} done` : "Free"}</span></header>
      <div class="ins-body">
        ${ns ? nowCardHTML(ns) : ""}
        ${prayers.length ? `<h4 class="group-label">Prayers</h4>
        <div class="group">${prayers.map((p) => `<button type="button" class="row prayer-row${p.done ? " done" : ""}" data-pray="${p.id}">
          <span class="pr-box">${TICK}</span><span class="pr-name">${esc(p.title)}</span><span class="row-v">${clock(toMin(p.start))}</span></button>`).join("")}</div>` : ""}
        <h4 class="group-label">Plan</h4>
        <div class="group">${kinds.length ? kinds.map((c) => `<div class="row"><span class="h-name" data-cat="${c}"><i class="h-dot"></i>${CAT_LABEL[c]}</span><span class="row-v">${fmtDur(totals[c])}</span></div>`).join("")
          + (study ? `<div class="row row-total"><span>In all</span><span class="row-v">${fmtDur(study)}</span></div>` : "")
          : `<div class="row"><span class="muted">Nothing planned</span></div>`}</div>
        ${canSchool ? `<div class="group"><div class="row"><span>School day</span><button type="button" class="switch" role="switch" aria-checked="${isSchoolDay(d.date)}" data-act="school" aria-label="School day"></button></div></div>
        <p class="foot">Term dates are a best guess. Switch this off for an inset day or a holiday, and the day re-plans itself.</p>` : ""}
        <h4 class="group-label">Notes</h4>
        <div class="group"><textarea data-daynote rows="4" placeholder="Homework due, what to bring, how it went">${esc(d.note || "")}</textarea></div>
      </div>`;
  }

  /* ── where you are in the day ── */
  function nowState() {
    if (todayIso() < START) return null;
    const d = getDay(todayIso());
    const m = nowExact();
    const items = d.blocks.filter((b) => !isBand(b) && b.title !== "Sleep").sort((a, b) => toMin(a.start) - toMin(b.start));
    const cur = items.find((b) => toMin(b.start) <= m && m < toMin(b.end));
    const next = items.find((b) => toMin(b.start) > m);
    const prayer = d.blocks.find((b) => isBand(b) && toMin(b.start) <= m && m < toMin(b.end));
    return { d, m, cur: prayer || cur, next };
  }
  function nowCardHTML({ d, m, cur, next }) {
    const left = cur ? Math.max(1, Math.ceil(toMin(cur.end) - m)) : 0;
    const p = cur ? (m - toMin(cur.start)) / dur(cur) : 0;
    return `<button type="button" class="now-card" data-act="to-now"${cur ? ` data-cat="${esc(cur.cat)}"` : ""}>
      <span class="nc-top"><span class="nc-label">Now</span><span class="nc-time">${clock(Math.floor(m))}</span></span>
      <span class="nc-title">${cur ? esc(displayTitle(cur, d)) : "Free time"}</span>
      ${cur ? `<span class="nc-bar"><i style="width:${(p * 100).toFixed(1)}%"></i></span><span class="nc-left">${fmtDur(left)} left, until ${clock(toMin(cur.end))}</span>` : ""}
      ${next ? `<span class="nc-next">Next: <b>${esc(displayTitle(next, d))}</b> at ${clock(toMin(next.start))}</span>` : ""}
    </button>`;
  }
  /** Move the line, fill the block you're in, and keep the Now card current, without redrawing the day. */
  function tickNow() {
    if (drag) return;
    const m = nowExact(), isToday = ui.date === todayIso();
    const line = document.getElementById("now-line");
    if (line) { line.style.top = `${(m - T0) * PPM}px`; line.querySelector("span").textContent = clock(Math.floor(m)); }
    const w = document.getElementById("wnow");
    if (w) w.style.top = `${(m - T0) * PPM_W}px`;
    view.querySelectorAll(".blk[data-s]").forEach((el) => {
      const s = +el.dataset.s, e = +el.dataset.e;
      const on = isToday && s <= m && m < e;
      el.classList.toggle("is-now", on);
      el.classList.toggle("is-past", isToday && e <= m);
      if (on) el.style.setProperty("--p", ((m - s) / (e - s)).toFixed(4)); else el.style.removeProperty("--p");
    });
    const ins = $("#inspector");
    if (!ui.sel && !ins.contains(document.activeElement)) {
      const card = ins.querySelector(".now-card"), ns = isToday ? nowState() : null;
      if (card && ns) card.outerHTML = nowCardHTML(ns);
    }
  }

  const seg = $(".seg"), thumb = document.createElement("span");
  thumb.className = "seg-thumb"; seg.prepend(thumb);
  function placeThumb() {
    const b = seg.querySelector('[aria-selected="true"]'); if (!b) return;
    thumb.style.width = `${b.offsetWidth}px`;
    thumb.style.transform = `translateX(${b.offsetLeft - 2}px)`;
  }
  requestAnimationFrame(() => requestAnimationFrame(() => seg.classList.add("ready")));
  window.addEventListener("resize", placeThumb);

  function render() {
    renderSide();
    renderTop();
    if (ui.view === "week") renderWeek(); else renderDay();
    renderInspector();
    tickNow();
    fillRings();
  }

  function scrollToStart(smooth = false) {
    if (ui.view !== "day") { $("#view").scrollTop = 0; return; }
    const d = day();
    let m;
    if (d.date === todayIso()) m = nowMin() - 90;
    else { const wake = d.blocks.find((b) => /^Wake/.test(b.title)); m = (wake ? toMin(wake.start) : 9 * 60) - 30; }
    const top = Math.max(0, (m - T0) * PPM);
    if (smooth) $("#view").scrollTo({ top, behavior: "smooth" }); else $("#view").scrollTop = top;
    main.classList.toggle("scrolled", top > 4);
  }

  function goDate(iso, keepSel) {
    ui.date = iso < START ? START : iso;
    ui.month = ui.date.slice(0, 7);
    if (!keepSel) ui.sel = null;
    saveUi(); render(); scrollToStart();
  }

  /* ── mutations ── */
  function mutate(fn) { checkpoint(); const r = fn(); save(); render(); return r; }

  function addBlock(start, len = 60) {
    const d = day();
    start = Math.max(T0, Math.min(T1 - len, Math.round(start / 15) * 15));
    const b = { id: newId(), title: "New block", cat: "other", start: raw(start), end: raw(start + len), done: false };
    const n = mutate(() => { d.blocks.push(b); ui.sel = b.id; return settle(d, b.id); });
    madeRoom(n);
    const input = $('#inspector [data-f="title"]');
    if (input) { input.focus({ preventScroll: true }); input.select(); }
  }

  function deleteBlock(id) {
    const hit = findBlock(id); if (!hit) return;
    const name = displayTitle(hit.b, hit.d);
    mutate(() => { hit.d.blocks = hit.d.blocks.filter((x) => x.id !== id); ui.sel = null; });
    toast(`Deleted “${name}”`, { label: "Undo", run: () => restore(undo, redo) });
  }

  /* ── events: top bar ── */
  document.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => {
    ui.view = b.dataset.view; ui.sel = null; saveUi(); render(); scrollToStart();
  }));
  $("#prev").addEventListener("click", () => goDate(addDays(ui.view === "week" ? weekStart(ui.date) : ui.date, ui.view === "week" ? -7 : -1)));
  $("#next").addEventListener("click", () => goDate(addDays(ui.view === "week" ? weekStart(ui.date) : ui.date, ui.view === "week" ? 7 : 1)));
  $("#today").addEventListener("click", () => {
    const t = todayIso(); if (t < START) return;
    if (ui.view === "day" && ui.date === t) { scrollToStart(true); return; }
    ui.view = "day"; goDate(t);
  });
  $("#add").addEventListener("click", () => {
    if (ui.view === "week") { ui.view = "day"; render(); }
    const d = day();
    const sel = ui.sel && d.blocks.find((x) => x.id === ui.sel);
    let at;
    if (sel) at = toMin(sel.end);
    else {
      // the first free hour after waking
      const busy = d.blocks.filter((b) => !isBand(b) && b.title !== "Sleep").map((b) => [toMin(b.start), toMin(b.end)]).sort((a, b) => a[0] - b[0]);
      const wake = d.blocks.find((b) => /^Wake/.test(b.title));
      let cur = wake ? toMin(wake.end) : 9 * 60;
      for (const [s, e] of busy) { if (s - cur >= 60) break; cur = Math.max(cur, e); }
      at = cur;
    }
    addBlock(at);
    const nb = day().blocks.find((x) => x.id === ui.sel);
    if (nb) { const top = (toMin(nb.start) - T0) * PPM, v = $("#view"); if (top < v.scrollTop || top > v.scrollTop + v.clientHeight - 100) v.scrollTop = top - 120; }
  });

  const menu = $("#menu"), menuBtn = $("#menu-btn");
  menuBtn.addEventListener("click", (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; menuBtn.setAttribute("aria-expanded", String(!menu.hidden)); });
  document.addEventListener("click", (e) => { if (!menu.hidden && !e.target.closest(".menu-wrap")) { menu.hidden = true; menuBtn.setAttribute("aria-expanded", "false"); } });
  menu.addEventListener("click", async (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act; if (!act) return;
    menu.hidden = true; menuBtn.setAttribute("aria-expanded", "false");
    if (act === "print") { if (ui.view !== "day") { ui.view = "day"; render(); } setTimeout(() => window.print(), 50); }
    if (act === "export") {
      const blob = new Blob([JSON.stringify(state, null, 1)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `productivity-${todayIso()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast("Saved a copy to your Downloads");
    }
    if (act === "import") $("#import-file").click();
    if (act === "reset" && confirm("Go back to the drafted timetable? Every change and tick you’ve made will be cleared.")) {
      mutate(() => { state = fresh(); genCache.clear(); ui.sel = null; });
      toast("Back to the draft", { label: "Undo", run: () => restore(undo, redo) });
    }
    if (act === "lock" && WEB) {
      if (pending) await push();
      await fetch("/api/productivity/unlock", { method: "DELETE" }).catch(() => null);
      try { localStorage.removeItem(KEY); } catch {}
      location.reload();
    }
  });
  $("#import-file").addEventListener("change", async (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    try {
      const s = JSON.parse(await f.text());
      if (!Array.isArray(s.days) || !s.days.every((d) => d.date && Array.isArray(d.blocks))) throw new Error("not a timetable");
      s.draftFrom = DRAFT_KEY;
      mutate(() => { state = s; genCache.clear(); ui.sel = null; });
      toast("Opened the copy", { label: "Undo", run: () => restore(undo, redo) });
    } catch {
      toast("That file isn’t a Productivity timetable. Choose a .json saved from here.");
    }
  });

  /* ── events: sidebar ── */
  $("#days").addEventListener("click", (e) => {
    const nav = e.target.closest("[data-cal]");
    if (nav) {
      const d = dateObj(`${ui.month}-01`); d.setMonth(d.getMonth() + Number(nav.dataset.cal));
      ui.month = isoOf(d).slice(0, 7); renderSide();
      anim($("#days .cal-grid"), [{ opacity: 0, transform: `translateX(${Number(nav.dataset.cal) * 14}px)` }, { opacity: 1, transform: "none" }], { duration: 300 });
      return;
    }
    const b = e.target.closest("[data-date]"); if (b) goDate(b.dataset.date);
  });
  $("#progress").addEventListener("click", (e) => {
    const g = e.target.closest("[data-goto]"); if (!g) return;
    const hit = findBlock(g.dataset.goto); if (!hit) return;
    ui.view = "day"; ui.sel = hit.b.id; goDate(hit.d.date, true);
  });

  /* ── events: the view ── */
  const view = $("#view");
  const main = $("#main");
  view.addEventListener("scroll", () => main.classList.toggle("scrolled", view.scrollTop > 4), { passive: true });
  let drag = null, hold = 0;

  view.addEventListener("click", (e) => {
    const open = e.target.closest("[data-open]");
    if (open) {
      const hit = findBlock(open.dataset.open);
      if (hit.b.surah) openSurah(hit.b);
      else { ui.sel = hit.b.id; render(); $('#inspector [data-f="surah"]')?.focus({ preventScroll: true }); }
      return;
    }
    const tick = e.target.closest(".tick");
    if (tick) {
      const hit = findBlock(tick.closest(".blk").dataset.id);
      mutate(() => { hit.b.done = !hit.b.done; });
      if (hit.b.done) pop(view.querySelector(`.blk[data-id="${hit.b.id}"][data-seg="0"] .tick`));
      return;
    }
    const wh = e.target.closest(".wh");
    if (wh) { ui.view = "day"; goDate(wh.dataset.date); return; }
    const wb = e.target.closest(".wblk");
    if (wb) { const hit = findBlock(wb.dataset.id); ui.view = "day"; ui.sel = hit.b.id; goDate(hit.d.date, true); return; }
    const band = e.target.closest(".band");
    if (band) { ui.sel = band.dataset.id; render(); return; }
    if (!e.target.closest(".blk") && ui.sel) { ui.sel = null; render(); }
  });

  view.addEventListener("dblclick", (e) => {
    if (ui.view !== "day" || e.target.closest(".blk, .band")) return;
    const tl = view.querySelector(".timeline"); if (!tl) return;
    addBlock(T0 + (e.clientY - tl.getBoundingClientRect().top) / PPM - 30);
  });

  view.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || ui.view !== "day") return;
    const el = e.target.closest(".blk");
    if (!el || e.target.closest(".tick, .blk-open")) return;
    const hit = findBlock(el.dataset.id); if (!hit) return;
    drag = {
      id: hit.b.id, el, y0: e.clientY, s0: toMin(hit.b.start), e0: toMin(hit.b.end),
      resize: !!e.target.closest(".grip"), moved: false, armed: e.pointerType !== "touch",
      fixed: isWall(hit.b) && !!hit.b.locked, pid: e.pointerId,
    };
    // On a phone a block moves only after a short hold, so a swipe still scrolls the day.
    if (!drag.armed) { clearTimeout(hold); hold = setTimeout(() => { if (drag && !drag.moved) { drag.armed = true; el.classList.add("lifted"); } }, 320); }
    else e.preventDefault();
  });
  view.addEventListener("touchmove", (e) => { if (drag && drag.armed) e.preventDefault(); }, { passive: false });
  window.addEventListener("pointermove", (e) => {
    if (!drag || drag.fixed) return;
    const dy = e.clientY - drag.y0;
    if (!drag.armed) { if (Math.abs(dy) > 8) { clearTimeout(hold); drag = null; } return; }
    if (!drag.moved) {
      if (Math.abs(dy) < 4) return;
      drag.moved = true;
      // While it moves it is one piece again; the prayer gaps return when it lands.
      view.querySelectorAll(`.blk[data-id="${drag.id}"]`).forEach((x) => { if (x !== drag.el) x.style.visibility = "hidden"; });
      drag.el.classList.add("dragging");
      try { drag.el.setPointerCapture(drag.pid); } catch {}
    }
    const grid = (x) => Math.round(x / SNAP) * SNAP;
    const d = dy / PPM;
    let s = drag.s0, en = drag.e0;
    if (drag.resize) en = Math.max(s + 10, Math.min(T1, grid(drag.e0 + d)));
    else { const L = drag.e0 - drag.s0; s = Math.max(T0, Math.min(T1 - L, grid(drag.s0 + d))); en = s + L; }
    drag.s = s; drag.e = en;
    drag.el.style.top = (s - T0) * PPM + "px";
    drag.el.style.height = Math.max(14, (en - s) * PPM - 2) + "px";
    const m = drag.el.querySelector(".blk-m");
    if (m) m.textContent = `${clock(s)} – ${clock(en)} · ${fmtDur(en - s)}`;
  });
  const endDrag = () => {
    clearTimeout(hold);
    if (!drag) return;
    const dr = drag; drag = null;
    if (!dr.moved) { ui.sel = dr.id; render(); return; }
    const hit = findBlock(dr.id);
    if (dr.s === dr.s0 && dr.e === dr.e0) { render(); return; }
    const n = mutate(() => { hit.b.start = raw(dr.s); hit.b.end = raw(dr.e); ui.sel = dr.id; return settle(hit.d, dr.id); });
    madeRoom(n);
  };
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", () => { clearTimeout(hold); if (drag && drag.moved) render(); drag = null; });

  /* ── events: inspector ── */
  const ins = $("#inspector");
  let editSnap = false;
  ins.addEventListener("focusin", (e) => { if (e.target.matches("input, textarea, select")) editSnap = false; });
  const snapOnce = () => { if (!editSnap) { checkpoint(); editSnap = true; } };

  ins.addEventListener("input", (e) => {
    const t = e.target;
    if (t.matches("[data-daynote]")) { snapOnce(); day().note = t.value; save(); return; }
    const hit = ui.sel && findBlock(ui.sel); if (!hit) return;
    if (t.dataset.f === "title" || t.dataset.f === "note") {
      snapOnce();
      hit.b[t.dataset.f] = t.value;
      save();
      if (ui.view === "week") renderWeek(); else renderDay();
      renderSide();
    }
  });
  ins.addEventListener("change", (e) => {
    const t = e.target, hit = ui.sel && findBlock(ui.sel); if (!hit) return;
    const { b, d } = hit;
    if (t.dataset.f === "surah") {
      const n = Number(t.value) || 0;
      mutate(() => { if (n) b.surah = n; else delete b.surah; });
      // Ask once, while you're here, so the reminder can reach you in another window.
      if (n && "Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    }
    if (t.dataset.f === "ws") mutate(() => { state.tafsirWorkspace = t.value; });
    if (t.dataset.f === "cat") { const n = mutate(() => { b.cat = t.value; return settle(d, b.id); }); madeRoom(n); }
    if (t.dataset.f === "start" || t.dataset.f === "end") {
      if (!t.value) return;
      let m = toMin(t.value); if (m < T0) m += 1440;      // after midnight
      const L = dur(b);
      const n = mutate(() => {
        if (t.dataset.f === "start") { const s = Math.max(T0, Math.min(m, T1 - L)); b.start = raw(s); b.end = raw(s + L); }
        else b.end = raw(Math.max(toMin(b.start) + 5, Math.min(T1, m)));
        return isBand(b) ? (sortDay(d), 0) : settle(d, b.id);
      });
      madeRoom(n);
    }
    if (t.dataset.f === "date") {
      const to = t.value; if (!to || to === d.date || to < START) return;
      const target = getDay(to);
      const n = mutate(() => {
        d.blocks = d.blocks.filter((x) => x !== b);
        target.blocks.push(b);
        ui.date = to; ui.month = to.slice(0, 7);
        return isBand(b) ? (sortDay(target), 0) : settle(target, b.id);
      });
      scrollToStart();
      toast(`Moved to ${weekdayLong(to)} ${dateObj(to).getDate()}${n ? `; ${n} block${n === 1 ? "" : "s"} there moved later` : ""}`, { label: "Undo", run: () => restore(undo, redo) });
    }
  });
  ins.addEventListener("click", (e) => {
    const pray = e.target.closest("[data-pray]");
    if (pray) {
      const hit = findBlock(pray.dataset.pray);
      mutate(() => { hit.b.done = !hit.b.done; });
      if (hit.b.done) pop($(`#inspector [data-pray="${hit.b.id}"] .pr-box`));
      return;
    }
    const hit = ui.sel && findBlock(ui.sel);
    const act = e.target.closest("[data-act]")?.dataset.act; if (!act) return;
    if (act === "close") { ui.sel = null; render(); return; }
    if (act === "to-now") { $("#today").click(); return; }
    if (act === "school") {
      const iso = ui.date, on = !isSchoolDay(iso);
      mutate(() => { (state.school ||= {})[iso] = on; genCache.clear(); });
      slideSwitch($('#inspector .switch[data-act="school"]'), on);
      toast(on ? "Back to a school day" : "No school: the day re-planned itself", { label: "Undo", run: () => restore(undo, redo) });
      return;
    }
    if (!hit) return;
    const { b, d } = hit;
    if (act === "open") openSurah(b);
    if (act === "done") { mutate(() => { b.done = !b.done; }); slideSwitch($('#inspector .switch[data-act="done"]'), b.done); }
    if (act === "confirm") mutate(() => { delete b.tentative; b.title = b.title.replace(/ \((maybe|set the time)\)$/, ""); });
    if (act === "delete") deleteBlock(b.id);
    if (act === "dup") {
      const c = { ...clone(b), id: newId(), done: false };
      const L = dur(b); const s = Math.min(T1 - L, toMin(b.end));
      c.start = raw(s); c.end = raw(s + L);
      const n = mutate(() => { d.blocks.push(c); ui.sel = c.id; return settle(d, c.id); });
      madeRoom(n);
    }
  });

  /* ── keyboard ── */
  document.addEventListener("keydown", (e) => {
    const target = e.target instanceof Element ? e.target : document.body;
    const typing = target.matches("input, textarea, select");
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "z" && !typing) {
      e.preventDefault();
      if (e.shiftKey) restore(redo, undo); else restore(undo, redo);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y" && !typing) { e.preventDefault(); restore(redo, undo); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (typing) { if (e.key === "Escape") target.blur(); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); $("#prev").click(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); $("#next").click(); }
    else if (e.key === "Escape") { if (!menu.hidden) menu.hidden = true; else if (ui.sel) { ui.sel = null; render(); } }
    else if ((e.key === "Delete" || e.key === "Backspace") && ui.sel) { e.preventDefault(); deleteBlock(ui.sel); }
    else if (e.key === "Enter" && target.closest(".blk, .band")) { ui.sel = target.closest(".blk, .band").dataset.id; render(); }
    else if (e.key.toLowerCase() === "n") { e.preventDefault(); $("#add").click(); }
    else if (e.key.toLowerCase() === "t") $("#today").click();
    else if (e.key.toLowerCase() === "w") { ui.view = ui.view === "week" ? "day" : "week"; ui.sel = null; saveUi(); render(); scrollToStart(); }
  });

  /* ── when a tafsīr block begins ── */
  const reminded = new Set();
  function remind() {
    if (todayIso() < START) return;
    const d = getDay(todayIso());
    const m = nowMin();
    for (const b of d.blocks) {
      if (b.cat !== "tafsir" || b.done || reminded.has(b.id)) continue;
      const s = toMin(b.start);
      if (m < s || m >= s + 5) continue;
      reminded.add(b.id);
      if (b.surah) {
        toast(`Time for tafsīr: ${surahName(b.surah)}`, { label: "Open in TafsirLab", run: () => openSurah(b) }, 120000);
        if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
          const n = new Notification("Time for tafsīr", { body: `${surahName(b.surah)}. Open it in TafsirLab.`, icon: SITE + "/productivity-app/icon.png" });
          n.onclick = () => { window.focus(); openSurah(b); n.close(); };
        }
      } else {
        toast("Time for tafsīr. Which sūrah?", { label: "Choose", run: () => { ui.view = "day"; ui.sel = b.id; goDate(d.date, true); $('#inspector [data-f="surah"]')?.focus({ preventScroll: true }); } }, 120000);
      }
    }
  }

  /* Keep the now-line honest, roll over at midnight, and watch the clock. */
  let lastDate = todayIso();
  setInterval(() => {
    if (todayIso() !== lastDate) { lastDate = todayIso(); render(); return; }
    tickNow();
    remind();
  }, 15_000);

  render();
  scrollToStart();
  remind();
})();
