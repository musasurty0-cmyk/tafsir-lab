"use client";

/**
 * StudyWithAI — the dashboard entry point to the assistant.
 *
 * This was a stub that explained an unbuilt feature. The feature exists now, so
 * the banner is what it should always have been: a link. The explaining moved
 * to the assistant page itself, where it belongs.
 */

import { useRouter } from "next/navigation";
import { Sparkles, ChevronRight } from "lucide-react";
import { pushWithSplash } from "@/lib/nav-splash";

export default function StudyWithAI() {
  const router = useRouter();

  return (
    <button className="ai-banner" onClick={() => pushWithSplash(router, "/assistant")}>
      <span className="ai-banner-icon" aria-hidden><Sparkles size={19} /></span>
      <span className="ai-banner-text">
        <strong>Lab AI</strong>
        <span>
          Ask about any verse or theme. It teaches from the classical tafsīr in
          your library and quotes it, with the source shown.
        </span>
      </span>
      <ChevronRight size={18} aria-hidden className="ai-banner-chev" />
    </button>
  );
}
