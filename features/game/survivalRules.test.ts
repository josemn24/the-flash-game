import { describe, expect, it } from "vitest";
import {
  getSurvivalLivesAfterResult,
  getSurvivalReachedQuestionCount,
  isSurvivalMistake,
} from "@/features/game/survivalRules";
import type { AnswerStatus } from "@/types/game";

function result(status: AnswerStatus) {
  return { status };
}

describe("survival rules", () => {
  it("only consumes lives for incorrect or unanswered results", () => {
    expect(isSurvivalMistake(result("correct"))).toBe(false);
    expect(isSurvivalMistake(result("partial"))).toBe(false);
    expect(isSurvivalMistake(result("incorrect"))).toBe(true);
    expect(isSurvivalMistake(result("unanswered"))).toBe(true);
  });

  it("preserves lives for partial answers", () => {
    expect(getSurvivalLivesAfterResult(2, result("partial"))).toBe(2);
  });

  it("subtracts one life for mistakes without going below zero", () => {
    expect(getSurvivalLivesAfterResult(3, result("incorrect"))).toBe(2);
    expect(getSurvivalLivesAfterResult(1, result("unanswered"))).toBe(0);
    expect(getSurvivalLivesAfterResult(0, result("incorrect"))).toBe(0);
  });

  it("uses answered results as the reached question count", () => {
    expect(getSurvivalReachedQuestionCount(0)).toBe(0);
    expect(getSurvivalReachedQuestionCount(20)).toBe(20);
  });
});
