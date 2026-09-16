import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlashPopRoomHistoryDetail } from "@/components/game";
import { getRoomHistoryDetailPageModel } from "@/server/data-access";

type Props = {
  params: Promise<{ roomId: string; challengeId: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { roomId, challengeId } = await params;
  const model = await getRoomHistoryDetailPageModel(roomId, challengeId);

  return {
    title: model
      ? `Ranking de ${model.entry.title} — ${model.roomTitle} — Flash Pop`
      : "Ranking — Flash Pop",
  };
}

export default async function RoomHistoryDetailPage({ params }: Props) {
  const { roomId, challengeId } = await params;
  const model = await getRoomHistoryDetailPageModel(roomId, challengeId);

  if (!model) {
    notFound();
  }

  return (
    <FlashPopRoomHistoryDetail
      roomId={model.roomId}
      roomTitle={model.roomTitle}
      entry={model.entry}
      ranking={model.ranking}
      currentUserId={model.currentUserId}
      canReviewMembers={model.canReviewMembers}
    />
  );
}
