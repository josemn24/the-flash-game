import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlashPopRoomRanking } from "@/components/game";
import { getRoomRankingPageModel } from "@/server/data-access";

type Props = {
  params: Promise<{ roomId: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { roomId } = await params;
  const room = await getRoomRankingPageModel(roomId);

  return {
    title: room ? `Ranking de ${room.roomTitle} — The Flash` : "Ranking — The Flash",
  };
}

export default async function RoomRankingPage({ params }: Props) {
  const { roomId } = await params;
  const room = await getRoomRankingPageModel(roomId);

  if (!room) {
    notFound();
  }

  return (
    <FlashPopRoomRanking
      roomId={room.roomId}
      roomTitle={room.roomTitle}
      currentUserId={room.currentUserId}
      entries={room.entries}
    />
  );
}
