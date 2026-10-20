/* Productivity · Tafsir Lab
 *
 * A private timetable. The plan as drafted arrives with the page (or from
 * draft.js in the desktop copy); everything you change is saved on top of it,
 * to this browser and, on tafsir-lab.com, to your account's copy so every
 * device shows the same plan. "Reset to the draft" starts again.
 *
 * Blocks are minutes after midnight; a day runs 05:00 to 01:00, so anything
 * after midnight is stored past 24:00 (Sleep at 24:30).
 *
 * The timetable never shows two things in the same place. A prayer that falls
 * inside a study block splits it, the prayer sitting in the gap; one inside a
 * fixed event (mosque, a trip) is written into that event instead. Moving or
 * growing a block nudges whatever it lands on later in the day, and never
 * onto a fixed event.
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
  const T0 = 5 * 60, T1 = 25 * 60;   // 05:00 to 01:00
  const SNAP = 5;
  const PPM = 1.2;                   // pixels per minute, day view
  const PPM_W = 0.62;                // week view

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
    ["tafsir", "Tafsīr"], ["gym", "Gym"], ["fixed", "Fixed"], ["routine", "Routine"],
    ["prayer", "Prayer"], ["other", "Other"],
  ];
  const CAT_LABEL = Object.fromEntries(CATS);
  const STUDY = ["arabic", "maths", "biology", "chemistry", "tafsir"];
  const TRACKED = [...STUDY, "gym"];

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
  const isWall = (b) => !isBand(b) && (b.locked || b.cat === "fixed" || b.cat === "gym" || b.title === "Sleep" || /^Wake/.test(b.title));
  const fmtDur = (m) => {
    if (m <= 0) return "0m";
    const h = Math.floor(m / 60), r = m % 60;
    return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`;
  };
  const fmtHours = (m) => (Math.round((m / 60) * 2) / 2).toString() + "h";
  let seq = 0;
  const newId = () => "u" + Date.now().toString(36) + (seq++).toString(36);
  const dateObj = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
  // The planner's day runs 05:00 to 05:00, as the timeline does: at half past
  // midnight you are still in last night, not the start of tomorrow.
  const todayIso = () => { const n = new Date(Date.now() - 5 * 3600e3); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`; };
  const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes() + (n.getHours() < 5 ? 1440 : 0); };
  /** The same, to the second, so the line can glide rather than jump a minute at a time. */
  const nowExact = () => { const n = new Date(); return nowMin() + n.getSeconds() / 60; };
  const MONTH = (iso) => dateObj(iso).toLocaleDateString("en-GB", { month: "long" });
  const shortDate = (iso) => `${dateObj(iso).getDate()} ${MONTH(iso).slice(0, 3)}`;

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

  const ui = { day: 0, view: "day", sel: null };
  try { Object.assign(ui, JSON.parse(localStorage.getItem(UI_KEY)) || {}); ui.sel = null; } catch {}
  const ti = state.days.findIndex((d) => d.date === todayIso());
  if (ti >= 0) ui.day = ti;
  // A link can open a day or the week: #2026-10-23, #week
  const hash = decodeURIComponent(location.hash.slice(1));
  const hi = state.days.findIndex((d) => d.date === hash);
  if (hi >= 0) { ui.day = hi; ui.view = "day"; }
  if (hash === "week") ui.view = "week";
  ui.day = Math.max(0, Math.min(state.days.length - 1, ui.day | 0));

  /* ── saving: this browser, and TafsirLab ── */
  let pushTimer = 0, pending = false, failing = false;
  function save() {
    state.savedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
    saveUi();
    if (WEB) { pending = true; clearTimeout(pushTimer); pushTimer = setTimeout(push, 700); }
  }
  function saveUi() { try { localStorage.setItem(UI_KEY, JSON.stringify({ day: ui.day, view: ui.view })); } catch {} }
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
          state = d.state;
          try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
          if (ui.sel && !findBlock(ui.sel)) ui.sel = null;
          render();
        }
      } catch {}
    });
  }

  const undo = [], redo = [];
  function checkpoint() {
    undo.push(JSON.stringify(state));
    if (undo.length > 80) undo.shift();
    redo.length = 0;
  }
  function restore(from, to) {
    if (!from.length) return false;
    to.push(JSON.stringify(state));
    state = JSON.parse(from.pop());
    if (ui.sel && !findBlock(ui.sel)) ui.sel = null;
    save(); render();
    return true;
  }

  const day = () => state.days[ui.day];
  function findBlock(id) {
    for (let i = 0; i < state.days.length; i++) {
      const b = state.days[i].blocks.find((x) => x.id === id);
      if (b) return { b, di: i, d: state.days[i] };
    }
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
  const shown = { day: null, view: null, ins: null, cal: null };
  let ringsIn = false;
  const anim = (el, frames, opts) => el && el.animate && el.animate(frames, { duration: 360, easing: EASE, ...opts });
  function paintView(html) {
    const v = $("#view");
    const first = shown.view === null;
    const mode = shown.view !== ui.view ? "fade" : shown.day !== ui.day ? "slide" : "flip";
    const dir = Math.sign(ui.day - (shown.day ?? ui.day));
    const key = (el) => `${el.dataset.id}:${el.dataset.seg || 0}`;
    const before = new Map();
    if (mode === "flip") v.querySelectorAll(".blk[data-id], .band[data-id]").forEach((el) => before.set(key(el), el.offsetTop));
    v.innerHTML = html;
    shown.view = ui.view; shown.day = ui.day;
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

  /* ── sidebar: the fortnight as a calendar, what's coming up, and the rings ── */
  const dayTasks = (d) => d.blocks.filter((b) => TRACKED.includes(b.cat));
  function termStatus() {
    const today = todayIso(), first = state.days[0].date, last = state.days[state.days.length - 1].date;
    if (today < first) {
      const n = Math.round((dateObj(first) - dateObj(today)) / 864e5);
      return n === 1 ? "Starts tomorrow" : `Starts in ${n} days`;
    }
    if (today > last) return "Finished";
    return `Day ${state.days.findIndex((d) => d.date === today) + 1} of ${state.days.length}`;
  }
  function ring(r, frac, cls) {
    const C = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac));
    return `<circle class="rt ${cls}" cx="50" cy="50" r="${r}"/><circle class="rf ${cls}" cx="50" cy="50" r="${r}" stroke-dasharray="${(f * C).toFixed(2)} ${C.toFixed(2)}"/>`;
  }
  function renderSide() {
    const today = todayIso();
    const first = state.days[0].date, last = state.days[state.days.length - 1].date;
    const lead = (dateObj(first).getDay() + 6) % 7;      // weeks start on Monday
    let cal = `<div class="cal-head"><b>${MONTH(first)}${MONTH(last) !== MONTH(first) ? ` – ${MONTH(last)}` : ""}</b><span>${termStatus()}</span></div>
      <div class="cal-grid">${["M", "T", "W", "T", "F", "S", "S"].map((x) => `<span class="dow">${x}</span>`).join("")}${"<span></span>".repeat(lead)}`;
    state.days.forEach((d, i) => {
      const tasks = dayTasks(d), done = tasks.filter((b) => b.done).length;
      const st = tasks.length && done === tasks.length ? "all" : done ? "some" : "none";
      cal += `<button type="button" class="cd" data-day="${i}" aria-current="${i === ui.day}" data-today="${d.date === today}" data-state="${st}" aria-label="${d.weekday} ${shortDate(d.date)}, ${done} of ${tasks.length} done"><span>${dateObj(d.date).getDate()}</span><i></i></button>`;
    });
    $("#days").innerHTML = cal + `</div>`;
    if (shown.cal !== null && shown.cal !== ui.day) pop($("#days .cd[aria-current='true'] span"));
    shown.cal = ui.day;

    // Coming up: the fixed things still ahead.
    const nowKey = `${today} ${raw(nowMin())}`;
    const ups = [];
    // One-offs only: a weekly fixture (the mosque, Junayd's lesson) isn't news.
    const seen = {};
    for (const d of state.days) for (const b of d.blocks) if (b.cat === "fixed") seen[b.title] = (seen[b.title] || 0) + 1;
    for (const d of state.days) for (const b of d.blocks) if (b.cat === "fixed" && seen[b.title] === 1 && `${d.date} ${b.end}` > nowKey) ups.push({ d, b });
    ups.sort((x, y) => (`${x.d.date} ${x.b.start}` < `${y.d.date} ${y.b.start}` ? -1 : 1));

    const A = state.arabic || { total: 60, doneBefore: 10 };
    let arDone = 0, arPlanned = 0, prDone = 0, prAll = 0, stPlan = 0, stDone = 0;
    const hours = Object.fromEntries(TRACKED.map((c) => [c, { plan: 0, done: 0 }]));
    for (const d of state.days) for (const b of d.blocks) {
      if (b.cat === "arabic" && /lesson/i.test(b.title)) { arPlanned++; if (b.done) arDone++; }
      if (b.cat === "prayer") { prAll++; if (b.done) prDone++; }
      if (hours[b.cat]) { const m = workMinutes(b, d); hours[b.cat].plan += m; if (b.done) hours[b.cat].done += m; }
      if (STUDY.includes(b.cat)) { const m = workMinutes(b, d); stPlan += m; if (b.done) stDone += m; }
    }
    const now = A.doneBefore + arDone;
    const target = Math.min(A.total, A.doneBefore + arPlanned);
    $("#progress").innerHTML = `
      ${ups.length ? `<section class="side-sec">
        <h4>Coming up</h4>
        ${ups.slice(0, 4).map(({ d, b }) => `<button type="button" class="up" data-goto="${b.id}">
          <span class="up-day"><small>${dateObj(d.date).toLocaleDateString("en-GB", { weekday: "short" })}</small><b>${dateObj(d.date).getDate()}</b></span>
          <span class="up-t"><b>${esc(b.title.replace(/ \((maybe|set the time)\)$/, ""))}</b><small>${b.tentative ? "Time to confirm" : `${clock(toMin(b.start))}–${clock(toMin(b.end))}`}</small></span>
        </button>`).join("")}
      </section>` : ""}
      <section class="side-sec rings-sec">
        <h4>Half term</h4>
        <div class="rings">
          <svg viewBox="0 0 100 100" class="ring-svg" aria-hidden="true">${ring(42, now / A.total, "r-ar")}${ring(30, stPlan ? stDone / stPlan : 0, "r-st")}${ring(18, prAll ? prDone / prAll : 0, "r-pr")}</svg>
          <dl class="ring-key">
            <div class="k-ar"><dt>Arabic</dt><dd>${now}<small> of ${A.total}</small></dd></div>
            <div class="k-st"><dt>Study</dt><dd>${fmtHours(stDone)}<small> of ${fmtHours(stPlan)}</small></dd></div>
            <div class="k-pr"><dt>Prayers</dt><dd>${prDone}<small> of ${prAll}</small></dd></div>
          </dl>
        </div>
        <p class="ring-note">The plan reaches Arabic lesson ${target}.</p>
      </section>`;
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
      const w0 = Math.floor(ui.day / 7) * 7;
      const a = state.days[w0], b = state.days[Math.min(state.days.length - 1, w0 + 6)];
      $("#day-title").innerHTML = `<b>Week ${w0 / 7 + 1}</b> <span>${shortDate(a.date)} – ${shortDate(b.date)}</span>`;
      $("#day-sub").textContent = termStatus();
    } else {
      $("#day-title").innerHTML = `<b>${d.date === todayIso() ? "Today" : esc(d.weekday)}</b> <span>${d.date === todayIso() ? `${esc(d.weekday)} ` : ""}${dt.getDate()} ${MONTH(d.date)}</span>`;
      const tasks = dayTasks(d), done = tasks.filter((b) => b.done).length;
      $("#day-sub").textContent = `Half term, day ${ui.day + 1} of ${state.days.length}` + (tasks.length ? ` · ${done} of ${tasks.length} done` : " · A free day");
    }
    document.querySelectorAll(".seg button").forEach((b) => b.setAttribute("aria-selected", b.dataset.view === ui.view));
    placeThumb();
    const w0 = Math.floor(ui.day / 7) * 7;
    $("#prev").disabled = ui.view === "day" ? ui.day === 0 : w0 === 0;
    $("#next").disabled = ui.view === "day" ? ui.day === state.days.length - 1 : w0 + 7 >= state.days.length;
    $("#prev").setAttribute("aria-label", ui.view === "week" ? "Previous week" : "Previous day");
    $("#next").setAttribute("aria-label", ui.view === "week" ? "Next week" : "Next day");
    const inTerm = state.days.some((x) => x.date === todayIso());
    $("#today").disabled = !inTerm;
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
    const inside = prayersInside(b, d);
    const work = workMinutes(b, d);
    const meta = `${clock(toMin(b.start))} – ${clock(toMin(b.end))}`;
    void inside; void work;
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
           <div class="blk-t">${esc(b.title)}${b.tentative ? ` <span class="maybe">maybe</span>` : ""}</div>
           <div class="blk-m">${meta}</div>
           ${open}`
        : `<div class="blk-t">${esc(b.title)}</div>`;
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
    const w0 = Math.floor(ui.day / 7) * 7;
    const days = state.days.slice(w0, w0 + 7);
    const H = (T1 - T0) * PPM_W;
    let html = `<div class="chrome-space"></div><div class="week"><div class="wh-gap"></div>`;
    days.forEach((d, k) => {
      const dt = dateObj(d.date);
      html += `<button type="button" class="wh" data-day="${w0 + k}" data-sel="${w0 + k === ui.day}" data-today="${d.date === todayIso()}"><span>${d.weekday.slice(0, 3)}</span><b>${dt.getDate()}</b></button>`;
    });
    html += `<div class="wgut" style="height:${H}px">`;
    for (let t = T0 + 60; t < T1; t += 120) html += `<span style="top:${(t - T0) * PPM_W}px">${clock(t)}</span>`;
    html += `</div>`;
    days.forEach((d) => {
      const hidden = absorbed(d);
      html += `<div class="wcol" style="height:${H + 8}px">`;
      if (d.date === todayIso() && nowMin() >= T0 && nowMin() <= T1) html += `<div class="wnow" id="wnow" style="top:${(nowExact() - T0) * PPM_W}px"></div>`;
      for (let t = T0 + 60; t < T1; t += 120) html += `<div class="wline" style="top:${(t - T0) * PPM_W}px"></div>`;
      for (const b of d.blocks) {
        if (isBand(b)) {
          if (!hidden.has(b.id)) html += `<div class="wband" style="top:${(toMin(b.start) - T0) * PPM_W}px;height:${Math.max(3, dur(b) * PPM_W - 1)}px" title="${esc(b.title)} ${b.start}"></div>`;
          continue;
        }
        const ps = pieces(b, d, hidden);
        const tallest = ps.reduce((best, [s, e], k) => (e - s > ps[best][1] - ps[best][0] ? k : best), 0);
        for (const [k, [s, e]] of ps.entries()) {
          const top = (s - T0) * PPM_W, h = Math.max(8, (e - s) * PPM_W - 2);
          const label = b.cat === "tafsir" && b.surah ? `Tafsīr · ${surahName(b.surah)}` : b.title;
          html += `<button type="button" class="wblk${b.done ? " done" : ""}${b.tentative ? " tentative" : ""}" data-id="${b.id}" data-cat="${esc(b.cat)}" style="top:${top}px;height:${h}px" title="${esc(label)} · ${clock(toMin(b.start))}–${clock(toMin(b.end))}">${h >= 11 && k === tallest ? esc(label) : ""}</button>`;
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
    const key = ui.sel ? `b:${ui.sel}` : `g:${ui.day}`;
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
    el.innerHTML = `
      <header class="ins-bar"><span class="kind" data-cat="${esc(b.cat)}"><i></i>${CAT_LABEL[b.cat] || "Other"}${b.tentative ? " · to confirm" : ""}</span>${CLOSE}</header>
      <div class="ins-body">
        <div class="ins-head">
          <input class="ins-name" type="text" data-f="title" value="${esc(b.title)}" aria-label="Title">
          <p class="ins-when">${esc(d.weekday)} ${shortDate(d.date)}, ${clock(s)} to ${clock(e)}</p>
          ${inside.length && isWall(b) ? `<p class="ins-aside">${inside.map((p) => `${esc(p.title)} ${clock(toMin(p.start))}`).join(", ")} ${b.praysThere ? "is prayed there" : "falls during this"}.</p>` : ""}
        </div>
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
          <div class="row"><span>Length</span><span class="row-v">${fmtDur(e - s)}${inside.length && STUDY.includes(b.cat) ? `, ${fmtDur(workMinutes(b, d))} of work` : ""}</span></div>
        </div>
        ${inside.length && STUDY.includes(b.cat) ? `<p class="foot">${inside.map((p) => p.title).join(" and ")} falls inside it, so the time around ${inside.length > 1 ? "them" : "it"} is what counts.</p>` : ""}
        <div class="group">
          <div class="row"><span>${band ? "Prayed" : "Done"}</span><button type="button" class="switch" role="switch" aria-checked="${!!b.done}" data-act="done" aria-label="${band ? "Prayed" : "Done"}"></button></div>
          ${band ? "" : `<label class="row"><span>Kind</span><span class="kind-pick" data-cat="${esc(b.cat)}"><i></i><select data-f="cat">${CATS.filter(([c]) => c !== "prayer").map(([c, l]) => `<option value="${c}"${b.cat === c ? " selected" : ""}>${l}</option>`).join("")}</select></span></label>`}
          <label class="row"><span>Day</span><select data-f="day">${state.days.map((x, i) => `<option value="${i}"${x === d ? " selected" : ""}>${x.weekday} ${shortDate(x.date)}</option>`).join("")}</select></label>
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

  function glanceHTML(d) {
    const prayers = d.blocks.filter((b) => b.cat === "prayer").sort((a, b) => toMin(a.start) - toMin(b.start));
    const totals = {};
    for (const b of d.blocks) if (TRACKED.includes(b.cat)) totals[b.cat] = (totals[b.cat] || 0) + workMinutes(b, d);
    const tasks = dayTasks(d), done = tasks.filter((b) => b.done).length;
    const study = STUDY.reduce((a, c) => a + (totals[c] || 0), 0);
    const kinds = TRACKED.filter((c) => totals[c]);
    const ns = d.date === todayIso() ? nowState() : null;
    return `
      <header class="ins-bar"><span class="ins-title">${d.date === todayIso() ? "Today" : esc(d.weekday)}</span><span class="ins-meta">${tasks.length ? `${done} of ${tasks.length} done` : "Free"}</span></header>
      <div class="ins-body">
        ${ns ? nowCardHTML(ns) : ""}
        <h4 class="group-label">Prayers</h4>
        <div class="group">${prayers.map((p) => `<button type="button" class="row prayer-row${p.done ? " done" : ""}" data-pray="${p.id}">
          <span class="pr-box">${TICK}</span><span class="pr-name">${esc(p.title)}</span><span class="row-v">${clock(toMin(p.start))}</span></button>`).join("")}</div>
        <h4 class="group-label">Plan</h4>
        <div class="group">${kinds.length ? kinds.map((c) => `<div class="row"><span class="h-name" data-cat="${c}"><i class="h-dot"></i>${CAT_LABEL[c]}</span><span class="row-v">${fmtDur(totals[c])}</span></div>`).join("")
          + (study ? `<div class="row row-total"><span>In all</span><span class="row-v">${fmtDur(study)}</span></div>` : "")
          : `<div class="row"><span class="muted">Nothing planned</span></div>`}</div>
        <h4 class="group-label">Notes</h4>
        <div class="group"><textarea data-daynote rows="4" placeholder="Homework due, what to bring, how it went">${esc(d.note || "")}</textarea></div>
      </div>`;
  }

  /* ── where you are in the day ── */
  function nowState() {
    const d = state.days.find((x) => x.date === todayIso());
    if (!d) return null;
    const m = nowExact();
    const items = d.blocks.filter((b) => !isBand(b) && b.title !== "Sleep").sort((a, b) => toMin(a.start) - toMin(b.start));
    const cur = items.find((b) => toMin(b.start) <= m && m < toMin(b.end));
    const next = items.find((b) => toMin(b.start) > m);
    const prayer = d.blocks.find((b) => isBand(b) && toMin(b.start) <= m && m < toMin(b.end));
    return { d, m, cur: prayer || cur, next };
  }
  function nowCardHTML({ m, cur, next }) {
    const left = cur ? Math.max(1, Math.ceil(toMin(cur.end) - m)) : 0;
    const p = cur ? (m - toMin(cur.start)) / dur(cur) : 0;
    return `<button type="button" class="now-card" data-act="to-now"${cur ? ` data-cat="${esc(cur.cat)}"` : ""}>
      <span class="nc-top"><span class="nc-label">Now</span><span class="nc-time">${clock(Math.floor(m))}</span></span>
      <span class="nc-title">${cur ? esc(cur.title) : "Free time"}</span>
      ${cur ? `<span class="nc-bar"><i style="width:${(p * 100).toFixed(1)}%"></i></span><span class="nc-left">${fmtDur(left)} left, until ${clock(toMin(cur.end))}</span>` : ""}
      ${next ? `<span class="nc-next">Next: <b>${esc(next.title)}</b> at ${clock(toMin(next.start))}</span>` : ""}
    </button>`;
  }
  /** Move the line, fill the block you're in, and keep the Now card current, without redrawing the day. */
  function tickNow() {
    if (drag) return;
    const m = nowExact(), isToday = day().date === todayIso();
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

  function goDay(i, keepSel) {
    ui.day = Math.max(0, Math.min(state.days.length - 1, i));
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
    mutate(() => { hit.d.blocks = hit.d.blocks.filter((x) => x.id !== id); ui.sel = null; });
    toast(`Deleted “${hit.b.title}”`, { label: "Undo", run: () => restore(undo, redo) });
  }

  /* ── events: top bar ── */
  document.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => {
    ui.view = b.dataset.view; ui.sel = null; saveUi(); render(); scrollToStart();
  }));
  $("#prev").addEventListener("click", () => goDay(ui.view === "week" ? Math.floor(ui.day / 7) * 7 - 7 : ui.day - 1));
  $("#next").addEventListener("click", () => goDay(ui.view === "week" ? Math.floor(ui.day / 7) * 7 + 7 : ui.day + 1));
  $("#today").addEventListener("click", () => {
    const i = state.days.findIndex((d) => d.date === todayIso()); if (i < 0) return;
    if (ui.view === "day" && ui.day === i) { scrollToStart(true); return; }
    ui.view = "day"; goDay(i);
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
      mutate(() => { state = fresh(); ui.sel = null; });
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
      mutate(() => { state = s; ui.sel = null; ui.day = Math.min(ui.day, s.days.length - 1); });
      toast("Opened the copy", { label: "Undo", run: () => restore(undo, redo) });
    } catch {
      toast("That file isn’t a Productivity timetable. Choose a .json saved from here.");
    }
  });

  /* ── events: sidebar ── */
  $("#days").addEventListener("click", (e) => {
    const b = e.target.closest("[data-day]"); if (b) goDay(+b.dataset.day);
  });
  $("#progress").addEventListener("click", (e) => {
    const g = e.target.closest("[data-goto]"); if (!g) return;
    const hit = findBlock(g.dataset.goto); if (!hit) return;
    ui.view = "day"; ui.day = hit.di; ui.sel = hit.b.id; saveUi(); render(); scrollToStart();
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
    if (wh) { ui.view = "day"; goDay(+wh.dataset.day); return; }
    const wb = e.target.closest(".wblk");
    if (wb) { const hit = findBlock(wb.dataset.id); ui.view = "day"; ui.day = hit.di; ui.sel = hit.b.id; saveUi(); render(); scrollToStart(); return; }
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
    if (m) m.textContent = `${clock(s)}–${clock(en)} · ${fmtDur(en - s)}`;
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
    if (t.dataset.f === "day") {
      const to = +t.value; if (state.days[to] === d) return;
      const n = mutate(() => {
        d.blocks = d.blocks.filter((x) => x !== b);
        state.days[to].blocks.push(b);
        ui.day = to;
        return isBand(b) ? (sortDay(state.days[to]), 0) : settle(state.days[to], b.id);
      });
      scrollToStart();
      toast(`Moved to ${state.days[to].weekday} ${dateObj(state.days[to].date).getDate()}${n ? `; ${n} block${n === 1 ? "" : "s"} there moved later` : ""}`, { label: "Undo", run: () => restore(undo, redo) });
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
    const setcat = e.target.closest("[data-setcat]");
    if (setcat && hit) { const n = mutate(() => { hit.b.cat = setcat.dataset.setcat; return settle(hit.d, hit.b.id); }); madeRoom(n); return; }
    const act = e.target.closest("[data-act]")?.dataset.act; if (!act) return;
    if (act === "close") { ui.sel = null; render(); return; }
    if (act === "to-now") { $("#today").click(); return; }
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
    const d = state.days.find((x) => x.date === todayIso()); if (!d) return;
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
        toast("Time for tafsīr. Which sūrah?", { label: "Choose", run: () => { ui.view = "day"; ui.day = state.days.indexOf(d); ui.sel = b.id; render(); scrollToStart(); $('#inspector [data-f="surah"]')?.focus({ preventScroll: true }); } }, 120000);
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
