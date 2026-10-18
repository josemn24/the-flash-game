import type { GameSessionFailure, SessionRevision } from "@/types/contracts/game-session";
import type { AnswerResultDetails } from "@/types/contracts/result-details";
import type { TimeTrialProgress } from "@/types/domain/time-trial";
import type { MiniWordleLetterFeedback } from "@/types/domain/mini-wordle";
import type { AnswerResult, AnswerStatus } from "@/types/gameplay/result";
import type { ServerFlashTerminalReview } from "@/types/gameplay/challenge";

/** Public authoritative changes. Solutions belong exclusively to terminal review. */
export type AuthoritativeSessionUpdate = {
  readonly sessionId?: string;
  readonly revision?: SessionRevision;
  readonly ready?: boolean;
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
export type GameSessionAcceptance = {
  readonly kind: "accepted";
  readonly state: AuthoritativeSessionUpdate;
} & (
  | {
      /** Evaluated means the interaction ended, not that the session ended. */
      readonly effect: "acknowledged" | "progress" | "evaluated";
      readonly review?: never;
    }
  | {
      readonly effect: "completed";
      readonly review?: readonly ServerFlashTerminalReview[];
    }
);
export type GameSessionResult = GameSessionAcceptance | GameSessionFailure;
export type GameSessionBootstrap = {
  readonly status: "new" | "inProgress" | "completed";
  readonly results: readonly AnswerResult[];
  readonly score: number;
  readonly timeTrial?: TimeTrialProgress | null;
  readonly review?: readonly ServerFlashTerminalReview[];
};
