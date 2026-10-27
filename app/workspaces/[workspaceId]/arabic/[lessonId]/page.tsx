/**
 * /workspaces/[workspaceId]/arabic/[lessonId] — one lesson's cards.
 */

export const dynamic = "force-dynamic";

import { getSession } from "@/lib/session";
import * as ArabicService from "@/lib/services/arabic.service";
import ArabicLesson from "@/components/workspace/arabic/ArabicLesson";

export default async function ArabicLessonPage({
  params,
}: {
  params: Promise<{ workspaceId: string; lessonId: string }>;
}) {
  const { workspaceId, lessonId } = await params;
  const { userId } = await getSession();

  const [lesson, all] = await Promise.all([
    ArabicService.getLesson(workspaceId, lessonId, userId),
    ArabicService.listLessons(workspaceId, userId),
  ]);
  const i = all.findIndex((l) => l.id === lessonId);
  const pick = (l?: (typeof all)[number]) =>
    l ? { id: l.id, level: l.level, number: l.number, kind: l.kind, title: l.title } : null;

  return (
    <ArabicLesson
      workspaceId={workspaceId}
      lesson={lesson}
      prev={pick(all[i - 1])}
      next={pick(all[i + 1])}
    />
  );
}
