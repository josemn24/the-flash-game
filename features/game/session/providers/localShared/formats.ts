import { calculateQueensDraftMetrics } from "@/lib/queens";
import {
  getMiniWordleFeedback,
  normalizeMiniWordleWord,
  isValidMiniWordleWord,
  getMiniWordleMaxAttempts,
} from "@/lib/miniWordle";
import {
  calculateWordHashtagMetrics,
  replayWordHashtagSwaps,
  buildWordHashtagSolution,
  WORD_HASHTAG_ACTIVE_CELLS,
} from "@/lib/wordHashtag";
import { findWordSearchTarget, getWordSearchPath } from "@/lib/wordSearch";
import { scaleProgressiveCluePenalty } from "@/lib/scoringCore/questions/progressiveClues";
import type { GameSessionCommand } from "@/types/contracts/game-session";
import type { AuthoritativeSessionUpdate } from "@/types/gameplay/authoritative-session";
import type { AnswerValue } from "@/types/contracts";
import type { MiniWordleLetterFeedback } from "@/types/domain/mini-wordle";
import type { CompiledLevel } from "./definition";

export class LocalRejection extends Error {}
export const reject = (code: string): never => {
  throw new LocalRejection(code);
};
export type FormatState = {
  guesses: string[];
  feedback: MiniWordleLetterFeedback[][];
  codes: string[];
  queens: number[];
  incorrectValidations: number;
  revealed: number;
  swaps: { fromCell: number; toCell: number }[];
  selections: { targetId: string; startCell: number; endCell: number }[];
  incorrectSelections: number;
};
export const initialFormatState = (level: CompiledLevel): FormatState => ({
  guesses: [],
  feedback: [],
  codes: [],
  queens:
    level.question.type === "queens"
      ? [...(level.question.prefilledQueens ?? [])].sort((a, b) => a - b)
      : [],
  incorrectValidations: 0,
  revealed: 1,
  swaps: [],
  selections: [],
  incorrectSelections: 0,
});
export function formatProgress(level: CompiledLevel, state: FormatState): unknown {
  const q = level.question;
  switch (q.type) {
    case "queens": {
      const {
        placedQueens,
        completedRows,
        completedColumns,
        completedRegions,
        conflictingQueens,
        solved,
      } = calculateQueensDraftMetrics(q, state.queens);
      return {
        kind: q.type,
        queens: state.queens,
        placedQueens,
        completedRows,
        completedColumns,
        completedRegions,
        conflictingQueens,
        solved,
        incorrectValidations: state.incorrectValidations,
        maxIncorrectValidations: 3,
      };
    }
    case "mini-wordle":
      return {
        kind: q.type,
        guesses: state.guesses,
        feedback: state.feedback,
        attemptsUsed: state.guesses.length,
        maxAttempts: getMiniWordleMaxAttempts(q),
      };
    case "logic-code":
      return {
        kind: q.type,
        submittedCodes: state.codes,
        incorrectAttempts: state.codes.filter((code) => code !== q.correctAnswer).length,
      };
    case "progressive-clues": {
      const cluePenalty = scaleProgressiveCluePenalty(q.cluePenalty, 100, q.points);
      return {
        kind: q.type,
        clues: q.clues.slice(0, state.revealed),
        revealedClues: state.revealed,
        totalClues: q.clues.length,
        cluePenalty,
        availablePoints: Math.max(0, q.points - cluePenalty * (state.revealed - 1)),
      };
    }
    case "word-search":
      return {
        kind: q.type,
        foundSelections: state.selections,
        foundWordIds: state.selections.map((s) => s.targetId),
        foundCount: state.selections.length,
        totalWords: q.targets.length,
        incorrectAttempts: state.incorrectSelections,
      };
    case "word-hashtag": {
      const replay = replayWordHashtagSwaps(q, state.swaps);
      if (!replay.valid) return reject("invalid_word_hashtag_swap");
      const solution = buildWordHashtagSolution(q.words)!;
      return {
        kind: q.type,
        letters: replay.letters,
        correctCells: WORD_HASHTAG_ACTIVE_CELLS.filter(
          (cell) => replay.letters[cell] === solution[cell],
        ),
        swaps: state.swaps,
        movesUsed: replay.appliedMoves,
        movesRemaining: q.maxMoves - replay.appliedMoves,
        solved: WORD_HASHTAG_ACTIVE_CELLS.every((cell) => replay.letters[cell] === solution[cell]),
      };
    }
    default:
      return null;
  }
}
export type FormatTransition = {
  state: FormatState;
  update: AuthoritativeSessionUpdate;
  terminal: boolean;
  answer: AnswerValue | null;
};

