import { buildMockRoomChallengeAttempt } from "@/lib/roomAttempts";
import { challengeItems } from "@/data/mock/challengeFixtures";
import { playerRouteAliases, scheduledChallengeRouteAliases } from "@/data/mock/constants";
import { durationMs, mockId, utc } from "@/data/mock/identity";
import { demoScoreFixtures, scheduledChallenges } from "@/data/mock/socialFixtures";
import type { Attempt, AttemptAnswer, JsonValue } from "@/types/domain";

const scheduleById = new Map(scheduledChallenges.map((schedule) => [schedule.id, schedule]));
const itemByChallengeAndQuestion = new Map(
  challengeItems.map((item) => [`${item.challengeVersionId}:${item.questionVersionId}`, item]),
);

function json(value: unknown): JsonValue {
  return value as JsonValue;
}

const attempts: Attempt[] = [];
const answers: AttemptAnswer<JsonValue, JsonValue>[] = [];

for (const fixture of demoScoreFixtures) {
  const scheduledChallengeId = scheduledChallengeRouteAliases[fixture.scheduledChallengeKey];
  const scheduledChallenge = scheduleById.get(scheduledChallengeId);
  if (!scheduledChallenge) throw new Error(`Unknown schedule "${fixture.scheduledChallengeKey}".`);

  const attemptKey = `${fixture.scheduledChallengeKey}:${fixture.playerKey}:1`;
  const attemptId = mockId.attempt(attemptKey);
  const legacyAttempt = buildMockRoomChallengeAttempt(
    fixture.scheduledChallengeKey,
    { points: fixture.score, completed: true },
    { seed: attemptKey, playedAt: fixture.completedAt },
  );
  if (!legacyAttempt) throw new Error(`Could not build attempt "${attemptKey}".`);

  const completedAtMs = Date.parse(fixture.completedAt);
  const startedAt = utc(new Date(completedAtMs - 20 * 60_000).toISOString());
  attempts.push({
    id: attemptId,
    playerId: playerRouteAliases[fixture.playerKey],
    scheduledChallengeId,
    attemptNumber: 1,
    kind: "competitive",
    status: "completed",
    outcome: null,
    startedAt,
    deadlineAt: scheduledChallenge.closesAt,
    completedAt: utc(fixture.completedAt),
    score: fixture.score,
    clientStateSchemaVersion: 1,
    lockVersion: 1,
    progressPayload: null,
  });

  for (const [answerIndex, answer] of legacyAttempt.answers.entries()) {
    const item = itemByChallengeAndQuestion.get(
      `${scheduledChallenge.challengeVersionId}:${mockId.questionVersion(`${answer.questionId}:v1`)}`,
    );
    if (!item) {
      throw new Error(
        `Attempt "${attemptKey}" references question "${answer.questionId}" outside its challenge.`,
      );
    }
    const timedOut = answer.status === "unanswered";
    answers.push({
      id: mockId.attemptAnswer(`${attemptKey}:${answerIndex + 1}`),
      attemptId,
      challengeItemId: item.id,
      status: timedOut ? "timeout" : answer.status,
      answer: answer.answer == null ? null : json(answer.answer),
      resultDetails: answer.details == null ? null : json(answer.details),
      points: answer.points ?? 0,
      presentedAt: startedAt,
      submittedAt: timedOut ? null : utc(fixture.completedAt),
      timeUsedMs: durationMs((answer.timeUsed ?? 0) * 1_000),
    });
  }
}

export const attemptFixtures: readonly Attempt[] = attempts;
export const attemptAnswerFixtures: readonly AttemptAnswer<JsonValue, JsonValue>[] = answers;
