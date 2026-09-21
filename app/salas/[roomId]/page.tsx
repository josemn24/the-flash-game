import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlashPopRoomDetail } from "@/components/game";
import { demoRooms } from "@/data/demoRoom";
import { buildRoomDetailModel, getRoomById } from "@/lib/roomDetail";

type Props = {
  params: Promise<{ roomId: string }>;
};

export const dynamic = "force-dynamic";
export const dynamicParams = false;

export function generateStaticParams() {
  return demoRooms.map((room) => ({ roomId: room.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const room = getRoomById((await params).roomId);

  return room
    ? {
        title: `${room.title} — Flash Pop`,
        description: `Detalle de la sala ${room.title} y su desafío diario.`,
      }
    : {
        title: "Sala no encontrada — Flash Pop",
      };
}

export default async function RoomPage({ params }: Props) {
  const room = getRoomById((await params).roomId);
  if (!room) notFound();

  return <FlashPopRoomDetail model={buildRoomDetailModel(room)} />;
}
