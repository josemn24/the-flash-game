import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlashPopRoomMemberDetail } from "@/components/game";
import { getRoomMemberDetailPageModel } from "@/server/data-access";

type Props = {
  params: Promise<{ roomId: string; memberId: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { roomId, memberId } = await params;
  const model = await getRoomMemberDetailPageModel(roomId, memberId);

  return model
    ? {
        title: `${model.member.name} — ${model.roomTitle} — Flash Pop`,
        description: `Detalle del intento de ${model.member.name} en el ranking de hoy de ${model.roomTitle}.`,
      }
    : { title: "Jugador no encontrado — Flash Pop" };
}

export default async function RoomMemberRankingPage({ params }: Props) {
  const { roomId, memberId } = await params;
  const model = await getRoomMemberDetailPageModel(roomId, memberId);
  if (!model) notFound();

  return <FlashPopRoomMemberDetail model={model} />;
}
