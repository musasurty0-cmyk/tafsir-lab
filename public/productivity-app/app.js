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
  const todayIso = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`; };
  const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes() + (n.getHours() < 5 ? 1440 : 0); };
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
    toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }

  /* ── sidebar ── */
  const dayTasks = (d) => d.blocks.filter((b) => TRACKED.includes(b.cat));
  function renderSide() {
    const today = todayIso();
    let html = "";
    state.days.forEach((d, i) => {
      if (i % 7 === 0) html += `<div class="week-label">Week ${i / 7 + 1}</div>`;
      const dt = dateObj(d.date);
      const tasks = dayTasks(d), done = tasks.filter((b) => b.done).length;
      const frac = tasks.length ? done / tasks.length : 0;
      const C = 2 * Math.PI * 7;
      const meta = d.blocks
        .filter((b) => b.cat === "gym" || b.cat === "fixed")
        .map((b) => b.title.split(" · ")[0].replace(/ \(.*\)$/, "") + (b.tentative ? "?" : ""));
      const metaText = [...new Set(meta)].join(" · ") || "Study day";
      html += `<button type="button" class="day" data-day="${i}" aria-current="${i === ui.day}" data-today="${d.date === today}">
        <span class="day-num">${dt.getDate()}</span>
        <span class="day-name">${esc(d.weekday)}</span>
        <span class="day-meta">${esc(metaText)}</span>
        <svg class="day-prog" viewBox="0 0 18 18" aria-label="${done} of ${tasks.length} done"><circle class="track" cx="9" cy="9" r="7"/><circle class="fill" cx="9" cy="9" r="7" stroke-dasharray="${(frac * C).toFixed(2)} ${C.toFixed(2)}"/></svg>
      </button>`;
    });
    $("#days").innerHTML = html;

    const first = state.days[0].date, last = state.days[state.days.length - 1].date;
    const td = $("#term-dates"); if (td) td.textContent = `${shortDate(first)} to ${shortDate(last)}`;
    const st = $("#term-status");
    if (today < first) {
      const n = Math.round((dateObj(first) - dateObj(today)) / 864e5);
      st.textContent = n === 1 ? "Starts tomorrow" : `Starts in ${n} days`;
    } else if (today > last) st.textContent = "Finished";
    else st.textContent = `Day ${state.days.findIndex((d) => d.date === today) + 1} of ${state.days.length}`;

    const A = state.arabic || { total: 60, doneBefore: 10 };
    let arDone = 0, arPlanned = 0;
    const hours = Object.fromEntries(TRACKED.map((c) => [c, { plan: 0, done: 0 }]));
    for (const d of state.days) for (const b of d.blocks) {
      if (b.cat === "arabic" && /lesson/i.test(b.title)) { arPlanned++; if (b.done) arDone++; }
      if (hours[b.cat]) { const m = workMinutes(b, d); hours[b.cat].plan += m; if (b.done) hours[b.cat].done += m; }
    }
    const pct = (n) => (100 * n / A.total).toFixed(2) + "%";
    const now = A.doneBefore + arDone;
    const target = Math.min(A.total, A.doneBefore + arPlanned);
    $("#progress").innerHTML = `
      <div class="ar">
        <div class="ar-head"><span>Arabic course</span><b>${now}<small> of ${A.total}</small></b></div>
        <div class="bar" role="img" aria-label="${now} of ${A.total} lessons">
          <i class="b-plan" style="width:${pct(target)}"></i>
          <i class="b-before" style="width:${pct(A.doneBefore)}"></i>
          <i class="b-done" style="left:${pct(A.doneBefore)};width:${pct(arDone)}"></i>
        </div>
        <p class="ar-note">Lesson ${target} by the end, if you keep to the plan</p>
      </div>
      <div class="hours">
        ${TRACKED.map((c) => `
          <span class="h-name" data-cat="${c}"><i class="h-dot"></i>${CAT_LABEL[c]}</span>
          <span class="h-val"><b>${fmtHours(hours[c].done)}</b> of ${fmtHours(hours[c].plan)}</span>`).join("")}
      </div>`;
  }

  /* ── top bar ── */
  function renderTop() {
    const d = day();
    const dt = dateObj(d.date);
    if (ui.view === "week") {
      const w0 = Math.floor(ui.day / 7) * 7;
      const a = state.days[w0], b = state.days[Math.min(state.days.length - 1, w0 + 6)];
      $("#day-title").textContent = `Week ${w0 / 7 + 1}`;
      $("#day-sub").textContent = `${shortDate(a.date)} to ${shortDate(b.date)}`;
    } else {
      $("#day-title").textContent = `${d.weekday} ${dt.getDate()} ${MONTH(d.date)}`;
      const p = d.prayers || {};
      const names = ["Fajr", d.weekday === "Friday" ? "Jumuʿah" : "Dhuhr", "Asr", "Maghrib", "Isha"];
      $("#day-sub").innerHTML = names.map((n) => {
        const t = p[n === "Jumuʿah" ? "Dhuhr" : n];
        return t ? `<span class="pt"><b>${n}</b> ${t}</span>` : "";
      }).join("");
    }
    document.querySelectorAll(".seg button").forEach((b) => b.setAttribute("aria-selected", b.dataset.view === ui.view));
    const w0 = Math.floor(ui.day / 7) * 7;
    $("#prev").disabled = ui.view === "day" ? ui.day === 0 : w0 === 0;
    $("#next").disabled = ui.view === "day" ? ui.day === state.days.length - 1 : w0 + 7 >= state.days.length;
    $("#prev").setAttribute("aria-label", ui.view === "week" ? "Previous week" : "Previous day");
    $("#next").setAttribute("aria-label", ui.view === "week" ? "Next week" : "Next day");
    const inTerm = state.days.some((x) => x.date === todayIso());
    $("#today").disabled = !inTerm;
    $("#today").title = inTerm ? "" : `Half term runs ${shortDate(state.days[0].date)} to ${shortDate(state.days[state.days.length - 1].date)}`;
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
    let meta = `${clock(toMin(b.start))}–${clock(toMin(b.end))}`;
    if (STUDY.includes(b.cat) && inside.length) meta += ` · ${fmtDur(work)} with ${inside.map((p) => p.title).join(", ")}`;
    else if (STUDY.includes(b.cat)) meta += ` · ${fmtDur(work)}`;
    const prayedHere = isWall(b) && inside.length
      ? `<div class="blk-p">${inside.map((p) => `${esc(p.title)} ${clock(toMin(p.start))}`).join(" · ")}${b.praysThere || inside.every((p) => /^Prayed/.test(p.note || "")) ? ", prayed there" : ""}</div>` : "";
    const w = 100 / pos.cols;
    const base = ["blk", b.done && "done", b.tentative && "tentative", isWall(b) && b.locked && "locked"].filter(Boolean);
    const open = b.cat === "tafsir"
      ? `<button type="button" class="blk-open" data-open="${b.id}">${b.surah ? `Open ${esc(surahName(b.surah))} ${ARROW}` : "Choose a sūrah"}</button>` : "";
    return segs.map(([s, e], k) => {
      const top = (s - T0) * PPM, h = Math.max(14, (e - s) * PPM - 2);
      const first = k === 0, lastSeg = k === segs.length - 1;
      const short = h < 40;
      const cls = [...base, short && "short", !first && "cont"].filter(Boolean).join(" ");
      const body = first
        ? `<button type="button" class="tick" aria-label="${b.done ? "Mark not done" : "Mark done"}">${TICK}</button>
           <div class="blk-t">${esc(b.title)}${b.tentative ? ` <span class="maybe">maybe</span>` : ""}</div>
           <div class="blk-m">${meta}</div>
           ${prayedHere}
           ${!short || b.cat === "tafsir" ? open : ""}
           ${b.note && h > 76 && !open ? `<div class="blk-n">${esc(b.note)}</div>` : ""}`
        : `<div class="blk-t">${esc(b.title)}</div>${!short ? `<div class="blk-m">continued, until ${clock(toMin(b.end))}</div>` : ""}`;
      return `<div class="${cls}" data-id="${b.id}" data-seg="${k}" data-cat="${esc(b.cat)}" aria-selected="${ui.sel === b.id}" ${first ? 'tabindex="0"' : ""}
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
    let html = `<div class="timeline" style="height:${H}px">`;
    for (let t = T0; t <= T1; t += 60) html += `<div class="hour" style="top:${(t - T0) * PPM}px"><span>${clock(t)}</span></div>`;
    html += `<div class="lane">`;
    const boxes = d.blocks.filter((b) => !isBand(b));
    const pos = layoutColumns(boxes);
    for (const b of boxes) html += blockHTML(b, d, pos.get(b.id), hidden);
    for (const b of d.blocks.filter((x) => isBand(x) && !hidden.has(x.id))) {
      const top = (toMin(b.start) - T0) * PPM, h = Math.max(13, dur(b) * PPM - 2);
      html += `<div class="band${b.done ? " done" : ""}" data-id="${b.id}" aria-selected="${ui.sel === b.id}" tabindex="0" style="top:${top}px;height:${h}px" title="${esc(b.note || "")}">
        <b>${esc(b.title)}</b><span>${clock(toMin(b.start))}</span>${b.note ? `<em>${esc(b.note)}</em>` : ""}</div>`;
    }
    html += `</div>`;
    if (d.date === todayIso()) {
      const m = nowMin();
      if (m >= T0 && m <= T1) html += `<div class="now" style="top:${(m - T0) * PPM}px"></div>`;
    }
    html += `</div>`;
    $("#view").innerHTML = html;
  }

  /* ── week view ── */
  function renderWeek() {
    const w0 = Math.floor(ui.day / 7) * 7;
    const days = state.days.slice(w0, w0 + 7);
    const H = (T1 - T0) * PPM_W;
    let html = `<div class="week"><div class="wh-gap"></div>`;
    days.forEach((d, k) => {
      const dt = dateObj(d.date);
      html += `<button type="button" class="wh" data-day="${w0 + k}" data-sel="${w0 + k === ui.day}" data-today="${d.date === todayIso()}"><b>${dt.getDate()}</b><span>${d.weekday.slice(0, 3)}</span></button>`;
    });
    html += `<div class="wgut" style="height:${H}px">`;
    for (let t = T0 + 60; t < T1; t += 120) html += `<span style="top:${(t - T0) * PPM_W}px">${clock(t)}</span>`;
    html += `</div>`;
    days.forEach((d) => {
      const hidden = absorbed(d);
      html += `<div class="wcol" style="height:${H + 8}px">`;
      for (let t = T0 + 60; t < T1; t += 120) html += `<div class="wline" style="top:${(t - T0) * PPM_W}px"></div>`;
      for (const b of d.blocks) {
        if (isBand(b)) {
          if (!hidden.has(b.id)) html += `<div class="wband" style="top:${(toMin(b.start) - T0) * PPM_W}px;height:${Math.max(3, dur(b) * PPM_W - 1)}px" title="${esc(b.title)} ${b.start}"></div>`;
          continue;
        }
        for (const [s, e] of pieces(b, d, hidden)) {
          const top = (s - T0) * PPM_W, h = Math.max(8, (e - s) * PPM_W - 2);
          const label = b.cat === "tafsir" && b.surah ? `Tafsīr · ${surahName(b.surah)}` : b.title;
          html += `<button type="button" class="wblk${b.done ? " done" : ""}${b.tentative ? " tentative" : ""}" data-id="${b.id}" data-cat="${esc(b.cat)}" style="top:${top}px;height:${h}px" title="${esc(label)} · ${clock(toMin(b.start))}–${clock(toMin(b.end))}">${h >= 13 && s === toMin(b.start) ? esc(label) : ""}</button>`;
        }
      }
      html += `</div>`;
    });
    html += `</div>`;
    $("#view").innerHTML = html;
  }

  /* ── inspector ── */
  const CLOSE = `<button type="button" class="icon-btn" data-act="close" aria-label="Close details"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
  function renderInspector() {
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
      <header class="ins-bar"><span class="kind" data-cat="${esc(b.cat)}"><i></i>${CAT_LABEL[b.cat] || "Other"}${b.tentative ? " · maybe" : ""}</span>${CLOSE}</header>
      <div class="ins-body">
      <label class="field field-title"><span>Title</span><input type="text" data-f="title" value="${esc(b.title)}"></label>
      ${b.cat === "tafsir" ? `
        <div class="surah-pick">
          <label class="field"><span>Sūrah</span>
            <select data-f="surah"><option value="">Choose a sūrah</option>${SURAHS.map(([n], i) => `<option value="${i + 1}"${b.surah === i + 1 ? " selected" : ""}>${i + 1}. ${esc(n)}</option>`).join("")}</select>
          </label>
          ${b.surah ? `<p class="surah-ar" lang="ar" dir="rtl">${esc(SURAHS[b.surah - 1][1])}</p>` : ""}
          ${ws.length > 1 ? `<label class="field"><span>Workspace</span><select data-f="ws">${ws.map((w) => `<option value="${esc(w.id)}"${state.tafsirWorkspace === w.id ? " selected" : ""}>${esc(w.name)}</option>`).join("")}</select></label>` : ""}
          <button type="button" class="btn btn-accent btn-wide" data-act="open" ${b.surah ? "" : "disabled"}>Open in TafsirLab ${ARROW}</button>
          ${WEB && !BOOT.signedIn ? `<p class="hint">You’ll be asked to sign in to TafsirLab first.</p>` : ""}
        </div>` : ""}
      <div class="toggle-row"><span>${band ? "Prayed" : "Done"}</span><button type="button" class="switch" role="switch" aria-checked="${!!b.done}" data-act="done" aria-label="${band ? "Prayed" : "Done"}"></button></div>
      <div class="row2">
        <label class="field"><span>Starts</span><input type="time" step="300" data-f="start" value="${clock(s)}"></label>
        <label class="field"><span>Ends</span><input type="time" step="300" data-f="end" value="${clock(e)}"></label>
      </div>
      <p class="dur-note">${fmtDur(e - s)}${inside.length && STUDY.includes(b.cat) ? `, ${fmtDur(workMinutes(b, d))} of it work, with ${inside.map((p) => p.title).join(" and ")}` : ""}</p>
      ${band ? "" : `<div class="field"><span>Kind</span><div class="cats">${CATS.filter(([c]) => c !== "prayer").map(([c, l]) =>
        `<button type="button" class="cat-opt" data-cat="${c}" data-setcat="${c}" aria-pressed="${b.cat === c}"><i></i>${l}</button>`).join("")}</div></div>`}
      <label class="field"><span>Notes</span><textarea data-f="note" rows="3" placeholder="Anything to remember">${esc(b.note || "")}</textarea></label>
      ${band ? `<p class="hint">Prayer times are set for the day. Change the time here if you pray it later.</p>` : ""}
      <label class="field"><span>Day</span><select data-f="day">${state.days.map((x, i) => `<option value="${i}"${x === d ? " selected" : ""}>${x.weekday} ${shortDate(x.date)}</option>`).join("")}</select></label>
      <div class="ins-actions">
        ${band ? "" : `<button type="button" class="btn" data-act="dup">Duplicate</button>`}
        ${b.tentative ? `<button type="button" class="btn" data-act="confirm">Confirm it</button>` : ""}
        <button type="button" class="btn btn-danger" data-act="delete">Delete</button>
      </div>
      </div>`;
  }

  function glanceHTML(d) {
    const prayers = d.blocks.filter((b) => b.cat === "prayer").sort((a, b) => toMin(a.start) - toMin(b.start));
    const totals = {};
    for (const b of d.blocks) if (TRACKED.includes(b.cat)) totals[b.cat] = (totals[b.cat] || 0) + workMinutes(b, d);
    const tasks = dayTasks(d), done = tasks.filter((b) => b.done).length;
    const study = STUDY.reduce((a, c) => a + (totals[c] || 0), 0);
    return `
      <header class="ins-bar"><span class="ins-title">${esc(d.weekday)}</span><span class="ins-meta">${done} of ${tasks.length} done</span></header>
      <div class="ins-body">
      <section class="glance">
        <h3>Prayers</h3>
        ${prayers.map((p) => `<button type="button" class="prayer-row${p.done ? " done" : ""}" data-pray="${p.id}">
          <span class="pr-box">${TICK}</span>
          <span class="pr-name">${esc(p.title)}</span><span class="pr-time">${clock(toMin(p.start))}</span></button>`).join("")}
      </section>
      <section class="glance">
        <h3>Study</h3>
        <div class="totals">${TRACKED.filter((c) => totals[c]).map((c) => `<span class="h-name" data-cat="${c}"><i class="h-dot"></i>${CAT_LABEL[c]}</span><span class="t-v">${fmtDur(totals[c])}</span>`).join("") || `<span class="hint">Nothing planned</span><span></span>`}
        ${study ? `<span class="t-sum">In all</span><span class="t-v t-sum">${fmtDur(study)}</span>` : ""}</div>
      </section>
      <label class="field"><span>Notes for the day</span><textarea data-daynote rows="4" placeholder="Homework due, what to bring, how it went">${esc(d.note || "")}</textarea></label>
      <p class="hint">Drag a block to move it, or its lower edge to resize it; whatever it lands on moves later. Double-click an empty time to add one. <kbd>←</kbd> <kbd>→</kbd> change day, <kbd>Ctrl</kbd> <kbd>Z</kbd> undoes.</p>
      </div>`;
  }

  function render() {
    renderSide();
    renderTop();
    if (ui.view === "week") renderWeek(); else renderDay();
    renderInspector();
  }

  function scrollToStart() {
    if (ui.view !== "day") { $("#view").scrollTop = 0; return; }
    const d = day();
    let m;
    if (d.date === todayIso()) m = nowMin() - 90;
    else { const wake = d.blocks.find((b) => /^Wake/.test(b.title)); m = (wake ? toMin(wake.start) : 9 * 60) - 30; }
    $("#view").scrollTop = Math.max(0, (m - T0) * PPM);
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
  $("#today").addEventListener("click", () => { const i = state.days.findIndex((d) => d.date === todayIso()); if (i >= 0) { ui.view = "day"; goDay(i); } });
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

  /* ── events: the view ── */
  const view = $("#view");
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
    if (tick) { const hit = findBlock(tick.closest(".blk").dataset.id); mutate(() => { hit.b.done = !hit.b.done; }); return; }
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
    if (pray) { const hit = findBlock(pray.dataset.pray); mutate(() => { hit.b.done = !hit.b.done; }); return; }
    const hit = ui.sel && findBlock(ui.sel);
    const setcat = e.target.closest("[data-setcat]");
    if (setcat && hit) { const n = mutate(() => { hit.b.cat = setcat.dataset.setcat; return settle(hit.d, hit.b.id); }); madeRoom(n); return; }
    const act = e.target.closest("[data-act]")?.dataset.act; if (!act) return;
    if (act === "close") { ui.sel = null; render(); return; }
    if (!hit) return;
    const { b, d } = hit;
    if (act === "open") openSurah(b);
    if (act === "done") mutate(() => { b.done = !b.done; });
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
    if (todayIso() !== lastDate) { lastDate = todayIso(); renderSide(); renderTop(); }
    if (ui.view === "day" && day().date === todayIso() && !drag && !document.activeElement?.matches?.("#view *")) renderDay();
    remind();
  }, 30_000);

  render();
  scrollToStart();
  remind();
})();
