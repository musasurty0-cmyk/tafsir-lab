"use client";

/**
 * AppSidebar — the persistent left column for app-level destinations.
 *
 * The Rail this sits beside in spirit (components/workspace/Rail.tsx) switches
 * between workspaces; this one switches between PARTS OF THE APP. They answer
 * different questions, which is why the workspace switcher moved into Home
 * rather than being crammed in here.
 *
 * The rule inherited from the Rail holds: nothing in here is decorative. Every
 * row navigates somewhere that exists, so there is no disabled state and no
 * "coming soon" — if a destination is not built, its row is not here.
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home, Users, PieChart, Trophy, Settings, MessageSquare, LogOut,
} from "lucide-react";
import { pushWithSplash } from "@/lib/nav-splash";
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

/* Order is deliberate: what you do (Home), who you do it with (Friends),
   how it is going (Analytics, Leaderboard), then the settings drawer. */
const ITEMS: Item[] = [
  { href: "/home",        label: "Home",       Icon: Home },
  { href: "/friends",     label: "Friends",    Icon: Users },
  { href: "/analytics",   label: "Analytics",  Icon: PieChart },
  { href: "/leaderboard", label: "Leaderboard", Icon: Trophy },
  { href: "/settings",    label: "Settings",   Icon: Settings },
  { href: "/contact",     label: "Contact Us", Icon: MessageSquare },
];

export default function AppSidebar({ user }: { user: SidebarUser | null }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // Hard navigation on purpose: a client push would keep the signed-in
      // React tree (and its caches) alive behind the login screen.
      window.location.href = "/login";
    }
  }

  return (
    <nav className="app-sidebar" aria-label="Main">
      <Link href="/settings" className="app-sidebar-me" title={user?.name ?? "Account"}>
        <Avatar
          name={user?.name ?? ""}
          avatarUrl={user?.avatarUrl}
          className="app-sidebar-avatar"
        />
        <span className="app-sidebar-me-pencil" aria-hidden>✎</span>
      </Link>

      <div className="app-sidebar-items">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <button
              key={href}
              className="app-sidebar-item"
              data-active={active ? "true" : "false"}
              aria-current={active ? "page" : undefined}
              onClick={() => { if (!active) pushWithSplash(router, href); }}
            >
              <Icon size={20} strokeWidth={1.6} aria-hidden />
              <span className="app-sidebar-label">{label}</span>
            </button>
          );
        })}
      </div>

      <button className="app-sidebar-item app-sidebar-out" onClick={signOut} disabled={signingOut}>
        <LogOut size={20} strokeWidth={1.6} aria-hidden />
        <span className="app-sidebar-label">{signingOut ? "…" : "Logout"}</span>
      </button>
    </nav>
  );
}
