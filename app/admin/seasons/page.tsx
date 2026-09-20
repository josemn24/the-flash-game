import type { Metadata } from "next";
import { AdminNotice, AdminShell } from "@/components/admin";
import { SeasonManagement } from "@/components/admin/SeasonManagement.client";
import { getSuperadminSeasonsPageModel } from "@/server/data-access";
import { loadAdminPageModel } from "../section-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Temporadas · Portal de operaciones",
};

type AdminSeasonsPageProps = {
  readonly searchParams: Promise<{ season?: string }>;
};

export default async function AdminSeasonsPage({ searchParams }: AdminSeasonsPageProps) {
  const page = await loadAdminPageModel(getSuperadminSeasonsPageModel);
  const params = await searchParams;
  const notices = {
    created: "Borrador de temporada creado.",
    updated: "Borrador de temporada actualizado.",
    activated: "Temporada activada correctamente.",
  } as const;
  const notice = params.season && Object.prototype.hasOwnProperty.call(notices, params.season)
    ? notices[params.season as keyof typeof notices]
    : null;
  return (
    <AdminShell
      operator={page.operator}
      activeSection="seasons"
      breadcrumbs={[{ label: "Resumen", href: "/admin" }, { label: "Temporadas" }]}
    >
      {notice ? <AdminNotice title={notice} description="El contexto operativo se ha actualizado." /> : null}
      <SeasonManagement rooms={page.rooms} />
    </AdminShell>
  );
}
