import type {
  AnswerResult,
  NarrativeChallenge,
  NarrativeOutcome,
  NarrativeStep,
  NarrativeTextBlock,
} from "@/types/game";

export type NarrativePhase = "intro" | "scene" | "playing" | "transition" | "results" | "review";

export type NarrativeSessionState = {
  phase: NarrativePhase;
  stepIndex: number;
  results: AnswerResult[];
  locked: boolean;
  lastTimedOut: boolean;
};

export type NarrativeSessionAction =
  | { type: "start" }
  | { type: "answer"; result: AnswerResult; timedOut: boolean }
  | {
      type: "advance";
      nextStepType: NarrativeStep["type"] | null;
    }
  | { type: "show-review" }
  | { type: "show-results" }
  | { type: "replay" };

export const initialNarrativeSessionState: NarrativeSessionState = {
  phase: "intro",
  stepIndex: -1,
  results: [],
  locked: false,
  lastTimedOut: false,
};

export function getNarrativeSequence(challenge: NarrativeChallenge): NarrativeStep[] {
  return [
    { type: "scene", scene: challenge.prologue },
    ...challenge.beats.flatMap((beat) => beat.steps),
  ];
}

export function getNarrativeOutcome(result: AnswerResult, timedOut: boolean): NarrativeOutcome {
  if (timedOut) return "timeout";
  return result.status === "correct" ? "correct" : "incorrect";
}

export function getNarrativeReaction(
  step: NarrativeStep | undefined,
  result: AnswerResult | undefined,
  timedOut: boolean,
): NarrativeTextBlock[] {
  if (!result || step?.type !== "question" || step.question.id !== result.questionId) return [];
  if (!step.reactions) return [];
  return step.reactions[getNarrativeOutcome(result, timedOut)];
}

export function narrativeSessionReducer(
  state: NarrativeSessionState,
  action: NarrativeSessionAction,
): NarrativeSessionState {
  switch (action.type) {
    case "start":
      return { ...initialNarrativeSessionState, phase: "scene", stepIndex: 0 };
    case "answer":
      if (state.phase !== "playing") return state;
      return {
        ...state,
        phase: "transition",
        results: [...state.results, action.result],
        locked: true,
        lastTimedOut: action.timedOut,
      };
    case "advance":
      if (action.nextStepType === null) {
        return {
          ...state,
          phase: "results",
          locked: false,
        };
      }
      return {
        ...state,
        phase: action.nextStepType === "scene" ? "scene" : "playing",
        stepIndex: state.stepIndex + 1,
        locked: false,
      };
    case "show-review":
      return { ...state, phase: "review" };
    case "show-results":
      return { ...state, phase: "results" };
    case "replay":
      return initialNarrativeSessionState;
  }
}
