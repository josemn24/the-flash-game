import { completedAttemptFixtures } from "@/data/mock/catalog/attempts";
import { challengeItems } from "@/data/mock/challengeFixtures";
import { playerRouteAliases, scheduledChallengeRouteAliases } from "@/data/mock/constants";
import { durationMs, mockId, utc } from "@/data/mock/identity";
import { questionDefinitions, questionVersions } from "@/data/mock/questionFixtures";
import { scheduledChallenges } from "@/data/mock/socialFixtures";
import type { Attempt, AttemptAnswer, JsonValue } from "@/types/domain";

const scheduleByRouteKey = new Map(
  Object.entries(scheduledChallengeRouteAliases).map(([routeKey, id]) => [
    routeKey,
    scheduledChallenges.find((schedule) => schedule.id === id),
  ]),
);
const questionVersionBySlug = new Map(
  questionDefinitions.map((definition) => [
    definition.slug,
    questionVersions.find((version) => version.questionDefinitionId === definition.id),
  ]),
);

function attemptKey(fixture: (typeof completedAttemptFixtures)[number]) {
  return `${fixture.scheduledChallengeKey}:${fixture.playerKey}:${fixture.attemptNumber}`;
}

export const attemptFixtures: readonly Attempt[] = completedAttemptFixtures.map((fixture) => ({
  id: mockId.attempt(attemptKey(fixture)),
  playerId: playerRouteAliases[fixture.playerKey],
  scheduledChallengeId: scheduledChallengeRouteAliases[fixture.scheduledChallengeKey],
  attemptNumber: fixture.attemptNumber,
  kind: fixture.kind,
  status: fixture.status,
  outcome: fixture.outcome,
  startedAt: utc(fixture.startedAt),
  deadlineAt: utc(fixture.deadlineAt),
  completedAt: fixture.completedAt === null ? null : utc(fixture.completedAt),
  score: fixture.score,
  clientStateSchemaVersion: fixture.clientStateSchemaVersion,
  lockVersion: fixture.lockVersion,
  progressPayload: fixture.progressPayload,
}));

export const attemptAnswerFixtures: readonly AttemptAnswer<JsonValue, JsonValue>[] =
  completedAttemptFixtures.flatMap((fixture) => {
    const schedule = scheduleByRouteKey.get(fixture.scheduledChallengeKey);
    if (!schedule) throw new Error(`Unknown schedule "${fixture.scheduledChallengeKey}".`);
    const key = attemptKey(fixture);
    const attemptId = mockId.attempt(key);
    return fixture.answers.map((answer, index) => {
      const questionVersion = questionVersionBySlug.get(answer.questionSlug);
      const item = challengeItems.find(
        (candidate) =>
          candidate.challengeVersionId === schedule.challengeVersionId &&
          candidate.questionVersionId === questionVersion?.id,
      );
      if (!item) {
        throw new Error(
          `Attempt "${key}" references question "${answer.questionSlug}" outside its challenge.`,
        );
      }
      return {
        id: mockId.attemptAnswer(`${key}:${index + 1}`),
        attemptId,
        challengeItemId: item.id,
        status: answer.status,
        answer: answer.answer,
        resultDetails: answer.resultDetails,
        points: answer.points,
        presentedAt: utc(answer.presentedAt),
        submittedAt: answer.submittedAt === null ? null : utc(answer.submittedAt),
        timeUsedMs: durationMs(answer.timeUsedMs),
      };
    });
  });
