"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import {
  AuthenticationRequiredError,
  SuperadminAttemptCommandError,
  SuperadminAccessDeniedError,
} from "@/application/administration/errors";
import { requireSuperadmin } from "@/server/admin";
import {
  adjustSuperadminAttempt as executeAdjustSuperadminAttempt,
  invalidateSuperadminAttempt as executeInvalidateSuperadminAttempt,
} from "@/server/admin-attempt";

export type AttemptActionState = {
  readonly message?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function parseCommon(formData: FormData) {
  const roomId = textValue(formData, "roomId");
  const scheduledChallengeId = textValue(formData, "scheduledChallengeId");
  const attemptId = textValue(formData, "attemptId");
  const idempotencyKey = textValue(formData, "idempotencyKey");
  const reason = textValue(formData, "reason");
  const lockVersion = Number(textValue(formData, "lockVersion"));
  const fieldErrors: Record<string, string> = {};

  if (!uuidPattern.test(roomId)) fieldErrors.form = "La sala no es válida.";
  if (!uuidPattern.test(scheduledChallengeId)) fieldErrors.form = "La publicación no es válida.";
  if (!uuidPattern.test(attemptId)) fieldErrors.form = "El intento no es válido.";
  if (!Number.isSafeInteger(lockVersion) || lockVersion < 1) {
    fieldErrors.form = "La versión del intento no es válida. Recarga la página.";
  }
  if (idempotencyKey.length < 8 || idempotencyKey.length > 160) {
    fieldErrors.form = "No se pudo preparar la operación. Recarga el formulario.";
  }
  if (reason.length < 1 || reason.length > 500) {
    fieldErrors.reason = "Introduce un motivo de hasta 500 caracteres.";
  }

  return {
    roomId,
    scheduledChallengeId,
    attemptId,
    idempotencyKey,
    reason,
    lockVersion,
    fieldErrors,
  };
}

function handlePortalBoundary(error: unknown): never {
  if (error instanceof AuthenticationRequiredError) redirect("/");
  if (error instanceof SuperadminAccessDeniedError) notFound();
  throw error;
}

function commandMessage(code: string) {
  switch (code) {
    case "attempt_not_terminal":
      return "El intento ya no está en un estado corregible. Recarga la inspección.";
    case "stale_version":
      return "El intento cambió mientras lo inspeccionabas. Recarga la página.";
    case "idempotency_conflict":
      return "Esta operación ya se usó con otros datos. Recarga el formulario.";
    case "reason_required":
      return "El motivo es obligatorio.";
    case "invalid_score":
      return "La puntuación debe estar entre 0 y 100.";
    case "not_competitive":
      return "Solo se pueden operar intentos competitivos.";
    case "not_authorized":
      return "No tienes permisos para esta operación.";
    default:
      return "No se ha podido completar la operación. Inténtalo de nuevo.";
  }
}

export async function adjustSuperadminAttempt(
  _state: AttemptActionState,
  formData: FormData,
): Promise<AttemptActionState> {
  try {
    const access = await requireSuperadmin();
    const parsed = parseCommon(formData);
    const score = Number(textValue(formData, "score"));
    if (!Number.isSafeInteger(score) || score < 0 || score > 100) {
      parsed.fieldErrors.score = "La puntuación debe ser un entero entre 0 y 100.";
    }
    if (Object.keys(parsed.fieldErrors).length > 0) {
      return { message: "Revisa los datos de la corrección.", fieldErrors: parsed.fieldErrors };
    }

    try {
      await executeAdjustSuperadminAttempt(access.authUserId, {
        attemptId: parsed.attemptId,
        lockVersion: parsed.lockVersion,
        reason: parsed.reason,
        idempotencyKey: parsed.idempotencyKey,
        score,
      });
    } catch (error) {
      if (error instanceof SuperadminAttemptCommandError) {
        return { message: commandMessage(error.code) };
      }
      throw error;
    }

    revalidatePath(`/admin/rooms/${parsed.roomId}/attempts`, "layout");
    revalidatePath(`/admin/rooms/${parsed.roomId}`);
    redirect(
      `/admin/rooms/${parsed.roomId}/attempts/${parsed.scheduledChallengeId}/${parsed.attemptId}?updated=1`,
    );
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

export async function invalidateSuperadminAttempt(
  _state: AttemptActionState,
  formData: FormData,
): Promise<AttemptActionState> {
  try {
    const access = await requireSuperadmin();
    const parsed = parseCommon(formData);
    if (Object.keys(parsed.fieldErrors).length > 0) {
      return { message: "Revisa los datos de la invalidación.", fieldErrors: parsed.fieldErrors };
    }

    try {
      await executeInvalidateSuperadminAttempt(access.authUserId, {
        attemptId: parsed.attemptId,
        lockVersion: parsed.lockVersion,
        reason: parsed.reason,
        idempotencyKey: parsed.idempotencyKey,
      });
    } catch (error) {
      if (error instanceof SuperadminAttemptCommandError) {
        return { message: commandMessage(error.code) };
      }
      throw error;
    }

    revalidatePath(`/admin/rooms/${parsed.roomId}/attempts`, "layout");
    revalidatePath(`/admin/rooms/${parsed.roomId}`);
    redirect(
      `/admin/rooms/${parsed.roomId}/attempts/${parsed.scheduledChallengeId}/${parsed.attemptId}?updated=1`,
    );
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
