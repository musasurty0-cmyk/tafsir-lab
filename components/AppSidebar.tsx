"use client";

/**
 * AppSidebar — the persistent left column for app-level destinations.
 *
 * The Rail (components/workspace/Rail.tsx) switches between workspaces; this
 * one switches between PARTS OF THE APP. They answer different questions,
 * which is why the workspace switcher lives in Home rather than in here.
 *
 * Laid out like a Mac sidebar, three widths of one component:
 *   - wide (≥1240px): a floating panel, the wordmark, labelled rows, and your
 *     account at the foot (avatar, name, "Settings", and Log out beside it);
 *   - compact (721–1239px): the same panel as an icon column, names in tooltips;
 *   - phone (≤720px): an iOS tab bar along the bottom: the four places plus You.
 *
 * Nothing in here is decorative. Every row navigates somewhere that exists, so
 * there is no disabled state and no "coming soon".
 */

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Home, Users, PieChart, Trophy, MessageSquare, LogOut } from "lucide-react";
import { pushWithSplash } from "@/lib/nav-splash";
import { signOut } from "@/lib/sign-out";
import Avatar from "./Avatar";

export interface SidebarUser {
  name:      string;
  avatarUrl: string | null;
}

interface Item {
  href:  string;
  label: string;
  Icon:  typeof Home;
}

/* What you do (Home), who you do it with (Friends), how it is going
   (Analytics, Leaderboard). Settings is your account row at the foot. */
const PLACES: Item[] = [
  { href: "/home",        label: "Home",        Icon: Home },
  { href: "/friends",     label: "Friends",     Icon: Users },
  { href: "/analytics",   label: "Analytics",   Icon: PieChart },
  { href: "/leaderboard", label: "Leaderboard", Icon: Trophy },
];

export default function AppSidebar({ user }: { user: SidebarUser | null }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [leaving, setLeaving] = useState(false);

  const isAt = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const go   = (href: string) => { if (!isAt(href)) pushWithSplash(router, href); };
  const name = user?.name?.trim() || "Your account";

  /* Every row carries aria-label as well as its visible text: the label span
     is display:none in the compact column, and display:none removes text from
     the accessibility tree, so without it the row would be an unnamed button. */
  const row = ({ href, label, Icon }: Item, quiet = false) => {
    const here = isAt(href);
    return (
      <button
        key={href}
        className={"sb-row" + (quiet ? " sb-row--quiet" : "")}
        data-active={here ? "true" : "false"}
        aria-current={here ? "page" : undefined}
        aria-label={label}
        title={label}
        onClick={() => go(href)}
      >
        <Icon className="sb-ico" size={19} strokeWidth={1.75} aria-hidden />
        <span className="sb-label">{label}</span>
      </button>
    );
  };

  return (
    <nav className="app-sidebar" aria-label="Main">
      <button className="sb-brand" onClick={() => go("/home")} aria-label="TafsirLab home" title="TafsirLab">
        <span className="sb-mark" aria-hidden>T</span>
        <span className="sb-word">TafsirLab</span>
      </button>

      <div className="sb-places">
        {PLACES.map((it) => row(it))}
      </div>

      <div className="sb-foot">
        {row({ href: "/contact", label: "Contact us", Icon: MessageSquare }, true)}

        <div className="sb-me" data-active={isAt("/settings") ? "true" : "false"}>
          <button
            className="sb-me-open"
            aria-current={isAt("/settings") ? "page" : undefined}
            aria-label={`${name}, settings`}
            title="Settings"
            onClick={() => go("/settings")}
          >
            <Avatar name={user?.name ?? ""} avatarUrl={user?.avatarUrl} className="sb-avatar" />
            <span className="sb-me-text">
              <span className="sb-me-name">{name}</span>
              <span className="sb-me-sub">Settings</span>
            </span>
            {/* The tab bar's label for this one. */}
            <span className="sb-me-tab" aria-hidden>You</span>
          </button>
          <button
            className="sb-out"
            onClick={() => { setLeaving(true); void signOut(); }}
            disabled={leaving}
            aria-busy={leaving}
            aria-label="Log out"
            title="Log out"
          >
            <LogOut size={17} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </div>
    </nav>
  );
}
