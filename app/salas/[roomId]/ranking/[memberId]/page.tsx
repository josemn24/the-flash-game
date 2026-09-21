import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlashPopRoomMemberDetail } from "@/components/game";
import { demoRooms } from "@/data/demoRoom";
import { getRoomById } from "@/lib/roomDetail";
import { buildRoomMemberDetailModel } from "@/lib/roomMemberDetail";

type Props = {
  params: Promise<{ roomId: string; memberId: string }>;
};

export const dynamic = "force-dynamic";
export const dynamicParams = false;

export function generateStaticParams() {
  return demoRooms.flatMap((room) =>
    room.members.map((member) => ({ roomId: room.id, memberId: member.id })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { roomId, memberId } = await params;
  const room = getRoomById(roomId);
  const member = room?.members.find((candidate) => candidate.id === memberId);

  return member && room
    ? {
        title: `${member.name} — ${room.title} — Flash Pop`,
        description: `Detalle del intento de ${member.name} en el ranking de hoy de ${room.title}.`,
      }
    : { title: "Jugador no encontrado — Flash Pop" };
}

export default async function RoomMemberRankingPage({ params }: Props) {
  const { roomId, memberId } = await params;
  const room = getRoomById(roomId);
  if (!room) notFound();

  const model = buildRoomMemberDetailModel(room, memberId);
  if (!model) notFound();

  return <FlashPopRoomMemberDetail model={model} />;
}
