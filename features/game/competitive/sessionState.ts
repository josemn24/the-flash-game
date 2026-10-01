import type { AnswerResult } from "@/types/gameplay/result";
import type { FlashChallenge, PyramidChallenge } from "@/types/gameplay/challenge";
import type { ServerFlashQuestion } from "@/types/gameplay/challenge";

export type ServerFlashPhase =
  | "intro"
  | "recovering"
  | "countdown"
  | "briefing"
  | "preparing"
  | "playing"
  | "checking"
  | "answer-reveal"
  | "transition"
  | "results"
  | "review";

export type AttemptState = { id: string; lockVersion: number };
export type ServerFlashAttemptState = AttemptState;

export type ServerFlashSessionState = {
  phase: ServerFlashPhase;
  attempt: AttemptState | null;
  question: ServerFlashQuestion | null;
  questionIndex: number;
  questionPresentedAt: number | null;
  questionDeadlineAt: number | null;
  results: AnswerResult[];
  lastResult?: AnswerResult;
  score: number;
  reviewChallenge: FlashChallenge | PyramidChallenge | null;
  locked: boolean;
  busy: boolean;
  attemptExpired: boolean;
  startNotice?: string;
  levelNotice?: string;
};

export type ServerFlashSessionEvent =
  | { type: "set_phase"; phase: ServerFlashPhase }
  | { type: "set_attempt"; attempt: AttemptState | null }
  | { type: "set_attempt_expired"; value: boolean }
  | { type: "set_start_notice"; notice?: string }
  | { type: "set_level_notice"; notice?: string }
  | { type: "start_succeeded"; attempt: AttemptState; phase: ServerFlashPhase }
  | {
      type: "recovery_succeeded";
      attempt: AttemptState;
      results: AnswerResult[];
      phase: ServerFlashPhase;
    }
  | { type: "answer_received"; attempt: AttemptState; result: AnswerResult }
  | {
      type: "transition_to_results";
      score: number;
      reviewChallenge: FlashChallenge | PyramidChallenge | null;
    }
  | { type: "expire_attempt" };

export const initialServerFlashSessionState = (
  phase: ServerFlashPhase,
  results: AnswerResult[] = [],
  score = 0,
  reviewChallenge: FlashChallenge | PyramidChallenge | null = null,
): ServerFlashSessionState => ({
  phase,
  attempt: null,
  question: null,
  questionIndex: 0,
  questionPresentedAt: null,
  questionDeadlineAt: null,
  results,
  score,
  reviewChallenge,
  locked: false,
  busy: false,
  attemptExpired: false,
});

export function serverFlashSessionReducer(
  state: ServerFlashSessionState,
  event: ServerFlashSessionEvent,
): ServerFlashSessionState {
  switch (event.type) {
    case "set_phase":
      return { ...state, phase: event.phase };
    case "set_attempt":
      return { ...state, attempt: event.attempt };
    case "set_attempt_expired":
      return { ...state, attemptExpired: event.value };
    case "set_start_notice":
      return { ...state, startNotice: event.notice };
    case "set_level_notice":
      return { ...state, levelNotice: event.notice };
    case "start_succeeded":
      return { ...state, attempt: event.attempt, phase: event.phase, startNotice: undefined };
    case "recovery_succeeded":
      return { ...state, attempt: event.attempt, results: event.results, phase: event.phase };
    case "answer_received":
      return {
        ...state,
        attempt: event.attempt,
        results: [...state.results, event.result],
        lastResult: event.result,
        phase: "transition",
      };
    case "transition_to_results":
      return {
        ...state,
        score: event.score,
        reviewChallenge: event.reviewChallenge,
        phase: "results",
        locked: true,
        busy: false,
      };
    case "expire_attempt":
      return {
        ...state,
        attempt: null,
        question: null,
        questionPresentedAt: null,
        questionDeadlineAt: null,
        reviewChallenge: null,
        score: 0,
        locked: true,
        busy: false,
        attemptExpired: true,
        phase: "results",
      };
  }
}