/** Pure transitions matching the six SQL event protocols. No storage or clock access. */
export function transitionFormat(
  level: CompiledLevel,
  previous: FormatState,
  command: GameSessionCommand,
  dictionaries: ReadonlyMap<string, ReadonlySet<string>>,
): FormatTransition {
  const state = structuredClone(previous);
  const q = level.question;
  let answer: AnswerValue | null = null;
  let terminal = false;
  let update: AuthoritativeSessionUpdate = {};
  switch (command.operation) {
    case "queensDraft":
    case "queensValidation": {
      const input = command.input;
      if (q.type !== "queens") return reject("unsupported_question");
      const cells = [...input.queens];
      const validation = command.operation === "queensValidation";
      if (
        cells.length > 64 ||
        !cells.every((cell) => Number.isSafeInteger(cell) && cell >= 0 && cell <= 63)
      )
        return reject("invalid_queens_answer");
      if (new Set(cells).size !== cells.length) return reject("invalid_queens_answer");
      if (validation && cells.length > q.grid.rows) return reject("queens_answer_overflow");
      if (validation && cells.length < q.grid.rows) return reject("queens_answer_incomplete");
      if (cells.some((cell) => cell >= q.grid.rows * q.grid.columns))
        return reject("invalid_queens_answer");
      const queens = [...new Set([...cells, ...(q.prefilledQueens ?? [])])].sort((a, b) => a - b);
      if (queens.length > q.grid.rows) return reject("queens_answer_overflow");
      if (command.operation === "queensValidation" && queens.length < q.grid.rows)
        return reject("queens_answer_incomplete");
      state.queens = queens;
      const metrics = calculateQueensDraftMetrics(q, queens);
      let correct = false;
      if (command.operation === "queensValidation") {
        correct =
          metrics.solved &&
          JSON.stringify(queens) === JSON.stringify([...q.solution].sort((a, b) => a - b));
        if (!correct) state.incorrectValidations++;
        terminal = correct || state.incorrectValidations >= 3;
        answer = { queens, marks: [] };
      }
      update = {
        ...(formatProgress(level, state) as AuthoritativeSessionUpdate),
        terminal,
        ...(command.operation === "queensValidation"
          ? { correct, incorrectAttempts: state.incorrectValidations }
          : {}),
      };
      return {
        state,
        update,
        terminal,
        answer,
      };
    }
    case "miniWordleGuess": {
      const input = command.input;
      if (q.type !== "mini-wordle") return reject("unsupported_question");
      const guess = normalizeMiniWordleWord(input.guess);
      if (
        !isValidMiniWordleWord(guess, q.wordLength) ||
        !(
          guess === normalizeMiniWordleWord(q.correctAnswer) ||
          q.additionalGuesses?.map(normalizeMiniWordleWord).includes(guess) ||
          dictionaries.get(q.dictionaryId ?? "")?.has(guess)
        )
      )
        return reject("invalid_mini_wordle_guess");
      if (state.guesses.includes(guess)) return reject("duplicate_mini_wordle_guess");
      if (state.guesses.length >= getMiniWordleMaxAttempts(q)) return reject("attempt_terminal");
      const feedback = getMiniWordleFeedback(guess, q.correctAnswer);
      state.guesses.push(guess);
      state.feedback.push(feedback);
      terminal =
        guess === normalizeMiniWordleWord(q.correctAnswer) ||
        state.guesses.length >= getMiniWordleMaxAttempts(q);
      answer = { guesses: state.guesses };
      update = { guess, feedback, attemptsUsed: state.guesses.length, terminal };
      break;
    }
    case "logicCodeAttempt": {
      const input = command.input;
      if (q.type !== "logic-code") return reject("unsupported_question");
      const code = input.code.trim();
      if (!new RegExp(`^[0-9]{${q.codeLength}}$`).test(code)) return reject("invalid_logic_code");
      if (state.codes.includes(code)) return reject("duplicate_logic_code");
      state.codes.push(code);
      terminal = code === q.correctAnswer;
      answer = code;
      update = {
        code,
        correct: terminal,
        incorrectAttempts: state.codes.filter((c) => c !== q.correctAnswer).length,
        terminal,
      };
      break;
    }
    case "progressiveClueReveal": {
      if (q.type !== "progressive-clues") return reject("unsupported_question");
      if (state.revealed >= q.clues.length) return reject("all_clues_revealed");
      state.revealed++;
      update = {
        ...(formatProgress(level, state) as AuthoritativeSessionUpdate),
        clue: q.clues[state.revealed - 1],
      };
      break;
    }
    case "wordHashtagSwap": {
      const input = command.input;
      if (q.type !== "word-hashtag") return reject("unsupported_question");
      for (const key of ["fromCell", "toCell"] as const)
        if (!Number.isSafeInteger(input[key]) || input[key] < 0) return reject(`invalid_${key}`);
      const swaps = [...state.swaps, { fromCell: input.fromCell, toCell: input.toCell }];
      const metrics = calculateWordHashtagMetrics(q, { swaps });
      if (!metrics.valid) return reject("invalid_word_hashtag_swap");
      state.swaps = swaps;
      terminal = metrics.solved || metrics.movesRemaining === 0;
      answer = { swaps };
      update = { ...(formatProgress(level, state) as AuthoritativeSessionUpdate), terminal };
      break;
    }
    case "wordSearchSelection": {
      const input = command.input;
      if (q.type !== "word-search") return reject("unsupported_question");
      for (const key of ["startCell", "endCell"] as const)
        if (!Number.isSafeInteger(input[key]) || input[key] < 0) return reject(`invalid_${key}`);
      if (!getWordSearchPath(q.grid, input.startCell, input.endCell))
        return reject("invalid_word_search_selection");
      const target = findWordSearchTarget(q, input.startCell, input.endCell);
      if (target && state.selections.some((s) => s.targetId === target.id))
        return reject("word_search_target_already_found");
      if (target)
        state.selections.push({
          targetId: target.id,
          startCell: input.startCell,
          endCell: input.endCell,
        });
      else state.incorrectSelections++;
      terminal = state.selections.length === q.targets.length;
      answer = { foundWordIds: state.selections.map((s) => s.targetId) };
      update = {
        ...(formatProgress(level, state) as AuthoritativeSessionUpdate),
        correct: Boolean(target),
        terminal,
      };
      break;
    }
    default:
      return reject("invalid_command");
  }
  return { state, update, terminal, answer };
}
