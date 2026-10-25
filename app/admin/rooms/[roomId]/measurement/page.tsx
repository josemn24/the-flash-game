import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { SeasonMeasurementPanel } from "@/components/admin/SeasonMeasurementPanel";
import { roomMeasurement } from "@/server/product/room-measurement";
import { getSuperadminRoomDetailPageModel } from "@/server/production-admin-data-access";
import { loadAdminPageModel } from "@/app/admin/section-page";

export const dynamic = "force-dynamic";
export default async function RoomMeasurementPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ season?: string; page?: string }>;
}) {
  const { roomId } = await params;
  const query = await searchParams;
  const [room, report] = await Promise.all([
    loadAdminPageModel(() => getSuperadminRoomDetailPageModel(roomId)),
    roomMeasurement.season(roomId, query.season),
  ]);
  if (!room || !report || report.sources.roomId !== roomId) notFound();
  return (
    <AdminShell
      operator={room.operator}
      activeSection="rooms"
      breadcrumbs={[
        { label: room.room.title, href: `/admin/rooms/${roomId}` },
        { label: "Medición de temporada" },
      ]}
    >
      <SeasonMeasurementPanel
        report={report}
        timeZone={room.room.timeZone}
        page={Math.max(1, Math.floor(Number(query.page) || 1))}
      />
    </AdminShell>
  );
}
