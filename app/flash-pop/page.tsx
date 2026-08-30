import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlashPopLobby } from "@/components/flash-pop/FlashPopLobby.client";
import { getChallengeById } from "@/data/challenges";
import { FLASH_POP_CHALLENGE_ID } from "@/features/flash-pop/demoSocial";

export const metadata: Metadata = {
  title: "Flash Pop — Lobby",
  description: "Lobby demo del vertical slice de Flash Pop.",
};

export default function FlashPopPage() {
  const challenge = getChallengeById(FLASH_POP_CHALLENGE_ID);
  if (!challenge || challenge.mode !== "pyramid") notFound();
  return <FlashPopLobby challenge={challenge} />;
}
