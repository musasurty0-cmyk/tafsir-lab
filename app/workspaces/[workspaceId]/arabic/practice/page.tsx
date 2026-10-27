/**
 * /workspaces/[workspaceId]/arabic/practice?scope=due|lesson|unlock&lesson=<id>
 *   due    — today's review
 *   lesson — practise one lesson
 *   unlock — the one-time pass over a lesson's unanswered cards
 */

export const dynamic = "force-dynamic";

import { getSession } from "@/lib/session";
import * as ArabicService from "@/lib/services/arabic.service";
import ArabicPractice from "@/components/workspace/arabic/ArabicPractice";
import { lessonLabel } from "@/components/workspace/arabic/lesson-label";

export default async function ArabicPracticePage({
  params, searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ scope?: string; lesson?: string }>;
}) {
  const { workspaceId } = await params;
  const { scope: rawScope, lesson: lessonId } = await searchParams;
  const { userId } = await getSession();

  const scope = rawScope === "lesson" || rawScope === "unlock" ? rawScope : "due";
  const lessons = await ArabicService.listLessons(workspaceId, userId);
  const l = lessonId ? lessons.find((x) => x.id === lessonId) : undefined;
  const lesson = l ? { id: l.id, title: l.title, label: lessonLabel(l) } : null;

  const finalScope = scope === "due" || lesson ? scope : "due";
  /* Keyed, so moving from one session to another (an unlock test, then
     today's review) starts fresh instead of carrying the last one's state. */
  return (
    <ArabicPractice
      key={`${finalScope}:${lesson?.id ?? ""}`}
      workspaceId={workspaceId}
      scope={finalScope}
      lesson={lesson}
    />
  );
}
