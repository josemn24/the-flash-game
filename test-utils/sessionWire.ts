import { WORD_HASHTAG_ACTIVE_CELLS } from "@/lib/wordHashtag";
export const wireValidationContext = {
  mode: "flash" as const,
  items: [
    {
      id: "item",
      questionType: "multiple-choice" as const,
      payloadSchemaVersion: 1,
      timeLimitMs: 60000,
      points: 100,
    },
  ],
};
import type { CompetitiveAttemptClient } from "@/features/game/competitive/attemptClient";
import type { CompetitiveJsonObject } from "@/features/game/competitive/transport";
import type { GameSessionOperation } from "@/types/contracts/game-session";
/** Complete wire fixtures for policy tests. Decoder regressions use raw, unmodified responses. */
export function sessionWireFixture(
  operation: GameSessionOperation,
  value: CompetitiveJsonObject,
  input: CompetitiveJsonObject = {},
  sessionId = "attempt",
): CompetitiveJsonObject {
  const queens = {
    queens: [],
    placedQueens: 0,
    completedRows: 0,
    completedColumns: 0,
    completedRegions: 0,
    conflictingQueens: 0,
    solved: false,
    incorrectValidations: 0,
    maxIncorrectValidations: 3,
  };
  const defaults: Partial<Record<GameSessionOperation, CompetitiveJsonObject>> = {
    prepareSession: { ready: true },
    alphabetPass: { passed: true },
    start: { resumed: false, deadlineAt: null },
    takeover: { deadlineAt: null },
    prepare: {
      challengeItemId: "item",
      publicPayload: { question: "Elige", options: ["A", "B"] },
      presentedAt: "2026-10-01T10:00:00Z",
      deadlineAt: "2026-10-01T10:01:00Z",
      timedOut: false,
    },
    activate: {
      challengeItemId: "item",
      presentedAt: "2026-10-01T10:00:00Z",
      deadlineAt: "2026-10-01T10:01:00Z",
      timedOut: false,
    },
    answer: { status: "correct", points: 10, timeUsedMs: 1000 },
    complete: { status: "completed", score: 20 },
    abandon: { status: "abandoned", score: null },
    miniWordleGuess: {
      guess: "CASA",
      feedback: ["C", "A", "S", "A"].map((letter) => ({ letter, status: "absent" })),
      attemptsUsed: 1,
      terminal: false,
    },
    logicCodeAttempt: { code: "1234", correct: false, incorrectAttempts: 1, terminal: false },
    wordHashtagSwap: {
      letters: Array.from({ length: 25 }, (_, i) =>
        WORD_HASHTAG_ACTIVE_CELLS.includes(i) ? "A" : null,
      ),
      correctCells: [],
      movesUsed: 1,
      movesRemaining: 9,
      terminal: false,
    },
    progressiveClueReveal: {
      clue: "Pista",
      revealedClues: 2,
      totalClues: 3,
      availablePoints: 10,
      cluePenalty: 1,
    },
    pyramidDraft: { reviewState: { type: "ordering", answer: ["A", "B"] } },
    connectPairsDraft: { reviewState: { type: "connect-pairs", paths: { a: [0, 1, 2] } } },
    wordSearchSelection: {
      correct: false,
      terminal: false,
      foundSelections: [],
      foundWordIds: [],
      foundCount: 0,
      totalWords: 1,
      incorrectAttempts: 1,
    },
    recover: { phase: "countdown", answers: [] },
    queensDraft: queens,
    queensValidation: { ...queens, terminal: false, incorrectAttempts: 0, correct: false },
  };
  return {
    ...(operation === "prepareSession" ? {} : { attemptId: sessionId }),
    ...("challengeItemId" in input ? { challengeItemId: input.challengeItemId } : {}),
    ...defaults[operation],
    ...value,
  };
}
export function clientWithWireFixtures(
  client: CompetitiveAttemptClient,
  sessionId = "attempt",
  context?: import("@/types/gameplay/authoritative-session").GameSessionValidationContext,
): CompetitiveAttemptClient {
  return Object.fromEntries(
    Object.keys(client).map((key) => [
      key,
      async (input: CompetitiveJsonObject) => {
        const result = await (
          client[key as GameSessionOperation] as (
            input: CompetitiveJsonObject,
          ) => Promise<CompetitiveJsonObject>
        )(input);
        if (result === undefined) return result;
        const fixture = sessionWireFixture(key as GameSessionOperation, result, input, sessionId);
        if (
          key === "prepare" &&
          fixture.progress === undefined &&
          fixture.publicPayload &&
          typeof fixture.publicPayload === "object"
        ) {
          const payload = fixture.publicPayload as CompetitiveJsonObject;
          if (payload.wordLength !== undefined)
            fixture.progress = {
              kind: "mini-wordle",
              guesses: [],
              feedback: [],
              attemptsUsed: 0,
              maxAttempts: payload.maxAttempts,
            };
          if (payload.regions !== undefined)
            fixture.progress = {
              kind: "queens",
              queens: payload.prefilledQueens ?? [],
              placedQueens: Array.isArray(payload.prefilledQueens)
                ? payload.prefilledQueens.length
                : 0,
              completedRows: 0,
              completedColumns: 0,
              completedRegions: 0,
              conflictingQueens: 0,
              solved: false,
              incorrectValidations: 0,
              maxIncorrectValidations: 3,
            };
          if (payload.initialLetters !== undefined)
            fixture.progress = {
              kind: "word-hashtag",
              letters: payload.initialLetters,
              correctCells: [],
              movesUsed: 0,
              movesRemaining: payload.maxMoves,
            };
          if (payload.targets !== undefined)
            fixture.progress = {
              kind: "word-search",
              foundSelections: [],
              foundWordIds: [],
              foundCount: 0,
              totalWords: Array.isArray(payload.targets) ? payload.targets.length : 2,
              incorrectAttempts: 0,
            };
        }
        if (key === "prepare" && context?.mode === "alphabet") {
          const given =
            fixture.progress && typeof fixture.progress === "object"
              ? (fixture.progress as CompetitiveJsonObject)
              : {};
          fixture.progress = {
            kind: "alphabet",
            round: 1,
            currentIndex: 0,
            playedCount: 1,
            correctAnswers: 0,
            incorrectAnswers: 0,
            elapsedTimeMs: 0,
            deadlineAt: fixture.deadlineAt,
            lastCorrectAt: null,
            ...given,
            letters:
              Array.isArray(given.letters) && given.letters.length
                ? given.letters
                : context.items.map((i) => ({
                    letter: i.id,
                    challengeItemId: i.id,
                    status: "unvisited",
                    answer: null,
                  })),
          };
        }
        if (
          context?.mode === "time-trial" &&
          ["prepare", "recover", "queensValidation", "complete"].includes(key) &&
          fixture.timeTrial === undefined
        ) {
          const waiting =
            key === "recover" &&
            fixture.phase !== "playing" &&
            fixture.phase !== "results" &&
            fixture.deadlineAt == null;
          const now = new Date().toISOString();
          const deadline =
            typeof fixture.deadlineAt === "string"
              ? fixture.deadlineAt
              : new Date(Date.now() + (context.timeLimitMs ?? 60000)).toISOString();
          fixture.timeTrial = {
            kind: "time-trial",
            currentIndex: 0,
            solvedCount: 0,
            totalCount: context.items.length,
            points: 0,
            elapsedTimeMs: 0,
            serverNow: now,
            lastCorrectElapsedMs: null,
            clockStartedAt: waiting
              ? null
              : new Date(Date.parse(deadline) - (context.timeLimitMs ?? 60000)).toISOString(),
            deadlineAt: waiting ? null : deadline,
            endReason: key === "complete" ? "time_limit" : null,
          };
        }
        return fixture;
      },
    ]),
  ) as unknown as CompetitiveAttemptClient;
}
