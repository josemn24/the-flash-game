import { WORD_HASHTAG_ACTIVE_CELLS, normalizeWordHashtagWord } from "@/lib/wordHashtag";
import { readTimeTrialProgress, readTimeTrialResult } from "@/lib/timeTrial";

/** Shape diagnostics contain paths only: never serialize private receipts or solutions. */
export class CompetitiveResponseContractError extends Error {
  constructor(readonly path: string) {
    super(`Invalid competitive response at ${path}`);
    this.name = "CompetitiveResponseContractError";
  }
}
export type ResponseRecord = Record<string, unknown>;
export type Check = (value: unknown) => boolean;
export const text: Check = (v) => typeof v === "string" && v.length > 0;
export const boolean: Check = (v) => typeof v === "boolean";
export const integer: Check = (v) => Number.isSafeInteger(v) && Number(v) >= 0;
export const positive: Check = (v) => integer(v) && Number(v) > 0;
export const points: Check = (v) => integer(v) && Number(v) <= 100;
export const date: Check = (v) => typeof v === "string" && Number.isFinite(Date.parse(v));
export const nullable =
  (check: Check): Check =>
  (v) =>
    v === null || check(v);
export const list =
  (check: Check): Check =>
  (v) =>
    Array.isArray(v) && v.every(check);
export const oneOf =
  (...values: readonly unknown[]): Check =>
  (v) =>
    values.includes(v);
export const answerStatus = oneOf("correct", "partial", "incorrect", "unanswered");
export const mode = oneOf("flash", "alphabet", "survival", "pyramid", "narrative", "time-trial");
export const json: Check = (v) =>
  v === null ||
  typeof v === "string" ||
  typeof v === "boolean" ||
  (typeof v === "number" && Number.isFinite(v)) ||
  (Array.isArray(v) && v.every(json)) ||
  (isRecord(v) && Object.values(v).every(json));
