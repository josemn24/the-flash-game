"use server";

import { revalidatePath } from "next/cache";
import { RoomMembershipCommandError } from "@/application/administration/errors";
import type { RoomMemberManagementAction } from "@/application/ports/room-membership-commands";
import { isValidRoomMemberTarget, manageRoomMemberCommand } from "@/server/room-members";

export type RoomMemberActionState = {
  readonly ok?: boolean;
  readonly message?: string;
};

const actions = new Set<RoomMemberManagementAction>(["grant_admin", "revoke_admin", "remove"]);
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
  const validTarget = isValidRoomMemberTarget(roomKey, targetMemberKey);
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
    await manageRoomMemberCommand({ roomKey, targetMemberKey, action, idempotencyKey });
    revalidatePath(`/salas/${roomKey}/ajustes`);
    revalidatePath(`/salas/${roomKey}`);
    return { ok: true };
  } catch (error) {
    return errorState(error);
  }
}
