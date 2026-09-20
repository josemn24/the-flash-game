"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AuthenticationRequiredError,
  SuperadminAccessDeniedError,
  SuperadminSeasonCommandError,
} from "@/application/administration/errors";
import type { SuperadminPortalContext } from "@/types/view-models";
import { localDateTimeToUtc } from "@/lib/zonedDateTime";
import { requireSuperadmin } from "@/server/admin";
import {
  activateSuperadminSeason,
  createSuperadminSeason,
  updateSuperadminSeason,
} from "@/server/admin-season";

export type SeasonActionState = {
  readonly message?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function validationState(fieldErrors: Record<string, string>): SeasonActionState {
  return { message: "Revisa los datos de la temporada.", fieldErrors };
}

function handlePortalBoundary(error: unknown): never {
  if (error instanceof AuthenticationRequiredError) redirect("/");
  if (error instanceof SuperadminAccessDeniedError) redirect("/");
  throw error;
}

function commandMessage(code: string) {
  switch (code) {
    case "room_not_found":
      return "La sala ya no está disponible.";
    case "season_not_found":
      return "La temporada ya no existe. Recarga el portal.";
    case "season_not_draft":
      return "Solo se pueden editar temporadas en borrador.";
    case "season_already_active":
      return "La temporada ya está activa.";
    case "active_season_exists":
      return "La sala ya tiene otra temporada activa.";
    case "invalid_season_dates":
      return "Revisa las fechas y la zona horaria de la sala.";
    case "idempotency_conflict":
      return "Esta operación ya se usó con otros datos. Recarga el formulario.";
    default:
      return "No se ha podido guardar la temporada. Inténtalo de nuevo.";
  }
}

function commandState(error: unknown, field: string): SeasonActionState {
  if (error instanceof SuperadminSeasonCommandError) {
    return validationState({ [field]: commandMessage(error.code) });
  }
  throw error;
}

function findRoom(context: SuperadminPortalContext, roomId: string) {
  return context.rooms.find((room) => room.roomId === roomId) ?? null;
}

function findSeasonRoom(context: SuperadminPortalContext, seasonId: string) {
  for (const room of context.rooms) {
    if (room.seasons.some((season) => season.seasonId === seasonId)) return room;
  }
  return null;
}

function parseCommonFields(formData: FormData) {
  const title = textValue(formData, "title");
  const startsAtLocal = textValue(formData, "startsAtLocal");
  const endsAtLocal = textValue(formData, "endsAtLocal");
  const reason = textValue(formData, "reason");
  const idempotencyKey = textValue(formData, "idempotencyKey");
  const fieldErrors: Record<string, string> = {};

  if (title.length < 3 || title.length > 80) fieldErrors.title = "Usa entre 3 y 80 caracteres.";
  if (!startsAtLocal) fieldErrors.startsAtLocal = "Introduce una fecha de inicio.";
  if (!endsAtLocal) fieldErrors.endsAtLocal = "Introduce una fecha de fin.";
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 160) {
    fieldErrors.form = "No se pudo preparar la operación. Recarga el formulario.";
  }
  if (reason.length === 0 || reason.length > 500)
    fieldErrors.reason = "Introduce un motivo de hasta 500 caracteres.";

  return { title, startsAtLocal, endsAtLocal, reason, idempotencyKey, fieldErrors };
}

function parseUtcWindow(
  startsAtLocal: string,
  endsAtLocal: string,
  timeZone: string,
  fieldErrors: Record<string, string>,
) {
  if (fieldErrors.startsAtLocal || fieldErrors.endsAtLocal) return null;
  try {
    const startsAt = localDateTimeToUtc(startsAtLocal, timeZone);
    const endsAt = localDateTimeToUtc(endsAtLocal, timeZone);
    if (startsAt >= endsAt) {
      fieldErrors.endsAtLocal = "La fecha de fin debe ser posterior al inicio.";
      return null;
    }
    return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
  } catch {
    fieldErrors.startsAtLocal = "La fecha no existe en la zona horaria de la sala.";
    return null;
  }
}

