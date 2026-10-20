import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/server/admin";
import { getRehearsalPreview } from "@/server/production-rehearsal-data-access";
import { RehearsalGameApp } from "@/components/game/production";
import { loadAdminPageModel } from "../../../section-page";
export const dynamic = "force-dynamic";
export default async function RehearsalPreview({
  params,
}: {
  params: Promise<{ rehearsalId: string; version: string }>;
}) {
  await loadAdminPageModel(() => requireSuperadmin());
  const { rehearsalId, version } = await params;
  const artifact = await getRehearsalPreview(rehearsalId, Number(version));
  if (!artifact) notFound();
  return (
    <RehearsalGameApp
      definition={artifact.definition}
      reference={artifact.ref}
      returnTo="/admin/challenges"
    />
  );
}
