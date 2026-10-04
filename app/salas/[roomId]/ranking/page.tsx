import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlashPopRoomRanking } from "@/components/game/production";
import { getRoomRankingPageModel } from "@/server/production-room-data-access";

type Props = {
  params: Promise<{ roomId: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { roomId } = await params;
  // A failed data read is handled by the page's retry boundary, not by metadata streaming.
  const room = await getRoomRankingPageModel(roomId).catch(() => null);
  const label =
    room?.season?.status === "finished" ? "Clasificación final" : "Ranking de temporada";

  return {
    title: room ? `${label} de ${room.roomTitle} — The Flash` : "Ranking — The Flash",
  };
}

export default async function RoomRankingPage({ params }: Props) {
  const { roomId } = await params;
  const room = await getRoomRankingPageModel(roomId);

  if (!room) {
    notFound();
  }

  return <FlashPopRoomRanking {...room} />;
}
