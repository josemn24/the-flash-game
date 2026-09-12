import type { MockPublishedChallenge } from "@/data/mock/catalog/challengeDefinition";
import { publishedChallengeFixtures } from "@/data/mock/catalog/challenges";
import type { QuestionSlug } from "@/data/mock/catalog/questions";
import type {
  ChallengeDefinition,
  NarrativeBeatDefinition,
  NarrativeReactionMap,
  NarrativeScene,
  PyramidLevelBriefing,
} from "@/types/gameplay";

type ObjectConfig = Readonly<Record<string, unknown>>;

function objectConfig(value: unknown): ObjectConfig {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as ObjectConfig) : {};
}

function pointMap(fixture: MockPublishedChallenge) {
  return Object.fromEntries(fixture.items.map((item) => [item.questionSlug, item.points]));
}

export function projectLegacyChallengeDefinition(
  fixture: MockPublishedChallenge,
): ChallengeDefinition<QuestionSlug> {
  const base = {
    id: fixture.slug,
    title: fixture.title,
    subtitle: fixture.subtitle,
    description: fixture.description,
  };
  const config = objectConfig(fixture.modeConfig);

  switch (fixture.mode) {
    case "flash":
      return {
        ...base,
        mode: fixture.mode,
        questionIds: fixture.items.map(({ questionSlug }) => questionSlug),
        questionPoints: pointMap(fixture),
      };
    case "survival":
      return {
        ...base,
        mode: fixture.mode,
        lives: Number(config.lives ?? 0),
        questionIds: fixture.items.map(({ questionSlug }) => questionSlug),
        questionPoints: pointMap(fixture),
      };
    case "alphabet":
      return {
        ...base,
        mode: fixture.mode,
        timeLimit: Number(config.timeLimitMs ?? 0) / 1_000,
        entries: fixture.items.map((item) => ({
          letter: String(objectConfig(item.modeConfig).letter ?? ""),
          questionId: item.questionSlug,
        })),
      };
    case "pyramid":
      return {
        ...base,
        mode: fixture.mode,
        attemptVersion: Number(config.attemptSchemaVersion ?? 1),
        levels: fixture.items.map((item) => {
          const itemConfig = objectConfig(item.modeConfig);
          return {
            id: String(itemConfig.levelId ?? ""),
            label: String(itemConfig.label ?? ""),
            questionId: item.questionSlug,
            briefing: itemConfig.briefing as PyramidLevelBriefing,
          };
        }),
        questionPoints: pointMap(fixture),
      };
    case "narrative": {
      const itemBySlug = new Map(fixture.items.map((item) => [item.questionSlug, item]));
      const beats = Array.isArray(config.beats) ? config.beats : [];
      return {
        ...base,
        mode: fixture.mode,
        implementationStatus:
          config.implementationStatus === "prototype" ? "prototype" : "complete",
        maxScore: 100,
        prologue: config.prologue as NarrativeScene,
        beats: beats.map((rawBeat): NarrativeBeatDefinition<QuestionSlug> => {
          const beat = objectConfig(rawBeat);
          const steps = Array.isArray(beat.steps) ? beat.steps : [];
          return {
            id: String(beat.id ?? ""),
            title: String(beat.title ?? ""),
            steps: steps.map((rawStep) => {
              const step = objectConfig(rawStep);
              if (step.type === "scene") {
                return { type: "scene", scene: step.scene as NarrativeScene };
              }
              const questionId = String(step.questionSlug) as QuestionSlug;
              const item = itemBySlug.get(questionId);
              return {
                type: "question",
                questionId,
                reactions: (objectConfig(item?.modeConfig).reactions ?? undefined) as
                  NarrativeReactionMap | undefined,
              };
            }),
          };
        }),
        questionPoints: pointMap(fixture),
      };
    }
  }
}

export const legacyChallengeDefinitions = Object.fromEntries(
  publishedChallengeFixtures.map((fixture) => [
    fixture.slug,
    projectLegacyChallengeDefinition(fixture),
  ]),
) as {
  readonly [Fixture in (typeof publishedChallengeFixtures)[number] as Fixture["slug"]]: Extract<
    ChallengeDefinition<QuestionSlug>,
    { mode: Fixture["mode"] }
  >;
};
