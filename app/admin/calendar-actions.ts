"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AuthenticationRequiredError,
  SuperadminAccessDeniedError,
  SuperadminCalendarCommandError,
} from "@/application/administration/errors";
import { localDateTimeToUtc } from "@/lib/zonedDateTime";
import { requireSuperadmin } from "@/server/admin";
import {
  createScheduledChallenge as createScheduledChallengeCommand,
  updateScheduledChallenge as updateScheduledChallengeCommand,
} from "@/server/admin-calendar";
import { getSuperadminCalendarContext } from "@/server/admin-calendar";
import type { SuperadminPortalContext } from "@/types/view-models";

export type CalendarActionState = {
  readonly message?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function validationState(fieldErrors: Record<string, string>): CalendarActionState {
  return { message: "Revisa los datos de la programación.", fieldErrors };
}

function handlePortalBoundary(error: unknown): never {
  if (
    error instanceof AuthenticationRequiredError ||
    error instanceof SuperadminAccessDeniedError
  ) {
    redirect("/");
  }
  throw error;
}

function commandMessage(code: string) {
  switch (code) {
    case "season_not_found":
      return "La temporada ya no existe. Recarga el portal.";
    case "season_not_active":
      return "La temporada debe estar activa.";
    case "room_not_found":
      return "La sala ya no está disponible.";
    case "content_not_found":
      return "El contenido ya no existe. Recarga el portal.";
    case "content_not_published":
      return "Selecciona contenido publicado.";
    case "unsupported_content":
      return "Solo se puede programar Flash publicado compatible.";
    case "invalid_schedule_dates":
      return "La ventana no es válida o queda fuera de la temporada.";
    case "schedule_not_found":
      return "La publicación ya no existe. Recarga el portal.";
    case "schedule_already_open":
      return "La publicación ya ha comenzado y no se puede reprogramar.";
    case "schedule_not_editable":
      return "Solo se pueden reprogramar publicaciones futuras.";
    case "schedule_number_conflict":
      return "Ese número ya está ocupado en la temporada.";
    case "schedule_overlap":
      return "La ventana se solapa con otra publicación.";
    case "schedule_conflict":
      return "La publicación cambió en otra pestaña. Recarga antes de guardar.";
    case "idempotency_conflict":
      return "Esta operación ya se usó con otros datos. Recarga el formulario.";
    default:
      return "No se ha podido guardar la programación. Inténtalo de nuevo.";
  }
}

function commandState(error: unknown): CalendarActionState {
  if (error instanceof SuperadminCalendarCommandError) {
    return validationState({ form: commandMessage(error.code) });
  }
  throw error;
}

function findSeasonRoom(context: SuperadminPortalContext, seasonId: string) {
  for (const room of context.rooms) {
    if (room.seasons.some((season) => season.seasonId === seasonId)) return room;
  }
  return null;
}

function parseCommon(formData: FormData) {
  const idempotencyKey = textValue(formData, "idempotencyKey");
  const reason = textValue(formData, "reason");
  const numberText = textValue(formData, "number");
  const opensAtLocal = textValue(formData, "opensAtLocal");
  const closesAtLocal = textValue(formData, "closesAtLocal");
  const challengeVersionId = textValue(formData, "challengeVersionId");
  const fieldErrors: Record<string, string> = {};
  const number = Number(numberText);
  if (!uuidPattern.test(challengeVersionId))
    fieldErrors.challengeVersionId = "Selecciona contenido publicado.";
  if (!Number.isSafeInteger(number) || number <= 0)
    fieldErrors.number = "Usa un número entero positivo.";
  if (!opensAtLocal) fieldErrors.opensAtLocal = "Introduce la apertura.";
  if (!closesAtLocal) fieldErrors.closesAtLocal = "Introduce el cierre.";
  if (idempotencyKey.length < 8 || idempotencyKey.length > 160)
    fieldErrors.form = "Recarga el formulario para preparar la operación.";
  if (reason.length === 0 || reason.length > 500)
    fieldErrors.reason = "Introduce un motivo de hasta 500 caracteres.";
  return {
    idempotencyKey,
    reason,
    number,
    challengeVersionId,
    opensAtLocal,
    closesAtLocal,
    fieldErrors,
  };
}

function parseWindow(parsed: ReturnType<typeof parseCommon>, timeZone: string) {
  if (parsed.fieldErrors.opensAtLocal || parsed.fieldErrors.closesAtLocal) return null;
  try {
    const opensAt = localDateTimeToUtc(parsed.opensAtLocal, timeZone);
    const closesAt = localDateTimeToUtc(parsed.closesAtLocal, timeZone);
    if (opensAt >= closesAt) {
      parsed.fieldErrors.closesAtLocal = "El cierre debe ser posterior a la apertura.";
      return null;
    }
    return { opensAt: opensAt.toISOString(), closesAt: closesAt.toISOString() };
  } catch {
    parsed.fieldErrors.opensAtLocal = "La fecha no existe en la zona horaria de la sala.";
    return null;
  }
}

export async function createScheduledChallenge(
  _state: CalendarActionState,
  formData: FormData,
): Promise<CalendarActionState> {
  try {
    const access = await requireSuperadmin();
    const seasonId = textValue(formData, "seasonId");
    const parsed = parseCommon(formData);
    if (!uuidPattern.test(seasonId))
      parsed.fieldErrors.seasonId = "Selecciona una temporada activa.";
    const room = findSeasonRoom(access.context, seasonId);
    const season = room?.seasons.find((candidate) => candidate.seasonId === seasonId);
    if (!room || !season || season.status !== "active")
      parsed.fieldErrors.seasonId = "Selecciona una temporada activa.";
    const window = room ? parseWindow(parsed, room.timeZone) : null;
    if (!window || Object.keys(parsed.fieldErrors).length > 0)
      return validationState(parsed.fieldErrors);
    if (!room) return validationState({ seasonId: "La sala ya no está disponible." });
    try {
      await createScheduledChallengeCommand({
        idempotencyKey: parsed.idempotencyKey,
        seasonId,
        challengeVersionId: parsed.challengeVersionId,
        number: parsed.number,
        opensAt: window.opensAt,
        closesAt: window.closesAt,
        reason: parsed.reason,
      });
    } catch (error) {
      return commandState(error);
    }
    revalidatePath("/admin");
    revalidatePath("/admin/rooms");
    revalidatePath(`/admin/rooms/${room.roomId}`);
    redirect(`/admin/rooms/${room.roomId}?tab=calendar&calendar=created`);
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof SuperadminAccessDeniedError
    )
      handlePortalBoundary(error);
    throw error;
  }
}

