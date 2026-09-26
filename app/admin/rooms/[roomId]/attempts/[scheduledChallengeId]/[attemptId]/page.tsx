import { notFound } from "next/navigation";
import { AdminAttemptDetail } from "@/components/admin";
import { getSuperadminAttemptInspectionPageModel } from "@/server/data-access";
import { loadAdminPageModel } from "../../../../../section-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Inspección de intento · Portal de operaciones",
};

export default async function AdminAttemptDetailPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ roomId: string; scheduledChallengeId: string; attemptId: string }>;
  readonly searchParams: Promise<{ updated?: string }>;
}) {
  const { roomId, scheduledChallengeId, attemptId } = await params;
  const query = await searchParams;
  const page = await loadAdminPageModel(() =>
    getSuperadminAttemptInspectionPageModel(roomId, scheduledChallengeId, attemptId),
  );
  if (!page) notFound();
  return <AdminAttemptDetail model={page} updated={query.updated === "1"} />;
}
