import { describe, expect, it } from "vitest";
import type { EvaluationContext } from "@/application/ports/attempt-commands";
import { normalizeCompetitiveEvaluationContext } from "@/infrastructure/supabase/attempts/normalize-competitive-context";
import { parseFlashEditorialQuestionDocument } from "@/lib/editorial/flashDocument";
import { spainSurvivalQuestions } from "@/data/mock/catalog/questions/spainSurvival";
import { supabaseCompetitiveEvaluator } from "./competitive-evaluator";

const storedDocument = {
  slug: "published-survival-image",
  type: "progressive-image",
  payloadSchemaVersion: 2,
  timeLimitMs: 16_000,
  publicPayload: {
    question: "Identifica el monumento que aparece.",
    surface: {
      assetId: "74f91006-70a5-5551-cf6d-4384ced7a39b",
      alt: "Fotografía de la Sagrada Familia vista desde el Parc Güell",
      width: 1920,
      height: 1271,
      fit: "contain",
    },
    revealDurationMs: 7_000,
    answerLabel: null,
    answerPlaceholder: null,
  },
  solutionPayload: {
    correctAnswer: "Sagrada Familia",
    acceptedAnswers: ["sagrada familia", "la sagrada familia", "basílica de la sagrada familia"],
    solutionAlt: "Fotografía de la Sagrada Familia de Barcelona",
  },
};

function context(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  const { assetId, ...surface } = storedDocument.publicPayload.surface;
  return {
    receiptId: "00000000-0000-4000-8000-000000000001" as EvaluationContext["receiptId"],
    questionVersionId:
      "00000000-0000-4000-8000-000000000002" as EvaluationContext["questionVersionId"],
    receivedAt: "2026-10-03T18:35:00Z" as EvaluationContext["receivedAt"],
    questionType: "progressive-image",
    payloadSchemaVersion: storedDocument.payloadSchemaVersion,
    timeLimitMs: storedDocument.timeLimitMs as EvaluationContext["timeLimitMs"],
    timeUsedMs: 10_927 as EvaluationContext["timeUsedMs"],
    timedOut: false,
    answer: "  LA SAGRADA FAMILIA  ",
    publicPayload: {
      ...storedDocument.publicPayload,
      surface: { ...surface, src: `https://example.supabase.co/signed/${assetId}?token=test` },
    },
    solutionPayload: storedDocument.solutionPayload,
    itemPoints: 100,
    itemConfigSchemaVersion: 1,
    itemConfig: {},
    mode: "survival",
    modeConfigSchemaVersion: 1,
    modeConfig: { lives: 3 },
    ...overrides,
  };
}

describe("competitive progressive-image evaluation", () => {
  it.each([
    { answer: "  LA SAGRADA FAMILIA  ", timedOut: false, status: "correct", points: 73 },
    { answer: "Catedral de Burgos", timedOut: false, status: "incorrect", points: 0 },
    { answer: null, timedOut: true, status: "unanswered", points: 0 },
  ])("evaluates a published legacy caption as $status", ({ answer, timedOut, status, points }) => {
    expect(supabaseCompetitiveEvaluator.evaluate(context({ answer, timedOut }))).toEqual({
      status,
      points,
    });
  });

  it("reads the frozen asset reference without applying publication-only caption checks", () => {
    expect(() =>
      normalizeCompetitiveEvaluationContext(
        context({ publicPayload: storedDocument.publicPayload }),
      ),
    ).not.toThrow();
  });

  it("still rejects answer-revealing captions in new editorial documents", () => {
    expect(() => parseFlashEditorialQuestionDocument(storedDocument)).toThrow();
  });

  it("keeps the Spain survival images valid for new publications", () => {
    const images = spainSurvivalQuestions.filter(
      (question) => question.type === "progressive-image",
    );
    expect(images).toHaveLength(2);
    for (const question of images) {
      expect(() =>
        parseFlashEditorialQuestionDocument({
          slug: question.slug,
          type: question.type,
          payloadSchemaVersion: 1,
          timeLimitMs: question.publicPayload.timeLimitMs,
          publicPayload: {
            question: question.publicPayload.prompt,
            ...question.publicPayload.payload,
            revealDurationMs: question.publicPayload.payload.revealDurationMs * 1_000,
          },
          solutionPayload: question.privatePayload.solution.payload,
        }),
      ).not.toThrow();
    }
  });

  it("still rejects a malformed published solution", () => {
    expect(() =>
      supabaseCompetitiveEvaluator.evaluate(
        context({
          solutionPayload: { ...storedDocument.solutionPayload, acceptedAnswers: ["Otro lugar"] },
        }),
      ),
    ).toThrow("invalid_question_solution");
  });
});

