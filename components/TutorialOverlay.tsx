"use client";

import { useEffect } from "react";
import { startTour, isTourDone } from "@/lib/tour";

export default function TutorialOverlay() {
  useEffect(() => {
    if (!isTourDone()) startTour();
   
  }, []);
  return null;
}
