import "server-only";

import type {
  ActivateSeasonInput,
  CreateSeasonInput,
  SuperadminSeasonCommands,
  UpdateSeasonInput,
} from "@/application/ports/superadmin-season-commands";
import {
  SuperadminAccessDeniedError,
  SuperadminSeasonCommandError,
} from "@/application/administration/errors";
import { createClient } from "@/lib/supabase/server";
import type { SuperadminSeasonCommandResult } from "@/types/view-models";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const seasonStatuses = new Set(["draft", "scheduled", "active", "finished", "cancelled"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSeasonStatus(value: unknown) {
  return typeof value === "string" && seasonStatuses.has(value);
}

function isSeasonResult(value: unknown): value is SuperadminSeasonCommandResult {
  if (!isRecord(value)) return false;
  return (
    typeof value.seasonId === "string" &&
    uuidPattern.test(value.seasonId) &&
    typeof value.roomId === "string" &&
    uuidPattern.test(value.roomId) &&
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    isSeasonStatus(value.status) &&
    typeof value.startsAt === "string" &&
    !Number.isNaN(Date.parse(value.startsAt)) &&
    typeof value.endsAt === "string" &&
    !Number.isNaN(Date.parse(value.endsAt)) &&
    new Date(value.startsAt).getTime() < new Date(value.endsAt).getTime()
  );
}

function commandErrorCode(error: { code?: string; message?: string }) {
  const message = error.message ?? "";
  const candidates = [
    "not_authorized",
    "invalid_command",
    "invalid_season",
    "season_not_found",
    "room_not_found",
    "season_not_draft",
    "active_season_exists",
    "season_already_active",
    "invalid_season_dates",
    "idempotency_conflict",
  ];
  return (
    candidates.find((candidate) => message.includes(candidate)) ?? error.code ?? "command_failed"
  );
}

async function callSeasonCommand<
  T extends CreateSeasonInput | UpdateSeasonInput | ActivateSeasonInput,
>(
  functionName:
    "create_superadmin_season" | "update_superadmin_season" | "activate_superadmin_season",
  input: T,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(functionName, { input });

  if (error) {
    if (error.code === "42501" || error.message.includes("not_authorized")) {
      throw new SuperadminAccessDeniedError();
    }
    throw new SuperadminSeasonCommandError(commandErrorCode(error), error);
  }
  if (!isSeasonResult(data)) {
    throw new SuperadminSeasonCommandError("invalid_response");
  }
  return { ...data, source: "supabase" as const };
}

export class SupabaseSuperadminSeasonCommands implements SuperadminSeasonCommands {
  createSeason(input: CreateSeasonInput) {
    return callSeasonCommand("create_superadmin_season", input);
  }

  updateSeason(input: UpdateSeasonInput) {
    return callSeasonCommand("update_superadmin_season", input);
  }

  activateSeason(input: ActivateSeasonInput) {
    return callSeasonCommand("activate_superadmin_season", input);
  }
}

export const supabaseSuperadminSeasonCommands = new SupabaseSuperadminSeasonCommands();

export function isSuperadminSeasonCommandResult(
  value: unknown,
): value is SuperadminSeasonCommandResult {
  return isSeasonResult(value);
}
