import {
  competitiveCapabilityFor,
  type CompetitiveAdapterKey,
} from "@/features/question-formats/capabilities";
import type { PendingCommand, SessionQuestion } from "../core/sessionReducer";
import type { CompetitiveChallenge } from "../modes/policy";
import type { CompetitiveJsonObject } from "../transport";
import { logicCodeOutcome } from "./logicCode";
import { miniWordleOutcome } from "./miniWordle";
import { progressiveCluesOutcome } from "./progressiveClues";
import { queensOutcome } from "./queens";
import { evaluated, type FormatAction, type FormatOutcome, type InteractionSpec } from "./types";
import { wordHashtagOutcome } from "./wordHashtag";
import { wordSearchOutcome } from "./wordSearch";

type InteractionAdapter = {
  compose: (question: SessionQuestion, action: FormatAction) => InteractionSpec;
  normalize: (
    question: SessionQuestion,
    command: PendingCommand,
    response: CompetitiveJsonObject,
  ) => FormatOutcome;
};
const genericAdapter: InteractionAdapter = {
  compose(question, action) {
    if (action.kind !== "answer") throw new Error("unexpected_competitive_action");
    return {
      operation: "answer",
      data: { challengeItemId: question.id, answer: action.answer },
      channel: "answerVerification",
    };
  },
  normalize(question, command, response) {
    if (command.operation !== "answer") throw new Error("unexpected_interaction_command");
    return evaluated(question, command.input.answer, response);
  },
};
export const COMPETITIVE_ADAPTERS = {
  generic: genericAdapter,
  "alphabet-pass": genericAdapter,
  "mini-wordle": {
    compose(question, action) {
      if (action.kind !== "mini-wordle") throw new Error("unexpected_competitive_action");
      const challengeItemId = question.id;
      return {
        operation: "miniWordleGuess",
        data: { challengeItemId, guess: action.guess },
        channel: "submission",
      };
    },
    normalize(question, command, response) {
      return miniWordleOutcome(question, response);
    },
  },
  "logic-code": {
    compose(question, action) {
      if (action.kind !== "logic-code") throw new Error("unexpected_competitive_action");
      const challengeItemId = question.id;
      return {
        operation: "logicCodeAttempt",
        data: { challengeItemId, code: action.code },
        channel: "submission",
      };
    },
    normalize(question, command, response) {
      if (command.operation !== "logicCodeAttempt")
        throw new Error("unexpected_interaction_command");
      return logicCodeOutcome(question, command.input.code, response);
    },
  },
  "word-hashtag": {
    compose(question, action) {
      if (action.kind !== "word-hashtag") throw new Error("unexpected_competitive_action");
      const challengeItemId = question.id;
      return {
        operation: "wordHashtagSwap",
        data: { challengeItemId, fromCell: action.fromCell, toCell: action.toCell },
        channel: "submission",
      };
    },
    normalize(question, command, response) {
      if (command.operation !== "wordHashtagSwap")
        throw new Error("unexpected_interaction_command");
      return wordHashtagOutcome(question, command.input.fromCell, command.input.toCell, response);
    },
  },
  "progressive-clues": {
    compose(question, action) {
      if (action.kind !== "reveal") throw new Error("unexpected_competitive_action");
      const challengeItemId = question.id;
      return { operation: "progressiveClueReveal", data: { challengeItemId }, channel: "reveal" };
    },
    normalize(question, command, response) {
      return progressiveCluesOutcome(question, response);
    },
  },
  "word-search": {
    compose(question, action) {
      if (action.kind !== "word-search") throw new Error("unexpected_competitive_action");
      const challengeItemId = question.id;
      return {
        operation: "wordSearchSelection",
        data: { challengeItemId, startCell: action.startCell, endCell: action.endCell },
        channel: "wordSearch",
      };
    },
    normalize(question, command, response) {
      if (command.operation !== "wordSearchSelection")
        throw new Error("unexpected_interaction_command");
      return wordSearchOutcome(question, command.input.startCell, command.input.endCell, response);
    },
  },
  queens: {
    compose(question, action) {
      if (action.kind !== "queens-draft" && action.kind !== "queens-validation")
        throw new Error("unexpected_competitive_action");
      return {
        operation: action.kind === "queens-draft" ? "queensDraft" : "queensValidation",
        data: { challengeItemId: question.id, queens: [...action.queens] },
        channel: "queens",
      };
    },
    normalize(question, command, response) {
      return queensOutcome(question, response, command.operation === "queensDraft");
    },
  },
} satisfies Record<CompetitiveAdapterKey, InteractionAdapter>;
export function interactionFor(
  challenge: CompetitiveChallenge,
  question: SessionQuestion,
  action: FormatAction,
): InteractionSpec {
  const capability = competitiveCapabilityFor(question.type, challenge.mode);
  if (!capability) throw new Error("unsupported_competitive_format");
  const adapter =
    action.kind === "answer" ? genericAdapter : COMPETITIVE_ADAPTERS[capability.adapterKey];
  return adapter.compose(question, action);
}
const adapterByOperation: Partial<Record<PendingCommand["operation"], CompetitiveAdapterKey>> = {
  answer: "generic",
  miniWordleGuess: "mini-wordle",
  logicCodeAttempt: "logic-code",
  wordHashtagSwap: "word-hashtag",
  progressiveClueReveal: "progressive-clues",
  queensDraft: "queens",
  queensValidation: "queens",
  wordSearchSelection: "word-search",
};
export function normalizeInteraction(
  question: SessionQuestion,
  command: PendingCommand,
  response: CompetitiveJsonObject,
): FormatOutcome {
  const key = adapterByOperation[command.operation];
  if (!key) throw new Error("unexpected_interaction_command");
  return COMPETITIVE_ADAPTERS[key].normalize(question, command, response);
}
