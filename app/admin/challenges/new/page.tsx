import type { Metadata } from "next";
import { AdminShell, EditorialManagement } from "@/components/admin";
import { getSuperadminNewChallengePageModel } from "@/server/data-access";
import { loadAdminPageModel } from "../../section-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nuevo desafío · Portal de operaciones",
};

export default async function NewAdminChallengePage() {
  const page = await loadAdminPageModel(getSuperadminNewChallengePageModel);
  return (
    <AdminShell
      operator={page.operator}
      activeSection="challenges"
      breadcrumbs={[
        { label: "Resumen", href: "/admin" },
        { label: "Desafíos", href: "/admin/challenges" },
        { label: "Nuevo desafío" },
      ]}
    >
      <EditorialManagement
        context={page.editorial}
        questionLibrary={page.questionLibrary}
        eyebrow="S11 · catálogo editorial"
        title="Nuevo desafío Flash"
      />
    </AdminShell>
  );
}
