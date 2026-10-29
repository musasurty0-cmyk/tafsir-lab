/**
 * Productivity — an Apple Calendar, shown beside the plan.
 *
 * Apple has no API for a calendar, but the Calendar app can share one as a
 * "Public Calendar": a webcal:// link to an iCalendar file on iCloud that
 * anyone holding the link can read. The link is kept in ProductivityPlan and
 * the file is read here on the server, so the browser only ever sees the
 * events, never the link. Read-only: nothing is written back to Apple.
 *
 * Times come back as London wall-clock strings, "2026-11-03T17:30", which is
 * how the timetable thinks about a day; all-day events as dates, end exclusive.
 */

import { createHash } from "node:crypto";
import ICAL from "ical.js";

export type CalEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
};

const ZONE = "Europe/London";
const TTL = 5 * 60_000;            // Apple is asked again at most every five minutes
const MAX_BYTES = 5_000_000;
const MAX_STEPS = 20_000;           // occurrences walked per repeating event

/** The https address of an iCloud calendar link, or null if it isn't one. */
export function checkUrl(raw: string): string | null {
  const s = raw.trim().replace(/^webcals?:\/\//i, "https://");
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== "https:" || !isIcloud(u.hostname) || u.username || u.password) return null;
  return u.toString();
}
const isIcloud = (host: string) => host === "icloud.com" || host.endsWith(".icloud.com");

const cache = new Map<string, { at: number; cal: ICAL.Component }>();

/** The calendar behind a link, from iCloud or from a copy read in the last few minutes. */
async function load(url: string): Promise<ICAL.Component> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.cal;
  const cal = parseCalendar(await download(url));
  cache.set(url, { at: Date.now(), cal });
  return cal;
}

/** An iCalendar file, with its time zones made known. */
export function parseCalendar(text: string): ICAL.Component {
  let cal: ICAL.Component;
  try { cal = new ICAL.Component(ICAL.parse(text)); } catch { throw new Error("Not a calendar"); }
  if (cal.name !== "vcalendar") throw new Error("Not a calendar");
  for (const tz of cal.getAllSubcomponents("vtimezone")) ICAL.TimezoneService.register(tz);
  return cal;
}

/** Follows iCloud's redirects by hand, so the request never leaves icloud.com. */
async function download(url: string): Promise<string> {
  let at = url;
  for (let hop = 0; hop < 4; hop++) {
    const r = await fetch(at, {
      redirect: "manual",
      headers: { Accept: "text/calendar" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (r.status >= 300 && r.status < 400) {
      const next = r.headers.get("location");
      const u = next ? new URL(next, at) : null;
      if (!u || u.protocol !== "https:" || !isIcloud(u.hostname)) throw new Error("Redirected away from iCloud");
      at = u.toString();
      continue;
    }
    if (r.status === 404 || r.status === 403) throw new Error("Not shared");
    if (!r.ok) throw new Error(`iCloud answered ${r.status}`);
    const text = await r.text();
    if (text.length > MAX_BYTES) throw new Error("Calendar too large");
    return text;
  }
  throw new Error("Too many redirects");
}

const pad = (n: number) => String(n).padStart(2, "0");
const london = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** An iCalendar time as London wall-clock time; a date stays a date. */
function local(t: ICAL.Time): string {
  if (t.isDate) return `${t.year}-${pad(t.month)}-${pad(t.day)}`;
  // A floating time has no zone: it means the clock on the wall, wherever you are.
  if (!t.zone || t.zone === ICAL.Timezone.localTimezone) {
    return `${t.year}-${pad(t.month)}-${pad(t.day)}T${pad(t.hour)}:${pad(t.minute)}`;
  }
  const p = Object.fromEntries(london.formatToParts(t.toJSDate()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

const shortId = (s: string) => createHash("sha1").update(s).digest("base64url").slice(0, 12);

/** Events overlapping the days from..to (to exclusive), as "YYYY-MM-DD". */
export async function eventsBetween(url: string, from: string, to: string): Promise<CalEvent[]> {
  return eventsIn(await load(url), from, to);
}

export function eventsIn(cal: ICAL.Component, from: string, to: string): CalEvent[] {
  const vevents = cal.getAllSubcomponents("vevent");

  // A changed occurrence of a repeating event is its own VEVENT, tied to the
  // series by UID and RECURRENCE-ID; the series learns about it here.
  const masters = new Map<string, ICAL.Event>();
  const loose: ICAL.Component[] = [];
  for (const v of vevents) if (!v.hasProperty("recurrence-id")) masters.set(String(v.getFirstPropertyValue("uid") ?? ""), new ICAL.Event(v));
  for (const v of vevents) {
    if (!v.hasProperty("recurrence-id")) continue;
    const m = masters.get(String(v.getFirstPropertyValue("uid") ?? ""));
    if (m) m.relateException(v); else loose.push(v);
  }

  const out: CalEvent[] = [];
  const add = (ev: ICAL.Event, s: ICAL.Time, e: ICAL.Time | null) => {
    if (String(ev.component.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED") return;
    const allDay = s.isDate;
    const start = local(s);
    let end: string;
    if (e) end = local(e);
    else if (allDay) { const n = s.clone(); n.day += 1; end = local(n); }
    else end = start;
    // Overlap with the range, compared as local strings.
    const lo = allDay ? from : `${from}T00:00`, hi = allDay ? to : `${to}T00:00`;
    if (!(end > lo || (end === start && start >= lo)) || start >= hi) return;
    const location = String(ev.location || "").trim();
    out.push({
      id: shortId(`${ev.uid}|${start}`),
      title: String(ev.summary || "").trim() || "Busy",
      start, end, allDay,
      ...(location ? { location } : {}),
    });
  };

  const stop = `${to}T00:00`;
  for (const ev of masters.values()) {
    if (!ev.startDate) continue;
    if (!ev.isRecurring()) { add(ev, ev.startDate, ev.endDate); continue; }
    const it = ev.iterator();
    for (let i = 0; i < MAX_STEPS; i++) {
      const next = it.next();
      if (!next) break;
      if (local(next).slice(0, 16) >= stop.slice(0, next.isDate ? 10 : 16)) break;
      const det = ev.getOccurrenceDetails(next);
      add(det.item, det.startDate, det.endDate);
    }
  }
  for (const v of loose) {
    const ev = new ICAL.Event(v);
    if (ev.startDate) add(ev, ev.startDate, ev.endDate);
  }
  return out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}
