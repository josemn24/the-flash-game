import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getChallengeById } from "@/data/challenges";
import {
  FLASH_POP_PREVIEW_CHALLENGE_IDS,
  isFlashPopPreviewChallenge,
} from "@/features/flash-pop/demoSocial";

type Props = { params: Promise<{ challengeId: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return FLASH_POP_PREVIEW_CHALLENGE_IDS.map((challengeId) => ({ challengeId }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const challenge = getChallengeById((await params).challengeId);
  return challenge?.mode === "pyramid"
    ? { title: `${challenge.title} — Flash Pop`, description: challenge.description }
    : { title: "Reto no disponible — Flash Pop" };
}

export default async function FlashPopChallengePage({ params }: Props) {
  const challengeId = (await params).challengeId;
  const challenge = getChallengeById(challengeId);
  if (!isFlashPopPreviewChallenge(challengeId) || !challenge || challenge.mode !== "pyramid") {
    notFound();
  }

  permanentRedirect(`/desafios/${challengeId}`);
}
