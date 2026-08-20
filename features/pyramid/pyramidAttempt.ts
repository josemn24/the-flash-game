import type { AnswerResult, AnswerValue, PyramidChallenge, Question } from "@/types/game";

export const PYRAMID_ATTEMPT_SCHEMA_VERSION = 1;

export type PyramidAttemptOutcome = "failed" | "summit";
export type PyramidAttemptPhase = "playing" | "transition" | "completed";

export type PyramidAttemptSummary = {
  challengeId: string;
  levelsCleared: number;
  score: number;
  timeUsed: number;
  outcome: PyramidAttemptOutcome;
  completedAt: number;
};

export type PyramidAttemptRecord = {
  schemaVersion: typeof PYRAMID_ATTEMPT_SCHEMA_VERSION;
  challengeId: string;
  definitionId: string;
  attemptVersion: number;
  status: "in-progress" | "completed";
  phase: PyramidAttemptPhase;
  startedAt: number;
  currentLevelIndex: number;
  levelStartedAt: number | null;
  deadlineAt: number | null;
  results: AnswerResult[];
  draftAnswer: AnswerValue | null;
  submittedCodes: string[];
  incorrectAttempts: number;
  outcome: PyramidAttemptOutcome | null;
  completedAt: number | null;
  summary: PyramidAttemptSummary | null;
};

export function getPyramidAttemptStorageKey(
  challenge: Pick<PyramidChallenge, "id" | "attemptVersion">,
) {
  return `the-flash:pyramid-attempt:${challenge.id}:v${challenge.attemptVersion}`;
}

export function isPyramidLevelPassed(result: Pick<AnswerResult, "status" | "isCorrect">) {
  return result.status === "correct" && result.isCorrect;
}

export function normalizePyramidResult(result: AnswerResult): AnswerResult {
  return isPyramidLevelPassed(result) ? result : { ...result, points: 0 };
}

export function createPyramidAttempt(
  challenge: PyramidChallenge,
  now: number,
): PyramidAttemptRecord {
  return {
    schemaVersion: PYRAMID_ATTEMPT_SCHEMA_VERSION,
    challengeId: challenge.id,
    definitionId: challenge.definitionId,
    attemptVersion: challenge.attemptVersion,
    status: "in-progress",
    phase: "playing",
    startedAt: now,
    currentLevelIndex: 0,
    levelStartedAt: null,
    deadlineAt: null,
    results: [],
    draftAnswer: null,
    submittedCodes: [],
    incorrectAttempts: 0,
    outcome: null,
    completedAt: null,
    summary: null,
  };
}

export function armPyramidLevel(
  record: PyramidAttemptRecord,
  question: Question,
  availableUntil: string | null,
  now: number,
): PyramidAttemptRecord {
  if (record.status === "completed" || record.deadlineAt !== null) return record;
  return {
    ...record,
    levelStartedAt: now,
    deadlineAt: availableUntil
      ? Math.min(now + question.timeLimit * 1000, new Date(availableUntil).getTime())
      : now + question.timeLimit * 1000,
  };
}

export function getPyramidAttemptSummary(
  challengeId: string,
  results: AnswerResult[],
  outcome: PyramidAttemptOutcome,
  completedAt: number,
): PyramidAttemptSummary {
  return {
    challengeId,
    levelsCleared: results.filter(isPyramidLevelPassed).length,
    score: Math.max(
      0,
      results.reduce((total, result) => total + result.points, 0),
    ),
    timeUsed: results.reduce((total, result) => total + result.timeUsed, 0),
    outcome,
    completedAt,
  };
}

export function completePyramidAttempt(
  record: PyramidAttemptRecord,
  result: AnswerResult,
  outcome: PyramidAttemptOutcome,
  completedAt: number,
): PyramidAttemptRecord {
  const normalizedResult = normalizePyramidResult(result);
  const results = [...record.results, normalizedResult];
  return {
    ...record,
    status: "completed",
    phase: "completed",
    deadlineAt: null,
    results,
    draftAnswer: null,
    submittedCodes: [],
    incorrectAttempts: 0,
    outcome,
    completedAt,
    summary: getPyramidAttemptSummary(record.challengeId, results, outcome, completedAt),
  };
}

export function comparePyramidAttemptSummaries(
  left: PyramidAttemptSummary,
  right: PyramidAttemptSummary,
) {
  return (
    right.levelsCleared - left.levelsCleared ||
    right.score - left.score ||
    left.timeUsed - right.timeUsed
  );
}

