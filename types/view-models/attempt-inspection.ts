import type { JsonValue, UtcIsoDateTime } from "@/types/domain/values";

export type SuperadminCompetitiveMode = "flash" | "alphabet" | "survival" | "pyramid";
export type SuperadminAttemptStatus = "in_progress" | "completed" | "abandoned" | "invalidated";

export type SuperadminAttemptPublication = {
  readonly scheduledChallengeId: string;
  readonly roomId: string;
  readonly roomTitle: string;
  readonly seasonId: string;
  readonly seasonTitle: string;
  readonly seasonStatus: string;
  readonly challengeVersionId: string;
  readonly challengeSlug: string;
  readonly versionNumber: number;
  readonly challengeTitle: string;
  readonly challengeSubtitle: string;
  readonly mode: SuperadminCompetitiveMode;
  readonly number: number;
  readonly status: "scheduled" | "open" | "closed" | "cancelled";
  readonly opensAt: UtcIsoDateTime;
  readonly closesAt: UtcIsoDateTime;
  readonly updatedAt: UtcIsoDateTime;
};

export type SuperadminAttemptListRow = {
  readonly attemptId: string;
  readonly playerId: string;
  readonly displayName: string;
  readonly avatarSrc?: string;
  readonly status: SuperadminAttemptStatus;
  readonly outcome: string | null;
  readonly attemptNumber: number;
  readonly startedAt: UtcIsoDateTime;
  readonly deadlineAt: UtcIsoDateTime | null;
  readonly completedAt: UtcIsoDateTime | null;
  readonly originalScore: number | null;
  readonly effectiveScore: number;
  readonly lockVersion: number;
  readonly isCorrected: boolean;
};

export type SuperadminAttemptListModel = {
  readonly operator: { readonly playerId: string; readonly displayName: string };
  readonly roomId: string;
  readonly publication: SuperadminAttemptPublication;
  readonly attempts: readonly SuperadminAttemptListRow[];
  readonly nextCursor: { readonly startedAt: UtcIsoDateTime; readonly attemptId: string } | null;
  readonly source: "supabase";
};

export type SuperadminAttemptItemInspection = {
  readonly challengeItemId: string;
  readonly position: number;
  readonly itemPoints: number;
  readonly questionVersionId: string;
  readonly questionType: string;
  readonly publicPayload: JsonValue;
  readonly answer: JsonValue | null;
  readonly status: "correct" | "partial" | "incorrect" | "unanswered" | "timeout" | null;
  readonly resultDetails: JsonValue | null;
  readonly awardedPoints: number | null;
  readonly presentedAt: UtcIsoDateTime | null;
  readonly submittedAt: UtcIsoDateTime | null;
  readonly timeUsedMs: number | null;
};

export type SuperadminAttemptLedgerEntry = {
  readonly entryId: string;
  readonly entryType: "accreditation" | "adjustment" | "reversal";
  readonly amount: number;
  readonly reason: string | null;
  readonly createdByPlayerId: string | null;
  readonly createdByDisplayName: string | null;
  readonly createdAt: UtcIsoDateTime;
};

export type SuperadminAttemptAuditEntry = {
  readonly auditId: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly reason: string | null;
  readonly requestId: string | null;
  readonly actorPlayerId: string | null;
  readonly actorDisplayName: string | null;
  readonly beforePayload: JsonValue;
  readonly afterPayload: JsonValue;
  readonly createdAt: UtcIsoDateTime;
};

export type SuperadminAttemptInspectionModel = {
  readonly operator: { readonly playerId: string; readonly displayName: string };
  readonly roomId: string;
  readonly publication: SuperadminAttemptPublication;
  readonly attempt: SuperadminAttemptListRow & {
    readonly email: string | null;
    readonly terminalReason: string | null;
  };
  readonly items: readonly SuperadminAttemptItemInspection[];
  readonly ledger: readonly SuperadminAttemptLedgerEntry[];
  readonly audit: readonly SuperadminAttemptAuditEntry[];
  readonly source: "supabase";
};
