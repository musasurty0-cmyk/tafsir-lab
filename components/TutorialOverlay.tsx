"use client";

import { useEffect } from "react";
import { startTour, isTourDone } from "@/lib/tour";

export default function TutorialOverlay() {
  useEffect(() => {
    if (!isTourDone()) startTour();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
