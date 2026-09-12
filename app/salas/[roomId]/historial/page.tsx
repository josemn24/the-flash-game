import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlashPopRoomHistory } from "@/components/game";
import { getRoomHistoryPageModel } from "@/server/data-access";

type Props = {
  params: Promise<{ roomId: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { roomId } = await params;
  const room = await getRoomHistoryPageModel(roomId);

  return {
    title: room ? `Historial de ${room.roomTitle} — Flash Pop` : "Historial — Flash Pop",
  };
}

export default async function RoomHistoryPage({ params }: Props) {
  const { roomId } = await params;
  const model = await getRoomHistoryPageModel(roomId);

  if (!model) {
    notFound();
  }
  return (
    <FlashPopRoomHistory roomId={model.roomId} entries={model.entries} rankings={model.rankings} />
  );
}
