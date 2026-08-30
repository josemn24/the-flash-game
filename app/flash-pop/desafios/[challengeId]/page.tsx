import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlashPopPyramidGame } from "@/components/flash-pop/FlashPopPyramidGame.client";
import { getChallengeById } from "@/data/challenges";
import { FLASH_POP_CHALLENGE_ID } from "@/features/flash-pop/demoSocial";

type Props = { params: Promise<{ challengeId: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ challengeId: FLASH_POP_CHALLENGE_ID }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const challenge = getChallengeById((await params).challengeId);
  return challenge?.mode === "pyramid"
    ? { title: `${challenge.title} — Flash Pop`, description: challenge.description }
    : { title: "Reto no disponible — Flash Pop" };
}

export default async function FlashPopChallengePage({ params }: Props) {
  const challenge = getChallengeById((await params).challengeId);
  if (!challenge || challenge.mode !== "pyramid" || challenge.id !== FLASH_POP_CHALLENGE_ID) {
    notFound();
  }

  return <FlashPopPyramidGame challenge={challenge} />;
}
