import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LocalFlashGameApp } from "@/components/game/shells/LocalFlashGameApp.client";
import { LocalAlphabetGameApp } from "@/components/game/shells/LocalAlphabetGameApp.client";
import { LocalPyramidGameApp } from "@/components/game/shells/LocalPyramidGameApp.client";
import { LocalSurvivalGameApp } from "@/components/game/shells/LocalSurvivalGameApp.client";
import { LocalTimeTrialGameApp } from "@/components/game/shells/LocalTimeTrialGameApp.client";
import {
  getLocalFlashDemoDefinition,
  getLocalAlphabetDemoDefinition,
  getLocalPyramidDemoDefinition,
  getLocalSurvivalDemoDefinition,
  getLocalTimeTrialDemoDefinition,
} from "@/server/demo-data-access";
import type {
  LocalFlashDefinition,
  LocalPyramidDefinition,
  LocalSurvivalDefinition,
} from "@/types/gameplay/local-pyramid";
import type { LocalTimeTrialDefinition } from "@/types/gameplay/local-time-trial";
import type { LocalAlphabetDefinition } from "@/types/gameplay/local-alphabet";

type Props = { params: Promise<{ challengeId: string }> };

export const dynamic = "force-dynamic";

async function getLocalDefinition(challengeId: string) {
  return (
    (await getLocalPyramidDemoDefinition(challengeId)) ??
    (await getLocalAlphabetDemoDefinition(challengeId)) ??
    (await getLocalFlashDemoDefinition(challengeId)) ??
    (await getLocalSurvivalDemoDefinition(challengeId)) ??
    (await getLocalTimeTrialDemoDefinition(challengeId))
  );
}

type LocalDefinition =
  | LocalPyramidDefinition
  | LocalFlashDefinition
  | LocalSurvivalDefinition
  | LocalTimeTrialDefinition
  | LocalAlphabetDefinition;

function isFlashDefinition(definition: LocalDefinition): definition is LocalFlashDefinition {
  return definition.challenge.mode === "flash";
}

function isSurvivalDefinition(definition: LocalDefinition): definition is LocalSurvivalDefinition {
  return definition.challenge.mode === "survival";
}

function isTimeTrialDefinition(
  definition: LocalDefinition,
): definition is LocalTimeTrialDefinition {
  return definition.challenge.mode === "time-trial";
}

function isAlphabetDefinition(definition: LocalDefinition): definition is LocalAlphabetDefinition {
  return definition.challenge.mode === "alphabet";
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
  return isTimeTrialDefinition(definition) ? (
    <LocalTimeTrialGameApp definition={definition} />
  ) : isAlphabetDefinition(definition) ? (
    <LocalAlphabetGameApp definition={definition} />
  ) : isFlashDefinition(definition) ? (
    <LocalFlashGameApp definition={definition} />
  ) : isSurvivalDefinition(definition) ? (
    <LocalSurvivalGameApp definition={definition} />
  ) : (
    <LocalPyramidGameApp definition={definition} />
  );
}
