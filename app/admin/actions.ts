"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import {
  AuthenticationRequiredError,
  SuperadminAccessDeniedError,
  SuperadminRoomCommandError,
} from "@/application/administration/errors";
import type { CreateRoomInput } from "@/application/ports/superadmin-room-commands";
import { requireSuperadmin } from "@/server/admin";
import {
  lookupSuperadminPlayers as lookupPlayers,
  createSuperadminRoom,
} from "@/server/admin-room";
import type { SuperadminPlayerCandidate } from "@/types/view-models";

export type AdminLookupResult =
  | { readonly ok: true; readonly candidates: readonly SuperadminPlayerCandidate[] }
  | { readonly ok: false; readonly message: string };

export type CreateRoomActionState = {
  readonly message?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const memberRoles = new Set(["admin", "member", "spectator"]);

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 320 && emailPattern.test(email) ? email : null;
}

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function validationState(fieldErrors: Record<string, string>): CreateRoomActionState {
  return { message: "Revisa los datos de la sala.", fieldErrors };
}

function handlePortalBoundary(error: unknown): never {
  if (error instanceof AuthenticationRequiredError) redirect("/");
  if (error instanceof SuperadminAccessDeniedError) notFound();
  throw error;
}

export async function lookupSuperadminPlayers(emails: readonly string[]): Promise<AdminLookupResult> {
  try {
    await requireSuperadmin();
    const normalizedEmails = [...new Set(emails.map(normalizeEmail).filter((email): email is string => Boolean(email)))];
    if (normalizedEmails.length === 0 || normalizedEmails.length !== emails.length) {
      return { ok: false, message: "Introduce un email válido." };
    }
    const candidates = await lookupPlayers(normalizedEmails);
    return { ok: true, candidates };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError || error instanceof SuperadminAccessDeniedError) {
      handlePortalBoundary(error);
    }
    throw error;
  }
}

function parseInput(formData: FormData): { input?: CreateRoomInput; state?: CreateRoomActionState } {
  const title = textValue(formData, "title").trim();
  const description = textValue(formData, "description").trim();
  const timeZone = textValue(formData, "timeZone").trim();
  const ownerEmail = normalizeEmail(textValue(formData, "ownerEmail"));
  const reason = textValue(formData, "reason").trim();
  const idempotencyKey = textValue(formData, "idempotencyKey").trim();
  const memberEmails = formData.getAll("memberEmail");
  const memberRolesInput = formData.getAll("memberRole");
  const fieldErrors: Record<string, string> = {};

  if (title.length < 3 || title.length > 80) fieldErrors.title = "Usa entre 3 y 80 caracteres.";
  if (description.length > 280) fieldErrors.description = "La descripción no puede superar 280 caracteres.";
  if (!timeZone) fieldErrors.timeZone = "Selecciona una zona horaria.";
  if (!ownerEmail) fieldErrors.ownerEmail = "Introduce un email válido.";
  if (reason.length === 0 || reason.length > 500) fieldErrors.reason = "Introduce un motivo de hasta 500 caracteres.";
  if (idempotencyKey.length < 8 || idempotencyKey.length > 160) {
    fieldErrors.form = "No se pudo preparar la operación. Recarga el formulario.";
  }
  if (memberEmails.length !== memberRolesInput.length) {
    fieldErrors.members = "El grupo inicial contiene una fila incompleta.";
  }

  const initialMembers = memberEmails.map((email, index) => ({
    email: normalizeEmail(email),
    role: memberRolesInput[index],
  }));
  if (initialMembers.some((member) => !member.email)) {
    fieldErrors.members = "Todos los emails del grupo deben ser válidos.";
  }
  if (initialMembers.some((member) => typeof member.role !== "string" || !memberRoles.has(member.role))) {
    fieldErrors.members = "Cada miembro debe tener un rol válido.";
  }

  if (Object.keys(fieldErrors).length > 0 || !ownerEmail) return { state: validationState(fieldErrors) };

  return {
    input: {
      idempotencyKey,
      title,
      description,
      timeZone,
      ownerEmail,
      initialMembers: initialMembers as CreateRoomInput["initialMembers"],
      reason,
    },
  };
}

export async function createPrivateRoom(
  _state: CreateRoomActionState,
  formData: FormData,
): Promise<CreateRoomActionState> {
  try {
    await requireSuperadmin();
    const parsed = parseInput(formData);
    if (!parsed.input) return parsed.state ?? { message: "Revisa los datos de la sala." };

    try {
      await createSuperadminRoom(parsed.input);
    } catch (error) {
      if (error instanceof SuperadminRoomCommandError) {
        const field = error.code.includes("owner") ? "ownerEmail" : error.code.includes("member") ? "members" : "form";
        return validationState({ [field]: commandMessage(error.code) });
      }
      throw error;
    }
    revalidatePath("/admin");
    redirect("/admin?created=1");
  } catch (error) {
    if (error instanceof AuthenticationRequiredError || error instanceof SuperadminAccessDeniedError) {
      handlePortalBoundary(error);
    }
    throw error;
  }
}

function commandMessage(code: string) {
  switch (code) {
    case "owner_not_found":
      return "No existe un owner activo con ese email.";
    case "member_not_found":
      return "Uno de los miembros no pertenece a un usuario activo.";
    case "duplicate_member":
      return "No repitas emails en el grupo inicial.";
    case "owner_in_members":
      return "El owner no puede aparecer también como miembro.";
    case "invalid_member_role":
      return "El grupo contiene un rol no permitido.";
    case "idempotency_conflict":
      return "Esta operación ya se usó con otros datos. Recarga el formulario.";
    case "invalid_room_timezone":
      return "La zona horaria no es válida.";
    default:
      return "No se ha podido crear la sala. Inténtalo de nuevo.";
  }
}
