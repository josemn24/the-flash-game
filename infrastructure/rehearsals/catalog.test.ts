import { describe, expect, it } from "vitest";
import { listRehearsals } from "./catalog";
import { createLocalPyramidSessionProvider } from "@/features/game/session/providers/localPyramid";
import { createLocalFlashSessionProvider } from "@/features/game/session/providers/localFlash";
import { createLocalSurvivalSessionProvider } from "@/features/game/session/providers/localSurvival";
import { createLocalAlphabetSessionProvider } from "@/features/game/session/providers/localAlphabet";
import { createLocalTimeTrialSessionProvider } from "@/features/game/session/providers/localTimeTrial";
import { readFileSync } from "node:fs";
import { rehearsalCompatibility } from "@/lib/rehearsals/structure";

describe("published rehearsal catalog", () => {
  it("builds all seven independently authored exercises with the real local authorities", () => {
    const artifacts = listRehearsals();
    expect(artifacts).toHaveLength(7);
    const words = JSON.parse(readFileSync("public/dictionaries/es-general-5.v1.json", "utf8"));
    const dictionaries = new Map([
      ["es-general-5.v1", new Set<string>(Array.isArray(words) ? words : words.words)],
    ]);
    for (const { definition } of artifacts) {
      const challenge = definition.challenge;
      if (challenge.mode === "pyramid")
        createLocalPyramidSessionProvider({
          definition: definition as Parameters<
            typeof createLocalPyramidSessionProvider
          >[0]["definition"],
          dictionaries,
        });
      else if (challenge.mode === "flash")
        createLocalFlashSessionProvider({
          definition: definition as Parameters<
            typeof createLocalFlashSessionProvider
          >[0]["definition"],
        });
      else if (challenge.mode === "survival")
        createLocalSurvivalSessionProvider({
          definition: definition as Parameters<
            typeof createLocalSurvivalSessionProvider
          >[0]["definition"],
        });
      else if (challenge.mode === "alphabet")
        createLocalAlphabetSessionProvider({
          definition: definition as Parameters<
            typeof createLocalAlphabetSessionProvider
          >[0]["definition"],
        });
      else
        createLocalTimeTrialSessionProvider({
          definition: definition as Parameters<
            typeof createLocalTimeTrialSessionProvider
          >[0]["definition"],
        });
    }
  });
  it("detects structural changes while accepting different question text", () => {
    const source = listRehearsals()[0]!.source;
    const alternative = structuredClone(source);
    (alternative.questions[0]!.publicPayload as Record<string, unknown>).question =
      "Otro ejercicio";
    expect(rehearsalCompatibility(source, alternative)).toEqual([]);
    (alternative.questions[0] as { timeLimitMs: number }).timeLimitMs++;
    expect(rehearsalCompatibility(source, alternative)).not.toEqual([]);
  });
});

import { COMPETITIVE_RESOLVERS } from "@/lib/scoringCore/resolution/registry";
import type { CompetitiveQuestionType } from "@/lib/question-formats/definitions";
import { SessionDriver, manualClock } from "@/test-utils/game-session-conformance/driver";
import { correctActions } from "@/test-utils/game-session-conformance/corpus";
import { repositoryRehearsals } from "@/scripts/support/rehearsal-catalog.mjs";
import manifest from "@/data/rehearsals/manifest.v1.json";
import profiles from "@/data/rehearsals/profiles.v1.json";
import { rehearsalStructure } from "@/lib/rehearsals/structure";

it("retains immutable artifact hashes and uses the same catalog identity in setup scripts", () => {
  const artifacts = listRehearsals();
  expect(artifacts.map((a) => a.ref)).toEqual(manifest);
  expect(repositoryRehearsals().map((a: { ref: unknown }) => a.ref)).toEqual(manifest);
  for (const artifact of artifacts)
    expect(rehearsalStructure(artifact.source)).toEqual(
      profiles[artifact.ref.id as keyof typeof profiles],
    );
});

it.each(listRehearsals())(
  "$ref.id can actually reach a perfect terminal result using its published solutions",
  async ({ definition, source }) => {
    const clock = manualClock();
    const words = JSON.parse(readFileSync("public/dictionaries/es-general-5.v1.json", "utf8"))
      .words as string[];
    const dictionaries = new Map([["es-general-5.v1", new Set(words)]]);
    const options = { clock, dictionaries };
    const provider =
      definition.challenge.mode === "pyramid"
        ? createLocalPyramidSessionProvider({
            ...options,
            definition: definition as Parameters<
              typeof createLocalPyramidSessionProvider
            >[0]["definition"],
          })
        : definition.challenge.mode === "flash"
          ? createLocalFlashSessionProvider({
              ...options,
              definition: definition as Parameters<
                typeof createLocalFlashSessionProvider
              >[0]["definition"],
            })
          : definition.challenge.mode === "survival"
            ? createLocalSurvivalSessionProvider({
                ...options,
                definition: definition as Parameters<
                  typeof createLocalSurvivalSessionProvider
                >[0]["definition"],
              })
            : definition.challenge.mode === "alphabet"
              ? createLocalAlphabetSessionProvider({
                  ...options,
                  definition: definition as Parameters<
                    typeof createLocalAlphabetSessionProvider
                  >[0]["definition"],
                })
              : createLocalTimeTrialSessionProvider({
                  ...options,
                  definition: definition as Parameters<
                    typeof createLocalTimeTrialSessionProvider
                  >[0]["definition"],
                });
    const driver = new SessionDriver(
      provider,
      definition.challenge.id,
      definition.levels.map((l) => l.challengeItemId),
    );
    await driver.begin();
    for (const [index, level] of definition.levels.entries()) {
      await driver.issue("prepare", {}, index);
      if (definition.challenge.mode === "pyramid") await driver.issue("activate", {}, index);
      const question = COMPETITIVE_RESOLVERS[level.publicQuestion.type as CompetitiveQuestionType]({
        ...level,
        points: source.questions[index]!.points,
      });
      for (const action of correctActions(question)) await driver.action(action, index);
    }
    const result = await driver.issue("complete");
    expect(result.effect).toBe("completed");
    expect(result.state.score).toBe(100);
    expect(result.state.answers).toHaveLength(definition.levels.length);
    expect(result.state.answers?.every((a) => a.status === "correct")).toBe(true);
    if (result.effect === "completed") expect(result.review).toHaveLength(definition.levels.length);
  },
);
