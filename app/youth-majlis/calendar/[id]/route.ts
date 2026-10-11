/**
 * GET /youth-majlis/calendar/[id] — one session as an .ics file, so "Add to
 * calendar" puts it in a phone's calendar with its time and venue.
 * Behind the portal's gate: the venue is the cohort's, not the public's.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasAccess } from "@/lib/youth-majlis/gate";
import { MODULES, SHAYKH } from "@/lib/youth-majlis/content";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const compact = (date: string, time: string) => `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAccess("majlis"))) return NextResponse.redirect(new URL("/youth-majlis", req.url));
  const { id } = await params;
  const s = await db.youthMajlisSession.findUnique({ where: { id } }).catch(() => null);
  if (!s?.date) return new NextResponse("Not found", { status: 404 });

  const m = MODULES.find((x) => x.n === s.moduleN);
  const date = s.date.toISOString().slice(0, 10);
  const start = s.startTime ?? "17:30", end = s.endTime ?? "21:00";
  const title = `Youth Majlis: Sūrah ${m?.surahEn ?? ""}, session ${s.seq}`;
  const body = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TafsirLab//Youth Majlis//EN", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${s.id}@tafsir-lab.com`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "")}`,
    `DTSTART;TZID=Europe/London:${compact(date, start)}`,
    `DTEND;TZID=Europe/London:${compact(date, end)}`,
    `SUMMARY:${esc(title)}`,
    ...(s.venue ? [`LOCATION:${esc(s.venue)}`] : []),
    `DESCRIPTION:${esc(`With ${SHAYKH}. ${m?.title ?? ""}.`)}`,
    "BEGIN:VALARM", "TRIGGER:-PT3H", "ACTION:DISPLAY", `DESCRIPTION:${esc(title)}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="youth-majlis-${date}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
