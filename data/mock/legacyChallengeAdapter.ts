import {
  challengeDefinitions,
  challengeItems,
  challengeVersions,
} from "@/data/mock/challengeFixtures";
import { questionVersions } from "@/data/mock/questionFixtures";
import {
  scheduledChallengeRouteAliases,
  type ScheduledChallengeRouteKey,
} from "@/data/mock/constants";
import { reconstructLegacyQuestion } from "@/data/mock/legacyQuestionAdapter";
import { scheduledChallenges } from "@/data/mock/socialFixtures";
import { withChallengeQuestionPoints } from "@/lib/challengeScoring";
import {
  assertSupportedConfigSchemaVersion,
  assertSupportedQuestionPayloadSchemaVersion,
} from "@/types/contracts";
import type { ScheduledChallengeId } from "@/types/domain";
import type {
  Challenge,
  NarrativeBeat,
  NarrativeReactionMap,
  NarrativeScene,
  PyramidLevelBriefing,
} from "@/types/gameplay";

type ObjectConfig = Readonly<Record<string, unknown>>;

const routeByScheduledChallengeId = new Map(
  Object.entries(scheduledChallengeRouteAliases).map(([routeKey, id]) => [
    id,
    routeKey as ScheduledChallengeRouteKey,
  ]),
);

function objectConfig(value: unknown): ObjectConfig {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as ObjectConfig) : {};
}

/** Une entidades canónicas únicamente en el borde de compatibilidad de la UI actual. */
export function reconstructLegacyChallenge(scheduledChallengeId: ScheduledChallengeId): Challenge {
  const schedule = scheduledChallenges.find(({ id }) => id === scheduledChallengeId);
  const routeKey = schedule ? routeByScheduledChallengeId.get(schedule.id) : null;
  const version = schedule
    ? challengeVersions.find(({ id }) => id === schedule.challengeVersionId)
    : undefined;
  const definition = version
    ? challengeDefinitions.find(({ id }) => id === version.challengeDefinitionId)
    : undefined;
  if (!schedule || !routeKey || !version || !definition) {
    throw new Error(`Cannot reconstruct scheduled challenge "${scheduledChallengeId}".`);
  }
  assertSupportedConfigSchemaVersion(version.configSchemaVersion);

  const items = challengeItems
    .filter((item) => item.challengeVersionId === version.id)
    .sort((left, right) => left.position - right.position);
  const resolvedItems = items.map((item) => {
    assertSupportedConfigSchemaVersion(item.configSchemaVersion);
    const questionVersion = questionVersions.find(({ id }) => id === item.questionVersionId);
    if (!questionVersion) throw new Error(`Cannot resolve question version for item "${item.id}".`);
    assertSupportedQuestionPayloadSchemaVersion(questionVersion.payloadSchemaVersion);
    const question = reconstructLegacyQuestion(item.questionVersionId);
    if (!question) throw new Error(`Cannot reconstruct question for item "${item.id}".`);
    return { item, question };
  });
  const pointMap = Object.fromEntries(
    resolvedItems.map(({ item, question }) => [question.id, item.points]),
  );
  const base = {
    id: routeKey,
    definitionId: definition.slug,
    number: schedule.number,
    title: version.title,
    subtitle: version.subtitle,
    description: version.description,
  };
  const config = objectConfig(version.modeConfig);

  if (version.mode === "alphabet") {
    return {
      ...base,
      mode: "alphabet",
      timeLimit: Number(config.timeLimitMs ?? 0) / 1_000,
      entries: resolvedItems.map(({ item, question }) => ({
        letter: String(objectConfig(item.modeConfig).letter ?? ""),
        question,
      })),
    };
  }
  if (version.mode === "survival") {
    return {
      ...base,
      mode: "survival",
      lives: Number(config.lives ?? 0),
      questions: resolvedItems.map(({ question }) => question),
      questionPoints: pointMap,
    };
  }
  if (version.mode === "pyramid") {
    return {
      ...base,
      mode: "pyramid",
      attemptVersion: Number(config.attemptSchemaVersion ?? 1),
      availableFrom: schedule.opensAt,
      availableUntil: schedule.closesAt,
      levels: resolvedItems.map(({ item, question }) => {
        const itemConfig = objectConfig(item.modeConfig);
        return {
          id: String(itemConfig.levelId ?? ""),
          label: String(itemConfig.label ?? ""),
          briefing: itemConfig.briefing as PyramidLevelBriefing,
          question,
        };
      }),
      questionPoints: pointMap,
    };
  }
  if (version.mode === "narrative") {
    const questionBySlug = new Map(
      resolvedItems.map(({ item, question }) => [question.id, { item, question }]),
    );
    const beats = Array.isArray(config.beats) ? config.beats : [];
    return {
      ...base,
      mode: "narrative",
      implementationStatus: config.implementationStatus === "prototype" ? "prototype" : "complete",
      maxScore: 100,
      prologue: config.prologue as NarrativeScene,
      beats: beats.map((rawBeat): NarrativeBeat => {
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
            const questionSlug = String(step.questionSlug ?? "");
            const resolved = questionBySlug.get(questionSlug);
            if (!resolved) throw new Error(`Missing narrative item "${questionSlug}".`);
            const itemConfig = objectConfig(resolved.item.modeConfig);
            return {
              type: "question",
              question: withChallengeQuestionPoints(resolved.question, resolved.item.points),
              reactions: (itemConfig.reactions ?? undefined) as NarrativeReactionMap | undefined,
            };
          }),
        };
      }),
    };
  }

  return {
    ...base,
    mode: "flash",
    questions: resolvedItems.map(({ question }) => question),
    questionPoints: pointMap,
  };
}

export const legacyChallenges: readonly Challenge[] = scheduledChallenges.map((schedule) =>
  reconstructLegacyChallenge(schedule.id),
);
