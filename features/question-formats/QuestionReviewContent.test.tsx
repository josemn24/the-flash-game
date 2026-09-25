import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuestionReviewContent } from "@/features/question-formats/QuestionReviewContent";
import { questionsById } from "@/test-utils/mockGameplay";
import type { AnswerResult } from "@/types/result";

const question = questionsById["pyramid-connect-pairs-trap"];

function result(overrides: Partial<AnswerResult>): AnswerResult {
  return {
    questionId: question.id,
    answer: null,
    status: "unanswered",
    isCorrect: false,
    points: 0,
    timeUsed: 0,
    ...overrides,
  };
}

describe("Connect Pairs review", () => {
  it("renders the canonical routes and hides the duplicate submitted layer when correct", () => {
    if (question.type !== "connect-pairs") throw new Error("Expected connect-pairs question");

    const markup = renderToStaticMarkup(
      <QuestionReviewContent
        question={question}
        result={result({
          answer: { paths: question.solutionPaths },
          status: "correct",
          isCorrect: true,
          details: {
            type: "connect-pairs",
            connectedPairs: 4,
            totalPairs: 4,
            coveredCells: 25,
            totalCells: 25,
            coverage: 1,
            conflicts: 0,
          },
        })}
      />,
    );

    expect(markup.match(/class="[^"]*connectPairsReviewRouteLine/g)).toHaveLength(
      question.pairs.length,
    );
    expect(markup).not.toContain("connectPairsReviewSubmittedLine");
    expect(markup).toContain("Solución completa");
    expect(markup).toContain("Círculo");
    expect(markup).toContain("Triángulo");
  });

  it("renders both solution and submitted routes for an incomplete answer", () => {
    if (question.type !== "connect-pairs") throw new Error("Expected connect-pairs question");

    const markup = renderToStaticMarkup(
      <QuestionReviewContent
        question={question}
        result={result({
          answer: { paths: { circle: [0, 1, 2] } },
          status: "partial",
          details: {
            type: "connect-pairs",
            connectedPairs: 0,
            totalPairs: 4,
            coveredCells: 3,
            totalCells: 25,
            coverage: 3 / 25,
            conflicts: 0,
          },
        })}
      />,
    );

    expect(markup.match(/class="[^"]*connectPairsReviewRouteLine/g)).toHaveLength(
      question.pairs.length,
    );
    expect(markup).toContain("connectPairsReviewSubmittedLine");
    expect(markup).toContain("Tu respuesta");
    expect(markup).toContain("Respuesta parcial");
    expect(markup).toContain("extremo no incluido en tu respuesta");
  });

  it("uses the light board variant for Zip review", () => {
    const zipQuestion = questionsById["p17-route-zip"];
    if (zipQuestion.type !== "zip") throw new Error("Expected zip question");

    const markup = renderToStaticMarkup(
      <QuestionReviewContent
        question={zipQuestion}
        result={{
          questionId: zipQuestion.id,
          answer: null,
          status: "unanswered",
          isCorrect: false,
          points: 0,
          timeUsed: 0,
          details: {
            type: "zip",
            coveredCells: 1,
            totalCells: 25,
            reachedCheckpoint: 1,
            totalCheckpoints: zipQuestion.checkpoints.length,
            completed: false,
          },
        }}
      />,
    );

    expect(markup).toContain("boardReview");
  });
});
