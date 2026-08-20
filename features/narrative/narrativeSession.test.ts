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
  questionId: "ross-sea-transantarctic-range",
  answer: "Cordillera Transantártica",
  status: "correct",
  isCorrect: true,
  points: 10,
  timeUsed: 4.2,
};

function getNarrativeChallenge() {
  const challenge = getChallengeById("tabarnia-challenge-04");
  if (challenge?.mode !== "narrative") throw new Error("Expected narrative challenge");
  return challenge;
}

function reachFirstQuestion() {
  const started = narrativeSessionReducer(initialNarrativeSessionState, { type: "start" });
  const chapterOpening = narrativeSessionReducer(started, {
    type: "advance",
    nextStepType: "scene",
  });
  const firstObservation = narrativeSessionReducer(chapterOpening, {
    type: "advance",
    nextStepType: "scene",
  });
  return narrativeSessionReducer(firstObservation, { type: "advance", nextStepType: "question" });
}

describe("P-17 narrative session", () => {
  it("builds the exact twenty-seven-page sequence", () => {
    const sequence = getNarrativeSequence(getNarrativeChallenge());

    expect(
      sequence.map((step) => (step.type === "scene" ? step.scene.id : step.question.id)),
    ).toEqual([
      "scene-field-context",
      "scene-prologue-recording",
      "scene-all-but-one",
      "ross-sea-transantarctic-range",
      "scene-p17-identification",
      "scene-p17-register",
      "antarctic-circle-map",
      "scene-deviation-overlay",
      "polar-fauna-classification",
      "scene-observation-rule",
      "scene-chapter-stay-out",
      "scene-corridor",
      "clear-camp-escape",
      "scene-camp-cleared",
      "scene-nadir-message",
      "p17-evidence-matrix",
      "scene-nadir-match",
      "scene-chapter-complete-line",
      "scene-six-records",
      "p17-route-zip",
      "scene-route-complete",
      "scene-story-is-not-cause",
      "p17-observation-order",
      "scene-last-sheet",
      "p17-final-record",
      "scene-resolution",
      "scene-epilogue",
    ]);
    expect(sequence).toHaveLength(27);
    const questions = sequence.flatMap((step) => (step.type === "question" ? [step.question] : []));
    expect(questions).toHaveLength(8);
    expect(questions.reduce((total, question) => total + question.points, 0)).toBe(100);
    expect(questions.reduce((total, question) => total + question.timeLimit, 0)).toBe(284);
    expect(
      sequence.flatMap((step, index) =>
        step.type === "question" ? [{ question: step.question.id, page: index + 1 }] : [],
      ),
    ).toEqual([
      { question: "ross-sea-transantarctic-range", page: 4 },
      { question: "antarctic-circle-map", page: 7 },
      { question: "polar-fauna-classification", page: 9 },
      { question: "clear-camp-escape", page: 13 },
      { question: "p17-evidence-matrix", page: 16 },
      { question: "p17-route-zip", page: 20 },
      { question: "p17-observation-order", page: 23 },
      { question: "p17-final-record", page: 25 },
    ]);
    expect(
      sequence.flatMap((step, index) =>
        step.type === "question"
          ? [{ reactionPage: index + 2, nextType: sequence[index + 1]?.type }]
          : [],
      ),
    ).toEqual(
      [5, 8, 10, 14, 17, 21, 24, 26].map((reactionPage) => ({
        reactionPage,
        nextType: "scene",
      })),
    );
  });

  it("keeps the final evidence statement immediately before the blackout", () => {
    const sequence = getNarrativeSequence(getNarrativeChallenge());
    expect(sequence.at(-2)).toMatchObject({ type: "scene", scene: { id: "scene-resolution" } });
    expect(sequence.at(-1)).toMatchObject({
      type: "scene",
      scene: { id: "scene-epilogue", presentation: "blackout" },
    });
    const resolution = sequence.at(-2);
    expect(
      resolution?.type === "scene" &&
        resolution.scene.blocks.some((block) =>
          block.text.endsWith("La causa de la trayectoria no pudo determinarse."),
        ),
    ).toBe(true);
    expect(resolution?.type === "scene" && resolution.scene.blocks.at(-1)?.text).toBe(
      "Pero, ¿por qué?",
    );
  });

  it("keeps the three chapters and eight evidence entries in narrative order", () => {
    const challenge = getNarrativeChallenge();
    const scenes = getNarrativeSequence(challenge).flatMap((step, index) =>
      step.type === "scene" ? [{ ...step.scene, page: index + 1 }] : [],
    );
    expect(challenge.beats.map((beat) => beat.title)).toEqual([
      "Todos menos uno",
      "Mantenerse fuera",
      "La línea completa",
    ]);
    expect(challenge.notebookEntries.map((entry) => entry.id)).toEqual([
      "note-direction",
      "note-polar-context",
      "note-polar-fauna",
      "note-intervention",
      "note-nadir",
      "note-route",
      "note-chronology",
      "note-final",
    ]);
    expect(challenge.notebookEntries.every((entry) => entry.relevance === "context")).toBe(true);
    expect(
      scenes
        .filter((scene) => scene.presentation === "chapter-opening")
        .map((scene) => [scene.page, scene.title]),
    ).toEqual([
      [2, "Todos menos uno"],
      [11, "Mantenerse fuera"],
      [18, "La línea completa"],
    ]);
    expect(scenes.filter((scene) => scene.title).map((scene) => scene.page)).toEqual([
      1, 2, 11, 18,
    ]);
    expect(scenes.map((scene) => scene.presentation)).toEqual([
      "text-led",
      "chapter-opening",
      "full-bleed",
      "split",
      "text-led",
      "artifact",
      "text-led",
      "chapter-opening",
      "split",
      "full-bleed",
      "artifact",
      "text-led",
      "chapter-opening",
      "artifact",
      "full-bleed",
      "text-led",
      "split",
      "artifact",
      "blackout",
    ]);
  });

  it("starts in the prologue and advances to the first timed proof", () => {
    const playing = reachFirstQuestion();
    expect(playing).toMatchObject({ phase: "playing", stepIndex: 3, locked: false });
    expect(getNarrativeSequence(getNarrativeChallenge())[playing.stepIndex]).toMatchObject({
      type: "question",
      question: { id: "ross-sea-transantarctic-range" },
    });
  });

  it.each([
    ["acierto", correctResult, false],
    [
      "fallo",
      { ...correctResult, answer: "mar", status: "incorrect", isCorrect: false, points: 0 },
      false,
    ],
    [
      "parcial",
      { ...correctResult, answer: "interior", status: "partial", isCorrect: false, points: 4 },
      false,
    ],
    [
      "timeout",
      { ...correctResult, answer: null, status: "unanswered", isCorrect: false, points: 0 },
      true,
    ],
  ] as const)("unlocks the same evidence after %s", (_label, result, timedOut) => {
    const transition = narrativeSessionReducer(reachFirstQuestion(), {
      type: "answer",
      result,
      timedOut,
      unlockEntryIds: ["note-direction"],
    });

    expect(transition).toMatchObject({
      phase: "transition",
      unlockedEntryIds: ["note-direction"],
      lastTimedOut: timedOut,
      locked: true,
    });
  });

  it("advances from the answer transition to the following narrative scene", () => {
    const transition = narrativeSessionReducer(reachFirstQuestion(), {
      type: "answer",
      result: correctResult,
      timedOut: false,
      unlockEntryIds: ["note-direction"],
    });

    const scene = narrativeSessionReducer(transition, {
      type: "advance",
      nextStepType: "scene",
    });

    expect(scene).toMatchObject({
      phase: "scene",
      stepIndex: 4,
      locked: false,
      results: [correctResult],
      unlockedEntryIds: ["note-direction"],
    });
  });

  it("does not add another result while the answer transition is active", () => {
    const transition = narrativeSessionReducer(reachFirstQuestion(), {
      type: "answer",
      result: correctResult,
      timedOut: false,
      unlockEntryIds: ["note-direction"],
    });

    expect(
      narrativeSessionReducer(transition, {
        type: "answer",
        result: { ...correctResult, timeUsed: 5.1 },
        timedOut: false,
        unlockEntryIds: ["note-direction"],
      }),
    ).toMatchObject({
      phase: "transition",
      results: [correctResult],
    });
  });

  it.each([
    ["correct", correctResult, false, "referencia del mapa quedó encajada"],
    [
      "incorrect",
      {
        ...correctResult,
        answer: "Montes Ellsworth",
        status: "incorrect",
        isCorrect: false,
        points: 0,
      },
      false,
      "Nora rebobinó",
    ],
    [
      "partial",
      {
        ...correctResult,
        answer: "Cordillera de la Península Antártica",
        status: "partial",
        isCorrect: false,
        points: 4,
      },
      false,
      "Nora rebobinó",
    ],
    [
      "timeout",
      { ...correctResult, answer: null, status: "unanswered", isCorrect: false, points: 0 },
      true,
      "ficha de archivo terminó de revelarse",
    ],
  ] as const)("selects the %s narrative reaction", (_label, result, timedOut, expected) => {
    const reaction = getNarrativeReaction(
      getNarrativeSequence(getNarrativeChallenge())[3],
      result,
      timedOut,
    );
    expect(reaction.some((block) => block.text.includes(expected))).toBe(true);
  });

  it("finishes after the blackout while preserving every result and evidence entry", () => {
    const challenge = getNarrativeChallenge();
    const results = challenge.beats
      .flatMap((beat) => beat.steps)
      .flatMap((step) =>
        step.type === "question"
          ? [{ ...correctResult, questionId: step.question.id, points: step.question.points }]
          : [],
      );
    const state = {
      ...reachFirstQuestion(),
      phase: "scene" as const,
      stepIndex: 26,
      results,
      unlockedEntryIds: challenge.notebookEntries.map((entry) => entry.id),
      locked: false,
    };

    expect(narrativeSessionReducer(state, { type: "advance", nextStepType: null })).toMatchObject({
      phase: "results",
      results,
      unlockedEntryIds: challenge.notebookEntries.map((entry) => entry.id),
    });
  });

  it("moves between result and review without losing progress", () => {
    const results = narrativeSessionReducer(
      { ...reachFirstQuestion(), phase: "scene", stepIndex: 26, results: [correctResult] },
      { type: "advance", nextStepType: null },
    );
    const review = narrativeSessionReducer(results, { type: "show-review" });
    expect(review).toMatchObject({ phase: "review", results: [correctResult] });
    expect(narrativeSessionReducer(review, { type: "show-results" })).toMatchObject({
      phase: "results",
      results: [correctResult],
    });
  });
});
