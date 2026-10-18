import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LocalFlashGameApp } from "@/components/game/shells/LocalFlashGameApp.client";
import { LocalPyramidGameApp } from "@/components/game/shells/LocalPyramidGameApp.client";
import {
  getLocalFlashDemoDefinition,
  getLocalPyramidDemoDefinition,
} from "@/server/demo-data-access";
import type { LocalFlashDefinition, LocalPyramidDefinition } from "@/types/gameplay/local-pyramid";

type Props = { params: Promise<{ challengeId: string }> };

export const dynamic = "force-dynamic";

async function getLocalDefinition(challengeId: string) {
  return (
    (await getLocalPyramidDemoDefinition(challengeId)) ??
    (await getLocalFlashDemoDefinition(challengeId))
  );
}

function isFlashDefinition(
  definition: LocalPyramidDefinition | LocalFlashDefinition,
): definition is LocalFlashDefinition {
  return definition.challenge.mode === "flash";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const definition = await getLocalDefinition((await params).challengeId);
  return definition
    ? {
        title: `${definition.challenge.title} — Ensayo local — The Flash`,
        description: definition.challenge.description,
      }
    : { title: "Reto no disponible — The Flash" };
}

export default async function FlashPopChallengePage({ params }: Props) {
  const challengeId = (await params).challengeId;
  const definition = await getLocalDefinition(challengeId);
  if (!definition) notFound();

  // This route is a mock rehearsal. Its fixture includes solutions by design.
  return isFlashDefinition(definition) ? (
    <LocalFlashGameApp definition={definition} />
  ) : (
    <LocalPyramidGameApp definition={definition} />
  );
}
