import { describe, expect, it } from "vitest";
import { QUESTION_FORMAT_CATALOG } from "@/features/question-formats/catalog";
import { calculateAnswerScore, evaluateAnswer, isAnswerCorrect } from "@/lib/scoring";

describe("question evaluation", () => {
  it("normalizes accepted short answers", () => {
    const question = QUESTION_FORMAT_CATALOG["short-text"].example;
    expect(isAnswerCorrect(question, "Mil novecientos cuarenta y cinco")).toBe(true);
  });

  it("preserves the speed floor and incorrect penalties", () => {
    const choice = QUESTION_FORMAT_CATALOG["multiple-choice"].example;
    const trueFalse = QUESTION_FORMAT_CATALOG["true-false"].example;
    expect(calculateAnswerScore(choice, choice.correctAnswer, 0)).toBe(100);
    expect(calculateAnswerScore(choice, choice.correctAnswer, choice.timeLimit)).toBe(50);
    expect(calculateAnswerScore(choice, "Toronto", 0)).toBe(-20);
    expect(calculateAnswerScore(trueFalse, true, 0)).toBe(-40);
  });

  it("evaluates odd-one-out answers and applies its incorrect penalty", () => {
    const question = QUESTION_FORMAT_CATALOG["odd-one-out"].example;
    expect(evaluateAnswer({ question, answer: "luna", timeUsed: 0 })).toMatchObject({
      status: "correct",
      points: 100,
    });
    expect(evaluateAnswer({ question, answer: "venus", timeUsed: 0 })).toMatchObject({
      status: "incorrect",
      points: -20,
    });
    expect(evaluateAnswer({ question, answer: "desconocido", timeUsed: 0 })).toMatchObject({
      status: "incorrect",
      points: -20,
    });
    expect(evaluateAnswer({ question, answer: null, timeUsed: 99, timedOut: true })).toMatchObject({
      status: "unanswered",
      points: 0,
      timeUsed: question.timeLimit,
    });
  });

  it("awards partial classification points", () => {
    const question = QUESTION_FORMAT_CATALOG.classification.example;
    const result = evaluateAnswer({
      question,
      answer: { Delfín: "mamífero", Águila: "ave", Tortuga: "ave" },
      timeUsed: 0,
    });
    expect(result.status).toBe("incorrect");
    expect(result.points).toBe(107);
  });

  it("calculates estimation proximity", () => {
    const question = QUESTION_FORMAT_CATALOG.estimation.example;
    const result = evaluateAnswer({ question, answer: 430, timeUsed: 0 });
    expect(result.status).toBe("partial");
    expect(result.points).toBe(70);
    expect(result.details).toEqual({ type: "estimation", difference: 100, proximity: 0.5 });
  });

  it("penalizes failed code attempts", () => {
    const question = QUESTION_FORMAT_CATALOG["logic-code"].example;
    const result = evaluateAnswer({
      question,
      answer: "042",
      submittedCodes: ["111", "222", "042"],
      timeUsed: 0,
    });
    expect(result.points).toBe(120);
    expect(result.details).toEqual({
      type: "logic-code",
      submittedCodes: ["111", "222", "042"],
      incorrectAttempts: 2,
    });
  });

  it("returns zero points after a timeout", () => {
    const question = QUESTION_FORMAT_CATALOG["multiple-choice"].example;
    const result = evaluateAnswer({ question, answer: null, timeUsed: 99, timedOut: true });
    expect(result.status).toBe("unanswered");
    expect(result.points).toBe(0);
    expect(result.timeUsed).toBe(question.timeLimit);
  });
});
