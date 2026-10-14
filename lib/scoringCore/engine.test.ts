import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calculateResolvedAnswerScore,
  evaluateResolvedAnswer,
  isResolvedAnswerCorrect,
} from "./engine";
import { SCORING } from "./registry";
import type { LogicCodeQuestion, MultipleChoiceQuestion } from "@/types/gameplay/scoring";

const base = {
  id: "engine-context",
  category: "Lógica",
  question: "Resuelve la pregunta",
  explanation: "Solución",
  tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [], lifeSkills: [] },
  timeLimit: 20,
  points: 100,
};
const choice: MultipleChoiceQuestion = {
  ...base,
  type: "multiple-choice",
  options: ["A", "B"],
  correctAnswer: "A",
};
const code: LogicCodeQuestion = {
  ...base,
  type: "logic-code",
  codeLength: 3,
  clues: [{ code: "682", hint: "Una cifra" }],
  correctAnswer: "042",
};

afterEach(() => vi.restoreAllMocks());

describe("scoring engine context construction", () => {
  it("evaluates formats without a context hook without a preliminary correctness check", () => {
    const correctness = vi.spyOn(SCORING[choice.type], "isCorrect");
    expect(evaluateResolvedAnswer({ question: choice, answer: "A", timeUsed: 0 })).toMatchObject({
      isCorrect: true,
      status: "correct",
      points: 100,
    });
    expect(calculateResolvedAnswerScore(choice, "B", 0)).toBe(0);
    expect(correctness).not.toHaveBeenCalled();
    expect(isResolvedAnswerCorrect(choice, "A")).toBe(true);
    expect(correctness).toHaveBeenCalledExactlyOnceWith(choice, "A");
  });

  it.each([
    ["042", true, 2],
    ["999", false, 3],
  ] as const)(
    "preserves the hook's correctness and persisted code attempts for %s",
    (answer, isCorrect, incorrectAttempts) => {
      const hook = vi.spyOn(SCORING[code.type], "buildEvaluationContext");
      const correctness = vi.spyOn(SCORING[code.type], "isCorrect");
      const submittedCodes = ["111", "222", answer];
      expect(
        evaluateResolvedAnswer({
          question: code,
          answer,
          timeUsed: -1,
          submittedCodes,
          incorrectAttempts: 9,
          matchingIncorrectAttempts: 7,
          progressiveCluesRevealed: 3,
          progressiveClueAvailablePoints: 40,
        }),
      ).toMatchObject({
        isCorrect,
        status: isCorrect ? "correct" : "incorrect",
        points: isCorrect ? 80 : 0,
        details: { type: "logic-code", submittedCodes, incorrectAttempts },
      });
      expect(correctness).toHaveBeenCalledExactlyOnceWith(code, answer);
      expect(hook).toHaveBeenCalledExactlyOnceWith({
        question: code,
        answer,
        timeUsed: 0,
        timedOut: false,
        submittedCodes,
        incorrectAttempts: 9,
        matchingIncorrectAttempts: 7,
        progressiveCluesRevealed: 3,
        progressiveClueAvailablePoints: 40,
        isCorrect,
      });
    },
  );

  it("preserves scalar scoring context, elapsed-time clamping and caller-supplied attempts", () => {
    const hook = vi.spyOn(SCORING[code.type], "buildEvaluationContext");
    expect(calculateResolvedAnswerScore(code, "042", 30, 2, 4)).toBe(40);
    expect(hook).toHaveBeenCalledExactlyOnceWith({
      question: code,
      answer: "042",
      timeUsed: 20,
      timedOut: false,
      submittedCodes: [],
      incorrectAttempts: 2,
      matchingIncorrectAttempts: 2,
      progressiveCluesRevealed: 4,
      isCorrect: true,
    });
  });
});
