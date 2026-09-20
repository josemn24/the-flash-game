import type { Metadata } from "next";
import { AdminNotice, AdminShell } from "@/components/admin";
import { CalendarManagement } from "@/components/admin/CalendarManagement.client";
import { getSuperadminCalendarPageModel } from "@/server/data-access";
import { loadAdminPageModel } from "../section-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Calendario · Portal de operaciones",
};

type AdminCalendarPageProps = {
  readonly searchParams: Promise<{ calendar?: string }>;
};

export default async function AdminCalendarPage({ searchParams }: AdminCalendarPageProps) {
  const page = await loadAdminPageModel(getSuperadminCalendarPageModel);
  const params = await searchParams;
  const notices = {
    created: "Publicación programada correctamente.",
    updated: "Publicación reprogramada correctamente.",
  } as const;
  const notice = params.calendar && Object.prototype.hasOwnProperty.call(notices, params.calendar)
    ? notices[params.calendar as keyof typeof notices]
    : null;
  return (
    <AdminShell
      operator={page.operator}
      activeSection="calendar"
      breadcrumbs={[{ label: "Resumen", href: "/admin" }, { label: "Calendario" }]}
    >
      {notice ? <AdminNotice title={notice} description="El calendario operativo se ha actualizado." /> : null}
      <CalendarManagement context={page.context} calendar={page.calendar} />
    </AdminShell>
  );
}
