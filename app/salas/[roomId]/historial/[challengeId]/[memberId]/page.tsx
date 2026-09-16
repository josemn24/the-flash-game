import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlashPopRoomMemberDetail } from "@/components/game";
import { getRoomMemberDetailPageModel } from "@/server/data-access";

type Props = {
  params: Promise<{ roomId: string; challengeId: string; memberId: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { roomId, challengeId, memberId } = await params;
  const model = await getRoomMemberDetailPageModel(roomId, memberId, challengeId);
  return {
    title: model
      ? `${model.member.name} — ${model.roomTitle} — Flash Pop`
      : "Resultado — Flash Pop",
  };
}

export default async function HistoricalMemberPage({ params }: Props) {
  const { roomId, challengeId, memberId } = await params;
  const model = await getRoomMemberDetailPageModel(roomId, memberId, challengeId);
  if (!model) notFound();
  return <FlashPopRoomMemberDetail model={model} />;
}
