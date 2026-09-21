import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlashPopFlashGame } from "@/components/game";
import { getChallengeById } from "@/data/challenges";
import { FLASH_POP_FLASH_PILOT_ID as FLASH_POP_FLASH_PILOT } from "@/features/flash-pop/demoSocial";

export const FLASH_POP_FLASH_PILOT_ID = FLASH_POP_FLASH_PILOT;
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ challengeId: FLASH_POP_FLASH_PILOT_ID }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ challengeId: string }>;
}): Promise<Metadata> {
  const { challengeId } = await params;
  const challenge = getChallengeById(challengeId);
  return {
    title: challenge?.mode === "flash" ? `${challenge.title} — Flash Pop` : "Flash Pop — Preview",
    description: "Preview del sistema Flash Pop aplicado al desafío Flash clásico.",
  };
}

export default async function FlashPopFlashPage({
  params,
}: {
  params: Promise<{ challengeId: string }>;
}) {
  const { challengeId } = await params;
  const challenge = getChallengeById(challengeId);
  if (challengeId !== FLASH_POP_FLASH_PILOT_ID || !challenge || challenge.mode !== "flash")
    notFound();
  return <FlashPopFlashGame challenge={challenge} />;
}
