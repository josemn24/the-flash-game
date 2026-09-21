import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { isFlashPopPreviewChallenge } from "@/features/flash-pop/demoSocial";
import { getPlayableChallengePageModel } from "@/server/data-access";

type Props = { params: Promise<{ challengeId: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const model = await getPlayableChallengePageModel((await params).challengeId);
  return model?.challenge.mode === "pyramid"
    ? { title: `${model.challenge.title} — The Flash`, description: model.challenge.description }
    : { title: "Reto no disponible — The Flash" };
}

export default async function FlashPopChallengePage({ params }: Props) {
  const challengeId = (await params).challengeId;
  const model = await getPlayableChallengePageModel(challengeId);
  if (!isFlashPopPreviewChallenge(challengeId) || model?.challenge.mode !== "pyramid") {
    notFound();
  }

  permanentRedirect(`/desafios/${challengeId}`);
}