export const reviewStateValue: Check = (value) => {
  if (!isRecord(value)) return false;
  if (value.type === "connect-pairs")
    return (
      isRecord(value.paths) &&
      Object.entries(value.paths).every(
        ([key, path]) =>
          key.length > 0 && Array.isArray(path) && path.every((cell) => integer(cell)),
      )
    );
  return value.type === "queens" && Array.isArray(value.queens) && value.queens.every(integer);
};
export function isRecord(v: unknown): v is ResponseRecord {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
export function requireResponse(condition: unknown, path: string): asserts condition {
  if (!condition) throw new CompetitiveResponseContractError(path);
}
export function record(v: unknown, path = "response"): ResponseRecord {
  requireResponse(isRecord(v), path);
  return v;
}
export function fields(row: ResponseRecord, checks: Record<string, Check>, path = "response") {
  for (const [key, check] of Object.entries(checks))
    requireResponse(check(row[key]), `${path}.${key}`);
}
export function optionalFields(
  row: ResponseRecord,
  checks: Record<string, Check>,
  path = "response",
) {
  for (const [key, check] of Object.entries(checks))
    if (row[key] !== undefined) requireResponse(check(row[key]), `${path}.${key}`);
}
export function identity(row: ResponseRecord, expected?: object) {
  fields(row, { attemptId: text, lockVersion: positive });
  for (const key of ["attemptId", "challengeItemId", "receiptId"] as const) {
    if (expected && key in expected && row[key] !== undefined)
      requireResponse(row[key] === (expected as Record<string, unknown>)[key], `response.${key}`);
  }
}
export function answerRows(value: unknown, allowOmittedNullAnswers = false) {
  requireResponse(Array.isArray(value), "response.answers");
  value.forEach((value, i) => {
    const row = record(value, `response.answers.${i}`);
    fields(
      row,
      { challengeItemId: text, status: answerStatus, points, timeUsedMs: integer },
      `response.answers.${i}`,
    );
    // Saved projections strip nulls recursively, including answers reconstructed from events.
    requireResponse(
      json(row.answer) || (allowOmittedNullAnswers && row.answer === undefined),
      `response.answers.${i}.answer`,
    );
    optionalFields(
      row,
      { resultDetails: nullable(resultDetails), reviewState: nullable(reviewStateValue) },
      `response.answers.${i}`,
    );
  });
  requireResponse(
    new Set(value.map((row) => row.challengeItemId)).size === value.length,
    "response.answers",
  );
}
/** These SQL progress DTOs are receipts first; evaluation is a later transaction. */
export function formatFields(operation: string, row: ResponseRecord, evaluated: boolean) {
  const queens = {
    queens: list(integer),
    placedQueens: integer,
    completedRows: integer,
    completedColumns: integer,
    completedRegions: integer,
    conflictingQueens: integer,
    solved: boolean,
  };
  const validations = {
    incorrectValidations: integer,
    maxIncorrectValidations: nullable(positive),
  };
  switch (operation) {
    case "miniWordleGuess":
      fields(row, {
        guess: text,
        feedback: list(
          (v) =>
            isRecord(v) &&
            typeof v.letter === "string" &&
            v.letter.length === 1 &&
            oneOf("correct", "present", "absent")(v.status),
        ),
        attemptsUsed: positive,
        terminal: boolean,
      });
      optionalFields(row, { sequence: positive, maxAttempts: positive });
      requireResponse(
        (row.feedback as unknown[]).length === (row.guess as string).length,
        "response.feedback",
      );
      if (row.maxAttempts !== undefined)
        requireResponse(
          Number(row.attemptsUsed) <= Number(row.maxAttempts),
          "response.attemptsUsed",
        );
      break;
    case "logicCodeAttempt":
      fields(row, { code: text, correct: boolean, incorrectAttempts: integer, terminal: boolean });
      break;
    case "wordHashtagSwap":
      wordHashtagState(row);
      fields(row, { movesUsed: positive, terminal: boolean });
      break;
    case "progressiveClueReveal":
      fields(row, {
        clue: text,
        revealedClues: positive,
        totalClues: positive,
        availablePoints: points,
        cluePenalty: integer,
      });
      requireResponse(
        Number(row.revealedClues) <= Number(row.totalClues),
        "response.revealedClues",
      );
      break;
    case "connectPairsDraft":
      fields(row, { challengeItemId: text, reviewState: reviewStateValue });
      break;
    case "queensDraft":
      fields(row, { ...queens, ...validations });
      break;
    case "queensValidation":
      fields(row, {
        ...queens,
        ...validations,
        correct: boolean,
        incorrectAttempts: integer,
        terminal: boolean,
      });
      break;
    case "queensPlacement":
      fields(row, {
        ...queens,
        cell: integer,
        action: oneOf("place", "remove"),
        conflicting: boolean,
        penaltyApplied: boolean,
        terminal: boolean,
      });
      break;
    case "wordSearchSelection":
      fields(row, {
        correct: boolean,
        terminal: boolean,
        foundSelections: list(isRecord),
        foundWordIds: list(text),
        foundCount: integer,
        totalWords: positive,
        incorrectAttempts: integer,
      });
      if (!evaluated)
        fields(row, { startCell: integer, endCell: integer, matchedTargetId: nullable(text) });
      (row.foundSelections as ResponseRecord[]).forEach((s) =>
        fields(
          s,
          { targetId: text, startCell: integer, endCell: integer },
          "response.foundSelections",
        ),
      );
      requireResponse(
        Number(row.foundCount) <= Number(row.totalWords) &&
          (row.foundWordIds as unknown[]).length === row.foundCount &&
          (row.foundSelections as unknown[]).length === row.foundCount,
        "response.foundCount",
      );
      break;
    default:
      throw new CompetitiveResponseContractError("operation");
  }
  if (row.terminal === true) {
    if (evaluated) fields(row, { status: answerStatus, points, timeUsedMs: integer });
    else fields(row, { receiptId: text });
  }
  optionalFields(row, {
    points,
    timeUsedMs: integer,
    status: answerStatus,
    details: resultDetails,
  });
}
/** Read the existing clock contract without exposing the offending clock data. */
export function checkedTimeTrial<T>(read: (value: unknown) => T, value: unknown): T {
  try {
    return read(value);
  } catch {
    throw new CompetitiveResponseContractError("response.timeTrial");
  }
}
/** Stateful preparation must not silently reset progress through forgiving UI readers. */
export function preparedProgress(type: string, value: unknown) {
  const stateful = [
    "mini-wordle",
    "logic-code",
    "progressive-clues",
    "queens",
    "connect-pairs",
    "word-search",
    "word-hashtag",
  ];
  if (!stateful.includes(type)) return;
  if (type === "connect-pairs" && (value === undefined || value === null)) return;
  const r = record(value, "response.progress");
  requireResponse(r.kind === type, "response.progress.kind");
  switch (type) {
    case "connect-pairs": {
      fields(r, {
        kind: oneOf("connect-pairs"),
        paths: (v) =>
          isRecord(v) &&
          Object.entries(v).every(
            ([key, path]) =>
              key.length > 0 && Array.isArray(path) && path.every((cell) => integer(cell)),
          ),
      });
      break;
    }
    case "mini-wordle": {
      const feedback = (v: unknown) =>
        isRecord(v) && text(v.letter) && oneOf("correct", "present", "absent")(v.status);
      fields(
        r,
        {
          guesses: list(text),
          feedback: list(list(feedback)),
          attemptsUsed: integer,
          maxAttempts: positive,
        },
        "response.progress",
      );
      const guesses = r.guesses as string[];
      const rows = r.feedback as unknown[][];
      requireResponse(
        guesses.length === r.attemptsUsed &&
          rows.length === guesses.length &&
          rows.every((f, i) => f.length === guesses[i].length) &&
          Number(r.attemptsUsed) <= Number(r.maxAttempts),
        "response.progress.feedback",
      );
      break;
    }
    case "logic-code":
      fields(r, { submittedCodes: list(text), incorrectAttempts: integer }, "response.progress");
      break;
    case "progressive-clues":
      fields(
        r,
        {
          clues: list(text),
          revealedClues: positive,
          totalClues: positive,
          cluePenalty: integer,
          availablePoints: points,
        },
        "response.progress",
      );
      requireResponse(
        (r.clues as unknown[]).length === r.revealedClues &&
          Number(r.revealedClues) <= Number(r.totalClues),
        "response.progress.clues",
      );
      break;
    case "queens":
      formatFields("queensDraft", r, true);
      break;
    case "word-search":
      formatFields("wordSearchSelection", { ...r, terminal: false, correct: false }, true);
      break;
    case "word-hashtag":
      wordHashtagState(r);
      break;
  }
}
export function alphabetProgress(value: unknown, itemIds?: readonly string[]) {
  const r = record(value, "response.progress");
  fields(
    r,
    {
      kind: oneOf("alphabet"),
      round: positive,
      currentIndex: integer,
      playedCount: integer,
      correctAnswers: integer,
      incorrectAnswers: integer,
      elapsedTimeMs: integer,
      deadlineAt: date,
      lastCorrectAt: nullable(date),
      letters: list(isRecord),
    },
    "response.progress",
  );
  const letters = r.letters as ResponseRecord[];
  letters.forEach((letter) =>
    fields(
      letter,
      {
        letter: text,
        challengeItemId: text,
        status: oneOf("unvisited", "active", "passed", "correct", "incorrect", "unanswered"),
        answer: nullable(text),
      },
      "response.progress.letters",
    ),
  );
  requireResponse(
    letters.length > 0 &&
      new Set(letters.map((v) => v.challengeItemId)).size === letters.length &&
      Number(r.currentIndex) < letters.length &&
      Number(r.playedCount) <= letters.length &&
      Number(r.correctAnswers) + Number(r.incorrectAnswers) <= letters.length,
    "response.progress.letters",
  );
  if (itemIds)
    requireResponse(
      letters.length === itemIds.length &&
        letters.every((v) => itemIds.includes(String(v.challengeItemId))),
      "response.progress.letters.challengeItemId",
    );
}

/** Serializable evaluation details have their own discriminator, including nested collections. */
export function resultDetails(
  value: unknown,
): value is import("@/types/contracts/result-details").AnswerResultDetails {
  const shape =
    (checks: Record<string, Check>): Check =>
    (v) =>
      isRecord(v) && Object.entries(checks).every(([key, check]) => check(v[key]));
  const finite: Check = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
  const ratio: Check = (v) => finite(v) && Number(v) <= 1;
  const point = shape({ x: ratio, y: ratio });
  const schemas = {
    "logic-code": shape({ submittedCodes: list(text), incorrectAttempts: integer }),
    estimation: shape({ difference: finite, proximity: ratio }),
    matching: shape({ correctPairs: integer, totalPairs: integer }),
    "connect-pairs": shape({
      connectedPairs: integer,
      totalPairs: integer,
      coveredCells: integer,
      totalCells: integer,
      coverage: ratio,
      conflicts: integer,
    }),
    "flash-memory": shape({ correctPlacements: integer, totalPlacements: integer }),
    "memory-pairs": shape({
      matchedPairs: integer,
      totalPairs: integer,
      incorrectAttempts: integer,
      totalAttempts: integer,
    }),
    "simon-sequence": shape({ submittedSteps: list(text), firstMismatchIndex: nullable(integer) }),
    "mini-sudoku": shape({ correctCells: integer, totalCells: integer }),
    "mini-nonogram": shape({
      correctFilled: integer,
      incorrectFilled: integer,
      totalFilled: integer,
    }),
    queens: shape({
      placedQueens: integer,
      completedRows: integer,
      completedColumns: integer,
      completedRegions: integer,
      conflictingQueens: integer,
      incorrectAttempts: integer,
      marksUsed: integer,
      solved: boolean,
    }),
    "time-maze": shape({ moves: integer, optimalMoves: integer, reachedExit: boolean }),
    zip: shape({
      coveredCells: integer,
      totalCells: integer,
      reachedCheckpoint: integer,
      totalCheckpoints: integer,
      completed: boolean,
    }),
    pipes: shape({
      connectedTiles: integer,
      totalTiles: integer,
      openConnections: integer,
      isolatedComponents: integer,
      moves: integer,
      solved: boolean,
    }),
    "sliding-puzzle": shape({ moves: integer }),
    escape: shape({ moves: integer, optimalMoves: integer, escaped: boolean }),
    "progressive-clues": shape({
      revealedClues: integer,
      totalClues: integer,
      availablePoints: points,
    }),
    "heat-map": shape({
      selectedPoint: point,
      targetPoint: point,
      distance: finite,
      accuracy: ratio,
    }),
    "image-labeling": (v: unknown) =>
      isRecord(v) &&
      (v.task === "assign-all"
        ? shape({ correctLabels: integer, totalLabels: integer })(v)
        : v.task === "identify-one" && oneOf("choice", "text")(v.responseKind)),
    "error-reconstruction": shape({
      selectedStepId: nullable(text),
      locationCorrect: boolean,
      correctionRequired: boolean,
      correctionCorrect: boolean,
    }),
    "mini-wordle": shape({ attemptsUsed: integer, incorrectAttempts: integer, solved: boolean }),
    "word-hashtag": shape({
      correctCells: integer,
      totalCells: integer,
      completedWords: integer,
      totalWords: integer,
      movesUsed: integer,
      movesRemaining: integer,
      optimalMoves: integer,
      solved: boolean,
    }),
    "word-search": shape({
      foundWords: integer,
      totalWords: integer,
      incorrectSelections: integer,
      solved: boolean,
    }),
  } satisfies Record<import("@/types/contracts/result-details").AnswerResultDetails["type"], Check>;
  return (
    isRecord(value) &&
    typeof value.type === "string" &&
    Object.hasOwn(schemas, value.type) &&
    schemas[value.type as keyof typeof schemas](value) &&
    (value.incorrectAttempts === undefined || integer(value.incorrectAttempts)) &&
    (value.failureReason === undefined || value.failureReason === "attempts_exhausted")
  );
}

/** Public board invariants only. Correctness still belongs to the trusted evaluator. */
export function wordHashtagState(
  value: unknown,
  maxMoves?: number,
): asserts value is {
  readonly letters: readonly (string | null)[];
  readonly correctCells: readonly number[];
  readonly movesUsed: number;
  readonly movesRemaining: number;
} {
  const r = record(value);
  fields(r, {
    letters: list(nullable(text)),
    correctCells: list(integer),
    movesUsed: integer,
    movesRemaining: integer,
  });
  const letters = r.letters as (string | null)[];
  const cells = r.correctCells as number[];
  requireResponse(letters.length === 25, "response.letters");
  requireResponse(
    letters.every((letter, cell) =>
      WORD_HASHTAG_ACTIVE_CELLS.includes(cell)
        ? typeof letter === "string" && /^[A-ZÑ]$/.test(normalizeWordHashtagWord(letter))
        : letter === null,
    ),
    "response.letters",
  );
  requireResponse(
    cells.every(
      (cell, index) =>
        WORD_HASHTAG_ACTIVE_CELLS.includes(cell) &&
        letters[cell] !== null &&
        (index === 0 || cells[index - 1]! < cell),
    ),
    "response.correctCells",
  );
  if (maxMoves !== undefined) {
    requireResponse(positive(maxMoves), "context.maxMoves");
    requireResponse(
      Number(r.movesUsed) + Number(r.movesRemaining) === maxMoves,
      "response.movesRemaining",
    );
  }
}

/** Clock variants are checked against the operation, never inferred from display messages. */
export function timeTrialState(
  state: ResponseRecord,
  context: { timeLimitMs: number; totalCount?: number },
  requirement: "waiting-or-running" | "running" | "result" | "optional",
) {
  if (requirement === "optional" && state.timeTrial === undefined) return;
  const progress = checkedTimeTrial(
    requirement === "result" ? readTimeTrialResult : readTimeTrialProgress,
    state.timeTrial,
  );
  requireResponse(
    (progress.clockStartedAt === null) === (progress.deadlineAt === null),
    "response.timeTrial.deadlineAt",
  );
  if (requirement === "running" || requirement === "result")
    requireResponse(progress.clockStartedAt !== null, "response.timeTrial.clockStartedAt");
  if (progress.clockStartedAt !== null && progress.deadlineAt !== null)
    requireResponse(
      Date.parse(progress.deadlineAt) - Date.parse(progress.clockStartedAt) === context.timeLimitMs,
      "response.timeTrial.deadlineAt",
    );
  if (state.deadlineAt !== undefined)
    requireResponse(
      state.deadlineAt === null
        ? progress.deadlineAt === null
        : progress.deadlineAt !== null &&
            Date.parse(String(state.deadlineAt)) === Date.parse(progress.deadlineAt),
      "response.deadlineAt",
    );
  if (context.totalCount !== undefined)
    requireResponse(progress.totalCount === context.totalCount, "response.timeTrial.totalCount");
  requireResponse(
    progress.currentIndex === Math.min(progress.solvedCount, progress.totalCount - 1),
    "response.timeTrial.currentIndex",
  );
}
