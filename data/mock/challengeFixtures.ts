import { challengeDefinitions as legacyChallengeDefinitions } from "@/data/challengeDefinitions";
import { CONTENT_CREATED_AT, CONTENT_PUBLISHED_AT, demoIdentity } from "@/data/mock/constants";
import { mockId } from "@/data/mock/identity";
import type {
  ChallengeDefinition,
  ChallengeItem,
  ChallengeVersion,
  JsonValue,
} from "@/types/domain";
import type { ChallengeDefinition as LegacyChallengeDefinition } from "@/types/gameplay";

function distributePoints(questionCount: number) {
  const base = Math.floor(100 / questionCount);
  const remainder = 100 % questionCount;
  return Array.from({ length: questionCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

function questionIdsFor(definition: LegacyChallengeDefinition): readonly string[] {
  switch (definition.mode) {
    case "alphabet":
      return definition.entries.map((entry) => entry.questionId);
    case "pyramid":
      return definition.levels.map((level) => level.questionId);
    case "narrative":
      return definition.beats.flatMap((beat) =>
        beat.steps.flatMap((step) => (step.type === "question" ? [step.questionId] : [])),
      );
    default:
      return definition.questionIds;
  }
}

function pointValuesFor(definition: LegacyChallengeDefinition, questionIds: readonly string[]) {
  if (definition.mode === "alphabet" || !definition.questionPoints) {
    return distributePoints(questionIds.length);
  }

  const expectedTotal = definition.mode === "narrative" ? definition.maxScore : 100;
  const configuredPoints = definition.questionPoints;
  const points = questionIds.map((questionId) => configuredPoints[questionId]);
  if (points.some((value) => value == null || !Number.isInteger(value) || value < 0)) {
    throw new Error(`Invalid point allocation in challenge "${definition.id}".`);
  }
  const numericPoints = points as number[];
  const total = numericPoints.reduce((sum, value) => sum + value, 0);
  if (expectedTotal !== 100 || total !== 100) {
    throw new Error(`Challenge "${definition.id}" must add up to exactly 100 points.`);
  }
  return numericPoints;
}

function versionModeConfig(definition: LegacyChallengeDefinition): JsonValue {
  switch (definition.mode) {
    case "flash":
      return null;
    case "alphabet":
      return { timeLimitMs: definition.timeLimit * 1_000 };
    case "survival":
      return { lives: definition.lives };
    case "pyramid":
      return { attemptSchemaVersion: definition.attemptVersion };
    case "narrative":
      return {
        implementationStatus: definition.implementationStatus,
        prologue: definition.prologue,
        beats: definition.beats.map((beat) => ({
          id: beat.id,
          title: beat.title,
          steps: beat.steps.map((step) =>
            step.type === "scene"
              ? { type: "scene", scene: step.scene }
              : { type: "question", questionSlug: step.questionId },
          ),
        })),
      } as unknown as JsonValue;
  }
}

function itemModeConfig(definition: LegacyChallengeDefinition, questionId: string): JsonValue {
  switch (definition.mode) {
    case "alphabet":
      return {
        letter: definition.entries.find((entry) => entry.questionId === questionId)?.letter ?? "",
      };
    case "pyramid": {
      const level = definition.levels.find((candidate) => candidate.questionId === questionId);
      return level ? { levelId: level.id, label: level.label, briefing: level.briefing } : null;
    }
    case "narrative": {
      for (const [beatPosition, beat] of definition.beats.entries()) {
        for (const [stepPosition, step] of beat.steps.entries()) {
          if (step.type === "question" && step.questionId === questionId) {
            return {
              beatId: beat.id,
              beatPosition,
              stepPosition,
              reactions: step.reactions ?? null,
            } as JsonValue;
          }
        }
      }
      return null;
    }
    default:
      return null;
  }
}

const definitions = Object.values(legacyChallengeDefinitions);

export const challengeDefinitions: readonly ChallengeDefinition[] = definitions.map(
  (definition) => ({
    id: mockId.challengeDefinition(definition.id),
    slug: definition.id,
    createdByPlayerId: demoIdentity.superadminPlayerId,
    archivedAt: null,
    createdAt: CONTENT_CREATED_AT,
    updatedAt: CONTENT_PUBLISHED_AT,
  }),
);

export const challengeVersions: readonly ChallengeVersion[] = definitions.map((definition) => ({
  id: mockId.challengeVersion(`${definition.id}:v1`),
  challengeDefinitionId: mockId.challengeDefinition(definition.id),
  versionNumber: 1,
  status: "published",
  mode: definition.mode,
  title: definition.title,
  subtitle: definition.subtitle,
  description: definition.description,
  maxScore: 100,
  modeConfig: versionModeConfig(definition),
  createdByPlayerId: demoIdentity.superadminPlayerId,
  publishedAt: CONTENT_PUBLISHED_AT,
  createdAt: CONTENT_CREATED_AT,
  updatedAt: CONTENT_PUBLISHED_AT,
}));

export const challengeItems: readonly ChallengeItem[] = definitions.flatMap((definition) => {
  const questionIds = questionIdsFor(definition);
  const points = pointValuesFor(definition, questionIds);
  return questionIds.map((questionId, position) => ({
    id: mockId.challengeItem(`${definition.id}:v1:${position + 1}`),
    challengeVersionId: mockId.challengeVersion(`${definition.id}:v1`),
    questionVersionId: mockId.questionVersion(`${questionId}:v1`),
    position: position + 1,
    points: points[position] ?? 0,
    modeConfig: itemModeConfig(definition, questionId),
    createdAt: CONTENT_CREATED_AT,
    updatedAt: CONTENT_PUBLISHED_AT,
  }));
});

export const challengeQuestionSlugs = new Map(
  definitions.map((definition) => [definition.id, questionIdsFor(definition)]),
);
