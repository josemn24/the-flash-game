import { describe, expect, it } from "vitest";
import {
  CHALLENGE_MAX_SCORE,
  getConfiguredChallengeQuestionPointValues,
  getChallengeQuestionPointValues,
  withChallengeQuestionPoints,
  withChallengeScoring,
} from "@/lib/challengeScoring";
import type { Challenge, ProgressiveCluesQuestion } from "@/types/game";

describe("challenge scoring", () => {
  it("distributes the challenge maximum as integer points", () => {
    expect(getChallengeQuestionPointValues(10)).toEqual([10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
    expect(getChallengeQuestionPointValues(12)).toEqual([9, 9, 9, 9, 8, 8, 8, 8, 8, 8, 8, 8]);
    expect(getChallengeQuestionPointValues(16)).toEqual([
      7, 7, 7, 7, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
    ]);
  });

  it("returns no points for an empty challenge", () => {
    expect(getChallengeQuestionPointValues(0)).toEqual([]);
  });

  it("uses configured integer points when a challenge declares them", () => {
    expect(
      getConfiguredChallengeQuestionPointValues(["q-1", "q-2", "q-3"], {
        "q-1": 40,
        "q-2": 35,
        "q-3": 25,
      }),
    ).toEqual([40, 35, 25]);
  });

  it("rejects configured points that do not add up to the challenge maximum", () => {
    expect(() =>
      getConfiguredChallengeQuestionPointValues(["q-1", "q-2"], {
        "q-1": 40,
        "q-2": 40,
      }),
    ).toThrow("must add up to 100 points");
  });

  it("rejects incomplete configured points", () => {
    expect(() =>
      getConfiguredChallengeQuestionPointValues(["q-1", "q-2"], {
        "q-1": 100,
      }),
    ).toThrow("missing points");
  });

  it("applies challenge points without mutating source questions", () => {
    const question: ProgressiveCluesQuestion = {
      id: "clues",
      type: "progressive-clues",
      category: "Pistas",
      tags: {
        domains: ["culture"],
        topics: [],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
      },
      question: "¿Quién es?",
      clues: ["Pista 1", "Pista 2", "Pista 3"],
      cluePenalty: 20,
      correctAnswer: "Ada",
      timeLimit: 20,
      points: 160,
      explanation: "Respuesta de ejemplo.",
    };

    const scoredQuestion = withChallengeQuestionPoints(question, 8);

    expect(scoredQuestion).toMatchObject({ points: 8, cluePenalty: 1 });
    expect(question).toMatchObject({ points: 160, cluePenalty: 20 });
  });

  it("normalizes a challenge to the standard maximum score", () => {
    const challenge: Challenge = {
      id: "demo",
      definitionId: "definition",
      number: 1,
      title: "Demo",
      subtitle: "Demo",
      description: "Demo",
      mode: "flash",
      questions: Array.from({ length: 12 }, (_, index) => ({
        id: `q-${index}`,
        type: "true-false" as const,
        category: "Demo",
        tags: {
          domains: ["culture"],
          topics: [],
          cognitiveSkills: ["memory"],
          formatSkills: ["recall"],
        },
        question: "Pregunta",
        correctAnswer: true,
        timeLimit: 10,
        points: 100,
        explanation: "Explicación.",
      })),
    };

    const scoredChallenge = withChallengeScoring(challenge);

    expect(scoredChallenge.questions.map((question) => question.points).reduce((a, b) => a + b, 0))
      .toBe(CHALLENGE_MAX_SCORE);
    expect(scoredChallenge.questions.map((question) => question.points)).toEqual([
      9, 9, 9, 9, 8, 8, 8, 8, 8, 8, 8, 8,
    ]);
    expect(challenge.questions.every((question) => question.points === 100)).toBe(true);
  });

  it("normalizes a challenge using configured question scores", () => {
    const challenge: Challenge = {
      id: "demo",
      definitionId: "definition",
      number: 1,
      title: "Demo",
      subtitle: "Demo",
      description: "Demo",
      mode: "flash",
      questionPoints: {
        "q-1": 60,
        "q-2": 40,
      },
      questions: [
        {
          id: "q-1",
          type: "true-false" as const,
          category: "Demo",
          tags: {
            domains: ["culture"],
            topics: [],
            cognitiveSkills: ["memory"],
            formatSkills: ["recall"],
          },
          question: "Pregunta",
          correctAnswer: true,
          timeLimit: 10,
          points: 100,
          explanation: "Explicación.",
        },
        {
          id: "q-2",
          type: "true-false" as const,
          category: "Demo",
          tags: {
            domains: ["culture"],
            topics: [],
            cognitiveSkills: ["memory"],
            formatSkills: ["recall"],
          },
          question: "Pregunta",
          correctAnswer: true,
          timeLimit: 10,
          points: 100,
          explanation: "Explicación.",
        },
      ],
    };

    const scoredChallenge = withChallengeScoring(challenge);

    expect(scoredChallenge.questions.map((question) => question.points)).toEqual([60, 40]);
  });
});
