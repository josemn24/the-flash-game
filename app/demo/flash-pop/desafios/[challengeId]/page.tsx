import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LocalPyramidGameApp } from "@/components/game/shells/LocalPyramidGameApp.client";
import { getLocalPyramidDemoDefinition } from "@/server/demo-data-access";

type Props = { params: Promise<{ challengeId: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const definition = await getLocalPyramidDemoDefinition((await params).challengeId);
  return definition
    ? {
        title: `${definition.challenge.title} — Ensayo local — The Flash`,
        description: definition.challenge.description,
      }
    : { title: "Reto no disponible — The Flash" };
}

export default async function FlashPopChallengePage({ params }: Props) {
  const challengeId = (await params).challengeId;
  const definition = await getLocalPyramidDemoDefinition(challengeId);
  if (!definition) notFound();

  // This route is a mock rehearsal. Its fixture includes solutions by design.
  return <LocalPyramidGameApp definition={definition} />;
}
