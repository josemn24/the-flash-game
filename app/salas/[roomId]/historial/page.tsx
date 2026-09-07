import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlashPopRoomHistory } from "@/components/game";
import { demoRooms } from "@/data/demoRoom";
import { getRoomHistory } from "@/data/roomHistory";
import { getRoomById } from "@/lib/roomDetail";

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

  return (
    <FlashPopRoomHistory
      roomId={room.id}
      roomTitle={room.title}
      members={room.members}
      entries={getRoomHistory(room.id)}
    />
  );
}
