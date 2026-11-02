import type { GameMode } from "@/types/domain/content";
import type {
  GameSessionFailure,
  SessionRevision,
  GameSessionOperation,
} from "@/types/contracts/game-session";
import type { AnswerResultDetails } from "@/types/contracts/result-details";
import type {
  TimeTrialProgress,
  RunningTimeTrialProgress,
  TimeTrialResult,
} from "@/types/domain/time-trial";
import type { MiniWordleLetterFeedback } from "@/types/domain/mini-wordle";
import type { AnswerResult, AnswerStatus } from "@/types/gameplay/result";
import type { ReviewState } from "@/types/gameplay/result";
import type { ServerFlashTerminalReview } from "@/types/gameplay/challenge";

/** Public authoritative changes. Solutions belong exclusively to terminal review. */
export type AuthoritativeSessionUpdate = {
  readonly sessionId?: string;
  readonly revision?: SessionRevision;
  readonly ready?: boolean;
  readonly passed?: true;
  readonly resumed?: boolean;
  readonly phase?: string;
  readonly status?: AnswerStatus | "abandoned";
  readonly challengeItemId?: string;
  readonly presentedAt?: string | null;
  readonly deadlineAt?: string | null;
  readonly timedOut?: boolean;
  // Authored format payloads still use the existing question/progress adapters.
  readonly publicPayload?: unknown;
  readonly progress?: unknown;
  readonly answerLength?: number | null;
  readonly timeTrial?: TimeTrialProgress;
  readonly answers?: readonly AnswerResult[];
  readonly resolved?: { readonly challengeItemId: string };
  readonly narrativeCursor?: { readonly currentChallengeItemId?: string | null };
  readonly score?: number;
  readonly terminalReason?: string | null;
  readonly reviewPending?: boolean;
  readonly terminal?: boolean;
  readonly points?: number;
  readonly timeUsedMs?: number;
  readonly details?: AnswerResultDetails;
  readonly reviewState?: ReviewState;
  readonly guess?: string;
  readonly guesses?: readonly string[];
  readonly feedback?: readonly MiniWordleLetterFeedback[];
  readonly attemptsUsed?: number;
  readonly code?: string;
  readonly incorrectAttempts?: number;
  readonly letters?: readonly (string | null)[];
  readonly correctCells?: readonly number[];
  readonly movesUsed?: number;
  readonly movesRemaining?: number;
  readonly clue?: string;
  readonly totalClues?: number;
  readonly cluePenalty?: number;
  readonly revealedClues?: number;
  readonly availablePoints?: number;
  readonly queens?: readonly number[];
  readonly incorrectValidations?: number;
  readonly maxIncorrectValidations?: number | null;
  readonly placedQueens?: number;
  readonly completedRows?: number;
  readonly completedColumns?: number;
  readonly completedRegions?: number;
  readonly conflictingQueens?: number;
  readonly solved?: boolean;
  readonly foundSelections?: readonly {
    readonly targetId: string;
    readonly startCell: number;
    readonly endCell: number;
  }[];
  readonly foundWordIds?: readonly string[];
  readonly foundCount?: number;
  readonly totalWords?: number;
  readonly correct?: boolean;
};
/** Partial assembly only. Providers must decode it before crossing the session port. */
export type SessionResultDraft = {
  readonly kind: "accepted";
  readonly effect: "acknowledged" | "progress" | "evaluated" | "completed";
  readonly state: AuthoritativeSessionUpdate;
  readonly review?: readonly ServerFlashTerminalReview[];
};
type RequiredFields<K extends keyof AuthoritativeSessionUpdate> = {
  readonly [P in K]-?: Exclude<AuthoritativeSessionUpdate[P], undefined>;
};
export type SessionIdentity = RequiredFields<"sessionId" | "revision">;
export type PreparedSessionUpdate = AuthoritativeSessionUpdate &
  SessionIdentity &
  RequiredFields<"challengeItemId" | "presentedAt" | "deadlineAt" | "timedOut"> & {
    readonly publicPayload: unknown;
  };
export type EvaluatedSessionUpdate = AuthoritativeSessionUpdate &
  SessionIdentity &
  RequiredFields<"challengeItemId" | "points" | "timeUsedMs"> & { readonly status: AnswerStatus };
export type CompletedSessionUpdate = AuthoritativeSessionUpdate &
  SessionIdentity &
  RequiredFields<"score"> & { readonly phase: "results" };
type ProgressState<K extends keyof AuthoritativeSessionUpdate> = AuthoritativeSessionUpdate &
  SessionIdentity &
  RequiredFields<"challengeItemId" | K>;
type Acceptance<O extends GameSessionOperation, E extends SessionResultDraft["effect"], S> = {
  readonly kind: "accepted";
  readonly operation: O;
  readonly effect: E;
  readonly state: S;
} & (E extends "completed"
  ? { readonly review?: readonly ServerFlashTerminalReview[] }
  : { readonly review?: never });
type InteractionResult<O extends GameSessionOperation, K extends keyof AuthoritativeSessionUpdate> =
  | Acceptance<O, "progress", ProgressState<K | "terminal"> & { readonly terminal: false }>
  | Acceptance<
      O,
      "evaluated",
      EvaluatedSessionUpdate & RequiredFields<K | "terminal"> & { readonly terminal: true }
    >;
