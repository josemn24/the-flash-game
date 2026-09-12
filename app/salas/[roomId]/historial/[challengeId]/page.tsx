import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlashPopRoomHistoryDetail } from "@/components/game";
import { demoRooms } from "@/data/demoRoom";
import { getRoomHistoryEntry, getRoomHistory } from "@/data/roomHistory";
import { getRoomById } from "@/lib/roomDetail";
import { getHistoryLeaderboard } from "@/lib/roomRankings";

type Props = {
  params: Promise<{ roomId: string; challengeId: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return demoRooms.flatMap((room) =>
    getRoomHistory(room.id).map((entry) => ({ roomId: room.id, challengeId: entry.challengeId })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { roomId, challengeId } = await params;
  const room = getRoomById(roomId);
  const entry = room ? getRoomHistoryEntry(room.id, challengeId) : undefined;

  return {
    title:
      room && entry
        ? `Ranking de ${entry.title} — ${room.title} — Flash Pop`
        : "Ranking — Flash Pop",
  };
}

export default async function RoomHistoryDetailPage({ params }: Props) {
  const { roomId, challengeId } = await params;
  const room = getRoomById(roomId);
  const entry = room ? getRoomHistoryEntry(room.id, challengeId) : undefined;

  if (!room || !entry) {
    notFound();
  }

  return (
    <FlashPopRoomHistoryDetail
      roomId={room.id}
      roomTitle={room.title}
      entry={entry}
      ranking={getHistoryLeaderboard(room, entry)}
      currentUserId={room.currentUserId}
    />
  );
}
