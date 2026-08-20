import { describe, expect, it } from "vitest";
import {
  armPyramidLevel,
  comparePyramidAttemptSummaries,
  completePyramidAttempt,
  createPyramidAttempt,
  getPyramidAttemptStorageKey,
  normalizePyramidResult,
  parsePyramidAttempt,
  type PyramidAttemptSummary,
} from "@/features/pyramid/pyramidAttempt";
import { getChallengeById } from "@/data/challenges";
import type { AnswerResult } from "@/types/game";

function getChallenge() {
  const challenge = getChallengeById("tabarnia-challenge-05");
  if (challenge?.mode !== "pyramid") throw new Error("Expected pyramid challenge");
  return challenge;
}

function result(
  status: AnswerResult["status"],
  points: number,
  questionId = "pyramid-square-intruder",
): AnswerResult {
  return {
    questionId,
    answer: "square-27",
    status,
    isCorrect: status === "correct",
    points,
    timeUsed: 4,
  };
}

describe("pyramid attempt rules", () => {
  it("keeps points only for completely correct levels", () => {
    expect(normalizePyramidResult(result("correct", 7)).points).toBe(7);
    expect(normalizePyramidResult(result("partial", 5)).points).toBe(0);
    expect(normalizePyramidResult(result("incorrect", -2)).points).toBe(0);
    expect(normalizePyramidResult(result("unanswered", 0)).points).toBe(0);
  });

  it("builds, arms, completes and restores a versioned official attempt", () => {
    const challenge = getChallenge();
    const started = createPyramidAttempt(challenge, 1_000);
    const armed = armPyramidLevel(
      started,
      challenge.levels[0].question,
      challenge.availableUntil,
      2_000,
    );
    expect(armed.deadlineAt).toBe(14_000);
    expect(armPyramidLevel(started, challenge.levels[0].question, null, 2_000).deadlineAt).toBe(
      14_000,
    );

    const completed = completePyramidAttempt(armed, result("incorrect", -2), "failed", 5_000);
    expect(completed).toMatchObject({
      status: "completed",
      phase: "completed",
      outcome: "failed",
      summary: { levelsCleared: 0, score: 0, timeUsed: 4 },
    });
    expect(parsePyramidAttempt(JSON.stringify(completed), challenge)).toEqual(completed);
    expect(getPyramidAttemptStorageKey(challenge)).toBe(
      "the-flash:pyramid-attempt:tabarnia-challenge-05:v1",
    );
  });

  it("rejects corrupt records and records from another content version", () => {
    const challenge = getChallenge();
    const record = createPyramidAttempt(challenge, 1_000);
    expect(parsePyramidAttempt("not-json", challenge)).toBeNull();
    expect(
      parsePyramidAttempt(JSON.stringify(record), {
        ...challenge,
        attemptVersion: challenge.attemptVersion + 1,
      }),
    ).toBeNull();
    expect(
      parsePyramidAttempt(
        JSON.stringify({ ...record, currentLevelIndex: 3, results: [], deadlineAt: 900 }),
        challenge,
      ),
    ).toBeNull();

    const completed = completePyramidAttempt(record, result("incorrect", 0), "failed", 5_000);
    expect(
      parsePyramidAttempt(
        JSON.stringify({ ...completed, summary: { ...completed.summary, score: 99 } }),
        challenge,
      ),
    ).toBeNull();
  });

  it("records the summit only after seven completely correct levels", () => {
    const challenge = getChallenge();
    const results = challenge.levels
      .slice(0, -1)
      .map((level) =>
        result("correct", challenge.questionPoints[level.question.id], level.question.id),
      );
    const record = {
      ...createPyramidAttempt(challenge, 1_000),
      currentLevelIndex: challenge.levels.length - 1,
      results,
      levelStartedAt: 2_000,
      deadlineAt: 62_000,
    };
    const summit = completePyramidAttempt(
      record,
      result("correct", 24, challenge.levels.at(-1)?.question.id),
      "summit",
      8_000,
    );
    expect(summit.summary).toMatchObject({ levelsCleared: 7, score: 100, outcome: "summit" });
    expect(parsePyramidAttempt(JSON.stringify(summit), challenge)).toEqual(summit);
  });

  it("orders future ranking summaries by levels, points and time", () => {
    const base: PyramidAttemptSummary = {
      challengeId: "challenge",
      levelsCleared: 4,
      score: 40,
      timeUsed: 50,
      outcome: "failed",
      completedAt: 1,
    };
    const attempts = [
      base,
      { ...base, levelsCleared: 5, score: 35 },
      { ...base, score: 45, timeUsed: 60 },
      { ...base, score: 45, timeUsed: 40 },
    ];
    expect(attempts.sort(comparePyramidAttemptSummaries)).toEqual([
      { ...base, levelsCleared: 5, score: 35 },
      { ...base, score: 45, timeUsed: 40 },
      { ...base, score: 45, timeUsed: 60 },
      base,
    ]);
  });
});
