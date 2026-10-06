import type { AnswerValue } from "@/types/contracts";
import type { AnswerResult } from "@/types/gameplay/result";
import type {
  AlphabetChallenge,
  FlashChallenge,
  PyramidChallenge,
  ServerAlphabetProgress,
  ServerAlphabetQuestion,
  ServerFlashQuestion,
} from "@/types/gameplay/challenge";
import type { CompetitiveAttemptClient } from "../attemptClient";

export type SessionPhase =
  | "intro"
  | "recovering"
  | "countdown"
  | "briefing"
  | "scene"
  | "preparing"
  | "playing"
  | "checking"
  | "finalizing"
  | "answer-reveal"
  | "transition"
  | "results"
  | "review";
export type Attempt = { readonly id: string; readonly lockVersion: number };
export type SessionQuestion = ServerFlashQuestion | ServerAlphabetQuestion;
export type SessionReview = FlashChallenge | PyramidChallenge | AlphabetChallenge;
export type Operation = keyof CompetitiveAttemptClient;
export type PendingCommand = {
  [K in Operation]: {
    readonly operation: K;
    readonly input: Parameters<CompetitiveAttemptClient[K]>[0];
  };
}[Operation];
export type FeedbackChannel =
  "submission" | "answerVerification" | "reveal" | "queens" | "wordSearch";
export type Feedback = {
  channel: FeedbackChannel;
  state: "idle" | "submitting" | "error";
  visible: boolean;
  message?: string;
};
export type LifecycleError = {
  readonly operation: Operation | "projection";
  readonly message: string;
  readonly code?: string;
  readonly retryAt?: number;
  readonly retryable?: boolean;
};
export type SessionState = {
  phase: SessionPhase;
  attempt: Attempt | null;
  question: SessionQuestion | null;
  questionIndex: number;
  stepIndex: number;
  questionPresentedAt: number | null;
  questionDeadlineAt: number | null;
  deadlineAt: number | null;
  progress: ServerAlphabetProgress | null;
  results: AnswerResult[];
  lastResult?: AnswerResult;
  score: number;
  reviewChallenge: SessionReview | null;
  locked: boolean;
  busy: boolean;
  completionRetryScheduled: boolean;
  attemptExpired: boolean;
  pendingCommand: PendingCommand | null;
  lifecycleError?: LifecycleError;
  feedback?: Feedback;
  pendingAnswer: AnswerValue | null;
  startNotice?: string;
  levelNotice?: string;
  lastWordSearchSelection?: {
    readonly startCell: number;
    readonly endCell: number;
    readonly correct: boolean;
  };
};
export type SessionEvent =
  | {
      type: "phase";
      phase: SessionPhase;
      stepIndex?: number;
      questionIndex?: number;
      clearQuestion?: boolean;
    }
  | { type: "command_started"; command: PendingCommand; feedback?: FeedbackChannel }
  | { type: "command_succeeded"; attempt: Attempt | null }
  | {
      type: "command_failed";
      lifecycleError?: LifecycleError;
      feedback?: Feedback;
      definitive?: boolean;
      notice?: string;
    }
  | { type: "authorization_lost"; error: LifecycleError }
  | { type: "feedback_visible" }
  | {
      type: "prepared";
      attempt: Attempt;
      question: SessionQuestion | null;
      questionIndex: number;
      stepIndex: number;
      presentedAt: number | null;
      deadlineAt: number | null;
      progress?: ServerAlphabetProgress;
      phase: SessionPhase;
      locked: boolean;
    }
  | {
      type: "progress";
      question: SessionQuestion;
      selection?: SessionState["lastWordSearchSelection"];
      message?: string;
    }
  | {
      type: "answer_accepted";
      result: AnswerResult;
      phase: SessionPhase;
      question?: SessionQuestion;
    }
  | { type: "recovered"; attempt: Attempt; results: AnswerResult[] }
  | {
      type: "completed";
      reviewPending?: boolean;
      score: number;
      reviewChallenge: SessionReview | null;
      results?: AnswerResult[];
    }
  | { type: "completion_retry"; scheduled: boolean }
  | { type: "expired" }
  | { type: "draft"; answer: AnswerValue | null };

