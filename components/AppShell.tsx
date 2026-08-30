"use client";

/**
 * AppShell — sidebar + header + scrolling content, shared by every app-level
 * page (Home aside, which owns its own hero).
 *
 * The header is part of the shell rather than each page so the greeting, date
 * and streak do not re-mount — and therefore do not re-animate — when you move
 * between Analytics and Leaderboard. Only the content area changes, which is
 * what makes navigation feel like moving inside one app instead of loading
 * separate documents.
 */

import type { ReactNode } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import Link from "next/link";
import { Search } from "lucide-react";
import AppSidebar, { type SidebarUser } from "./AppSidebar";

export interface ShellStreak { current: number; today: number; goal: number }

interface Props {
  user:      SidebarUser | null;
  streak?:   ShellStreak | null;
  /** Right of the greeting — a search button, a close button, whatever fits. */
  action?:   ReactNode;
  children:  ReactNode;
}

/**
 * Today, in the READER's timezone — which the server does not know.
 *
 * This is a client component, so React renders it twice: once on the server
 * and once in the browser. Vercel runs UTC, so anyone between midnight and
 * their own UTC offset had the server render one date and the browser another,
 * and React discarded the tree with a hydration error. Nobody notices at
 * midday; it fires every night.
 *
 * The non-breaking space keeps the line's height so the greeting does not jump
 * when the date arrives.
 */
function useToday(): string {
  const hydrated = useHydrated();
  if (!hydrated) return " ";
  return ordinalise(new Intl.DateTimeFormat("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(new Date()));
}

/** "29th" rather than "29" — the greeting reads as a sentence, not a log line. */
function ordinalise(s: string) {
  return s.replace(/\b(\d{1,2}) /, (_, d: string) => {
    const n = Number(d);
    const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th"
      : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
    return `${n}${suffix} `;
  });
}

export default function AppShell({ user, streak, action, children }: Props) {
  const todayLabel = useToday();
  const first = (user?.name ?? "").trim() || "friend";

  return (
    <div className="app-shell">
      <AppSidebar user={user} />

      <div className="app-shell-main">
        <header className="app-shell-head">
          <div className="app-shell-greet">
            <h1 className="app-shell-title">Salaam, {first}</h1>
            <p className="app-shell-sub">
              Today is {todayLabel}
              {streak && (
                <>
                  {" "}
                  <span className="app-shell-streak" title={`${streak.current}-day streak`}>
                    <span aria-hidden>🔥</span> {streak.current}
                  </span>
                  {" · "}
                  <span className="app-shell-goal" title="Annotations today, against your daily goal">
                    {streak.today}/{streak.goal}
                  </span>
                </>
              )}
            </p>
          </div>
          {action ?? (
            <Link href="/explore" className="app-shell-search" title="Explore the Qur'an"
                  aria-label="Explore the Qur'an">
              <Search size={20} aria-hidden />
            </Link>
          )}
        </header>

        {/* A landmark, not a div: this is the region a screen-reader user
            jumps to in order to skip the sidebar and the greeting, and the
            sidebar beside it is already a <nav>. */}
        <main className="app-shell-body" id="main">{children}</main>
      </div>
    </div>
  );
}