describe("competitive logic-code evaluation", () => {
  function logicCodeContext(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
    return context({
      questionType: "logic-code",
      payloadSchemaVersion: 1,
      timeLimitMs: 25_000 as EvaluationContext["timeLimitMs"],
      timeUsedMs: 0 as EvaluationContext["timeUsedMs"],
      answer: "042",
      publicPayload: {
        question: "Deduce el código de tres cifras.",
        codeLength: 3,
        clues: [{ code: "682", hint: "Una cifra es correcta y está bien colocada." }],
      },
      solutionPayload: { correctAnswer: "042" },
      mode: "flash",
      modeConfig: {},
      submittedCodes: ["042"],
      incorrectAttempts: 0,
      ...overrides,
    });
  }

  it("keeps the successful first attempt and its leading zero in the review details", () => {
    expect(supabaseCompetitiveEvaluator.evaluate(logicCodeContext())).toEqual({
      status: "correct",
      points: 100,
      details: { type: "logic-code", submittedCodes: ["042"], incorrectAttempts: 0 },
    });
  });

  it("keeps all persisted attempts in order and applies the failed-attempt penalty", () => {
    expect(
      supabaseCompetitiveEvaluator.evaluate(
        logicCodeContext({ submittedCodes: ["111", "222", "042"], incorrectAttempts: 2 }),
      ),
    ).toEqual({
      status: "correct",
      points: 80,
      details: {
        type: "logic-code",
        submittedCodes: ["111", "222", "042"],
        incorrectAttempts: 2,
      },
    });
  });

  it("keeps failed attempts when the question times out without a final answer", () => {
    expect(
      supabaseCompetitiveEvaluator.evaluate(
        logicCodeContext({
          answer: null,
          timedOut: true,
          submittedCodes: ["111", "222"],
          incorrectAttempts: 2,
        }),
      ),
    ).toEqual({
      status: "unanswered",
      points: 0,
      details: { type: "logic-code", submittedCodes: ["111", "222"], incorrectAttempts: 2 },
    });
  });
});

describe("competitive Pyramid Queens evaluation", () => {
  const solution = [2, 9, 10, 18, 21];
  function queensContext(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
    return context({
      questionType: "queens",
      payloadSchemaVersion: 1,
      mode: "pyramid",
      modeConfig: {},
      timeLimitMs: 60_000 as EvaluationContext["timeLimitMs"],
      timeUsedMs: 0 as EvaluationContext["timeUsedMs"],
      publicPayload: {
        question: "Coloca cinco coronas",
        grid: { rows: 5, columns: 5 },
        regions: [0, 0, 0, 1, 1, 2, 0, 1, 1, 1, 2, 2, 1, 3, 1, 2, 3, 3, 3, 3, 2, 4, 3, 3, 3],
        prefilledQueens: [2],
      },
      solutionPayload: { solution, explanation: "Una por fila, columna y región" },
      answer: { queens: [0, 2, 5, 14, 20], marks: [] },
      incorrectAttempts: 3,
      incorrectValidations: 3,
      ...overrides,
    });
  }
  it("records exhaustion as incorrect with metrics and zero points", () => {
    expect(supabaseCompetitiveEvaluator.evaluate(queensContext())).toMatchObject({
      status: "incorrect",
      points: 0,
      details: {
        type: "queens",
        failureReason: "attempts_exhausted",
        placedQueens: 5,
        incorrectAttempts: 3,
        solved: false,
      },
    });
  });
  it.each([0, 1, 2])(
    "accepts a correct board after %i failures with its existing penalty",
    (failures) => {
      expect(
        supabaseCompetitiveEvaluator.evaluate(
          queensContext({
            answer: { queens: solution, marks: [] },
            incorrectAttempts: failures,
            incorrectValidations: failures,
          }),
        ),
      ).toMatchObject({ status: "correct", points: 100 - failures * 5 });
    },
  );
  it.each(["flash", "survival", "narrative"] as const)(
    "leaves %s Queens scoring unchanged",
    (mode) => {
      const result = supabaseCompetitiveEvaluator.evaluate(queensContext({ mode }));
      expect(result.status).toBe("partial");
      expect(result.details).not.toHaveProperty("failureReason");
    },
  );
  it("does not turn a timeout into exhaustion", () => {
    const result = supabaseCompetitiveEvaluator.evaluate(queensContext({ timedOut: true }));
    expect(result.status).toBe("unanswered");
    expect(result.details).not.toHaveProperty("failureReason");
  });
});