export function initialSessionState(
  phase: SessionPhase,
  results: AnswerResult[] = [],
  score = 0,
  reviewChallenge: SessionReview | null = null,
): SessionState {
  return {
    phase,
    attempt: null,
    question: null,
    questionIndex: 0,
    stepIndex: 0,
    questionPresentedAt: null,
    questionDeadlineAt: null,
    deadlineAt: null,
    progress: null,
    results,
    score,
    reviewChallenge,
    locked: phase === "results" || phase === "recovering",
    busy: false,
    completionRetryScheduled: false,
    attemptExpired: false,
    pendingCommand: null,
    pendingAnswer: null,
  };
}
export function sessionReducer(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case "phase":
      return {
        ...state,
        phase: event.phase,
        stepIndex: event.stepIndex ?? state.stepIndex,
        questionIndex: event.questionIndex ?? state.questionIndex,
        busy: false,
        locked: event.phase !== "playing",
        ...(event.clearQuestion
          ? {
              question: null,
              questionPresentedAt: null,
              questionDeadlineAt: null,
              pendingAnswer: null,
              feedback: undefined,
            }
          : {}),
      };
    case "command_started":
      return {
        ...state,
        pendingCommand: event.command,
        completionRetryScheduled: false,
        busy: event.command.operation !== "queensDraft",
        locked: event.command.operation === "queensDraft" ? state.locked : true,
        lifecycleError: undefined,
        startNotice: undefined,
        levelNotice: undefined,
        feedback: event.feedback
          ? { channel: event.feedback, state: "submitting", visible: false }
          : undefined,
        phase:
          event.command.operation === "answer" && state.phase === "playing"
            ? "checking"
            : state.phase,
      };
    case "command_succeeded":
      return {
        ...state,
        attempt: event.attempt,
        pendingCommand: null,
        busy: false,
        lifecycleError:
          state.lifecycleError?.code === "review_pending" ? state.lifecycleError : undefined,
        feedback: state.feedback?.state === "submitting" ? undefined : state.feedback,
      };
    case "command_failed":
      return {
        ...state,
        busy: false,
        locked: !event.definitive,
        pendingCommand: event.definitive ? null : state.pendingCommand,
        lifecycleError: event.lifecycleError,
        feedback: event.feedback,
        startNotice: event.notice,
        levelNotice: event.notice,
        phase: event.definitive && state.question ? "playing" : state.phase,
      };
    case "authorization_lost":
      return {
        ...initialSessionState("recovering"),
        locked: true,
        lifecycleError: event.error,
      };
    case "feedback_visible":
      return {
        ...state,
        feedback: state.feedback ? { ...state.feedback, visible: true } : undefined,
      };
    case "prepared":
      return {
        ...state,
        attempt: event.attempt,
        question: event.question,
        questionIndex: event.questionIndex,
        stepIndex: event.stepIndex,
        questionPresentedAt: event.presentedAt,
        questionDeadlineAt: event.deadlineAt,
        deadlineAt: event.progress ? event.deadlineAt : state.deadlineAt,
        progress: event.progress ?? state.progress,
        phase: event.phase,
        locked: event.locked,
        busy: false,
        pendingAnswer: null,
        feedback: undefined,
        lastWordSearchSelection: undefined,
      };
    case "progress":
      return {
        ...state,
        question: event.question,
        lastWordSearchSelection: event.selection ?? state.lastWordSearchSelection,
        locked: false,
        busy: false,
        feedback: event.message
          ? { channel: "queens", state: "idle", visible: true, message: event.message }
          : undefined,
      };
    case "answer_accepted": {
      if (state.results.some((answer) => answer.questionId === event.result.questionId))
        return state;
      return {
        ...state,
        results: [...state.results, event.result],
        lastResult: event.result,
        phase: event.phase,
        question: event.question ?? state.question,
        questionDeadlineAt: event.phase === "answer-reveal" ? null : state.questionDeadlineAt,
        pendingAnswer: null,
        locked: true,
        busy: false,
        feedback: undefined,
      };
    }
    case "recovered":
      return {
        ...state,
        attempt: event.attempt,
        results: event.results,
        lastResult: event.results.at(-1),
        pendingCommand: null,
        lifecycleError: undefined,
        feedback: undefined,
        pendingAnswer: null,
      };
    case "completed":
      return {
        ...state,
        phase: "results",
        results: event.results ?? state.results,
        completionRetryScheduled: false,
        score: event.score,
        reviewChallenge: event.reviewChallenge,
        question: null,
        questionPresentedAt: null,
        questionDeadlineAt: null,
        progress: null,
        pendingCommand: null,
        lifecycleError: event.reviewPending
          ? {
              operation: "projection",
              code: "review_pending",
              message: "Revisión temporalmente no disponible. Puedes volver a cargarla.",
            }
          : undefined,
        feedback: undefined,
        locked: true,
        busy: false,
      };
    case "completion_retry":
      return { ...state, completionRetryScheduled: event.scheduled };
    case "expired":
      return {
        ...initialSessionState("results", state.results),
        locked: true,
        attemptExpired: true,
      };
    case "draft":
      return { ...state, pendingAnswer: event.answer };
  }
}
