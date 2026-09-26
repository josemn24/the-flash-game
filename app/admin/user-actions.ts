"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AuthenticationRequiredError,
  SuperadminAccessDeniedError,
  SuperadminUserCommandError,
} from "@/application/administration/errors";
import { validateProfileName } from "@/lib/userProfile";
import { requireSuperadmin } from "@/server/admin";
import {
  addSuperadminRoomMember as addRoomMemberCommand,
  createSuperadminPlayerAccount,
  lookupSuperadminPlayers as lookupPlayers,
} from "@/server/admin-users";
import type { SuperadminPlayerCandidate } from "@/types/view-models";

export type SuperadminUserActionState = {
  readonly ok?: boolean;
  readonly message?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const memberRoles = new Set(["admin", "member", "spectator"]);

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function fieldError(fieldErrors: Record<string, string>): SuperadminUserActionState {
  return { ok: false, message: "Revisa los datos de la operación.", fieldErrors };
}

function boundary(error: unknown): never {
  if (error instanceof AuthenticationRequiredError) redirect("/");
  if (error instanceof SuperadminAccessDeniedError) redirect("/");
  throw error;
}

function commandMessage(code: string) {
  switch (code) {
    case "email_already_registered":
      return "Ya existe una cuenta con ese correo.";
    case "password_rejected":
      return "La contraseña no cumple los requisitos de Auth. Elige otra contraseña.";
    case "idempotency_conflict":
      return "La operación ya se usó con otros datos. Recarga el formulario.";
    case "member_already_active":
      return "Ese usuario ya pertenece a la sala.";
    case "member_banned":
      return "No se puede reactivar una membresía bloqueada.";
    case "player_not_found":
      return "No hay un jugador activo con ese correo.";
    case "room_not_found":
      return "La sala ya no está disponible.";
    case "rate_limited":
      return "Se han realizado demasiadas operaciones seguidas. Espera un momento.";
    case "auth_unavailable":
      return "No se ha podido crear la cuenta en Auth. Inténtalo de nuevo con el mismo formulario.";
    default:
      return "No se ha podido completar la operación. Inténtalo de nuevo.";
  }
}

function actionError(error: unknown, field = "form"): SuperadminUserActionState {
  const code = error instanceof SuperadminUserCommandError ? error.code : "command_failed";
  return fieldError({ [field]: commandMessage(code) });
}

export async function createPortalUser(
  _previousState: SuperadminUserActionState,
  formData: FormData,
): Promise<SuperadminUserActionState> {
  try {
    const access = await requireSuperadmin();
    const email = normalizeEmail(textValue(formData, "email"));
    const password = textValue(formData, "password");
    const displayName = textValue(formData, "displayName").trim();
    const reason = textValue(formData, "reason").trim();
    const idempotencyKey = textValue(formData, "idempotencyKey").trim();
    const fieldErrors: Record<string, string> = {};

    if (email.length > 320 || !emailPattern.test(email))
      fieldErrors.email = "Introduce un correo válido.";
    if (password.length < 8 || password.length > 128) {
      fieldErrors.password = "Usa una contraseña de entre 8 y 128 caracteres.";
    }
    const nameError = validateProfileName(displayName);
    if (nameError) fieldErrors.displayName = nameError;
    if (reason.length === 0 || reason.length > 500) {
      fieldErrors.reason = "Introduce un motivo de hasta 500 caracteres.";
    }
    if (idempotencyKey.length < 8 || idempotencyKey.length > 160) {
      fieldErrors.form = "No se pudo preparar la operación. Recarga el formulario.";
    }
    if (Object.keys(fieldErrors).length > 0) return fieldError(fieldErrors);

    try {
      await createSuperadminPlayerAccount({
        idempotencyKey,
        email,
        password,
        displayName,
        reason,
        actorPlayerId: access.actor.playerId,
      });
    } catch (error) {
      const field =
        error instanceof SuperadminUserCommandError
          ? error.code === "email_already_registered"
            ? "email"
            : error.code === "password_rejected"
              ? "password"
              : "form"
          : "form";
      return actionError(error, field);
    }

    revalidatePath("/admin");
    revalidatePath("/admin/users");
    revalidatePath("/admin/rooms");
    return {
      ok: true,
      message: "Cuenta creada y perfil preparado. No se ha enviado ningún correo.",
    };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof SuperadminAccessDeniedError
    )
      boundary(error);
    throw error;
  }
}

export async function lookupPortalUserByEmail(
  email: string,
): Promise<
  | { readonly ok: true; readonly candidate: SuperadminPlayerCandidate | null }
  | { readonly ok: false; readonly message: string }
> {
  try {
    await requireSuperadmin();
    const normalizedEmail = normalizeEmail(email);
    if (normalizedEmail.length > 320 || !emailPattern.test(normalizedEmail)) {
      return { ok: false, message: "Introduce un correo válido." };
    }
    const candidates = await lookupPlayers([normalizedEmail]);
    return {
      ok: true,
      candidate: candidates.find((candidate) => candidate.email === normalizedEmail) ?? null,
    };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof SuperadminAccessDeniedError
    )
      boundary(error);
    throw error;
  }
}

export async function addPortalUserToRoom(
  _previousState: SuperadminUserActionState,
  formData: FormData,
): Promise<SuperadminUserActionState> {
  try {
    const access = await requireSuperadmin();
    const roomId = textValue(formData, "roomId").trim();
    const targetPlayerId = textValue(formData, "targetPlayerId").trim();
    const role = textValue(formData, "role").trim();
    const reason = textValue(formData, "reason").trim();
    const idempotencyKey = textValue(formData, "idempotencyKey").trim();
    const fieldErrors: Record<string, string> = {};

    if (!uuidPattern.test(roomId) || !access.context.rooms.some((room) => room.roomId === roomId)) {
      fieldErrors.roomId = "La sala no está disponible.";
    }
    if (!uuidPattern.test(targetPlayerId)) fieldErrors.targetPlayerId = "Busca un usuario activo.";
    if (!memberRoles.has(role)) fieldErrors.role = "Selecciona un rol válido.";
    if (reason.length === 0 || reason.length > 500)
      fieldErrors.reason = "Introduce un motivo de hasta 500 caracteres.";
    if (idempotencyKey.length < 8 || idempotencyKey.length > 160) {
      fieldErrors.form = "No se pudo preparar la operación. Recarga el formulario.";
    }
    if (Object.keys(fieldErrors).length > 0) return fieldError(fieldErrors);

    try {
      await addRoomMemberCommand({
        idempotencyKey,
        roomId,
        targetPlayerId,
        role: role as "admin" | "member" | "spectator",
        reason,
      });
    } catch (error) {
      return actionError(error, "form");
    }

    revalidatePath("/admin");
    revalidatePath("/admin/rooms");
    revalidatePath(`/admin/rooms/${roomId}`);
    redirect(`/admin/rooms/${roomId}?tab=members&member=added`);
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof SuperadminAccessDeniedError
    )
      boundary(error);
    throw error;
  }
}
