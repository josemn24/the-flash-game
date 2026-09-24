import "server-only";

import type {
  AddSuperadminRoomMemberInput,
  CreateSuperadminPlayerInput,
  SuperadminRoomMemberCommandResult,
  SuperadminUserCommandResult,
  SuperadminUserCommands,
} from "@/application/ports/superadmin-user-commands";
import {
  SuperadminAccessDeniedError,
  SuperadminUserCommandError,
} from "@/application/administration/errors";
import { createClient } from "@/lib/supabase/server";
import { supabaseSuperadminPortalQueries } from "@/infrastructure/supabase/superadminQueries";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function commandCode(error: { code?: string; message?: string }) {
  const known = [
    "not_authorized",
    "invalid_command",
    "invalid_player",
    "player_not_found",
    "room_not_found",
    "member_already_active",
    "member_not_found",
    "member_banned",
    "invalid_member_role",
    "idempotency_conflict",
  ];
  return known.find((code) => error.message?.includes(code)) ?? error.code ?? "command_failed";
}

export class SupabaseSuperadminUserCommands implements SuperadminUserCommands {
  async createPlayer(input: CreateSuperadminPlayerInput): Promise<SuperadminUserCommandResult> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_superadmin_player", { input });
    if (error) {
      if (error.code === "42501") throw new SuperadminAccessDeniedError();
      throw new SuperadminUserCommandError(commandCode(error), error);
    }
    if (
      !isRecord(data) ||
      typeof data.playerId !== "string" ||
      !uuidPattern.test(data.playerId) ||
      typeof data.displayName !== "string"
    ) {
      throw new SuperadminUserCommandError("invalid_response");
    }
    return { playerId: data.playerId, displayName: data.displayName };
  }

  async addRoomMember(
    input: AddSuperadminRoomMemberInput,
  ): Promise<SuperadminRoomMemberCommandResult> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("add_superadmin_room_member", { input });
    if (error) {
      if (error.code === "42501") throw new SuperadminAccessDeniedError();
      throw new SuperadminUserCommandError(commandCode(error), error);
    }
    if (
      !isRecord(data) ||
      typeof data.roomId !== "string" ||
      !uuidPattern.test(data.roomId) ||
      typeof data.playerId !== "string" ||
      !uuidPattern.test(data.playerId) ||
      !["admin", "member", "spectator"].includes(String(data.role)) ||
      data.status !== "active" ||
      typeof data.reactivated !== "boolean"
    ) {
      throw new SuperadminUserCommandError("invalid_response");
    }
    return data as SuperadminRoomMemberCommandResult;
  }

  lookupPlayers(emails: readonly string[]) {
    return supabaseSuperadminPortalQueries.lookupPlayersByEmail(emails);
  }
}

export const supabaseSuperadminUserCommands = new SupabaseSuperadminUserCommands();
