"use client";

/**
 * HomeRail — the dashboard's right column: what you wrote last, and what you
 * saved.
 *
 * Both lists are links to a real place, so the rail is a way back into work
 * rather than a display. When either is empty it says what would put something
 * there instead of showing a bare heading over nothing.
 */

import { useRouter } from "next/navigation";
import { Clock, Bookmark } from "lucide-react";
import { pushWithSplash } from "@/lib/nav-splash";
import type { RailItem } from "@/lib/services/bookmarks.service";

interface Props {
  recent:    RailItem[];
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
}: { title: string; Icon: typeof Clock; items: RailItem[]; empty: string }) {
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

export default function HomeRail({ recent, bookmarks }: Props) {
  return (
    <aside className="home-rail" aria-label="Recent and saved">
      <Section
        title="Recent Annotations" Icon={Clock} items={recent}
        empty="Notes you write will appear here, with a way straight back to them."
      />
      <Section
        title="Bookmarks" Icon={Bookmark} items={bookmarks}
        empty="No bookmarks yet. Save a place from a page's menu to pin it here."
      />
    </aside>
  );
}