export async function updateScheduledChallenge(
  _state: CalendarActionState,
  formData: FormData,
): Promise<CalendarActionState> {
  try {
    const access = await requireSuperadmin();
    const roomId = textValue(formData, "roomId");
    const scheduledChallengeId = textValue(formData, "scheduledChallengeId");
    const expectedUpdatedAt = textValue(formData, "expectedUpdatedAt");
    const context = uuidPattern.test(roomId) ? await getSuperadminCalendarContext(roomId) : null;
    const entry = context?.entries.find(
      (candidate) => candidate.scheduledChallengeId === scheduledChallengeId,
    );
    const parsed = parseCommon(formData);
    if (!uuidPattern.test(roomId)) parsed.fieldErrors.roomId = "La sala no es válida.";
    if (!uuidPattern.test(scheduledChallengeId) || !entry)
      parsed.fieldErrors.scheduledChallengeId = "Selecciona una publicación futura.";
    if (!expectedUpdatedAt || Number.isNaN(Date.parse(expectedUpdatedAt)))
      parsed.fieldErrors.expectedUpdatedAt =
        "La publicación está desactualizada. Recarga el portal.";
    const room = entry
      ? access.context.rooms.find((candidate) => candidate.roomId === entry.roomId)
      : null;
    const window = room ? parseWindow(parsed, room.timeZone) : null;
    if (!window || Object.keys(parsed.fieldErrors).length > 0)
      return validationState(parsed.fieldErrors);
    if (!room) return validationState({ roomId: "La sala ya no está disponible." });
    try {
      await updateScheduledChallengeCommand({
        idempotencyKey: parsed.idempotencyKey,
        scheduledChallengeId,
        expectedUpdatedAt,
        challengeVersionId: parsed.challengeVersionId,
        number: parsed.number,
        opensAt: window.opensAt,
        closesAt: window.closesAt,
        reason: parsed.reason,
      });
    } catch (error) {
      return commandState(error);
    }
    revalidatePath("/admin");
    revalidatePath("/admin/rooms");
    revalidatePath(`/admin/rooms/${room.roomId}`);
    redirect(`/admin/rooms/${room.roomId}?tab=calendar&calendar=updated`);
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof SuperadminAccessDeniedError
    )
      handlePortalBoundary(error);
    throw error;
  }
}
