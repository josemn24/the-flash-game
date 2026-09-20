import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminRoomDetail, type AdminRoomTab } from "@/components/admin";
import { getSuperadminRoomDetailPageModel } from "@/server/data-access";
import { loadAdminPageModel } from "../../section-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Detalle de sala · Portal de operaciones",
};

type AdminRoomPageProps = {
  readonly params: Promise<{ roomId: string }>;
  readonly searchParams: Promise<{
    tab?: string;
    season?: string;
    calendar?: string;
    created?: string;
  }>;
};

const tabs = new Set<AdminRoomTab>(["overview", "seasons", "members", "calendar"]);

export default async function AdminRoomPage({ params, searchParams }: AdminRoomPageProps) {
  const { roomId } = await params;
  const page = await loadAdminPageModel(() => getSuperadminRoomDetailPageModel(roomId));
  if (!page) notFound();

  const query = await searchParams;
  const tab = tabs.has(query.tab as AdminRoomTab) ? (query.tab as AdminRoomTab) : "overview";
  const notices: Record<string, string> = {
    created: "Sala creada correctamente.",
    season:
      query.season === "created"
        ? "Borrador de temporada creado."
        : query.season === "updated"
          ? "Borrador de temporada actualizado."
          : "Temporada activada correctamente.",
    calendar:
      query.calendar === "created"
        ? "Publicación programada correctamente."
        : "Publicación reprogramada correctamente.",
  };
  const notice =
    query.created === "1"
      ? notices.created
      : query.season
        ? notices.season
        : query.calendar
          ? notices.calendar
          : null;

  return <AdminRoomDetail model={page} tab={tab} notice={notice} />;
}
