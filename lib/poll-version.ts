/**
 * "Has anything changed?" for the page's polls, answered without sending it.
 *
 * Every open page polled its notes every 5 s, its group progress every 8 s and
 * all of its ink every 15–20 s, and each poll sent the whole set back. Almost
 * always nothing had changed, but every byte still left the database, and the
 * free plan's 5 GB of egress a month ran out (7.8 GB, and the site went down).
 *
 * A poll now sends the version it last saw. The server works out the current
 * one from a single aggregate — the latest change time and the row count, a
 * few bytes — and only when they differ does it read and send the rows. The
 * count catches a deletion, which leaves no newer timestamp behind.
 */

/** A version string from the newest change and how many rows there are. */
export function pollVersion(latest: Date | null | undefined, count: number): string {
  return `${latest ? latest.getTime() : 0}.${count}`;
}

/** The whole reply to a poll whose version is still current; null means send the data. */
export function unchangedBody(seen: string | null, version: string): { unchanged: true; version: string } | null {
  return seen && seen === version ? { unchanged: true, version } : null;
}

/** The poll URL with the version last seen, if there is one. */
export function withVersion(url: string, version: string | null | undefined): string {
  if (!version) return url;
  return `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}`;
}
