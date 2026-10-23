import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/server/admin";
import {
  getEditorialRehearsal,
  getRehearsalPreview,
} from "@/server/production-rehearsal-data-access";
import { RehearsalPreviewClient } from "@/components/admin/RehearsalManagement.client";
import { loadAdminPageModel } from "../../section-page";
export const dynamic = "force-dynamic";
export default async function RehearsalPreview({
  params,
}: {
  params: Promise<{ challengeVersionId: string }>;
}) {
  await loadAdminPageModel(() => requireSuperadmin());
  const { challengeVersionId } = await params;
  const model = await getEditorialRehearsal(challengeVersionId);
  if (!model) notFound();
  const initial = model.coverage.ready ? await getRehearsalPreview(challengeVersionId) : null;
  return <RehearsalPreviewClient versionId={challengeVersionId} initial={initial} />;
}
