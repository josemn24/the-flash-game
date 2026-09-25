import { notFound } from "next/navigation";
import { AdminAttemptPublications } from "@/components/admin";
import { getSuperadminAttemptPublicationsPageModel } from "@/server/data-access";
import { loadAdminPageModel } from "../../../section-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Intentos · Portal de operaciones",
};

export default async function AdminAttemptPublicationsPage({
  params,
}: {
  readonly params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const page = await loadAdminPageModel(() => getSuperadminAttemptPublicationsPageModel(roomId));
  if (!page) notFound();
  return <AdminAttemptPublications {...page} />;
}
