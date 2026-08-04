import { describe, expect, it } from "vitest";
import {
  getSurvivalLivesAfterResult,
  getSurvivalReachedQuestionCount,
  isSurvivalMistake,
} from "@/features/game/survivalRules";
import type { AnswerResultDetails, AnswerStatus } from "@/types/game";

function result(status: AnswerStatus, details?: AnswerResultDetails) {
  return { status, details };
}

function matchingDetails(incorrectAttempts: number): AnswerResultDetails {
  return {
    type: "matching",
    correctPairs: 3,
    totalPairs: 3,
    incorrectAttempts,
  };
}

function queensDetails(incorrectAttempts: number): AnswerResultDetails {
  return {
    type: "queens",
    placedQueens: 5,
    completedRows: 5,
    completedColumns: 5,
    completedRegions: 5,
    conflictingQueens: 0,
    incorrectAttempts,
    marksUsed: 4,
    solved: true,
  };
}

describe("survival rules", () => {
  it("consumes lives for incorrect or unanswered results", () => {
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

  it("preserves lives for clean matching answers", () => {
    expect(isSurvivalMistake(result("correct", matchingDetails(0)))).toBe(false);
    expect(getSurvivalLivesAfterResult(2, result("correct", matchingDetails(0)))).toBe(2);
  });

  it("subtracts one life for matching answers with incorrect attempts", () => {
    expect(isSurvivalMistake(result("correct", matchingDetails(1)))).toBe(true);
    expect(getSurvivalLivesAfterResult(3, result("correct", matchingDetails(1)))).toBe(2);
    expect(getSurvivalLivesAfterResult(3, result("correct", matchingDetails(4)))).toBe(2);
  });

  it("subtracts one life for partial matching answers with incorrect attempts", () => {
    expect(getSurvivalLivesAfterResult(2, result("partial", matchingDetails(1)))).toBe(1);
  });

  it("subtracts at most one life for a solved Queens board with mistakes", () => {
    expect(getSurvivalLivesAfterResult(3, result("correct", queensDetails(0)))).toBe(3);
    expect(getSurvivalLivesAfterResult(3, result("correct", queensDetails(4)))).toBe(2);
  });

  it("uses answered results as the reached question count", () => {
    expect(getSurvivalReachedQuestionCount(0)).toBe(0);
    expect(getSurvivalReachedQuestionCount(20)).toBe(20);
  });
});
