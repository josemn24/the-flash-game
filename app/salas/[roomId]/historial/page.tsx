import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlashPopRoomHistory } from "@/components/game";
import { demoRooms } from "@/data/demoRoom";
import { getRoomHistory } from "@/data/roomHistory";
import { getRoomById } from "@/lib/roomDetail";
import { getHistoryLeaderboard } from "@/lib/roomRankings";

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
    title: room ? `Historial de ${room.title} — Flash Pop` : "Historial — Flash Pop",
  };
}

export default async function RoomHistoryPage({ params }: Props) {
  const { roomId } = await params;
  const room = getRoomById(roomId);

  if (!room) {
    notFound();
  }

  const entries = getRoomHistory(room.id);
  const rankings = Object.fromEntries(
    entries.map((entry) => [entry.challengeId, getHistoryLeaderboard(room, entry)]),
  );

  return <FlashPopRoomHistory roomId={room.id} entries={entries} rankings={rankings} />;
}
