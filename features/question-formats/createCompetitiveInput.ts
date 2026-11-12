import { isValidConnectPairsAnswer } from "@/lib/connectPairs";
import { isValidZipAnswer } from "@/lib/zip";
import type { CompetitiveInput, CompetitiveInputSource } from "./competitiveInputTypes";

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}
function isPoint(value: unknown): value is { x: number; y: number } {
  return (
    value !== null &&
    typeof value === "object" &&
    "x" in value &&
    "y" in value &&
    typeof value.x === "number" &&
    typeof value.y === "number"
  );
}
function queensFromAnswer(value: unknown): readonly number[] | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const candidate = (value as { queens?: unknown }).queens;
  if (!Array.isArray(candidate)) return undefined;
  return candidate.every(
    (cell: unknown) => typeof cell === "number" && Number.isSafeInteger(cell) && cell >= 0,
  )
    ? (candidate as number[])
    : undefined;
}

/** Pure projection of the final mode facade; the engine retains ownership of all operations. */
export function createCompetitiveInput(source: CompetitiveInputSource): CompetitiveInput | null {
  const { question, locked, pendingAnswer } = source;
  if (!question) return null;
  const answer = { onSubmit: source.submit };
  const progress = { onProgress: source.updateDraft };
  const submission = {
    submissionState: source.submissionState,
    submissionStatusVisible: source.submissionStatusVisible,
    submissionError: source.submissionError,
    onRetrySubmission: source.retrySubmit,
  };
  switch (question.type) {
    case "anagram":
      return { context: "competitive", format: "anagram", props: { question, locked, ...answer } };
    case "classification":
      return {
        context: "competitive",
        format: "classification",
        props: {
          question,
          locked,
          ...answer,
          ...progress,
          pendingAnswer: isStringRecord(pendingAnswer) ? pendingAnswer : undefined,
        },
      };
    case "connect-pairs":
      return {
        context: "competitive",
        format: "connect-pairs",
        props: {
          question,
          locked,
          ...answer,
          ...progress,
          ...submission,
          pendingAnswer: isValidConnectPairsAnswer(pendingAnswer) ? pendingAnswer : undefined,
        },
      };
    case "escape":
      return {
        context: "competitive",
        format: "escape",
        props: { question, locked, ...answer, ...progress, ...submission },
      };
    case "estimation":
      return {
        context: "competitive",
        format: "estimation",
        props: {
          question,
          locked,
          ...answer,
          ...progress,
          pendingAnswer: typeof pendingAnswer === "number" ? pendingAnswer : undefined,
        },
      };
    case "heat-map":
      return {
        context: "competitive",
        format: "heat-map",
        props: {
          question,
          locked,
          ...answer,
          ...progress,
          pendingAnswer: isPoint(pendingAnswer) ? pendingAnswer : undefined,
        },
      };
    case "logic-code":
      return {
        context: "competitive",
        format: "logic-code",
        props: {
          question,
          locked,
          ...submission,
          onLogicCodeAttempt: source.submitLogicCodeAttempt,
        },
      };
    case "logic-matrix":
      return {
        context: "competitive",
        format: "logic-matrix",
        props: { question, locked, ...answer },
      };
    case "matching":
      return {
        context: "competitive",
        format: "matching",
        props: {
          question,
          locked,
          ...answer,
          ...progress,
          ...submission,
          pendingAnswer: isStringRecord(pendingAnswer) ? pendingAnswer : undefined,
        },
      };
    case "mini-wordle":
      return {
        context: "competitive",
        format: "mini-wordle",
        props: { question, locked, ...submission, onMiniWordleGuess: source.submitMiniWordleGuess },
      };
    case "multiple-choice":
      return {
        context: "competitive",
        format: "multiple-choice",
        props: {
          question,
          locked,
          ...answer,
          pendingAnswer: typeof pendingAnswer === "string" ? pendingAnswer : undefined,
        },
      };
    case "odd-one-out":
      return {
        context: "competitive",
        format: "odd-one-out",
        props: { question, locked, ...answer },
      };
    case "ordering":
      return {
        context: "competitive",
        format: "ordering",
        props: {
          question,
          locked,
          ...answer,
          ...progress,
          pendingAnswer:
            Array.isArray(pendingAnswer) && pendingAnswer.every((item) => typeof item === "string")
              ? pendingAnswer
              : undefined,
        },
      };
    case "progressive-clues":
      return {
        context: "competitive",
        format: "progressive-clues",
        props: {
          question,
          locked,
          ...answer,
          ...submission,
          revealState: source.revealState,
          revealStatusVisible: source.revealStatusVisible,
          revealError: source.revealError,
          onRevealProgressiveClue: source.revealProgressiveClue,
          onRetryReveal: source.retryReveal,
        },
      };
    case "progressive-image":
      return {
        context: "competitive",
        format: "progressive-image",
        props: {
          question,
          locked,
          ...answer,
          ...submission,
          presentedAt: source.questionPresentedAt,
        },
      };
    case "queens":
      return {
        context: "competitive",
        format: "queens",
        props: {
          question,
          locked,
          draftQueens: queensFromAnswer(pendingAnswer),
          queensState: source.queensState,
          queensStatusVisible: source.queensStatusVisible,
          queensError: source.queensError,
          onQueensDraft: source.updateQueensDraft,
          onQueensValidate: source.validateQueensBoard,
          onRetryQueensValidation: source.retryQueensValidation,
        },
      };
    case "short-text":
      return {
        context: "competitive",
        format: "short-text",
        props: { question, locked, ...answer },
      };
    case "true-false":
      return {
        context: "competitive",
        format: "true-false",
        props: { question, locked, ...answer },
      };
    case "word-hashtag":
      return {
        context: "competitive",
        format: "word-hashtag",
        props: { question, locked, ...submission, onWordHashtagSwap: source.submitWordHashtagSwap },
      };
    case "word-search":
      return {
        context: "competitive",
        format: "word-search",
        props: {
          question,
          locked,
          wordSearchState: source.wordSearchState,
          wordSearchStatusVisible: source.wordSearchStatusVisible,
          wordSearchError: source.wordSearchError,
          lastWordSearchSelection: source.lastWordSearchSelection,
          onWordSearchSelection: source.submitWordSearchSelection,
          onRetryWordSearch: source.retryWordSearchSelection,
        },
      };
    case "zip":
      return {
        context: "competitive",
        format: "zip",
        props: {
          question,
          locked,
          ...answer,
          ...progress,
          ...submission,
          pendingAnswer: isValidZipAnswer(pendingAnswer) ? pendingAnswer : undefined,
        },
      };
    default:
      return unreachable(question);
  }
}
function unreachable(question: never): never {
  throw new Error(`Unsupported competitive question: ${JSON.stringify(question)}`);
}
