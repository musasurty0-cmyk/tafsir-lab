/**
 * Who is allowed to destroy things.
 *
 * canManagePages gates page deletion, and deleting a page cascades to every
 * StructuredNote on it (schema: onDelete Cascade). A wrong answer here is not
 * a wrong screen, it is somebody else's study notes gone.
 *
 * Also covers the form/route contract for the closed-beta application, where
 * the two sides validate against one shared list: if they ever drift, the
 * route rejects an option the form itself offered, and the applicant is told
 * to choose again from a menu where every choice fails.
 */
import { describe, it, expect } from "vitest";
import { canManagePages, type MemberRole } from "./services/workspaces.service";
import { STUDY_BUCKETS, AGE_MIN, AGE_MAX } from "./beta";

describe("canManagePages", () => {
  const roles: MemberRole[] = ["owner", "admin", "member"];

  it("lets owners and admins manage pages regardless of the setting", () => {
    for (const role of ["owner", "admin"] as MemberRole[]) {
      expect(canManagePages(role, false)).toBe(true);
      expect(canManagePages(role, true)).toBe(true);
    }
  });

  it("lets a member manage pages ONLY when the workspace opts in", () => {
    expect(canManagePages("member", false)).toBe(false);
    expect(canManagePages("member", true)).toBe(true);
  });

  it("is the members flag that changes, never the admin answer", () => {
    /* Guards against someone 'simplifying' this to `membersCanManagePages`
       alone, which would lock admins out of their own workspace. */
    const flipped = roles.filter((r) => canManagePages(r, true) !== canManagePages(r, false));
    expect(flipped).toEqual(["member"]);
  });

  it("denies by default for the least-privileged role", () => {
    expect(canManagePages("member", false)).toBe(false);
  });
});

describe("closed-beta form/route contract", () => {
  it("offers at least one option and they are all distinct", () => {
    expect(STUDY_BUCKETS.length).toBeGreaterThan(0);
    expect(new Set(STUDY_BUCKETS).size).toBe(STUDY_BUCKETS.length);
  });

  it("has no option that would be trimmed or emptied in transit", () => {
    /* The route runs each value through a trim-and-truncate helper before
       comparing, so a bucket with surrounding space would never match. */
    for (const b of STUDY_BUCKETS) {
      expect(b).toBe(b.trim());
      expect(b.length).toBeGreaterThan(0);
      expect(b.length).toBeLessThanOrEqual(60);   // the route slices at 60
    }
  });

  it("keeps the age bounds sane and the right way round", () => {
    expect(AGE_MIN).toBeLessThan(AGE_MAX);
    expect(AGE_MIN).toBeGreaterThan(0);
    expect(Number.isInteger(AGE_MIN) && Number.isInteger(AGE_MAX)).toBe(true);
  });

  it("survives a JSON round trip unchanged", () => {
    /* Three buckets contain an en-dash. If anything in the pipeline mangles
       non-ASCII, the route rejects a value the form offered — which is
       exactly what a mis-encoded request produced during testing. */
    for (const b of STUDY_BUCKETS) {
      expect(JSON.parse(JSON.stringify({ v: b })).v).toBe(b);
    }
  });
});
