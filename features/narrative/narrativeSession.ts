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
  unlockedEntryIds: string[];
  locked: boolean;
  lastTimedOut: boolean;
  notebookOpen: boolean;
};

export type NarrativeSessionAction =
  | { type: "start" }
  | { type: "answer"; result: AnswerResult; timedOut: boolean; unlockEntryIds: string[] }
  | {
      type: "advance";
      nextStepType: NarrativeStep["type"] | null;
      unlockEntryIds?: string[];
    }
  | { type: "show-review" }
  | { type: "show-results" }
  | { type: "open-notebook" }
  | { type: "close-notebook" }
  | { type: "replay" };

export const initialNarrativeSessionState: NarrativeSessionState = {
  phase: "intro",
  stepIndex: -1,
  results: [],
  unlockedEntryIds: [],
  locked: false,
  lastTimedOut: false,
  notebookOpen: false,
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
      return {
        ...state,
        phase: "transition",
        results: [...state.results, action.result],
        unlockedEntryIds: Array.from(
          new Set([...state.unlockedEntryIds, ...action.unlockEntryIds]),
        ),
        locked: true,
        lastTimedOut: action.timedOut,
        notebookOpen: false,
      };
    case "advance":
      if (action.nextStepType === null) {
        return {
          ...state,
          phase: "results",
          locked: false,
          notebookOpen: false,
        };
      }
      return {
        ...state,
        phase: action.nextStepType === "scene" ? "scene" : "playing",
        stepIndex: state.stepIndex + 1,
        unlockedEntryIds: Array.from(
          new Set([...state.unlockedEntryIds, ...(action.unlockEntryIds ?? [])]),
        ),
        locked: false,
        notebookOpen: false,
      };
    case "show-review":
      return { ...state, phase: "review", notebookOpen: false };
    case "show-results":
      return { ...state, phase: "results", notebookOpen: false };
    case "open-notebook":
      return { ...state, notebookOpen: true };
    case "close-notebook":
      return { ...state, notebookOpen: false };
    case "replay":
      return initialNarrativeSessionState;
  }
}
