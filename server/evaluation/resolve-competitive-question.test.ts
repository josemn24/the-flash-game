import { describe, expect, it } from "vitest";
import { resolveCompetitiveQuestion } from "./resolve-competitive-question";
import type { QuestionVersionId } from "@/types/domain/identifiers";
import type { DurationMs } from "@/types/domain/values";

const questionVersionId = "question-version:matching:v1" as QuestionVersionId;
const tags = {
  domains: [],
  topics: [],
  cognitiveSkills: [],
  formatSkills: [],
  lifeSkills: [],
} as const;

describe("resolveCompetitiveQuestion", () => {
  it("composes a public question and its private solution into the scoring projection", () => {
    const resolved = resolveCompetitiveQuestion({
      publicQuestion: {
        id: questionVersionId,
        type: "matching",
        category: "Geography",
        tags,
        prompt: "Match each country with its capital.",
        context: null,
        timeLimitMs: 30_000 as DurationMs,
        payload: {
          leftItems: [{ id: "es", label: "Spain" }],
          rightItems: [{ id: "mad", label: "Madrid" }],
        },
      },
      solution: {
        questionVersionId,
        type: "matching",
        explanation: "Madrid is the capital of Spain.",
        payload: { matches: { es: "mad" } },
      },
      points: 100,
    });

    expect(resolved).toMatchObject({
      type: "matching",
      points: 100,
      explanation: "Madrid is the capital of Spain.",
      leftItems: [{ id: "es", correctMatchId: "mad" }],
    });
  });

  it("keeps reveal-only data at the competitive boundary", () => {
    const resolved = resolveCompetitiveQuestion({
      publicQuestion: {
        id: questionVersionId,
        type: "progressive-clues",
        category: "Science",
        tags,
        prompt: "Identify the concept.",
        context: null,
        timeLimitMs: 45_000 as DurationMs,
        payload: { clueCount: 2, cluePenalty: 10 },
      },
      solution: {
        questionVersionId,
        type: "progressive-clues",
        explanation: "The clues point to the answer.",
        payload: { correctAnswer: "gravity", acceptedAnswers: ["gravity"] },
      },
      reveals: [
        {
          questionVersionId,
          type: "progressive-clues",
          payload: { clueIndex: 0, clue: "It affects every object with mass." },
        },
      ],
      points: 80,
    });

    expect(resolved).toMatchObject({
      type: "progressive-clues",
      clues: ["It affects every object with mass.", "clue-2"],
      correctAnswer: "gravity",
    });
  });
});
