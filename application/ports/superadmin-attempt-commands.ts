export type SuperadminAttemptCommandInput = {
  readonly attemptId: string;
  readonly lockVersion: number;
  readonly reason: string;
  readonly idempotencyKey: string;
};

export type SuperadminAdjustResultInput = SuperadminAttemptCommandInput & {
  /** Absolute target effective score, not a ledger delta. */
  readonly score: number;
};

export type SuperadminAdministrativeResult = {
  readonly attemptId: string;
  readonly lockVersion: number;
  readonly status: "completed" | "abandoned" | "invalidated";
  readonly effectiveScore: number;
};

export type SuperadminAnswerRegradeSelection = {
  readonly attemptId: string;
  readonly challengeItemId: string;
  readonly rubricQuestionVersionId: string;
  readonly lockVersion: number;
};

export type SuperadminAnswerRegradePreview = SuperadminAnswerRegradeSelection & {
  readonly rubricVersionNumber: number;
  readonly originalStatus: "correct" | "partial" | "incorrect";
  readonly originalPoints: number;
  readonly currentStatus: "correct" | "partial" | "incorrect";
  readonly currentPoints: number;
  readonly proposedStatus: "correct" | "partial" | "incorrect";
  readonly proposedPoints: number;
  readonly difference: number;
  readonly currentEffectiveScore: number;
  readonly newEffectiveScore: number;
};

export type SuperadminApplyAnswerRegradeInput = SuperadminAnswerRegradeSelection & {
  readonly reason: string;
  readonly idempotencyKey: string;
};

/** Server evaluator output; this shape never crosses the browser boundary. */
export type SuperadminAnswerRegradeCommandInput = SuperadminApplyAnswerRegradeInput & {
  readonly resultStatus: "correct" | "partial" | "incorrect";
  readonly resultPoints: number;
  readonly resultDetails?: import("@/types/domain/values").JsonValue;
};

export type PurgeTerminalAttemptInput = {
  readonly roomId: string;
  readonly scheduledChallengeId: string;
  readonly attemptId: string;
};

export type TimeoutCheckpointSelection = PurgeTerminalAttemptInput & {
  readonly challengeItemId: string;
  readonly lockVersion: number;
};

export type TimeoutCheckpointPreview = {
  readonly lockVersion: number;
  readonly currentPoints: number;
  readonly proposedPoints: number;
  readonly currentEffectiveScore: number;
  readonly newEffectiveScore: number;
  readonly solvedCount: number;
  readonly totalCount: number;
  readonly lastCorrectElapsedMs: number | null;
  readonly deadlineElapsedMs: number;
  readonly difference: number;
};

export type RecognizeTimeoutCheckpointInput = TimeoutCheckpointSelection & {
  readonly reason: string;
  readonly idempotencyKey: string;
};

export interface SuperadminAttemptCommands {
  purge(input: PurgeTerminalAttemptInput): Promise<string>;
  adjust(input: SuperadminAdjustResultInput): Promise<SuperadminAdministrativeResult>;
  invalidate(input: SuperadminAttemptCommandInput): Promise<SuperadminAdministrativeResult>;
  previewAnswerRegrade(
    input: SuperadminAnswerRegradeSelection,
  ): Promise<SuperadminAnswerRegradePreview>;
  regradeAnswer(input: SuperadminApplyAnswerRegradeInput): Promise<SuperadminAdministrativeResult>;
  previewTimeoutCheckpoint(input: TimeoutCheckpointSelection): Promise<TimeoutCheckpointPreview>;
  recognizeTimeoutCheckpoint(input: RecognizeTimeoutCheckpointInput): Promise<string>;
}
