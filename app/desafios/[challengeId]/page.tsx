import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoomChallengeClient } from "@/components/game/RoomChallengeClient.client";
import { getPlayableChallengePageModel } from "@/server/data-access";

type Props = {
  params: Promise<{ challengeId: string }>;
  searchParams: Promise<{ roomId?: string | string[] }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const model = await getPlayableChallengePageModel((await params).challengeId);
  return model
    ? { title: `${model.challenge.title} — The Flash`, description: model.challenge.description }
    : { title: "Desafío no encontrado — The Flash" };
}

export default async function ChallengePage({ params, searchParams }: Props) {
  const { challengeId } = await params;
  const roomIdValue = (await searchParams).roomId;
  const roomId = Array.isArray(roomIdValue) ? roomIdValue[0] : roomIdValue;
  const model = await getPlayableChallengePageModel(challengeId, roomId ?? null);
  if (!model) notFound();

  return (
    <RoomChallengeClient
      challenge={model.challenge}
      roomContext={model.roomContext}
      socialSnapshot={model.socialSnapshot}
      terminalReview={"terminalReview" in model ? model.terminalReview : undefined}
    />
  );
}
