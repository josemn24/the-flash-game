import "server-only";

import type {
  ManageRoomMemberInput,
  ManageRoomMemberResult,
  RoomMemberManagementAction,
  RoomMembershipCommands,
} from "@/application/ports/room-membership-commands";
import { RoomMembershipCommandError } from "@/application/administration/errors";
import { createClient } from "@/lib/supabase/server";
import type { RoomMembershipRole } from "@/types/view-models";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const actions = new Set<RoomMemberManagementAction>(["grant_admin", "revoke_admin", "remove"]);
const roles = new Set<RoomMembershipRole>(["owner", "admin", "member", "spectator"]);
type RpcResult = Omit<ManageRoomMemberResult, "targetMemberKey"> & {
  targetPlayerId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isResult(value: unknown): value is RpcResult {
  return (
    isRecord(value) &&
    typeof value.roomKey === "string" &&
    typeof value.targetPlayerId === "string" &&
    uuidPattern.test(value.targetPlayerId) &&
    typeof value.action === "string" &&
    actions.has(value.action as RoomMemberManagementAction) &&
    typeof value.role === "string" &&
    roles.has(value.role as RoomMembershipRole) &&
    (value.status === "active" || value.status === "removed")
  );
}

function commandCode(error: { code?: string; message?: string }) {
  const known = [
    "not_authorized",
    "room_not_found",
    "member_not_found",
    "member_is_owner",
    "invalid_command",
    "invalid_member_action",
    "invalid_member_role",
    "idempotency_conflict",
  ];
  return (
    known.find((candidate) => error.message?.includes(candidate)) ?? error.code ?? "command_failed"
  );
}

function assertInput(input: ManageRoomMemberInput) {
  if (
    !input ||
    typeof input.roomKey !== "string" ||
    input.roomKey.trim().length === 0 ||
    typeof input.idempotencyKey !== "string" ||
    input.idempotencyKey.length < 8 ||
    input.idempotencyKey.length > 160 ||
    typeof input.targetMemberKey !== "string" ||
    !uuidPattern.test(input.targetMemberKey) ||
    typeof input.action !== "string" ||
    !actions.has(input.action as RoomMemberManagementAction)
  ) {
    throw new RoomMembershipCommandError("invalid_command");
  }
}

export class SupabaseRoomMembershipCommands implements RoomMembershipCommands {
  async manageMember(input: ManageRoomMemberInput): Promise<ManageRoomMemberResult> {
    assertInput(input);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("manage_room_member", {
      input: {
        idempotencyKey: input.idempotencyKey,
        roomKey: input.roomKey,
        targetPlayerId: input.targetMemberKey,
        action: input.action,
      },
    });
    if (error) throw new RoomMembershipCommandError(commandCode(error), error);
    if (!isResult(data)) throw new RoomMembershipCommandError("invalid_response");
    return { ...data, targetMemberKey: data.targetPlayerId };
  }
}

export const supabaseRoomMembershipCommands = new SupabaseRoomMembershipCommands();
