import type { Metadata } from "next";
import { AdminNotice, AdminShell, ChallengesOverview } from "@/components/admin";
import { getSuperadminChallengesPageModel } from "@/server/data-access";
import { loadAdminPageModel } from "../section-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Desafíos · Portal de operaciones",
};

type AdminChallengesPageProps = {
  readonly searchParams: Promise<{ editorial?: string }>;
};

export default async function AdminChallengesPage({ searchParams }: AdminChallengesPageProps) {
  const page = await loadAdminPageModel(getSuperadminChallengesPageModel);
  const params = await searchParams;
  const notice =
    params.editorial === "saved"
      ? "Borrador editorial guardado."
      : params.editorial === "published"
        ? "Versión editorial publicada."
        : null;
  return (
    <AdminShell
      operator={page.operator}
      activeSection="challenges"
      breadcrumbs={[{ label: "Resumen", href: "/admin" }, { label: "Desafíos" }]}
    >
      {notice ? (
        <AdminNotice title={notice} description="El catálogo editorial se ha actualizado." />
      ) : null}
      <ChallengesOverview challenges={page.challenges} />
    </AdminShell>
  );
}
