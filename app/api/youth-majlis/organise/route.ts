/**
 * POST /api/youth-majlis/organise   { action, ...fields }
 *
 * Everything an organiser changes, so running the Majlis needs no code:
 *   session.save     create or edit a session (dates, venue, prep, takeaways…)
 *   session.delete
 *   assignment.save  set research for a session, for one student or several
 *   assignment.delete
 *   member.role      make someone an organiser, a student, or remove them
 *   settings.save    the announcement shown at the top of the portal
 *   cohort.create    make the shared cohort workspace
 *
 * Behind the portal's gate, a TafsirLab session, and the organiser role.
 * Every field is validated and bounded before it reaches the database.
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionOrNull } from "@/lib/session";
import { hasAccess } from "@/lib/youth-majlis/gate";
import { isOrganiser, saveSettings } from "@/lib/youth-majlis/data";
import { createCohortWorkspace } from "@/lib/youth-majlis/workspace";
import { MODULES } from "@/lib/youth-majlis/content";

class Bad extends Error {}

const str = (v: unknown, max: number): string | null => {
  if (v == null) return null;
  if (typeof v !== "string") throw new Bad("Expected text.");
  const t = v.trim();
  if (t.length > max) throw new Bad(`Keep it under ${max} characters.`);
  return t || null;
};
const date = (v: unknown): Date | null => {
  const t = str(v, 10);
  if (!t) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(Date.parse(t))) throw new Bad("Dates look like 2026-11-01.");
  return new Date(`${t}T00:00:00Z`);
};
const time = (v: unknown): string | null => {
  const t = str(v, 5);
  if (!t) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) throw new Bad("Times look like 17:30.");
  return t;
};
const int = (v: unknown, lo: number, hi: number): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < lo || n > hi) throw new Bad(`Expected a whole number from ${lo} to ${hi}.`);
  return n;
};
const lines = (v: unknown, max: number, each: number): string[] => {
  if (v == null) return [];
  if (!Array.isArray(v)) throw new Bad("Expected a list.");
  const out = v.map((x) => str(x, each)).filter((x): x is string => !!x);
  if (out.length > max) throw new Bad(`At most ${max} items.`);
  return out;
};
const url = (v: unknown): string | null => {
  const t = str(v, 500);
  if (!t) return null;
  try { const u = new URL(t); if (u.protocol !== "https:" && u.protocol !== "http:") throw 0; return u.toString(); }
  catch { throw new Bad("The recording link should be a full web address."); }
};
const uuid = (v: unknown): string => {
  if (typeof v !== "string" || !/^[0-9a-f-]{36}$/i.test(v)) throw new Bad("Unknown item.");
  return v;
};

export async function POST(req: NextRequest) {
  if (!(await hasAccess("majlis"))) return NextResponse.json({ error: "Locked." }, { status: 403 });
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "Sign in to TafsirLab first." }, { status: 401 });
  if (!(await isOrganiser(session.userId))) return NextResponse.json({ error: "Organisers only." }, { status: 403 });

  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || typeof b.action !== "string") return NextResponse.json({ error: "Nothing to do." }, { status: 400 });

  try {
    switch (b.action) {
      case "session.save": {
        const moduleN = int(b.moduleN, 1, MODULES.length);
        if (!moduleN) throw new Bad("Choose a module.");
        const data = {
          date: date(b.date), startTime: time(b.startTime), endTime: time(b.endTime), venue: str(b.venue, 120),
          ayahFrom: int(b.ayahFrom, 1, 286), ayahTo: int(b.ayahTo, 1, 286),
          prep: lines(b.prep, 30, 400).map((text) => ({ text })) as Prisma.InputJsonValue,
          prepDue: date(b.prepDue),
          takeaways: lines(b.takeaways, 12, 600) as Prisma.InputJsonValue,
          recordingUrl: url(b.recordingUrl), followUp: str(b.followUp, 1000),
          agenda: (Array.isArray(b.agenda) ? b.agenda : []).slice(0, 20).map((x) => {
            const o = (x ?? {}) as { time?: unknown; item?: unknown };
            return { time: time(o.time) ?? "", item: str(o.item, 200) ?? "" };
          }).filter((x) => x.item) as Prisma.InputJsonValue,
        };
        if (b.id) {
          const s = await db.youthMajlisSession.update({ where: { id: uuid(b.id) }, data, select: { id: true } });
          return NextResponse.json({ ok: true, id: s.id });
        }
        const last = await db.youthMajlisSession.findFirst({ where: { moduleN }, orderBy: { seq: "desc" }, select: { seq: true } });
        const s = await db.youthMajlisSession.create({ data: { ...data, moduleN, seq: (last?.seq ?? 0) + 1 }, select: { id: true } });
        return NextResponse.json({ ok: true, id: s.id });
      }
      case "session.delete": {
        await db.youthMajlisSession.delete({ where: { id: uuid(b.id) } });
        return NextResponse.json({ ok: true });
      }
      case "assignment.save": {
        const userIds = (Array.isArray(b.userIds) ? b.userIds : []).map(uuid).slice(0, 40);
        if (!userIds.length) throw new Bad("Choose at least one student.");
        const data = {
          point: int(b.point, 1, 10), ayahFrom: int(b.ayahFrom, 1, 286), ayahTo: int(b.ayahTo, 1, 286),
          note: str(b.note, 600), due: date(b.due),
        };
        if (data.point == null && data.ayahFrom == null && !data.note) throw new Bad("Give it a point, an āyah range or a note.");
        const id = await db.$transaction(async (tx) => {
          const a = b.id
            ? await tx.youthMajlisAssignment.update({ where: { id: uuid(b.id) }, data, select: { id: true } })
            : await tx.youthMajlisAssignment.create({ data: { ...data, sessionId: uuid(b.sessionId) }, select: { id: true } });
          await tx.youthMajlisAssignee.deleteMany({ where: { assignmentId: a.id } });
          await tx.youthMajlisAssignee.createMany({ data: userIds.map((userId) => ({ assignmentId: a.id, userId })) });
          return a.id;
        });
        return NextResponse.json({ ok: true, id });
      }
      case "assignment.delete": {
        await db.youthMajlisAssignment.delete({ where: { id: uuid(b.id) } });
        return NextResponse.json({ ok: true });
      }
      case "member.role": {
        const role = b.role === "organiser" || b.role === "student" || b.role === "left" ? b.role : null;
        if (!role) throw new Bad("Unknown role.");
        const userId = uuid(b.userId);
        if (userId === session.userId && role !== "organiser") {
          const others = await db.youthMajlisProgress.count({ where: { role: "organiser", userId: { not: userId } } });
          if (!others) throw new Bad("You’re the only organiser. Make someone else an organiser first.");
        }
        await db.youthMajlisProgress.update({ where: { userId }, data: { role } });
        return NextResponse.json({ ok: true });
      }
      case "settings.save": {
        await saveSettings({ announcement: str(b.announcement, 600) ?? "" });
        return NextResponse.json({ ok: true });
      }
      case "cohort.create": {
        const id = await createCohortWorkspace(session.userId);
        return NextResponse.json({ ok: true, id });
      }
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof Bad) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "That item no longer exists." }, { status: 404 });
    }
    throw e;
  }
}
