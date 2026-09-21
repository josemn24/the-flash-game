import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoomChallengeClient } from "@/components/game/RoomChallengeClient.client";
import { RoomChallengeIntroduction } from "@/components/game/shared";
import { getPlayableChallengePageModel, getRoomIntroductionPageModel } from "@/server/data-access";

type Props = {
  params: Promise<{ challengeId: string }>;
  searchParams: Promise<{ roomId?: string | string[] }>;
};

export const dynamic = "force-dynamic";

async function getRoomId(searchParams: Props["searchParams"]) {
  const roomIdValue = (await searchParams).roomId;
  return Array.isArray(roomIdValue) ? roomIdValue[0] : roomIdValue;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { challengeId } = await params;
  const roomId = await getRoomId(searchParams);
  const model = await getPlayableChallengePageModel(challengeId, roomId ?? null);
  if (model) {
    return {
      title: `${model.challenge.title} — The Flash`,
      description: model.challenge.description,
    };
  }

  const introduction = roomId ? await getRoomIntroductionPageModel(roomId, challengeId) : null;
  return introduction
    ? {
        title: `${introduction.challengeTitle} — The Flash`,
        description: `Introducción autorizada del desafío de ${introduction.roomTitle}.`,
      }
    : { title: "Desafío no encontrado — The Flash" };
}

export default async function ChallengePage({ params, searchParams }: Props) {
  const { challengeId } = await params;
  const roomId = await getRoomId(searchParams);
  const model = await getPlayableChallengePageModel(challengeId, roomId ?? null);
  if (model) {
    return (
      <RoomChallengeClient
        challenge={model.challenge}
        roomContext={model.roomContext}
        socialSnapshot={model.socialSnapshot}
        terminalReview={"terminalReview" in model ? model.terminalReview : undefined}
      />
    );
  }

  const introduction = roomId ? await getRoomIntroductionPageModel(roomId, challengeId) : null;
  if (!introduction) notFound();

  return <RoomChallengeIntroduction model={introduction} />;
}
