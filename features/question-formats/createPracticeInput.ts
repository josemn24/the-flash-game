import {
  isClassificationAnswer,
  isConnectPairsAnswer,
  isErrorReconstructionAnswer,
  isMatchingAnswer,
  isMiniWordleAnswer,
  isWordHashtagAnswer,
  isWordSearchAnswer,
} from "@/lib/scoring";
import { isQueensAnswer } from "@/lib/queens";
import type { PracticeInput, PracticeInputSource } from "./practiceInputTypes";

/** Pure projection: validation and defaults match the local adapters it replaces. */
export function createPracticeInput(source: PracticeInputSource): PracticeInput | null {
  const { question, locked, initialAnswer } = source;
  if (!question) return null;
  switch (question.type) {
    case "multiple-choice":
      return {
        context: "practice",
        format: "multiple-choice",
        props: { question, locked, onSubmit: source.onSubmit },
      };
    case "odd-one-out":
      return {
        context: "practice",
        format: "odd-one-out",
        props: { question, locked, onSubmit: source.onSubmit },
      };
    case "matching":
      return {
        context: "practice",
        format: "matching",
        props: {
          question,
          locked,
          onSubmit: source.onSubmit,
          onProgress: source.onProgress,
          initialAnswer:
            initialAnswer !== undefined && isMatchingAnswer(initialAnswer)
              ? initialAnswer
              : undefined,
          onIncorrectAttempt: source.onIncorrectAttempt,
        },
      };
    case "connect-pairs":
      return {
        context: "practice",
        format: "connect-pairs",
        props: {
          question,
          locked,
          onSubmit: source.onSubmit,
          onProgress: source.onProgress,
          initialAnswer:
            initialAnswer !== undefined && isConnectPairsAnswer(initialAnswer)
              ? initialAnswer
              : undefined,
        },
      };
    case "true-false":
      return {
        context: "practice",
        format: "true-false",
        props: { question, locked, onSubmit: source.onSubmit },
      };
    case "short-text":
      return {
        context: "practice",
        format: "short-text",
        props: { question, locked, onSubmit: source.onSubmit },
      };
    case "progressive-clues":
      return {
        context: "practice",
        format: "progressive-clues",
        props: {
          question,
          locked,
          onSubmit: source.onSubmit,
          onProgress: source.onProgress,
          initialAnswer: typeof initialAnswer === "string" ? initialAnswer : undefined,
          onProgressiveClueReveal: source.onProgressiveClueReveal,
          progressiveCluesRevealed: source.progressiveCluesRevealed,
        },
      };
    case "progressive-image":
      return {
        context: "practice",
        format: "progressive-image",
        props: {
          question,
          locked,
          onSubmit: source.onSubmit,
          onTimedResponseStart: source.onTimedResponseStart,
        },
      };
    case "heat-map":
      return {
        context: "practice",
        format: "heat-map",
        props: { question, locked, onSubmit: source.onSubmit },
      };
    case "image-labeling":
      return {
        context: "practice",
        format: "image-labeling",
        props: { question, locked, onSubmit: source.onSubmit },
      };
    case "ordering":
      return {
        context: "practice",
        format: "ordering",
        props: {
          question,
          locked,
          onSubmit: source.onSubmit,
          onProgress: source.onProgress,
          initialAnswer:
            Array.isArray(initialAnswer) && initialAnswer.every((item) => typeof item === "string")
              ? initialAnswer
              : undefined,
        },
      };
    case "classification": {
      const classificationDraft = initialAnswer ?? null;
      return {
        context: "practice",
        format: "classification",
        props: {
          question,
          locked,
          onSubmit: source.onSubmit,
          onProgress: source.onProgress,
          initialAnswer: isClassificationAnswer(classificationDraft)
            ? classificationDraft
            : undefined,
        },
      };
    }
    case "flash-memory":
      return {
        context: "practice",
        format: "flash-memory",
        props: {
          question,
          locked,
          onSubmit: source.onSubmit,
          onProgress: source.onProgress,
          onTimedResponseStart: source.onTimedResponseStart,
        },
      };
    case "memory-pairs":
      return {
        context: "practice",
        format: "memory-pairs",
        props: { question, locked, onSubmit: source.onSubmit, onProgress: source.onProgress },
      };
    case "simon-sequence":
      return {
        context: "practice",
        format: "simon-sequence",
        props: {
          question,
          locked,
          onSubmit: source.onSubmit,
          onTimedResponseStart: source.onTimedResponseStart,
        },
      };
    case "logic-matrix":
      return {
        context: "practice",
        format: "logic-matrix",
        props: { question, locked, onSubmit: source.onSubmit },
      };
    case "mini-sudoku":
      return {
        context: "practice",
        format: "mini-sudoku",
        props: { question, locked, onSubmit: source.onSubmit, onProgress: source.onProgress },
      };
    case "mini-nonogram":
      return {
        context: "practice",
        format: "mini-nonogram",
        props: { question, locked, onSubmit: source.onSubmit, onProgress: source.onProgress },
      };
    case "queens":
      return {
        context: "practice",
        format: "queens",
        props: {
          question,
          locked,
          onSubmit: source.onSubmit,
          onProgress: source.onProgress,
          initialAnswer: isQueensAnswer(initialAnswer, question.grid) ? initialAnswer : undefined,
          onIncorrectAttempt: source.onIncorrectAttempt,
        },
      };
    case "time-maze":
      return {
        context: "practice",
        format: "time-maze",
        props: { question, locked, onSubmit: source.onSubmit, onProgress: source.onProgress },
      };
    case "sliding-puzzle":
      return {
        context: "practice",
        format: "sliding-puzzle",
        props: { question, locked, onSubmit: source.onSubmit },
      };
    case "escape":
      return {
        context: "practice",
        format: "escape",
        props: { question, locked, onSubmit: source.onSubmit, onProgress: source.onProgress },
      };
    case "error-reconstruction":
      return {
        context: "practice",
        format: "error-reconstruction",
        props: {
          question,
          locked,
          onSubmit: source.onSubmit,
          onProgress: source.onProgress,
          initialAnswer:
            initialAnswer !== undefined && isErrorReconstructionAnswer(initialAnswer)
              ? initialAnswer
              : undefined,
        },
      };
    case "anagram":
      return {
        context: "practice",
        format: "anagram",
        props: { question, locked, onSubmit: source.onSubmit },
      };
    case "word-hashtag":
      return {
        context: "practice",
        format: "word-hashtag",
        props: {
          question,
          locked,
          onSubmit: source.onSubmit,
          onProgress: source.onProgress,
          initialAnswer: isWordHashtagAnswer(initialAnswer) ? initialAnswer : undefined,
        },
      };
    case "word-search":
      return {
        context: "practice",
        format: "word-search",
        props: {
          question,
          locked,
          onSubmit: source.onSubmit,
          onProgress: source.onProgress,
          initialAnswer:
            initialAnswer !== undefined && isWordSearchAnswer(initialAnswer)
              ? initialAnswer
              : undefined,
          onIncorrectAttempt: source.onIncorrectAttempt,
        },
      };
    case "mini-wordle":
      return {
        context: "practice",
        format: "mini-wordle",
        props: {
          question,
          locked,
          onSubmit: source.onSubmit,
          onProgress: source.onProgress,
          initialAnswer:
            initialAnswer !== undefined && isMiniWordleAnswer(initialAnswer)
              ? initialAnswer
              : undefined,
          onTimedResponseStart: source.onTimedResponseStart,
        },
      };
    case "logic-code":
      return {
        context: "practice",
        format: "logic-code",
        props: {
          question,
          locked,
          onProgress: source.onProgress,
          initialAnswer: typeof initialAnswer === "string" ? initialAnswer : undefined,
          onCodeAttempt: source.onCodeAttempt,
          codeAttemptCount: source.codeAttemptCount ?? 0,
        },
      };
    case "estimation":
      return {
        context: "practice",
        format: "estimation",
        props: { question, locked, onSubmit: source.onSubmit },
      };
    case "zip":
      return {
        context: "practice",
        format: "zip",
        props: { question, locked, onSubmit: source.onSubmit, onProgress: source.onProgress },
      };
    case "pipes":
      return {
        context: "practice",
        format: "pipes",
        props: { question, locked, onSubmit: source.onSubmit, onProgress: source.onProgress },
      };
    default:
      return unreachable(question);
  }
}
function unreachable(question: never): never {
  throw new Error(`Unsupported practice question: ${JSON.stringify(question)}`);
}
