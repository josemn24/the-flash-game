import type { Metadata } from "next";
import { AdminNotice, AdminShell } from "@/components/admin";
import { EditorialManagement } from "@/components/admin/EditorialManagement.client";
import { getSuperadminContentPageModel } from "@/server/data-access";
import { loadAdminPageModel } from "../section-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contenido Flash · Portal de operaciones",
};

type AdminContentPageProps = {
  readonly searchParams: Promise<{ editorial?: string }>;
};

export default async function AdminContentPage({ searchParams }: AdminContentPageProps) {
  const page = await loadAdminPageModel(getSuperadminContentPageModel);
  const params = await searchParams;
  const notices = {
    saved: "Borrador editorial guardado.",
    published: "Versión editorial publicada.",
  } as const;
  const notice = params.editorial && Object.prototype.hasOwnProperty.call(notices, params.editorial)
    ? notices[params.editorial as keyof typeof notices]
    : null;
  return (
    <AdminShell
      operator={page.operator}
      activeSection="content"
      breadcrumbs={[{ label: "Resumen", href: "/admin" }, { label: "Contenido Flash" }]}
    >
      {notice ? <AdminNotice title={notice} description="El catálogo editorial se ha actualizado." /> : null}
      <EditorialManagement context={page.editorial} questionLibrary={page.questionLibrary} />
    </AdminShell>
  );
}
