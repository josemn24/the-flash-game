import { describe, expect, it } from "vitest";
import {
  formatAlphabetProgress,
  getAlphabetNavigation,
  type AlphabetNavigationLetter,
} from "./alphabetNavigation";

function letters(...statuses: AlphabetNavigationLetter["status"][]) {
  return statuses.map((status, index) => ({ letter: ["A", "B", "C", "G", "T"][index], status }));
}

describe("Alphabet navigation", () => {
  it("starts without a previous letter and previews the next unvisited letter", () => {
    const board = letters("active", "unvisited", "unvisited");
    expect(getAlphabetNavigation(board, 0, null)).toMatchObject({
      previous: null,
      current: board[0],
      next: board[1],
      correctAnswers: 0,
      incorrectAnswers: 0,
      pendingLetters: 3,
    });
  });

  it.each(["correct", "incorrect", "passed"] as const)(
    "preserves the previous %s state",
    (status) => {
      const board = letters(status, "active", "unvisited");
      expect(getAlphabetNavigation(board, 1, 0)).toMatchObject({
        previous: board[0],
        current: board[1],
        next: board[2],
      });
    },
  );

  it("prioritizes unvisited letters over passed letters, including across the end", () => {
    const board = letters("passed", "unvisited", "active");
    expect(getAlphabetNavigation(board, 2, 1).next).toEqual(board[1]);
  });

  it("skips resolved letters and returns to passed letters in challenge order", () => {
    const board = letters("active", "correct", "incorrect", "passed", "passed");
    expect(getAlphabetNavigation(board, 0, 4).next).toEqual(board[3]);
    board[0].status = "passed";
    board[4].status = "active";
    expect(getAlphabetNavigation(board, 4, 3).next).toEqual(board[0]);
  });

  it("keeps the current letter identifiable during answer feedback", () => {
    const board = letters("correct", "unvisited", "unvisited");
    expect(getAlphabetNavigation(board, 0, null)).toMatchObject({
      current: board[0],
      correctAnswers: 1,
      pendingLetters: 2,
    });
  });

  it("does not duplicate the only pending letter or count terminal states as pending", () => {
    const board = letters("correct", "active", "incorrect", "unanswered");
    expect(getAlphabetNavigation(board, 1, 1)).toMatchObject({
      previous: null,
      next: null,
      correctAnswers: 1,
      incorrectAnswers: 1,
      pendingLetters: 1,
      isLastPending: true,
    });
  });

  it("does not invent a previous letter after recovery or preview a letter before preparation", () => {
    const board = letters("passed", "correct", "active");
    expect(getAlphabetNavigation(board, 2, null).previous).toBeNull();
    expect(getAlphabetNavigation(board, null, null)).toMatchObject({
      previous: null,
      current: null,
      next: null,
    });
  });

  it("formats singular, plural and zero counts", () => {
    expect(formatAlphabetProgress(1, 0, 17)).toBe("1 acierto · 0 fallos · 17 pendientes");
    expect(formatAlphabetProgress(0, 1, 1)).toBe("0 aciertos · 1 fallo · 1 pendiente");
    expect(formatAlphabetProgress(16, 2, 0)).toBe("16 aciertos · 2 fallos · 0 pendientes");
  });
});
