import { describe, expect, it } from "vitest";
import { normalizeCompetitiveEvaluationContext } from "./normalize-competitive-context";
import { resolveCompetitiveQuestion } from "@/server/evaluation/resolve-competitive-question";
import type { EvaluationContext } from "@/application/ports/attempt-commands";
import type { AnswerReceiptId, QuestionVersionId } from "@/types/domain/identifiers";
import type { DurationMs, UtcIsoDateTime } from "@/types/domain/values";

const questionVersionId = "00000000-0000-4000-8000-000000000001" as QuestionVersionId;
const receiptId = "00000000-0000-4000-8000-000000000002" as AnswerReceiptId;
const tags = { domains: [], topics: [], cognitiveSkills: [], formatSkills: [] };

function context(overrides: Partial<EvaluationContext>): EvaluationContext {
  return {
    receiptId,
    questionVersionId,
    answer: null,
    receivedAt: "2026-09-30T10:00:00.000Z" as UtcIsoDateTime,
    timeUsedMs: 1_000 as DurationMs,
    timedOut: false,
    questionType: "multiple-choice",
    payloadSchemaVersion: 1,
    itemConfigSchemaVersion: 1,
    publicPayload: {
      question: "Which option is correct?",
      category: "General",
      tags,
      options: ["A", "B"],
      media: null,
      promptVisual: null,
    },
    solutionPayload: { correctAnswer: "A", explanation: "A is correct." },
    timeLimitMs: 30_000 as DurationMs,
    itemPoints: 100,
    itemConfig: {},
    mode: "flash",
    modeConfigSchemaVersion: 1,
    modeConfig: {},
    ...overrides,
  };
}

describe("normalizeCompetitiveEvaluationContext", () => {
  it("converts a flat multiple-choice payload to canonical contracts", () => {
    const normalized = normalizeCompetitiveEvaluationContext(context({}));
    const resolved = resolveCompetitiveQuestion(normalized);

    expect(normalized.publicQuestion).toMatchObject({
      id: questionVersionId,
      type: "multiple-choice",
      payload: { options: ["A", "B"], media: null, promptVisual: null },
    });
    expect(normalized.solution).toMatchObject({
      questionVersionId,
      payload: { correctAnswer: "A" },
    });
    expect(resolved).toMatchObject({ type: "multiple-choice", correctAnswer: "A", points: 100 });
  });

  it("keeps progressive clue count and reveal data separate from the solution", () => {
    const normalized = normalizeCompetitiveEvaluationContext(
      context({
        questionType: "progressive-clues",
        publicPayload: {
          question: "Identify the concept.",
          category: "Science",
          tags,
          clues: ["First clue", "Second clue"],
          cluePenalty: 10,
        },
        solutionPayload: {
          correctAnswer: "gravity",
          acceptedAnswers: ["gravity"],
          explanation: "The clues describe gravity.",
        },
      }),
    );
    const resolved = resolveCompetitiveQuestion(normalized);

    expect(normalized.publicQuestion.payload).toEqual({ clueCount: 2, cluePenalty: 10 });
    expect(normalized.solution.payload).toEqual({
      correctAnswer: "gravity",
      acceptedAnswers: ["gravity"],
    });
    expect(resolved).toMatchObject({
      type: "progressive-clues",
      clues: ["First clue", "Second clue"],
    });
  });

  it("preserves validation errors and unsupported format boundaries", () => {
    expect(() =>
      normalizeCompetitiveEvaluationContext(
        context({ publicPayload: { question: "Missing options" }, solutionPayload: {} }),
      ),
    ).toThrow("invalid_question_payload");

    expect(() =>
      normalizeCompetitiveEvaluationContext(
        context({ questionType: "memory-pairs", publicPayload: {}, solutionPayload: {} }),
      ),
    ).toThrow("unsupported_question");
  });
});
