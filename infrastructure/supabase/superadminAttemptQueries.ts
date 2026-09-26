import "server-only";

import type { SuperadminAttemptQueries } from "@/application/queries";
import { SuperadminAccessDeniedError } from "@/application/administration/errors";
import { createClient } from "@/lib/supabase/server";
import { resolveAvatarPath } from "@/lib/media/publicAvatar";
import type {
  SuperadminAttemptAuditEntry,
  SuperadminAttemptItemInspection,
  SuperadminAttemptLedgerEntry,
  SuperadminAttemptListRow,
  SuperadminAttemptPublication,
  SuperadminCompetitiveMode,
  SuperadminAttemptStatus,
} from "@/types/view-models";
import type { JsonValue, UtcIsoDateTime } from "@/types/domain/values";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const modes = new Set<SuperadminCompetitiveMode>(["flash", "alphabet", "survival", "pyramid"]);
const statuses = new Set<SuperadminAttemptStatus>([
  "in_progress",
  "completed",
  "abandoned",
  "invalidated",
]);
const publicationStatuses = new Set(["scheduled", "open", "closed", "cancelled"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function isIso(value: unknown): value is UtcIsoDateTime {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isPublication(value: unknown): value is SuperadminAttemptPublication {
  return (
    isRecord(value) &&
    isUuid(value.scheduledChallengeId) &&
    isUuid(value.roomId) &&
    typeof value.roomTitle === "string" &&
    isUuid(value.seasonId) &&
    typeof value.seasonTitle === "string" &&
    typeof value.seasonStatus === "string" &&
    isUuid(value.challengeVersionId) &&
    typeof value.challengeSlug === "string" &&
    isInteger(value.versionNumber) &&
    value.versionNumber > 0 &&
    typeof value.challengeTitle === "string" &&
    typeof value.challengeSubtitle === "string" &&
    typeof value.mode === "string" &&
    modes.has(value.mode as SuperadminCompetitiveMode) &&
    isInteger(value.number) &&
    value.number > 0 &&
    typeof value.status === "string" &&
    publicationStatuses.has(value.status) &&
    isIso(value.opensAt) &&
    isIso(value.closesAt) &&
    isIso(value.updatedAt)
  );
}

function isAttemptRow(value: unknown): value is SuperadminAttemptListRow {
  return (
    isRecord(value) &&
    isUuid(value.attemptId) &&
    isUuid(value.playerId) &&
    typeof value.displayName === "string" &&
    (value.avatarPath === null || typeof value.avatarPath === "string") &&
    typeof value.status === "string" &&
    statuses.has(value.status as SuperadminAttemptStatus) &&
    (value.outcome === null || typeof value.outcome === "string") &&
    isInteger(value.attemptNumber) &&
    isIso(value.startedAt) &&
    (value.deadlineAt === null || isIso(value.deadlineAt)) &&
    (value.completedAt === null || isIso(value.completedAt)) &&
    (value.originalScore === null || isInteger(value.originalScore)) &&
    isInteger(value.effectiveScore) &&
    isInteger(value.lockVersion) &&
    typeof value.isCorrected === "boolean"
  );
}

function mapAttemptRow(value: Record<string, unknown>): SuperadminAttemptListRow {
  const row = value as unknown as SuperadminAttemptListRow & {
    readonly avatarPath?: string | null;
  };
  return {
    ...row,
    avatarSrc: row.avatarPath ? resolveAvatarPath(row.avatarPath) : undefined,
  };
}

function isItem(value: unknown): value is SuperadminAttemptItemInspection {
  return (
    isRecord(value) &&
    isUuid(value.challengeItemId) &&
    isInteger(value.position) &&
    isInteger(value.itemPoints) &&
    isUuid(value.questionVersionId) &&
    typeof value.questionType === "string" &&
    isJsonValue(value.publicPayload) &&
    (value.answer === null || isJsonValue(value.answer)) &&
    (value.status === null ||
      ["correct", "partial", "incorrect", "unanswered", "timeout"].includes(
        String(value.status),
      )) &&
    (value.resultDetails === null || isJsonValue(value.resultDetails)) &&
    (value.awardedPoints === null || isInteger(value.awardedPoints)) &&
    (value.presentedAt === null || isIso(value.presentedAt)) &&
    (value.submittedAt === null || isIso(value.submittedAt)) &&
    (value.timeUsedMs === null || isInteger(value.timeUsedMs))
  );
}

function isLedgerEntry(value: unknown): value is SuperadminAttemptLedgerEntry {
  return (
    isRecord(value) &&
    isUuid(value.entryId) &&
    ["accreditation", "adjustment", "reversal"].includes(String(value.entryType)) &&
    isInteger(value.amount) &&
    (value.reason === null || typeof value.reason === "string") &&
    (value.createdByPlayerId === null || isUuid(value.createdByPlayerId)) &&
    (value.createdByDisplayName === null || typeof value.createdByDisplayName === "string") &&
    isIso(value.createdAt)
  );
}

function isAuditEntry(value: unknown): value is SuperadminAttemptAuditEntry {
  return (
    isRecord(value) &&
    isUuid(value.auditId) &&
    typeof value.action === "string" &&
    typeof value.entityType === "string" &&
    (value.entityId === null || isUuid(value.entityId)) &&
    (value.reason === null || typeof value.reason === "string") &&
    (value.requestId === null || typeof value.requestId === "string") &&
    (value.actorPlayerId === null || isUuid(value.actorPlayerId)) &&
    (value.actorDisplayName === null || typeof value.actorDisplayName === "string") &&
    isJsonValue(value.beforePayload) &&
    isJsonValue(value.afterPayload) &&
    isIso(value.createdAt)
  );
}

function isListPayload(value: unknown): value is {
  publication: SuperadminAttemptPublication;
  attempts: readonly SuperadminAttemptListRow[];
  nextCursor: { readonly startedAt: UtcIsoDateTime; readonly attemptId: string } | null;
} {
  if (!isRecord(value) || !isPublication(value.publication) || !Array.isArray(value.attempts))
    return false;
  return (
    value.attempts.every(isAttemptRow) &&
    (value.nextCursor === null ||
      (isRecord(value.nextCursor) &&
        isIso(value.nextCursor.startedAt) &&
        isUuid(value.nextCursor.attemptId)))
  );
}

function isDetailPayload(value: unknown): value is {
  publication: SuperadminAttemptPublication;
  attempt: SuperadminAttemptListRow & {
    readonly email: string | null;
    readonly terminalReason: string | null;
  };
  items: readonly SuperadminAttemptItemInspection[];
  ledger: readonly SuperadminAttemptLedgerEntry[];
  audit: readonly SuperadminAttemptAuditEntry[];
} {
  if (!isRecord(value) || !isPublication(value.publication) || !isRecord(value.attempt))
    return false;
  const attempt = value.attempt as Record<string, unknown>;
  if (!isAttemptRow(attempt)) return false;
  const detailAttempt = attempt as SuperadminAttemptListRow & {
    readonly email: string | null;
    readonly terminalReason: string | null;
  };
  return (
    (detailAttempt.email === null || typeof detailAttempt.email === "string") &&
    (detailAttempt.terminalReason === null || typeof detailAttempt.terminalReason === "string") &&
    Array.isArray(value.items) &&
    value.items.every(isItem) &&
    Array.isArray(value.ledger) &&
    value.ledger.every(isLedgerEntry) &&
    Array.isArray(value.audit) &&
    value.audit.every(isAuditEntry)
  );
}

export class SupabaseSuperadminAttemptQueries implements SuperadminAttemptQueries {
  async listPublications(roomId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_superadmin_attempt_publications", {
      target_room_id: roomId,
    });
    if (error) {
      if (error.code === "42501") throw new SuperadminAccessDeniedError();
      throw new Error(`Supabase attempt publications read failed: ${error.message}`);
    }
    if (data === null) return null;
    if (!isRecord(data) || !Array.isArray(data.entries) || !data.entries.every(isPublication)) {
      throw new Error("Supabase attempt publications read returned an invalid payload.");
    }
    return data.entries;
  }

  async listAttempts(
    roomId: string,
    scheduledChallengeId: string,
    cursor: { readonly startedAt: string; readonly attemptId: string } | null = null,
  ) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_superadmin_room_attempts", {
      target_room_id: roomId,
      target_scheduled_challenge_id: scheduledChallengeId,
      cursor_started_at: cursor?.startedAt ?? null,
      cursor_attempt_id: cursor?.attemptId ?? null,
      page_size: 50,
    });
    if (error) {
      if (error.code === "42501") throw new SuperadminAccessDeniedError();
      throw new Error(`Supabase attempt list read failed: ${error.message}`);
    }
    if (data === null) return null;
    if (!isListPayload(data))
      throw new Error("Supabase attempt list read returned an invalid payload.");
    return {
      roomId,
      publication: data.publication,
      attempts: data.attempts.map((attempt) =>
        mapAttemptRow(attempt as unknown as Record<string, unknown>),
      ),
      nextCursor: data.nextCursor,
    };
  }

  async getInspection(roomId: string, scheduledChallengeId: string, attemptId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_superadmin_attempt_inspection", {
      target_room_id: roomId,
      target_scheduled_challenge_id: scheduledChallengeId,
      target_attempt_id: attemptId,
    });
    if (error) {
      if (error.code === "42501") throw new SuperadminAccessDeniedError();
      throw new Error(`Supabase attempt inspection read failed: ${error.message}`);
    }
    if (data === null) return null;
    if (!isDetailPayload(data))
      throw new Error("Supabase attempt inspection returned an invalid payload.");
    return {
      roomId,
      publication: data.publication,
      attempt: {
        ...mapAttemptRow(data.attempt as unknown as Record<string, unknown>),
        email: data.attempt.email,
        terminalReason: data.attempt.terminalReason,
      },
      items: data.items,
      ledger: data.ledger,
      audit: data.audit,
    };
  }
}

export const supabaseSuperadminAttemptQueries = new SupabaseSuperadminAttemptQueries();