export type SessionAcceptanceByOperation = {
  prepareSession: Acceptance<
    "prepareSession",
    "acknowledged",
    AuthoritativeSessionUpdate & { readonly ready: true }
  >;
  start: Acceptance<
    "start",
    "acknowledged",
    AuthoritativeSessionUpdate & SessionIdentity & RequiredFields<"resumed" | "deadlineAt">
  >;
  takeover: Acceptance<
    "takeover",
    "acknowledged",
    AuthoritativeSessionUpdate & SessionIdentity & RequiredFields<"deadlineAt">
  >;
  prepare: Acceptance<"prepare", "acknowledged", PreparedSessionUpdate>;
  activate: Acceptance<
    "activate",
    "acknowledged",
    AuthoritativeSessionUpdate &
      SessionIdentity &
      RequiredFields<"challengeItemId" | "timedOut"> & {
        readonly presentedAt: string;
        readonly deadlineAt: string;
      }
  >;
  answer: Acceptance<"answer", "evaluated", EvaluatedSessionUpdate>;
  alphabetPass: Acceptance<
    "alphabetPass",
    "acknowledged",
    AuthoritativeSessionUpdate & SessionIdentity & { readonly passed: true }
  >;
  complete: Acceptance<"complete", "completed", CompletedSessionUpdate>;
  abandon: Acceptance<"abandon", "completed", CompletedSessionUpdate>;
  recover:
    | Acceptance<"recover", "completed", CompletedSessionUpdate & RequiredFields<"answers">>
    | Acceptance<
        "recover",
        "acknowledged",
        AuthoritativeSessionUpdate &
          SessionIdentity &
          RequiredFields<"answers"> & {
            readonly phase: "countdown" | "prepare" | "briefing" | "playing";
          }
      >;
  miniWordleGuess: InteractionResult<"miniWordleGuess", "guess" | "feedback" | "attemptsUsed">;
  logicCodeAttempt: InteractionResult<"logicCodeAttempt", "code" | "incorrectAttempts" | "correct">;
  wordHashtagSwap: InteractionResult<
    "wordHashtagSwap",
    "letters" | "correctCells" | "movesUsed" | "movesRemaining"
  >;
  wordSearchSelection: InteractionResult<
    "wordSearchSelection",
    | "foundSelections"
    | "foundWordIds"
    | "foundCount"
    | "totalWords"
    | "incorrectAttempts"
    | "correct"
  >;
  queensValidation: InteractionResult<
    "queensValidation",
    "queens" | "incorrectValidations" | "solved"
  >;
  queensDraft: Acceptance<
    "queensDraft",
    "progress",
    ProgressState<"queens" | "incorrectValidations" | "solved">
  >;
  connectPairsDraft: Acceptance<"connectPairsDraft", "progress", ProgressState<"reviewState">>;
  progressiveClueReveal: Acceptance<
    "progressiveClueReveal",
    "progress",
    ProgressState<"clue" | "revealedClues" | "totalClues" | "availablePoints" | "cluePenalty">
  >;
};
/** Mode-specific requirements supplement the operation discriminator without changing HTTP JSON. */
type TimeTrialClockFor<K extends GameSessionOperation> = K extends "prepare" | "queensValidation"
  ? { readonly timeTrial: RunningTimeTrialProgress }
  : K extends "complete"
    ? { readonly timeTrial: TimeTrialResult }
    : unknown;
type TimeTrialRecoveryState<S> = S extends { readonly phase: "results" }
  ? S &
      (
        | { readonly status: "abandoned"; readonly timeTrial?: TimeTrialProgress }
        | { readonly status?: AnswerStatus; readonly timeTrial: TimeTrialResult }
      )
  : S &
      (
        | { readonly phase: "playing"; readonly timeTrial: RunningTimeTrialProgress }
        | {
            readonly phase: "countdown" | "prepare" | "briefing";
            readonly timeTrial: TimeTrialProgress;
          }
      );
type WithTimeTrial<T, K extends GameSessionOperation> = T extends { readonly state: infer S }
  ? Omit<T, "state"> & {
      readonly state: K extends "recover" ? TimeTrialRecoveryState<S> : S & TimeTrialClockFor<K>;
    }
  : never;
export type TimeTrialSessionAcceptance<K extends GameSessionOperation> = {
  [P in K]: WithTimeTrial<SessionAcceptanceByOperation[P], P>;
}[K];
export type GameSessionAcceptance<
  K extends GameSessionOperation = GameSessionOperation,
  M extends GameMode = GameMode,
> = M extends "time-trial" ? TimeTrialSessionAcceptance<K> : SessionAcceptanceByOperation[K];
export type GameSessionResult<
  K extends GameSessionOperation = GameSessionOperation,
  M extends GameMode = GameMode,
> = GameSessionAcceptance<K, M> | GameSessionFailure;
export type SessionUpdateByOperation<K extends GameSessionOperation> =
  SessionAcceptanceByOperation[K]["state"];
/** Public challenge metadata needed to validate the response, never sent as command input. */
export type GameSessionValidationContext<M extends GameMode = GameMode> = {
  readonly mode: M;
  readonly timeLimitMs?: number;
  readonly items: readonly {
    readonly id: string;
    readonly questionType: import("@/types/contracts/questions").QuestionType;
    readonly payloadSchemaVersion?: number;
    readonly timeLimitMs: number;
    readonly points: number;
    readonly wordHashtagMaxMoves?: number;
  }[];
};
export type GameSessionBootstrap = {
  readonly status: "new" | "inProgress" | "completed";
  readonly results: readonly AnswerResult[];
  readonly score: number;
  readonly timeTrial?: TimeTrialProgress | null;
  readonly review?: readonly ServerFlashTerminalReview[];
};
