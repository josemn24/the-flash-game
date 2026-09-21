import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MiniWordleQuestion } from "@/components/questions/formats/mini-wordle/MiniWordleQuestion";
import { QuestionReviewContent } from "@/features/question-formats/QuestionReviewContent";
import { questionsById } from "@/data/questions";
import type { AnswerResult } from "@/types/result";

const callbacks = {
  onProgress: vi.fn(),
  onSubmit: vi.fn(),
  onTimedResponseStart: vi.fn(),
};

describe("Mini-Wordle layout", () => {
  it("passes five letters to the playable board layout", () => {
    const markup = renderToStaticMarkup(
      <MiniWordleQuestion
        correctAnswer="JOSUÉ"
        wordLength={5}
        maxAttempts={6}
        locked={false}
        {...callbacks}
      />,
    );

    expect(markup).toContain("--mini-wordle-columns:5");
  });

  it("keeps four letters as the playable layout fallback", () => {
    const markup = renderToStaticMarkup(
      <MiniWordleQuestion correctAnswer="LUNA" locked={false} {...callbacks} />,
    );

    expect(markup).toContain("--mini-wordle-columns:4");
  });

  it("uses five columns and six attempts in the review", () => {
    const question = questionsById["abrahamic-mini-wordle-josue"];
    const result: AnswerResult = {
      questionId: question.id,
      answer: { guesses: ["ANGEL"] },
      status: "incorrect",
      isCorrect: false,
      points: 0,
      timeUsed: 12,
      details: {
        type: "mini-wordle",
        attemptsUsed: 1,
        incorrectAttempts: 1,
        solved: false,
      },
    };

    const markup = renderToStaticMarkup(
      <QuestionReviewContent question={question} result={result} />,
    );

    expect(markup).toContain("--mini-wordle-columns:5");
    expect(markup).toContain("de 6");
  });
});
