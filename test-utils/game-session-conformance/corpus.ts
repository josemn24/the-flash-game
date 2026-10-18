import corpus from "../format-contracts/corpus.json";
import { readStoredQuestion } from "@/lib/question-formats/storedRegistry";
import {
  buildWordHashtagSolution,
  WORD_HASHTAG_ACTIVE_CELLS,
  applyWordHashtagSwap,
} from "@/lib/wordHashtag";
import { COMPETITIVE_RESOLVERS } from "@/lib/scoringCore/resolution/registry";
import type { CompetitiveQuestionType } from "@/lib/question-formats/definitions";
import type { LocalPyramidDefinition } from "@/types/gameplay/local-pyramid";
import type {
  GameSessionCommand,
  GameSessionCommandInputs,
  GameSessionOperation,
} from "@/types/contracts/game-session";
import type { QuestionVersionId } from "@/types/domain/identifiers";
import type { DurationMs, JsonValue } from "@/types/domain/values";
import type { ResolvedQuestion } from "@/types/gameplay/scoring";

const seen = new Set<string>();
export const sessionCases = corpus.filter((row) => {
  const key = `${row.document.type}:${row.document.payloadSchemaVersion}`;
  if (!row.valid || !row.modes.includes("pyramid") || seen.has(key)) return false;
  seen.add(key);
  return true;
});
export type SessionCase = (typeof sessionCases)[number];
export type SessionAction = {
  [K in GameSessionOperation]: {
    operation: K;
    input: Omit<
      GameSessionCommandInputs[K],
      "sessionId" | "revision" | "idempotencyKey" | "challengeItemId"
    >;
  };
}[GameSessionOperation];

