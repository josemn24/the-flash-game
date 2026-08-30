import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlashPopFlashGame } from "@/components/flash-pop/FlashPopFlashGame.client";
import { getChallengeById } from "@/data/challenges";

export const FLASH_POP_FLASH_PILOT_ID = "tabarnia-flash-01";
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ challengeId: FLASH_POP_FLASH_PILOT_ID }];
}

export async function generateMetadata({ params }: { params: Promise<{ challengeId: string }> }): Promise<Metadata> {
  const { challengeId } = await params;
  const challenge = getChallengeById(challengeId);
  return {
    title: challenge?.mode === "flash" ? `${challenge.title} — Flash Pop` : "Flash Pop — Preview",
    description: "Preview del sistema Flash Pop aplicado al desafío Flash clásico.",
  };
}

export default async function FlashPopFlashPage({ params }: { params: Promise<{ challengeId: string }> }) {
  const { challengeId } = await params;
  const challenge = getChallengeById(challengeId);
  if (challengeId !== FLASH_POP_FLASH_PILOT_ID || !challenge || challenge.mode !== "flash") notFound();
  return <FlashPopFlashGame challenge={challenge} />;
}
