import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlashPopFlashGame } from "@/components/game/demo";
import { FLASH_POP_FLASH_PILOT_ID } from "@/features/flash-pop/demoSocial";
import { getFlashPopChallengePageModel } from "@/server/demo-data-access";
import type { FlashChallenge } from "@/types/gameplay/challenge";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ challengeId: string }>;
}): Promise<Metadata> {
  const { challengeId } = await params;
  const model = await getFlashPopChallengePageModel(challengeId);
  return {
    title:
      model?.challenge.mode === "flash"
        ? `${model.challenge.title} — The Flash`
        : "The Flash — Preview",
    description: "Preview del sistema The Flash aplicado al desafío Flash.",
  };
}

export default async function FlashPopFlashPage({
  params,
}: {
  params: Promise<{ challengeId: string }>;
}) {
  const { challengeId } = await params;
  const model = await getFlashPopChallengePageModel(challengeId);
  if (challengeId !== FLASH_POP_FLASH_PILOT_ID || model?.challenge.mode !== "flash") notFound();
  return <FlashPopFlashGame challenge={model.challenge as FlashChallenge} />;
}