export function runtimeDocument(test: SessionCase) {
  const document = structuredClone(test.document);
  const payload = document.publicPayload as Record<string, unknown>;
  for (const key of ["media", "surface"]) {
    const value = payload[key];
    if (value && typeof value === "object" && "assetId" in value) {
      const { assetId, ...rest } = value;
      payload[key] = { ...rest, src: `/authorized-assets/${assetId}.png` };
    }
  }
  return document;
}
export function definitionFor(
  test: SessionCase,
  ids: { challengeId?: string; itemIds?: string[]; questionIds?: string[]; duration?: number } = {},
): LocalPyramidDefinition {
  const rows = Array.from({ length: 7 }, (_, index) => (index === 0 ? test : sessionCases[0]!));
  const levels = rows.map((row, index) => {
    const document = runtimeDocument(row);
    const id = ids.itemIds?.[index] ?? `item-${index}`;
    const canonical = readStoredQuestion({
      questionType: document.type as CompetitiveQuestionType,
      payloadSchemaVersion: document.payloadSchemaVersion,
      publicPayload: document.publicPayload as JsonValue,
      solutionPayload: document.solutionPayload as JsonValue,
      timeLimitMs: (ids.duration ?? document.timeLimitMs) as DurationMs,
      itemPoints: index === 6 ? 16 : 14,
      receiptId: id,
      questionVersionId: (ids.questionIds?.[index] ?? `version-${index}`) as QuestionVersionId,
      mode: "pyramid",
      itemConfigSchemaVersion: 1,
      modeConfigSchemaVersion: 1,
      itemConfig: {},
      modeConfig: {},
      publicRepresentation: "authorized-runtime",
    });
    // Canonical solutions allow authored spelling. Keep it for terminal review;
    // the existing Mini-Wordle rules normalize it when scoring accepted guesses.
    if (canonical.solution.type === "mini-wordle") {
      const authored = document.solutionPayload as {
        correctAnswer: string;
        additionalGuesses: string[];
      };
      canonical.solution = {
        ...canonical.solution,
        payload: {
          ...canonical.solution.payload,
          correctAnswer: authored.correctAnswer,
          additionalGuesses: authored.additionalGuesses,
        },
      };
    }
    return {
      challengeItemId: id,
      payloadSchemaVersion: document.payloadSchemaVersion,
      ...canonical,
    };
  });
  return {
    challenge: {
      id: ids.challengeId ?? "challenge",
      definitionId: "definition",
      number: 1,
      title: "Conformidad Pirámide",
      subtitle: "",
      description: "",
      mode: "pyramid",
      maxScore: 100,
      attemptVersion: 1,
      availableFrom: "2000-01-01T00:00:00Z",
      availableUntil: "2999-01-01T00:00:00Z",
      levels: levels.map((level, index) => ({
        id: level.challengeItemId,
        levelId: `level-${index}`,
        label: `Nivel ${index + 1}`,
        briefing: {
          title: `Nivel ${index + 1}`,
          format: level.publicQuestion.type,
          description: "Ensayo",
        },
        position: index + 1,
        questionType: level.publicQuestion.type as CompetitiveQuestionType,
        payloadSchemaVersion: level.payloadSchemaVersion,
        timeLimitMs: level.publicQuestion.timeLimitMs,
        points: index === 6 ? 16 : 14,
      })),
    },
    levels,
  };
}
export function resolvedFor(definition: LocalPyramidDefinition, index = 0) {
  const level = definition.levels[index]!;
  return COMPETITIVE_RESOLVERS[level.publicQuestion.type as CompetitiveQuestionType]({
    ...level,
    points: definition.challenge.levels[index]!.points,
  });
}
export function correctActions(q: ResolvedQuestion): SessionAction[] {
  const answer = (value: GameSessionCommandInputs["answer"]["answer"]): SessionAction[] => [
    { operation: "answer", input: { answer: value } },
  ];
  switch (q.type) {
    case "queens":
      return [{ operation: "queensValidation", input: { queens: q.solution } }];
    case "mini-wordle":
      return [{ operation: "miniWordleGuess", input: { guess: q.correctAnswer } }];
    case "logic-code":
      return [{ operation: "logicCodeAttempt", input: { code: q.correctAnswer } }];
    case "word-search":
      return q.targets.map((target) => ({
        operation: "wordSearchSelection",
        input: { startCell: target.startCell, endCell: target.endCell },
      }));
    case "word-hashtag": {
      const target = buildWordHashtagSolution(q.words)!;
      let board = [...q.initialLetters];
      const actions: SessionAction[] = [];
      for (const cell of WORD_HASHTAG_ACTIVE_CELLS) {
        if (board[cell] === target[cell]) continue;
        const from = WORD_HASHTAG_ACTIVE_CELLS.find(
          (index) =>
            index !== cell && board[index] === target[cell] && board[index] !== target[index],
        );
        if (from === undefined) throw new Error("unsolvable_hashtag_fixture");
        const swap = { fromCell: from, toCell: cell };
        board = applyWordHashtagSwap(q, board, swap)!;
        actions.push({ operation: "wordHashtagSwap", input: swap });
      }
      return actions;
    }
    case "matching":
      return answer(Object.fromEntries(q.leftItems.map((item) => [item.id, item.correctMatchId])));
    case "ordering":
      return answer(q.correctOrder);
    case "classification":
      return answer(Object.fromEntries(q.items.map((item) => [item.label, item.correctCategory])));
    case "logic-matrix":
      return answer(q.correctOptionId);
    case "zip":
      return answer({ path: q.solution });
    case "escape":
      return answer({ moves: q.referenceSolution! });
    case "connect-pairs":
      return answer({ paths: q.solutionPaths });
    case "heat-map":
      return answer(q.target);
    default:
      if ("correctAnswer" in q) return answer(q.correctAnswer);
      throw new Error(`missing_correct_action:${q.type}`);
  }
}
export function exhaustedHashtagActions(
  q: Extract<ResolvedQuestion, { type: "word-hashtag" }>,
): SessionAction[] {
  const solution = buildWordHashtagSolution(q.words)!;
  for (const fromCell of WORD_HASHTAG_ACTIVE_CELLS)
    for (const toCell of WORD_HASHTAG_ACTIVE_CELLS) {
      const next = applyWordHashtagSwap(q, [...q.initialLetters], { fromCell, toCell });
      if (next && [fromCell, toCell].every((cell) => next[cell] !== solution[cell]))
        return Array.from({ length: q.maxMoves }, () => ({
          operation: "wordHashtagSwap",
          input: { fromCell, toCell },
        }));
    }
  throw new Error("missing_reversible_hashtag_fixture_swap");
}
/** Published examples with mistakes/partial work, including invalid and duplicate events. */
export function adverseActions(q: ResolvedQuestion): SessionAction[] {
  const answer = (value: GameSessionCommandInputs["answer"]["answer"]): SessionAction[] => [
    { operation: "answer", input: { answer: value } },
  ];
  switch (q.type) {
    case "queens":
      return [
        { operation: "queensValidation", input: { queens: [] } },
        ...Array.from({ length: 3 }, (): SessionAction => ({
          operation: "queensValidation",
          input: { queens: Array.from({ length: q.grid.rows }, (_, i) => i) },
        })),
      ];
    case "mini-wordle": {
      const guess = "cásas"; // Present in the preloaded test dictionary, absent from additionalGuesses.
      return [
        { operation: "miniWordleGuess", input: { guess: "ZZZZZ" } },
        { operation: "miniWordleGuess", input: { guess } },
        { operation: "miniWordleGuess", input: { guess } },
        { operation: "miniWordleGuess", input: { guess: q.additionalGuesses![1]! } },
      ];
    }
    case "logic-code": {
      const code = q.correctAnswer === "1111" ? "2222" : "1111";
      return [
        { operation: "logicCodeAttempt", input: { code: "x" } },
        { operation: "logicCodeAttempt", input: { code } },
        { operation: "logicCodeAttempt", input: { code } },
        { operation: "recover", input: {} },
      ];
    }
    case "word-search": {
      const target = q.targets[0]!;
      return [
        { operation: "wordSearchSelection", input: { startCell: -1, endCell: -1 } },
        { operation: "wordSearchSelection", input: { startCell: 0, endCell: 1 } },
        {
          operation: "wordSearchSelection",
          input: { startCell: target.startCell, endCell: target.endCell },
        },
        {
          operation: "wordSearchSelection",
          input: { startCell: target.startCell, endCell: target.endCell },
        },
        { operation: "recover", input: {} },
      ];
    }
    case "word-hashtag":
      return [
        { operation: "wordHashtagSwap", input: { fromCell: 0, toCell: 0 } },
        correctActions(q)[0]!,
        { operation: "recover", input: {} },
      ];
    case "progressive-clues":
      return [
        ...Array.from({ length: q.clues.length }, (): SessionAction => ({
          operation: "progressiveClueReveal",
          input: {},
        })),
        ...answer("incorrecta"),
      ];
    case "true-false":
      return answer(!q.correctAnswer);
    case "ordering": {
      const order = [...q.correctOrder];
      [order[0], order[1]] = [order[1]!, order[0]!];
      return answer(order);
    }
    case "matching":
      return answer(
        Object.fromEntries(
          q.leftItems.map((item, i) => [
            item.id,
            q.leftItems[(i + 1) % q.leftItems.length]!.correctMatchId,
          ]),
        ),
      );
    case "classification":
      return answer(
        Object.fromEntries(
          q.items.map((item, i) => [
            item.label,
            i === 0 ? q.categories.find((c) => c !== item.correctCategory)! : item.correctCategory,
          ]),
        ),
      );
    case "estimation":
      return answer(q.correctAnswer + q.step);
    case "heat-map": {
      const radius = (q.fullCreditRadius + q.toleranceRadius) / 2;
      const offset = (radius * Math.min(q.surface.width, q.surface.height)) / q.surface.width;
      return answer({ ...q.target, x: q.target.x + (q.target.x > 0.5 ? -offset : offset) });
    }
    case "zip":
      return answer({ path: q.solution.slice(0, -1) });
    case "connect-pairs":
      return answer({ paths: Object.fromEntries(Object.entries(q.solutionPaths).slice(0, 1)) });
    case "escape":
      return answer({ moves: [] });
    default:
      return answer("incorrecta");
  }
}
export function commandFor(
  action: SessionAction,
  context: { sessionId: string; revision: number; challengeItemId: string; idempotencyKey: string },
): GameSessionCommand {
  return {
    operation: action.operation,
    input: { ...context, ...action.input },
  } as GameSessionCommand;
}
export const testDictionaries = new Map([
  ["es-general-5.v1", new Set(["JESUS", "JOSUE", "JACOB", "DAVID", "CASAS"])],
]);
