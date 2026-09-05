import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameApp } from "@/components/game";
import { challenges, getChallengeById } from "@/data/challenges";

type Props = { params: Promise<{ challengeId: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return challenges.map((challenge) => ({ challengeId: challenge.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const challenge = getChallengeById((await params).challengeId);
  return challenge
    ? { title: `${challenge.title} — The Flash`, description: challenge.description }
    : { title: "Desafío no encontrado — The Flash" };
}

export default async function ChallengePage({ params }: Props) {
  const challenge = getChallengeById((await params).challengeId);
  if (!challenge) notFound();
  return <GameApp challenge={challenge} />;
}