export async function createSeasonDraft(
  _state: SeasonActionState,
  formData: FormData,
): Promise<SeasonActionState> {
  try {
    const access = await requireSuperadmin();
    const roomId = textValue(formData, "roomId");
    const parsed = parseCommonFields(formData);
    if (!uuidPattern.test(roomId)) parsed.fieldErrors.roomId = "Selecciona una sala válida.";
    const room = findRoom(access.context, roomId);
    if (!room) parsed.fieldErrors.roomId = "La sala ya no está disponible.";
    const window = room
      ? parseUtcWindow(parsed.startsAtLocal, parsed.endsAtLocal, room.timeZone, parsed.fieldErrors)
      : null;
    if (!window || Object.keys(parsed.fieldErrors).length > 0)
      return validationState(parsed.fieldErrors);

    try {
      await createSuperadminSeason({
        idempotencyKey: parsed.idempotencyKey,
        roomId,
        title: parsed.title,
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        reason: parsed.reason,
      });
    } catch (error) {
      return commandState(error, "form");
    }
    revalidatePath("/admin");
    revalidatePath("/admin/seasons");
    redirect("/admin/seasons?season=created");
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof SuperadminAccessDeniedError
    ) {
      handlePortalBoundary(error);
    }
    throw error;
  }
}

export async function updateSeasonDraft(
  _state: SeasonActionState,
  formData: FormData,
): Promise<SeasonActionState> {
  try {
    const access = await requireSuperadmin();
    const seasonId = textValue(formData, "seasonId");
    const parsed = parseCommonFields(formData);
    if (!uuidPattern.test(seasonId))
      parsed.fieldErrors.seasonId = "Selecciona una temporada válida.";
    const room = findSeasonRoom(access.context, seasonId);
    if (!room) parsed.fieldErrors.seasonId = "La temporada ya no está disponible.";
    const window = room
      ? parseUtcWindow(parsed.startsAtLocal, parsed.endsAtLocal, room.timeZone, parsed.fieldErrors)
      : null;
    if (!window || Object.keys(parsed.fieldErrors).length > 0)
      return validationState(parsed.fieldErrors);

    try {
      await updateSuperadminSeason({
        idempotencyKey: parsed.idempotencyKey,
        seasonId,
        title: parsed.title,
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        reason: parsed.reason,
      });
    } catch (error) {
      return commandState(error, "form");
    }
    revalidatePath("/admin");
    revalidatePath("/admin/seasons");
    redirect("/admin/seasons?season=updated");
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof SuperadminAccessDeniedError
    ) {
      handlePortalBoundary(error);
    }
    throw error;
  }
}

export async function activateSeason(
  _state: SeasonActionState,
  formData: FormData,
): Promise<SeasonActionState> {
  try {
    await requireSuperadmin();
    const seasonId = textValue(formData, "seasonId");
    const reason = textValue(formData, "reason");
    const idempotencyKey = textValue(formData, "idempotencyKey");
    const fieldErrors: Record<string, string> = {};
    if (!uuidPattern.test(seasonId)) fieldErrors.seasonId = "Selecciona una temporada válida.";
    if (reason.length === 0 || reason.length > 500)
      fieldErrors.reason = "Introduce un motivo de hasta 500 caracteres.";
    if (idempotencyKey.length < 8 || idempotencyKey.length > 160)
      fieldErrors.form = "No se pudo preparar la operación. Recarga el formulario.";
    if (Object.keys(fieldErrors).length > 0) return validationState(fieldErrors);

    try {
      await activateSuperadminSeason({ idempotencyKey, seasonId, reason });
    } catch (error) {
      return commandState(error, "form");
    }
    revalidatePath("/admin");
    revalidatePath("/admin/seasons");
    redirect("/admin/seasons?season=activated");
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof SuperadminAccessDeniedError
    ) {
      handlePortalBoundary(error);
    }
    throw error;
  }
}
