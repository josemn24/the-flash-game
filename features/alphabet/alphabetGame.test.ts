import { describe, expect, it } from "vitest";
import { getChallengeById } from "@/data/challenges";
import {
  alphabetReducer,
  calculateAlphabetScore,
  compareAlphabetResults,
  createAlphabetInitialState,
  isAlphabetAnswerCorrect,
} from "@/features/alphabet/alphabetGame";
import { normalizeAnswer } from "@/lib/normalizeAnswer";
import { isAnswerCorrect } from "@/lib/scoring";
import type { AlphabetChallenge, ShortTextQuestion } from "@/types/game";

function getAlphabetChallenge() {
  return getChallengeById("tabarnia-challenge-02") as AlphabetChallenge;
}

describe("alphabet answer evaluation", () => {
  const question = getAlphabetChallenge().entries[9]!.question as ShortTextQuestion;

  it("accepts case, accents, plurals and one small typo", () => {
    expect(isAlphabetAnswerCorrect(question, "JIRAFA")).toBe(true);
    expect(isAlphabetAnswerCorrect(question, "jirafas")).toBe(true);
    expect(isAlphabetAnswerCorrect(question, "jirfaa")).toBe(true);
  });

  it("rejects empty, different and more distant answers", () => {
    expect(isAlphabetAnswerCorrect(question, "")).toBe(false);
    expect(isAlphabetAnswerCorrect(question, "cebra")).toBe(false);
    expect(isAlphabetAnswerCorrect(question, "jirxzz")).toBe(false);
  });

  it("does not add fuzzy matching to Flash short-text questions", () => {
    const flashQuestion = {
      ...question,
      correctAnswer: "jirafa",
      acceptedAnswers: ["jirafa"],
    };
    expect(isAnswerCorrect(flashQuestion, "jirfaa")).toBe(false);
  });

  it("keeps every accepted animal tied to its assigned letter", () => {
    for (const entry of getAlphabetChallenge().entries) {
      expect(entry.question.type).toBe("short-text");
      if (entry.question.type !== "short-text") continue;
      const accepted = entry.question.acceptedAnswers ?? [entry.question.correctAnswer];
      expect(
        accepted.every((answer) =>
          normalizeAnswer(answer).startsWith(entry.letter.toLocaleLowerCase("es-ES")),
        ),
      ).toBe(true);
    }
  });
});

describe("alphabet scoring and ranking", () => {
  it("rounds only the final proportional score", () => {
    expect(calculateAlphabetScore(0, 15)).toBe(0);
    expect(calculateAlphabetScore(1, 15)).toBe(7);
    expect(calculateAlphabetScore(13, 15)).toBe(87);
    expect(calculateAlphabetScore(15, 15)).toBe(100);
  });

  it("ranks by correct answers and then time to the last correct answer", () => {
    expect(
      compareAlphabetResults(
        { correctAnswers: 12, lastCorrectAt: 80 },
        { correctAnswers: 11, lastCorrectAt: 20 },
      ),
    ).toBeLessThan(0);
    expect(
      compareAlphabetResults(
        { correctAnswers: 10, lastCorrectAt: 50 },
        { correctAnswers: 10, lastCorrectAt: 65 },
      ),
    ).toBeLessThan(0);
    expect(
      compareAlphabetResults(
        { correctAnswers: 0, lastCorrectAt: null },
        { correctAnswers: 0, lastCorrectAt: null },
      ),
    ).toBe(0);
  });
});

describe("alphabet reducer", () => {
  it("passes letters into another round and closes answered letters", () => {
    const challenge = getAlphabetChallenge();
    let state = createAlphabetInitialState(challenge);
    state = alphabetReducer(state, { type: "begin-countdown" });
    state = alphabetReducer(state, { type: "start" });
    state = alphabetReducer(state, { type: "pass" });

    expect(state.letters[0]?.status).toBe("passed");
    expect(state.currentIndex).toBe(1);

    state = alphabetReducer(state, {
      type: "submit",
      answer: "búho",
      correct: true,
      elapsedTime: 8,
    });
    expect(state.letters[1]).toMatchObject({ status: "correct", answer: "búho" });
    expect(state.lastCorrectAt).toBe(8);

    state = alphabetReducer(state, { type: "advance" });
    for (let index = 2; index < challenge.entries.length; index += 1) {
      state = alphabetReducer(state, { type: "pass" });
    }
    expect(state.currentIndex).toBe(0);
    expect(state.round).toBe(2);
  });

  it("does not return an incorrect letter and marks pending letters unanswered", () => {
    const challenge = getAlphabetChallenge();
    let state = alphabetReducer(createAlphabetInitialState(challenge), { type: "start" });
    state = alphabetReducer(state, {
      type: "submit",
      answer: "antílope",
      correct: false,
      elapsedTime: 4,
    });
    state = alphabetReducer(state, { type: "advance" });
    expect(state.letters[0]?.status).toBe("incorrect");

    state = alphabetReducer(state, { type: "finish", elapsedTime: 120 });
    expect(state.letters[0]?.status).toBe("incorrect");
    expect(state.letters.slice(1).every((letter) => letter.status === "unanswered")).toBe(true);
  });

  it("replay resets all session state", () => {
    const challenge = getAlphabetChallenge();
    let state = alphabetReducer(createAlphabetInitialState(challenge), { type: "start" });
    state = alphabetReducer(state, {
      type: "submit",
      answer: "armadillo",
      correct: true,
      elapsedTime: 3,
    });
    state = alphabetReducer(state, { type: "replay" });

    expect(state.phase).toBe("intro");
    expect(state.round).toBe(1);
    expect(state.lastCorrectAt).toBeNull();
    expect(state.letters.every((letter) => letter.status === "unvisited")).toBe(true);
  });
});
