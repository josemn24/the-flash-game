import { competitiveCapabilityFor } from "@/features/question-formats/capabilities";
import type { CompetitiveChallenge } from "../modes/policy";
import type { SessionQuestion, PendingCommand } from "../core/sessionReducer";
import type { CompetitiveJsonObject } from "../transport";
import { evaluated, type FormatAction, type FormatOutcome, type InteractionSpec } from "./types";
import { miniWordleOutcome } from "./miniWordle";
import { logicCodeOutcome } from "./logicCode";
import { progressiveCluesOutcome } from "./progressiveClues";
import { queensOutcome } from "./queens";
import { wordSearchOutcome } from "./wordSearch";
import { wordHashtagOutcome } from "./wordHashtag";

export function interactionFor(
  challenge: CompetitiveChallenge,
  question: SessionQuestion,
  action: FormatAction,
): InteractionSpec {
  const capability = competitiveCapabilityFor(question.type, challenge.mode);
  if (!capability) throw new Error("unsupported_competitive_format");
  const challengeItemId = question.id;
  // Every supported format can expire through the existing generic answer endpoint.
  if (action.kind === "answer")
    return {
      operation: "answer",
      data: { challengeItemId, answer: action.answer },
      channel: "answerVerification",
    };
  switch (action.kind) {
    case "mini-wordle":
      if (capability.adapterKey === "mini-wordle")
        return {
          operation: "miniWordleGuess",
          data: { challengeItemId, guess: action.guess },
          channel: "submission",
        };
      break;
    case "logic-code":
      if (capability.adapterKey === "logic-code")
        return {
          operation: "logicCodeAttempt",
          data: { challengeItemId, code: action.code },
          channel: "submission",
        };
      break;
    case "word-hashtag":
      if (capability.adapterKey === "word-hashtag")
        return {
          operation: "wordHashtagSwap",
          data: { challengeItemId, fromCell: action.fromCell, toCell: action.toCell },
          channel: "submission",
        };
      break;
    case "reveal":
      if (capability.adapterKey === "progressive-clues")
        return { operation: "progressiveClueReveal", data: { challengeItemId }, channel: "reveal" };
      break;
    case "queens-draft":
    case "queens-validation":
      if (capability.adapterKey === "queens")
        return {
          operation: action.kind === "queens-draft" ? "queensDraft" : "queensValidation",
          data: { challengeItemId, queens: [...action.queens] },
          channel: "queens",
        };
      break;
    case "word-search":
      if (capability.adapterKey === "word-search")
        return {
          operation: "wordSearchSelection",
          data: { challengeItemId, startCell: action.startCell, endCell: action.endCell },
          channel: "wordSearch",
        };
      break;
  }
  throw new Error("unexpected_competitive_action");
}
export function normalizeInteraction(
  question: SessionQuestion,
  command: PendingCommand,
  response: CompetitiveJsonObject,
): FormatOutcome {
  switch (command.operation) {
    case "answer":
      return evaluated(question, command.input.answer, response);
    case "miniWordleGuess":
      return miniWordleOutcome(question, response);
    case "logicCodeAttempt":
      return logicCodeOutcome(question, command.input.code, response);
    case "wordHashtagSwap":
      return wordHashtagOutcome(question, command.input.fromCell, command.input.toCell, response);
    case "progressiveClueReveal":
      return progressiveCluesOutcome(question, response);
    case "queensDraft":
    case "queensValidation":
      return queensOutcome(question, response, command.operation === "queensDraft");
    case "wordSearchSelection":
      return wordSearchOutcome(question, command.input.startCell, command.input.endCell, response);
    default:
      throw new Error("unexpected_interaction_command");
  }
}
