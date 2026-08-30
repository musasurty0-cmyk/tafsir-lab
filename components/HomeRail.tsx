"use client";

/**
 * HomeRail — the dashboard's right column: what you saved.
 *
 * Each entry is a link to a real place, so the rail is a way back into work
 * rather than a display. When it is empty it says what would put something
 * there instead of showing a bare heading over nothing.
 *
 * It used to carry a "Recent Annotations" list above this one. Two stacked
 * lists of recent-ish links competed with each other and with the workspace
 * cards that already show recent work, so the rail said the same thing three
 * times. Bookmarks are the half you choose deliberately, so that is the half
 * that stayed.
 */

import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { pushWithSplash } from "@/lib/nav-splash";
import type { RailItem } from "@/lib/services/bookmarks.service";

interface Props {
  bookmarks: RailItem[];
}

function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 1)    return "just now";
  if (mins < 60)   return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24)    return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30)   return `${days}d ago`;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(iso));
}

function Section({
  title, Icon, items, empty,
}: { title: string; Icon: typeof Bookmark; items: RailItem[]; empty: string }) {
  const router = useRouter();

  return (
    <section className="hr-section">
      <h2 className="hr-title"><Icon size={17} aria-hidden /> {title}</h2>

      {items.length === 0 ? (
        <p className="hr-empty">{empty}</p>
      ) : (
        <ul className="hr-list">
          {items.map((it, i) => (
            <li key={it.id} style={{ animationDelay: `${i * 40}ms` }}>
              <button className="hr-item" onClick={() => pushWithSplash(router, it.href)}>
                <span className="hr-item-title">{it.title}</span>
                <span className="hr-item-sub">{it.subtitle}</span>
                <span className="hr-item-at">{ago(it.at)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function HomeRail({ bookmarks }: Props) {
  return (
    <aside className="home-rail" aria-label="Saved places">
      <Section
        title="Bookmarks" Icon={Bookmark} items={bookmarks}
        empty="No bookmarks yet. Save a place from a page's menu to pin it here."
      />
    </aside>
  );
}
