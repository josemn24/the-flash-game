import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlashPopFlashGame } from "@/components/game";
import { FLASH_POP_FLASH_PILOT_ID } from "@/features/flash-pop/demoSocial";
import { getPlayableChallengePageModel } from "@/server/data-access";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ challengeId: string }>;
}): Promise<Metadata> {
  const { challengeId } = await params;
  const model = await getPlayableChallengePageModel(challengeId);
  return {
    title:
      model?.challenge.mode === "flash"
        ? `${model.challenge.title} — Flash Pop`
        : "Flash Pop — Preview",
    description: "Preview del sistema Flash Pop aplicado al desafío Flash clásico.",
  };
}

export default async function FlashPopFlashPage({
  params,
}: {
  params: Promise<{ challengeId: string }>;
}) {
  const { challengeId } = await params;
  const model = await getPlayableChallengePageModel(challengeId);
  if (challengeId !== FLASH_POP_FLASH_PILOT_ID || model?.challenge.mode !== "flash") notFound();
  return <FlashPopFlashGame challenge={model.challenge as import("@/types/game").FlashChallenge} />;
}
