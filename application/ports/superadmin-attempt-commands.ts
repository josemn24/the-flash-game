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

export interface SuperadminAttemptCommands {
  adjust(input: SuperadminAdjustResultInput): Promise<SuperadminAdministrativeResult>;
  invalidate(input: SuperadminAttemptCommandInput): Promise<SuperadminAdministrativeResult>;
}