function isAnswerResult(value: unknown): value is AnswerResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Partial<AnswerResult>;
  return (
    typeof result.questionId === "string" &&
    typeof result.isCorrect === "boolean" &&
    typeof result.points === "number" &&
    typeof result.timeUsed === "number" &&
    ["correct", "partial", "incorrect", "unanswered"].includes(result.status ?? "")
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasValidSummary(
  value: Partial<PyramidAttemptRecord>,
  results: AnswerResult[],
): value is PyramidAttemptRecord {
  if (
    value.status !== "completed" ||
    value.phase !== "completed" ||
    (value.outcome !== "failed" && value.outcome !== "summit") ||
    !isFiniteNumber(value.completedAt) ||
    !value.summary ||
    typeof value.summary !== "object"
  ) {
    return false;
  }

  const expected = getPyramidAttemptSummary(
    String(value.challengeId),
    results,
    value.outcome,
    value.completedAt,
  );
  return (
    value.summary.challengeId === expected.challengeId &&
    value.summary.levelsCleared === expected.levelsCleared &&
    value.summary.score === expected.score &&
    value.summary.timeUsed === expected.timeUsed &&
    value.summary.outcome === expected.outcome &&
    value.summary.completedAt === expected.completedAt
  );
}

export function parsePyramidAttempt(
  serialized: string,
  challenge: Pick<PyramidChallenge, "id" | "definitionId" | "attemptVersion" | "levels">,
): PyramidAttemptRecord | null {
  try {
    const value = JSON.parse(serialized) as Partial<PyramidAttemptRecord>;
    const validStatus = value.status === "in-progress" || value.status === "completed";
    const validPhase =
      value.phase === "playing" || value.phase === "transition" || value.phase === "completed";
    const validIndex =
      Number.isInteger(value.currentLevelIndex) &&
      Number(value.currentLevelIndex) >= 0 &&
      Number(value.currentLevelIndex) < challenge.levels.length;
    const results = Array.isArray(value.results) ? value.results : [];
    if (
      value.schemaVersion !== PYRAMID_ATTEMPT_SCHEMA_VERSION ||
      value.challengeId !== challenge.id ||
      value.definitionId !== challenge.definitionId ||
      value.attemptVersion !== challenge.attemptVersion ||
      !validStatus ||
      !validPhase ||
      !validIndex ||
      !isFiniteNumber(value.startedAt) ||
      !Array.isArray(value.results) ||
      !results.every(isAnswerResult) ||
      !Array.isArray(value.submittedCodes) ||
      !value.submittedCodes.every((code) => typeof code === "string") ||
      !Number.isInteger(value.incorrectAttempts) ||
      Number(value.incorrectAttempts) < 0 ||
      (value.levelStartedAt !== null && !isFiniteNumber(value.levelStartedAt)) ||
      (value.deadlineAt !== null && !isFiniteNumber(value.deadlineAt))
    ) {
      return null;
    }

    const typedResults = results as AnswerResult[];
    const currentLevelIndex = Number(value.currentLevelIndex);
    const questionSequenceIsValid = typedResults.every(
      (result, index) => result.questionId === challenge.levels[index]?.question.id,
    );
    const timingIsValid =
      value.levelStartedAt === null
        ? value.deadlineAt === null
        : value.deadlineAt === null || value.deadlineAt >= value.levelStartedAt;
    if (!questionSequenceIsValid || !timingIsValid) return null;

    if (value.status === "completed") {
      const terminalResult = typedResults.at(-1);
      const completedStateIsValid =
        typedResults.length === currentLevelIndex + 1 &&
        value.deadlineAt === null &&
        Boolean(terminalResult) &&
        (value.outcome === "summit"
          ? currentLevelIndex === challenge.levels.length - 1 &&
            typedResults.every(isPyramidLevelPassed)
          : !isPyramidLevelPassed(terminalResult!));
      return completedStateIsValid && hasValidSummary(value, typedResults)
        ? (value as PyramidAttemptRecord)
        : null;
    }

    if (value.outcome !== null || value.completedAt !== null || value.summary !== null) return null;
    const inProgressStateIsValid =
      value.phase === "playing"
        ? typedResults.length === currentLevelIndex
        : value.phase === "transition" &&
          currentLevelIndex < challenge.levels.length - 1 &&
          typedResults.length === currentLevelIndex + 1 &&
          value.deadlineAt === null &&
          isPyramidLevelPassed(typedResults.at(-1)!);
    if (!inProgressStateIsValid) return null;
    return value as PyramidAttemptRecord;
  } catch {
    return null;
  }
}
