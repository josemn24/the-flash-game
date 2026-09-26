import { notFound } from "next/navigation";
import { AdminAttemptList } from "@/components/admin";
import { getSuperadminAttemptListPageModel } from "@/server/data-access";
import { loadAdminPageModel } from "../../../../section-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Intentos del desafío · Portal de operaciones",
};

export default async function AdminAttemptListPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ roomId: string; scheduledChallengeId: string }>;
  readonly searchParams: Promise<{ cursorAt?: string; cursorId?: string }>;
}) {
  const { roomId, scheduledChallengeId } = await params;
  const query = await searchParams;
  const cursor =
    query.cursorAt && query.cursorId
      ? { startedAt: query.cursorAt, attemptId: query.cursorId }
      : null;
  const page = await loadAdminPageModel(() =>
    getSuperadminAttemptListPageModel(roomId, scheduledChallengeId, cursor),
  );
  if (!page) notFound();
  return <AdminAttemptList model={page} />;
}
