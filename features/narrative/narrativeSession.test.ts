import { describe, expect, it } from "vitest";
import { getChallengeById } from "@/data/challenges";
import {
  getNarrativeReaction,
  getNarrativeSequence,
  initialNarrativeSessionState,
  narrativeSessionReducer,
} from "@/features/narrative/narrativeSession";
import type { AnswerResult } from "@/types/game";

const correctResult: AnswerResult = {
  questionId: "antarctica-orientation-calibration",
  answer: "060°",
  status: "correct",
  isCorrect: true,
  points: 12,
  timeUsed: 4.2,
};

function getNarrativeChallenge() {
  const challenge = getChallengeById("tabarnia-challenge-04");
  if (challenge?.mode !== "narrative") throw new Error("Expected narrative challenge");
  return challenge;
}

function reachFirstQuestion() {
  const started = narrativeSessionReducer(initialNarrativeSessionState, { type: "start" });
  const arrival = narrativeSessionReducer(started, {
    type: "advance",
    nextStepType: "scene",
  });
  return narrativeSessionReducer(arrival, {
    type: "advance",
    nextStepType: "question",
  });
}

describe("narrative session", () => {
  it("builds the exact prologue and Movement I sequence", () => {
    const sequence = getNarrativeSequence(getNarrativeChallenge());

    expect(
      sequence.map((step) => (step.type === "scene" ? step.scene.id : step.question.id)),
    ).toEqual([
      "scene-prologue",
      "scene-arrival",
      "antarctica-orientation-calibration",
      "scene-after-q1",
      "antarctica-cold-layer",
    ]);
  });

  it("starts in the prologue and advances into the first question", () => {
    const challenge = getNarrativeChallenge();
    const playing = reachFirstQuestion();

    expect(playing).toMatchObject({ phase: "playing", stepIndex: 2, locked: false });
    expect(getNarrativeSequence(challenge)[playing.stepIndex]).toMatchObject({
      type: "question",
      question: { id: "antarctica-orientation-calibration" },
    });
  });

  it.each([
    ["acierto", correctResult, false],
    [
      "fallo",
      { ...correctResult, answer: "090°", status: "incorrect", isCorrect: false, points: 0 },
      false,
    ],
    [
      "timeout",
      { ...correctResult, answer: null, status: "unanswered", isCorrect: false, points: 0 },
      true,
    ],
  ] as const)("unlocks the same notebook entry after %s", (_label, result, timedOut) => {
    const playing = reachFirstQuestion();
    const transition = narrativeSessionReducer(playing, {
      type: "answer",
      result,
      timedOut,
      unlockEntryIds: ["note-calibration"],
    });

    expect(transition).toMatchObject({
      phase: "transition",
      unlockedEntryIds: ["note-calibration"],
      lastTimedOut: timedOut,
      locked: true,
    });
  });

  it.each([
    ["correct", correctResult, false, "Podemos orientarnos"],
    [
      "incorrect",
      { ...correctResult, answer: "090°", status: "incorrect", isCorrect: false, points: 0 },
      false,
      "El mapa necesita 060°",
    ],
    [
      "timeout",
      { ...correctResult, answer: null, status: "unanswered", isCorrect: false, points: 0 },
      true,
      "Nora fija el rumbo",
    ],
  ] as const)("selects only the %s reaction", (_outcome, result, timedOut, expectedText) => {
    const sequence = getNarrativeSequence(getNarrativeChallenge());
    const reaction = getNarrativeReaction(sequence[2], result, timedOut);

    expect(reaction.some((block) => block.text.includes(expectedText))).toBe(true);
    expect(reaction).toEqual(
      sequence[2].type === "question"
        ? sequence[2].reactions[timedOut ? "timeout" : result.isCorrect ? "correct" : "incorrect"]
        : [],
    );
  });

  it("uses the final question reaction on the prototype result", () => {
    const sequence = getNarrativeSequence(getNarrativeChallenge());
    const result = {
      ...correctResult,
      questionId: "antarctica-cold-layer",
      answer: "Una capa aislante de forro polar",
    };

    expect(getNarrativeReaction(sequence[4], result, false)).toEqual(
      sequence[4].type === "question" ? sequence[4].reactions.correct : [],
    );
  });

  it("finishes after the second answer instead of creating another scene", () => {
    const state = {
      ...reachFirstQuestion(),
      phase: "transition" as const,
      stepIndex: 4,
      results: [correctResult, { ...correctResult, questionId: "antarctica-cold-layer" }],
      unlockedEntryIds: ["note-calibration", "note-weather"],
      locked: true,
    };

    expect(narrativeSessionReducer(state, { type: "advance", nextStepType: null })).toMatchObject({
      phase: "prototype-results",
      stepIndex: 4,
      unlockedEntryIds: ["note-calibration", "note-weather"],
    });
  });

  it("opens the notebook without changing the active question", () => {
    const playing = reachFirstQuestion();
    const withNotebook = narrativeSessionReducer(playing, { type: "open-notebook" });

    expect(withNotebook).toMatchObject({
      phase: "playing",
      stepIndex: playing.stepIndex,
      notebookOpen: true,
    });
  });

  it("restores the complete initial state on replay", () => {
    const dirtyState = {
      ...reachFirstQuestion(),
      results: [correctResult],
      unlockedEntryIds: ["note-calibration"],
      notebookOpen: true,
    };

    expect(narrativeSessionReducer(dirtyState, { type: "replay" })).toEqual(
      initialNarrativeSessionState,
    );
  });
});
