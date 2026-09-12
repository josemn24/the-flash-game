import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlashPopRoomDetail } from "@/components/game";
import { getRoomDetailPageModel } from "@/server/data-access";

type Props = {
  params: Promise<{ roomId: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const room = await getRoomDetailPageModel((await params).roomId);

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
  const model = await getRoomDetailPageModel((await params).roomId);
  if (!model) notFound();

  return <FlashPopRoomDetail model={model} />;
}
