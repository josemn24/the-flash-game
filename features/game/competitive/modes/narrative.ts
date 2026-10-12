import type { ServerNarrativeChallenge, ServerNarrativeStep } from "@/types/gameplay/challenge";
import type { ModePolicy, ModeStep } from "./policy";
export function narrativePolicy(challenge: ServerNarrativeChallenge): ModePolicy {
  const sequence: ServerNarrativeStep[] = [
    { type: "scene", scene: challenge.prologue },
    ...challenge.beats.flatMap((beat) => beat.steps),
  ];
  const position = (id: string) =>
    sequence.findIndex((step) => step.type === "question" && step.questionId === id);
  const stepAt = (index: number): ModeStep =>
    !sequence[index]
      ? { type: "complete" }
      : sequence[index]?.type === "scene"
        ? { type: "phase", phase: "scene", stepIndex: index }
        : { type: "prepare" };
  return {
    initialPhase: "scene",
    sequence,
    position,
    terminal: (results) => results.length >= challenge.slots.length,
    next: (state) => stepAt(state.stepIndex + 1),
    recover: (state, response) => {
      const cursor = response.narrativeCursor as { currentChallengeItemId?: string } | undefined;
      if (cursor?.currentChallengeItemId) return { type: "prepare" };
      const unanswered = sequence.findIndex(
        (step) =>
          step.type === "question" &&
          !state.results.some((result) => result.questionId === step.questionId),
      );
      if (unanswered < 0) return { type: "complete" };
      let sceneIndex = unanswered;
      while (sceneIndex > 0 && sequence[sceneIndex]?.type !== "scene") sceneIndex--;
      return stepAt(sceneIndex);
    },
  };
}
