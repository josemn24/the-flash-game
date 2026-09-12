import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlashPopLobby } from "@/components/game";
import { getChallengeById } from "@/data/challenges";
import {
  FLASH_POP_CHALLENGE_ID,
  FLASH_POP_SECONDARY_CHALLENGE_ID,
} from "@/features/flash-pop/demoSocial";

export const metadata: Metadata = {
  title: "Flash Pop — Lobby",
  description: "Lobby demo de Flash Pop: asciende por siete niveles de La Pirámide.",
};

export default function FlashPopPage() {
  const primaryChallenge = getChallengeById(FLASH_POP_CHALLENGE_ID);
  const secondaryChallenge = getChallengeById(FLASH_POP_SECONDARY_CHALLENGE_ID);
  if (
    !primaryChallenge ||
    primaryChallenge.mode !== "pyramid" ||
    !secondaryChallenge ||
    secondaryChallenge.mode !== "pyramid"
  ) {
    notFound();
  }
  return (
    <FlashPopLobby primaryChallenge={primaryChallenge} secondaryChallenge={secondaryChallenge} />
  );
}
