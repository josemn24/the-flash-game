import { describe, expect, it, vi } from "vitest";
import type { AnswerValue } from "@/types/contracts";
import type { CompetitiveQuestionType } from "@/lib/question-formats/definitions";
import {
  competitiveInputFor,
  competitiveInputSource,
  competitiveQuestion,
} from "@/test-utils/competitiveInput";
import { createCompetitiveInput } from "./createCompetitiveInput";

describe("createCompetitiveInput", () => {
  it("has no input until the server releases a question", () => {
    expect(createCompetitiveInput(competitiveInputSource())).toBeNull();
  });

  it.each([
    ["classification", { a: "group" }],
    ["matching", { a: "b" }],
    ["connect-pairs", { paths: { red: [0, 1, 2] } }],
    ["estimation", 42],
    ["heat-map", { x: 0.2, y: 0.7 }],
    ["zip", { path: [0, 1, 2] }],
    ["multiple-choice", "Opción A"],
  ] satisfies [CompetitiveQuestionType, AnswerValue][])(
    "restores the %s draft without copying it",
    (format, pendingAnswer) => {
      const input = createCompetitiveInput(
        competitiveInputSource({ question: competitiveQuestion(format), pendingAnswer }),
      );
      if (!input || !("pendingAnswer" in input.props)) throw new Error("missing draft");
      expect(input.context).toBe("competitive");
      expect(input.props.pendingAnswer).toBe(pendingAnswer);
    },
  );

  it("projects the locally accepted Queens snapshot for provisional timeout review", () => {
    const input = createCompetitiveInput(
      competitiveInputSource({
        question: competitiveQuestion("queens"),
        pendingAnswer: { queens: [1, 4, 9], marks: [] },
      }),
    );
    if (!input || input.format !== "queens") throw new Error("missing Queens input");
    expect(input.props.draftQueens).toEqual([1, 4, 9]);
  });

  it.each([
    ["classification", { a: 2 }],
    ["matching", ["a"]],
    ["connect-pairs", { path: [0, 1] }],
    ["estimation", "42"],
    ["heat-map", { x: 0.2 }],
    ["zip", { path: [] }],
    ["multiple-choice", false],
  ] satisfies [CompetitiveQuestionType, AnswerValue][])(
    "falls back to the %s initial value for malformed restored data",
    (format, pendingAnswer) => {
      const input = createCompetitiveInput(
        competitiveInputSource({ question: competitiveQuestion(format), pendingAnswer }),
      );
      if (!input || !("pendingAnswer" in input.props)) throw new Error("missing draft");
      expect(input.props.pendingAnswer).toBeUndefined();
    },
  );

  it("forwards typed answers and draft progress without evaluating or replacing callbacks", () => {
    const submit = vi.fn();
    const updateDraft = vi.fn();
    competitiveInputFor("true-false", { submit }).props.onSubmit(false);
    competitiveInputFor("ordering", { submit }).props.onSubmit(["c", "a", "b"]);
    const pairs = competitiveInputFor("connect-pairs", { submit, updateDraft });
    pairs.props.onProgress({ paths: { red: [0, 1] } });
    pairs.props.onSubmit({ paths: { red: [0, 1, 2] } });
    const escape = competitiveInputFor("escape", { submit, updateDraft });
    escape.props.onProgress({ moves: [] });
    escape.props.onSubmit({ moves: [] });
    expect(submit.mock.calls).toEqual([
      [false],
      [["c", "a", "b"]],
      [{ paths: { red: [0, 1, 2] } }],
      [{ moves: [] }],
    ]);
    expect(updateDraft.mock.calls).toEqual([[{ paths: { red: [0, 1] } }], [{ moves: [] }]]);
    expect(pairs.props.onSubmit).toBe(submit);
    expect(pairs.props.onProgress).toBe(updateDraft);
  });

  it("keeps custom commands and their original retry operations", () => {
    const submitMiniWordleGuess = vi.fn(),
      submitLogicCodeAttempt = vi.fn(),
      submitWordHashtagSwap = vi.fn(),
      retrySubmit = vi.fn();
    const mini = competitiveInputFor("mini-wordle", { submitMiniWordleGuess, retrySubmit });
    mini.props.onMiniWordleGuess("LUNA");
    mini.props.onRetrySubmission?.();
    competitiveInputFor("logic-code", { submitLogicCodeAttempt }).props.onLogicCodeAttempt("123");
    competitiveInputFor("word-hashtag", { submitWordHashtagSwap }).props.onWordHashtagSwap(1, 2);
    expect(submitMiniWordleGuess).toHaveBeenCalledExactlyOnceWith("LUNA");
    expect(submitLogicCodeAttempt).toHaveBeenCalledExactlyOnceWith("123");
    expect(submitWordHashtagSwap).toHaveBeenCalledExactlyOnceWith(1, 2);
    expect(retrySubmit).toHaveBeenCalledTimes(1);
    expect(mini.props.onRetrySubmission).toBe(retrySubmit);
    expect(mini.props).not.toHaveProperty("onSubmit");
  });

  it("keeps independent answer and clue reveal errors, busy states and retries", () => {
    const retrySubmit = vi.fn(),
      retryReveal = vi.fn(),
      revealProgressiveClue = vi.fn();
    const { props } = competitiveInputFor("progressive-clues", {
      locked: true,
      submissionState: "error",
      submissionError: "Respuesta sin confirmar",
      submissionStatusVisible: true,
      retrySubmit,
      revealState: "error",
      revealError: "Pista sin confirmar",
      revealStatusVisible: false,
      retryReveal,
      revealProgressiveClue,
    });
    expect(props).toMatchObject({
      locked: true,
      submissionState: "error",
      submissionError: "Respuesta sin confirmar",
      submissionStatusVisible: true,
      revealState: "error",
      revealError: "Pista sin confirmar",
      revealStatusVisible: false,
    });
    props.onRetrySubmission?.();
    props.onRetryReveal?.();
    props.onRevealProgressiveClue();
    expect(retrySubmit).toHaveBeenCalledOnce();
    expect(retryReveal).toHaveBeenCalledOnce();
    expect(revealProgressiveClue).toHaveBeenCalledOnce();
    expect(props.onRetryReveal).toBe(retryReveal);
  });

  it("projects Queens and word search operations, progress and definite errors independently", () => {
    const updateQueensDraft = vi.fn(),
      validateQueensBoard = vi.fn(),
      retryQueensValidation = vi.fn();
    const queens = competitiveInputFor("queens", {
      updateQueensDraft,
      validateQueensBoard,
      retryQueensValidation,
      queensState: "submitting",
      queensStatusVisible: true,
    });
    queens.props.onQueensDraft([1, 4]);
    queens.props.onQueensValidate([1, 4]);
    queens.props.onRetryQueensValidation?.();
    expect(updateQueensDraft).toHaveBeenCalledExactlyOnceWith([1, 4]);
    expect(validateQueensBoard).toHaveBeenCalledExactlyOnceWith([1, 4]);
    expect(retryQueensValidation).toHaveBeenCalledOnce();
    expect(queens.props).toMatchObject({ queensState: "submitting", queensStatusVisible: true });
    const submitWordSearchSelection = vi.fn(),
      retryWordSearchSelection = vi.fn();
    const lastWordSearchSelection = { startCell: 0, endCell: 2, correct: false };
    const wordSearch = competitiveInputFor("word-search", {
      submitWordSearchSelection,
      retryWordSearchSelection,
      wordSearchState: "error",
      wordSearchStatusVisible: true,
      wordSearchError: "Selección inválida",
      lastWordSearchSelection,
    });
    wordSearch.props.onWordSearchSelection(0, 2);
    wordSearch.props.onRetryWordSearch?.();
    expect(submitWordSearchSelection).toHaveBeenCalledExactlyOnceWith(0, 2);
    expect(retryWordSearchSelection).toHaveBeenCalledOnce();
    expect(wordSearch.props.lastWordSearchSelection).toBe(lastWordSearchSelection);
    expect(wordSearch.props.wordSearchError).toBe("Selección inválida");
    expect(wordSearch.props).not.toHaveProperty("submissionState");
  });

  it("preserves the image presentation instant and an uncertain submission", () => {
    const { props } = competitiveInputFor("progressive-image", {
      questionPresentedAt: 1234,
      submissionState: "submitting",
      submissionStatusVisible: false,
      locked: true,
    });
    expect(props).toMatchObject({
      presentedAt: 1234,
      submissionState: "submitting",
      submissionStatusVisible: false,
      locked: true,
    });
  });
});
