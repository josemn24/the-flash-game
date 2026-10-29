import "server-only";

import { randomUUID } from "node:crypto";
import type {
  CalendarTickRunner,
  CancelScheduledChallengeInput,
  CreateScheduledChallengeInput,
  SuperadminCalendarCommands,
  SuperadminCalendarQueries,
  UpdateScheduledChallengeInput,
} from "@/application/ports/superadmin-calendar-commands";
import {
  SuperadminAccessDeniedError,
  SuperadminCalendarCommandError,
} from "@/application/administration/errors";
import { createClient } from "@/infrastructure/supabase/auth/server-client";
import { createServiceClient } from "@/infrastructure/supabase/auth/service-client";
import { serviceRpcError } from "@/infrastructure/supabase/serviceRpcError";
import type { PublicFunctionArgs, RawRpcResponse } from "@/infrastructure/supabase/rpcTypes";
import { isValidTimeZone } from "@/lib/zonedDateTime";
import type {
  SuperadminCalendarCommandResult,
  SuperadminCalendarContext,
  SuperadminCalendarEntry,
} from "@/types/view-models";
import type { GameMode } from "@/types/domain/content";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statuses = new Set(["scheduled", "open", "closed", "cancelled"]);
const seasonStatuses = new Set(["draft", "scheduled", "active", "finished", "cancelled"]);
const gameModes = new Set<GameMode>([
  "flash",
  "alphabet",
  "survival",
  "narrative",
  "pyramid",
  "time-trial",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function iso(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isGameMode(value: unknown): value is GameMode {
  return typeof value === "string" && gameModes.has(value as GameMode);
}

function isCalendarEntry(value: unknown): value is SuperadminCalendarEntry {
  if (!isRecord(value)) return false;
  return (
    typeof value.scheduledChallengeId === "string" &&
    uuidPattern.test(value.scheduledChallengeId) &&
    typeof value.roomId === "string" &&
    uuidPattern.test(value.roomId) &&
    typeof value.roomSlug === "string" &&
    typeof value.roomTitle === "string" &&
    typeof value.timeZone === "string" &&
    isValidTimeZone(value.timeZone) &&
    typeof value.seasonId === "string" &&
    uuidPattern.test(value.seasonId) &&
    typeof value.seasonTitle === "string" &&
    typeof value.seasonStatus === "string" &&
    seasonStatuses.has(value.seasonStatus) &&
    typeof value.challengeVersionId === "string" &&
    uuidPattern.test(value.challengeVersionId) &&
    typeof value.challengeSlug === "string" &&
    typeof value.versionNumber === "number" &&
    Number.isSafeInteger(value.versionNumber) &&
    value.versionNumber > 0 &&
    typeof value.challengeTitle === "string" &&
    typeof value.challengeSubtitle === "string" &&
    isGameMode(value.mode) &&
    typeof value.number === "number" &&
    Number.isSafeInteger(value.number) &&
    value.number > 0 &&
    typeof value.status === "string" &&
    statuses.has(value.status) &&
    iso(value.opensAt) &&
    iso(value.closesAt) &&
    iso(value.updatedAt)
  );
}

function isCalendarContext(value: unknown): value is Omit<SuperadminCalendarContext, "source"> {
  return isRecord(value) && Array.isArray(value.entries) && value.entries.every(isCalendarEntry);
}

function isCalendarResult(
  value: unknown,
): value is Omit<SuperadminCalendarCommandResult, "source"> {
  return (
    isRecord(value) &&
    typeof value.scheduledChallengeId === "string" &&
    uuidPattern.test(value.scheduledChallengeId) &&
    typeof value.roomId === "string" &&
    uuidPattern.test(value.roomId) &&
    typeof value.seasonId === "string" &&
    uuidPattern.test(value.seasonId) &&
    typeof value.challengeVersionId === "string" &&
    uuidPattern.test(value.challengeVersionId) &&
    typeof value.number === "number" &&
    Number.isSafeInteger(value.number) &&
    value.number > 0 &&
    typeof value.status === "string" &&
    statuses.has(value.status) &&
    iso(value.opensAt) &&
    iso(value.closesAt) &&
    iso(value.updatedAt)
  );
}

function isTickResult(
  value: unknown,
): value is Omit<
  import("@/application/ports/superadmin-calendar-commands").RunCalendarTickResult,
  "source"
> {
  return (
    isRecord(value) &&
    typeof value.runId === "string" &&
    iso(value.evaluatedAt) &&
    typeof value.opened === "number" &&
    Number.isSafeInteger(value.opened) &&
    value.opened >= 0 &&
    typeof value.closed === "number" &&
    Number.isSafeInteger(value.closed) &&
    value.closed >= 0 &&
    typeof value.finishedSeasons === "number" &&
    Number.isSafeInteger(value.finishedSeasons) &&
    value.finishedSeasons >= 0 &&
    typeof value.abandonedAttempts === "number" &&
    Number.isSafeInteger(value.abandonedAttempts) &&
    value.abandonedAttempts >= 0
  );
}

function commandCode(error: { code?: string; message?: string }) {
  if (["28P01", "28000", "42501"].includes(error.code ?? "")) {
    return "database_unavailable";
  }
  const message = error.message ?? "";
  const known = [
    "not_authorized",
    "invalid_command",
    "season_not_found",
    "season_not_active",
    "room_not_found",
    "content_not_found",
    "content_not_published",
    "unsupported_content",
    "invalid_schedule_dates",
    "season_finished",
    "season_start_locked",
    "schedule_finished",
    "opening_reached",
    "competitive_attempt_exists",
    "schedule_outside_season",
    "schedule_not_found",
    "schedule_not_cancellable",
    "schedule_not_editable",
    "schedule_already_open",
    "schedule_number_conflict",
    "schedule_overlap",
    "schedule_conflict",
    "calendar_tick_unauthorized",
    "calendar_tick_invalid",
    "idempotency_conflict",
  ];
  return known.find((candidate) => message.includes(candidate)) ?? error.code ?? "command_failed";
}

async function callCommand<T>(
  functionName:
    | "create_superadmin_scheduled_challenge"
    | "update_superadmin_scheduled_challenge"
    | "cancel_superadmin_scheduled_challenge",
  input:
    CreateScheduledChallengeInput | UpdateScheduledChallengeInput | CancelScheduledChallengeInput,
) {
  const supabase = await createClient();
  const args = { input } as PublicFunctionArgs<typeof functionName>;
  const { data, error } = await supabase.rpc(functionName, args);
  if (error) {
    if (error.code === "42501" || error.message.includes("not_authorized")) {
      throw new SuperadminAccessDeniedError();
    }
    throw new SuperadminCalendarCommandError(commandCode(error), error);
  }
  if (!isCalendarResult(data)) throw new SuperadminCalendarCommandError("invalid_response");
  return { ...data, source: "supabase" as const } as T;
}

export class SupabaseSuperadminCalendarQueries
  implements SuperadminCalendarQueries, SuperadminCalendarCommands, CalendarTickRunner
{
  async getContext(roomId?: string): Promise<SuperadminCalendarContext> {
    const supabase = await createClient();
    const response = roomId
      ? await supabase.rpc("get_superadmin_room_calendar_context", { target_room_id: roomId })
      : await supabase.rpc("get_superadmin_calendar_context");
    const { data, error } = response as RawRpcResponse<typeof response>;
    if (error) {
      if (error.code === "42501" || error.message.includes("not_authorized")) {
        throw new SuperadminAccessDeniedError();
      }
      throw new Error(`Supabase calendar read failed: ${error.message}`);
    }
    if (!isCalendarContext(data))
      throw new Error("Supabase calendar read returned an invalid context payload.");
    return { ...data, source: "supabase" };
  }

  createScheduledChallenge(
    input: CreateScheduledChallengeInput,
  ): Promise<SuperadminCalendarCommandResult> {
    return callCommand("create_superadmin_scheduled_challenge", input);
  }

  updateScheduledChallenge(
    input: UpdateScheduledChallengeInput,
  ): Promise<SuperadminCalendarCommandResult> {
    return callCommand("update_superadmin_scheduled_challenge", input);
  }

  cancelScheduledChallenge(
    input: CancelScheduledChallengeInput,
  ): Promise<SuperadminCalendarCommandResult> {
    return callCommand("cancel_superadmin_scheduled_challenge", input);
  }

  async runCalendarTick() {
    try {
      const { data, error, status } = await Promise.resolve(
        createServiceClient().rpc("run_calendar_tick", { input: { runId: randomUUID() } }),
      ).catch((error: unknown) => {
        throw serviceRpcError(error);
      });
      if (error) throw serviceRpcError(error, status);
      if (!isTickResult(data)) throw new SuperadminCalendarCommandError("invalid_response");
      return { ...data, source: "supabase" as const };
    } catch (error) {
      if (error instanceof SuperadminCalendarCommandError) throw error;
      throw new SuperadminCalendarCommandError(
        commandCode(error as { code?: string; message?: string }),
        error,
      );
    }
  }
}

export const supabaseSuperadminCalendarQueries = new SupabaseSuperadminCalendarQueries();
export const supabaseSuperadminCalendarCommands = supabaseSuperadminCalendarQueries;

export function isSuperadminCalendarContext(value: unknown): value is SuperadminCalendarContext {
  return isCalendarContext(value);
}
