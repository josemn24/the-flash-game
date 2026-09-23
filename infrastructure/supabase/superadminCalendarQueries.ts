import "server-only";

import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type {
  CalendarTickRunner,
  CreateScheduledChallengeInput,
  SuperadminCalendarCommands,
  SuperadminCalendarQueries,
  UpdateScheduledChallengeInput,
} from "@/application/ports/superadmin-calendar-commands";
import {
  SuperadminAccessDeniedError,
  SuperadminCalendarCommandError,
} from "@/application/administration/errors";
import { createClient } from "@/lib/supabase/server";
import { isValidTimeZone } from "@/lib/zonedDateTime";
import type {
  SuperadminCalendarCommandResult,
  SuperadminCalendarContext,
  SuperadminCalendarEntry,
} from "@/types/view-models";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statuses = new Set(["scheduled", "open", "closed", "cancelled"]);
const seasonStatuses = new Set(["draft", "scheduled", "active", "finished", "cancelled"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function iso(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
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
    (value.mode === "flash" || value.mode === "survival" || value.mode === "pyramid") &&
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
    value.finishedSeasons >= 0
  );
}

function commandCode(error: { code?: string; message?: string }) {
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
    "schedule_not_found",
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
  functionName: "create_superadmin_scheduled_challenge" | "update_superadmin_scheduled_challenge",
  input: CreateScheduledChallengeInput | UpdateScheduledChallengeInput,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(functionName, { input });
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
    const { data, error } = roomId
      ? await supabase.rpc("get_superadmin_room_calendar_context", { target_room_id: roomId })
      : await supabase.rpc("get_superadmin_calendar_context");
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

  async runCalendarTick() {
    const configured = process.env.SUPABASE_DB_URL;
    if (!configured) throw new SuperadminCalendarCommandError("database_unavailable");
    let connectionString: string;
    try {
      const url = new URL(configured);
      url.username = "authenticator";
      connectionString = url.toString();
    } catch (error) {
      throw new SuperadminCalendarCommandError("database_unavailable", error);
    }
    const pool = new Pool({
      connectionString,
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      application_name: "the-flash-game-calendar-tick",
    });
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE service_role");
      const result = await client.query<{ result: unknown }>(
        "select private.run_calendar_tick_command($1::jsonb) as result",
        [JSON.stringify({ runId: randomUUID() })],
      );
      await client.query("COMMIT");
      if (!isTickResult(result.rows[0]?.result))
        throw new SuperadminCalendarCommandError("invalid_response");
      return { ...result.rows[0].result, source: "supabase" as const };
    } catch (error) {
      try {
        await client?.query("ROLLBACK");
      } catch {
        /* preserve the original failure */
      }
      if (error instanceof SuperadminCalendarCommandError) throw error;
      throw new SuperadminCalendarCommandError(
        commandCode(error as { code?: string; message?: string }),
        error,
      );
    } finally {
      client?.release();
      await pool.end();
    }
  }
}

export const supabaseSuperadminCalendarQueries = new SupabaseSuperadminCalendarQueries();
export const supabaseSuperadminCalendarCommands = supabaseSuperadminCalendarQueries;

export function isSuperadminCalendarContext(value: unknown): value is SuperadminCalendarContext {
  return isCalendarContext(value);
}
