import type { Metadata } from "next";
import {
  AdminNotice,
  AdminRoomsOverview,
  AdminShell,
} from "@/components/admin";
import { CreateRoomForm } from "@/components/admin/CreateRoomForm.client";
import { getSuperadminRoomsPageModel } from "@/server/data-access";
import { loadAdminPageModel } from "../section-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Salas · Portal de operaciones",
};

type AdminRoomsPageProps = {
  readonly searchParams: Promise<{ created?: string }>;
};

export default async function AdminRoomsPage({ searchParams }: AdminRoomsPageProps) {
  const page = await loadAdminPageModel(getSuperadminRoomsPageModel);
  const params = await searchParams;
  return (
    <AdminShell
      operator={page.operator}
      activeSection="rooms"
      breadcrumbs={[{ label: "Resumen", href: "/admin" }, { label: "Salas" }]}
    >
      <AdminRoomsOverview rooms={page.rooms} />
      {params.created === "1" ? (
        <AdminNotice
          title="Sala creada correctamente."
          description="La nueva sala ya aparece en el contexto operativo."
        />
      ) : null}
      <div id="crear-sala">
        <CreateRoomForm />
      </div>
    </AdminShell>
  );
}
