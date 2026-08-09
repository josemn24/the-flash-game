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
  it("builds the exact prologue and Movements I–II sequence", () => {
    const sequence = getNarrativeSequence(getNarrativeChallenge());

    expect(
      sequence.map((step) => (step.type === "scene" ? step.scene.id : step.question.id)),
    ).toEqual([
      "scene-prologue",
      "scene-arrival",
      "antarctica-orientation-calibration",
      "scene-after-q1",
      "antarctica-cold-layer",
      "scene-station",
      "antarctica-warehouse-memory",
      "scene-after-q3",
      "antarctica-radio-batteries",
      "scene-after-q4",
      "antarctica-team-instruments",
      "scene-departure",
    ]);
  });

  it("keeps all six notebook entries in narrative order", () => {
    expect(getNarrativeChallenge().notebookEntries.map((entry) => entry.id)).toEqual([
      "note-calibration",
      "note-weather",
      "note-storage",
      "note-batteries",
      "note-team",
      "note-location",
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
      "parcial",
      { ...correctResult, answer: "090°", status: "partial", isCorrect: false, points: 4 },
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

  it("uses the final question reaction at the start of the departure scene", () => {
    const sequence = getNarrativeSequence(getNarrativeChallenge());
    const result = {
      ...correctResult,
      questionId: "antarctica-team-instruments",
      answer: { alba: "camera", alex: "hydrophone", mara: "seismometer" },
    };

    expect(getNarrativeReaction(sequence[10], result, false)).toEqual(
      sequence[10].type === "question" ? sequence[10].reactions.correct : [],
    );
  });

  it("finishes after the departure scene with all observations preserved", () => {
    const state = {
      ...reachFirstQuestion(),
      phase: "scene" as const,
      stepIndex: 11,
      results: [
        correctResult,
        { ...correctResult, questionId: "antarctica-cold-layer" },
        { ...correctResult, questionId: "antarctica-warehouse-memory" },
        { ...correctResult, questionId: "antarctica-radio-batteries" },
        { ...correctResult, questionId: "antarctica-team-instruments" },
      ],
      unlockedEntryIds: [
        "note-calibration",
        "note-weather",
        "note-storage",
        "note-batteries",
        "note-team",
        "note-location",
      ],
      locked: false,
    };

    expect(narrativeSessionReducer(state, { type: "advance", nextStepType: null })).toMatchObject({
      phase: "prototype-results",
      stepIndex: 11,
      unlockedEntryIds: [
        "note-calibration",
        "note-weather",
        "note-storage",
        "note-batteries",
        "note-team",
        "note-location",
      ],
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
