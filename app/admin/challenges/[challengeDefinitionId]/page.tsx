import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminNotice, AdminShell, EditorialManagement } from "@/components/admin";
import { ButtonLink } from "@/components/ui";
import { getSuperadminChallengeDetailPageModel } from "@/server/production-admin-data-access";
import { loadAdminPageModel } from "../../section-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Detalle de desafío · Portal de operaciones",
};

type AdminChallengeDetailPageProps = {
  readonly params: Promise<{ challengeDefinitionId: string }>;
  readonly searchParams: Promise<{
    editorial?: string;
    draftId?: string;
    compareFrom?: string;
    compareTo?: string;
  }>;
};

export default async function AdminChallengeDetailPage({
  params,
  searchParams,
}: AdminChallengeDetailPageProps) {
  const { challengeDefinitionId } = await params;
  const query = await searchParams;
  const page = await loadAdminPageModel(() =>
    getSuperadminChallengeDetailPageModel(
      challengeDefinitionId,
      query.compareFrom && query.compareTo ? [query.compareFrom, query.compareTo] : undefined,
    ),
  );
  if (!page) notFound();
  const notice =
    query.editorial === "saved"
      ? "Borrador editorial guardado."
      : query.editorial === "published"
        ? "Versión editorial publicada."
        : query.editorial === "revision-created"
          ? "Nueva versión creada como borrador."
          : query.editorial === "archived"
            ? "Versión editorial archivada."
            : null;
  const hasDraft = page.editorial.entries.some((entry) => entry.status === "draft");
  return (
    <AdminShell
      operator={page.operator}
      activeSection="challenges"
      breadcrumbs={[
        { label: "Resumen", href: "/admin" },
        { label: "Desafíos", href: "/admin/challenges" },
        { label: page.challenge.title },
      ]}
    >
      {notice ? (
        <AdminNotice title={notice} description="El desafío editorial se ha actualizado." />
      ) : null}
      {!hasDraft ? (
        <ButtonLink href="/admin/challenges/new" variant="primary">
          Crear nuevo desafío
        </ButtonLink>
      ) : null}
      <EditorialManagement
        context={page.editorial}
        questionLibrary={page.questionLibrary}
        comparison={page.comparison}
        initialDraftId={query.draftId}
        eyebrow={`Desafío Flash · ${page.challenge.slug}`}
        title={page.challenge.title}
        canCreate={hasDraft}
        allowNewDraft={false}
      />
    </AdminShell>
  );
}
