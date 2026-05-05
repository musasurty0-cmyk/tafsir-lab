"use client";

/**
 * TutorialOverlay — auto-starts the in-app tour for first-time users.
 *
 * Has no UI of its own. The TourBubble component (rendered in each page)
 * handles the actual tour UI. This component just reads the "done" flag
 * and calls startTour() once if the user hasn't completed the tour yet.
 *
 * Remount via `key` prop (from HomeClient) to re-trigger for "Replay tutorial".
 */

import { useEffect } from "react";
import { startTour, isTourDone } from "@/lib/tour";

interface Props {
  /** First workspace ID — tour uses this to navigate on step 0 → 1. */
  workspaceId?: string;
}

export default function TutorialOverlay({ workspaceId }: Props) {
  useEffect(() => {
    if (!isTourDone()) {
      startTour(workspaceId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
