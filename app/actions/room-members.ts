"use server";

import { revalidatePath } from "next/cache";
import {
  isMockRoomRoute,
  isMockRoomRouteEnabled,
  mockRoomMembershipCommands,
} from "@/infrastructure/mock/composition";
import { RoomMembershipCommandError } from "@/application/administration/errors";
import type { RoomMemberManagementAction } from "@/application/ports/room-membership-commands";
import { supabaseRoomMembershipCommands } from "@/infrastructure/supabase/roomMembershipCommands";
import { mocksEnabled } from "@/server/runtime-scope";

export type RoomMemberActionState = {
  readonly ok?: boolean;
  readonly message?: string;
};

const actions = new Set<RoomMemberManagementAction>(["grant_admin", "revoke_admin", "remove"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const mockMemberPattern = /^[a-z][a-z0-9-]*$/;

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function commandMessage(code: string) {
  switch (code) {
    case "not_authorized":
      return "Solo el propietario puede gestionar los miembros.";
    case "member_is_owner":
      return "El propietario no puede modificarse.";
    case "member_not_found":
      return "El miembro ya no está disponible. Recarga la página.";
    case "invalid_member_role":
      return "Ese miembro no puede cambiar a ese rol.";
    case "idempotency_conflict":
      return "La operación ya se utilizó con otros datos. Recarga la página.";
    default:
      return "No se ha podido actualizar la sala. Inténtalo de nuevo.";
  }
}

function errorState(error: unknown): RoomMemberActionState {
  const code =
    error instanceof RoomMembershipCommandError
      ? error.code
      : error instanceof Error
        ? error.message
        : "command_failed";
  return { ok: false, message: commandMessage(code) };
}

export async function manageRoomMember(
  _previousState: RoomMemberActionState,
  formData: FormData,
): Promise<RoomMemberActionState> {
  const roomKey = textValue(formData, "roomKey");
  const targetMemberKey = textValue(formData, "targetMemberKey");
  const action = textValue(formData, "action") as RoomMemberManagementAction;
  const idempotencyKey = textValue(formData, "idempotencyKey");
  const validTarget =
    uuidPattern.test(targetMemberKey) ||
    (isMockRoomRoute(roomKey) && mockMemberPattern.test(targetMemberKey));
  if (
    !roomKey ||
    !validTarget ||
    !actions.has(action) ||
    idempotencyKey.length < 8 ||
    idempotencyKey.length > 160
  ) {
    return { ok: false, message: "No se ha podido preparar la operación. Recarga la página." };
  }

  try {
    const commands =
      isMockRoomRouteEnabled(roomKey) && mocksEnabled()
        ? mockRoomMembershipCommands
        : supabaseRoomMembershipCommands;
    await commands.manageMember({ roomKey, targetMemberKey, action, idempotencyKey });
    revalidatePath(`/salas/${roomKey}/ajustes`);
    revalidatePath(`/salas/${roomKey}`);
    return { ok: true };
  } catch (error) {
    return errorState(error);
  }
}
