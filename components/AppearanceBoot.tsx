"use client";

/**
 * Applies stored theme and reading-size preferences on load, everywhere.
 *
 * Without this they would only take effect where the settings menu is
 * mounted — the dashboard — so opening a workspace directly would show the
 * defaults until the user navigated back. Renders nothing.
 */

import { useEffect } from "react";
import { applyAppearance } from "@/lib/appearance";

export default function AppearanceBoot() {
  useEffect(() => { applyAppearance(); }, []);
  return null;
}
