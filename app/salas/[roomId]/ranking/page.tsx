import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlashPopRoomRanking } from "@/components/game";
import { demoRooms } from "@/data/demoRoom";
import { getRoomById } from "@/lib/roomDetail";
import { getRoomLeaderboard } from "@/lib/roomRankings";

type Props = {
  params: Promise<{ roomId: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return demoRooms.map((room) => ({ roomId: room.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { roomId } = await params;
  const room = getRoomById(roomId);

  return {
    title: room ? `Ranking de ${room.title} — Flash Pop` : "Ranking — Flash Pop",
  };
}

export default async function RoomRankingPage({ params }: Props) {
  const { roomId } = await params;
  const room = getRoomById(roomId);

  if (!room) {
    notFound();
  }

  return (
    <FlashPopRoomRanking
      roomId={room.id}
      roomTitle={room.title}
      currentUserId={room.currentUserId}
      entries={getRoomLeaderboard(room)}
    />
  );
}
