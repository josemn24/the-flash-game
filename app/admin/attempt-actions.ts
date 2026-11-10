"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import {
  AuthenticationRequiredError,
  SuperadminAttemptCommandError,
  SuperadminAccessDeniedError,
} from "@/application/administration/errors";
import { productionAdminServices } from "@/server/composition/admin";
import { requireSuperadmin } from "@/server/admin";
import {
  adjustSuperadminAttempt as executeAdjustSuperadminAttempt,
  invalidateSuperadminAttempt as executeInvalidateSuperadminAttempt,
} from "@/server/admin-attempt";
import type {
  SuperadminAnswerRegradePreview,
  TimeoutCheckpointPreview,
} from "@/application/ports/superadmin-attempt-commands";

export type AttemptActionState = {
  readonly message?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly preview?: SuperadminAnswerRegradePreview;
  readonly checkpointPreview?: TimeoutCheckpointPreview;
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
    case "invalid_command":
      return "La respuesta, la rúbrica o el ítem ya no se pueden recalcular. Recarga la inspección.";
    case "timeout_checkpoint_unavailable":
      return "Este tablero ya no admite el reconocimiento al vencer. Recarga la inspección.";
    case "not_authorized":
      return "No tienes permisos para esta operación.";
    default:
      return "No se ha podido completar la operación. Inténtalo de nuevo.";
  }
}

function parseItemSelection(formData: FormData) {
  const roomId = textValue(formData, "roomId");
  const scheduledChallengeId = textValue(formData, "scheduledChallengeId");
  const attemptId = textValue(formData, "attemptId");
  const challengeItemId = textValue(formData, "challengeItemId");
  const lockVersion = Number(textValue(formData, "lockVersion"));
  const fieldErrors: Record<string, string> = {};
  if (
    ![roomId, scheduledChallengeId, attemptId, challengeItemId].every((id) => uuidPattern.test(id))
  ) {
    fieldErrors.form = "La selección no es válida. Recarga la inspección.";
  }
  if (!Number.isSafeInteger(lockVersion) || lockVersion < 1) {
    fieldErrors.form = "El intento cambió. Recarga la inspección.";
  }
  return {
    roomId,
    scheduledChallengeId,
    attemptId,
    challengeItemId,
    lockVersion,
    fieldErrors,
  };
}

function parseRegradeSelection(formData: FormData) {
  const selection = parseItemSelection(formData);
  const rubricQuestionVersionId = textValue(formData, "rubricQuestionVersionId");
  if (!uuidPattern.test(rubricQuestionVersionId)) {
    selection.fieldErrors.form = "La selección no es válida. Recarga la inspección.";
  }
  return { ...selection, rubricQuestionVersionId };
}

export async function previewSuperadminTimeoutCheckpoint(
  _state: AttemptActionState,
  formData: FormData,
): Promise<AttemptActionState> {
  try {
    await requireSuperadmin();
    const { fieldErrors, ...input } = parseItemSelection(formData);
    if (Object.keys(fieldErrors).length > 0) {
      return { message: fieldErrors.form, fieldErrors };
    }
    const checkpointPreview =
      await productionAdminServices.commands.previewTimeoutCheckpoint(input);
    return { checkpointPreview };
  } catch (error) {
    if (error instanceof SuperadminAttemptCommandError)
      return { message: commandMessage(error.code) };
    handlePortalBoundary(error);
  }
}

export async function applySuperadminTimeoutCheckpoint(
  _state: AttemptActionState,
  formData: FormData,
): Promise<AttemptActionState> {
  try {
    await requireSuperadmin();
    const { fieldErrors, ...input } = parseItemSelection(formData);
    const reason = textValue(formData, "reason");
    const idempotencyKey = textValue(formData, "idempotencyKey");
    if (reason.length < 1 || reason.length > 500)
      fieldErrors.reason = "Introduce un motivo de hasta 500 caracteres.";
    if (idempotencyKey.length < 8 || idempotencyKey.length > 160)
      fieldErrors.form = "No se pudo preparar la operación. Recarga el formulario.";
    if (Object.keys(fieldErrors).length > 0) {
      return { message: "Revisa los datos de la corrección.", fieldErrors };
    }
    const roomSlug = await productionAdminServices.commands.recognizeTimeoutCheckpoint({
      ...input,
      reason,
      idempotencyKey,
    });
    const listPath = `/admin/rooms/${input.roomId}/attempts/${input.scheduledChallengeId}`;
    const detailPath = `${listPath}/${input.attemptId}`;
    const roomPath = `/salas/${roomSlug}`;
    for (const path of [
      listPath,
      detailPath,
      roomPath,
      `${roomPath}/ranking`,
      `${roomPath}/historial`,
      `${roomPath}/historial/${input.scheduledChallengeId}`,
      `/desafios/${input.scheduledChallengeId}`,
    ])
      revalidatePath(path);
    redirect(`${detailPath}?updated=1`);
  } catch (error) {
    if (error instanceof SuperadminAttemptCommandError)
      return { message: commandMessage(error.code) };
    handlePortalBoundary(error);
  }
}

export async function previewSuperadminAnswerRegrade(
  _state: AttemptActionState,
  formData: FormData,
): Promise<AttemptActionState> {
  try {
    await requireSuperadmin();
    const parsed = parseRegradeSelection(formData);
    if (Object.keys(parsed.fieldErrors).length > 0) {
      return {
        message: "Revisa la selección de pregunta y rúbrica.",
        fieldErrors: parsed.fieldErrors,
      };
    }
    const preview = await productionAdminServices.commands.previewAttemptAnswerRegrade({
      attemptId: parsed.attemptId,
      challengeItemId: parsed.challengeItemId,
      rubricQuestionVersionId: parsed.rubricQuestionVersionId,
      lockVersion: parsed.lockVersion,
    });
    return { preview };
  } catch (error) {
    if (error instanceof SuperadminAttemptCommandError)
      return { message: commandMessage(error.code) };
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof SuperadminAccessDeniedError
    ) {
      handlePortalBoundary(error);
    }
    throw error;
  }
}

export async function applySuperadminAnswerRegrade(
  _state: AttemptActionState,
  formData: FormData,
): Promise<AttemptActionState> {
  try {
    await requireSuperadmin();
    const parsed = parseRegradeSelection(formData);
    const reason = textValue(formData, "reason");
    const idempotencyKey = textValue(formData, "idempotencyKey");
    if (reason.length < 1 || reason.length > 500) {
      parsed.fieldErrors.reason = "Introduce un motivo de hasta 500 caracteres.";
    }
    if (idempotencyKey.length < 8 || idempotencyKey.length > 160) {
      parsed.fieldErrors.form = "No se pudo preparar la operación. Recarga la inspección.";
    }
    if (Object.keys(parsed.fieldErrors).length > 0) {
      return { message: "Revisa los datos del recálculo.", fieldErrors: parsed.fieldErrors };
    }
    await productionAdminServices.commands.regradeAttemptAnswer({
      attemptId: parsed.attemptId,
      challengeItemId: parsed.challengeItemId,
      rubricQuestionVersionId: parsed.rubricQuestionVersionId,
      lockVersion: parsed.lockVersion,
      reason,
      idempotencyKey,
    });
    revalidatePath(`/admin/rooms/${parsed.roomId}/attempts`, "layout");
    revalidatePath(`/admin/rooms/${parsed.roomId}`);
    redirect(
      `/admin/rooms/${parsed.roomId}/attempts/${parsed.scheduledChallengeId}/${parsed.attemptId}?updated=1`,
    );
  } catch (error) {
    if (error instanceof SuperadminAttemptCommandError)
      return { message: commandMessage(error.code) };
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof SuperadminAccessDeniedError
    ) {
      handlePortalBoundary(error);
    }
    throw error;
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

export async function deleteSuperadminAttempt(
  _state: AttemptActionState,
  formData: FormData,
): Promise<AttemptActionState> {
  const roomId = textValue(formData, "roomId");
  const scheduledChallengeId = textValue(formData, "scheduledChallengeId");
  const attemptId = textValue(formData, "attemptId");
  if (![roomId, scheduledChallengeId, attemptId].every((id) => uuidPattern.test(id))) {
    return { message: "La partida no es válida. Recarga la inspección." };
  }

  let roomSlug: string;
  try {
    roomSlug = await productionAdminServices.commands.purgeAttempt({
      roomId,
      scheduledChallengeId,
      attemptId,
    });
  } catch (error) {
    if (error instanceof SuperadminAttemptCommandError) {
      return {
        message:
          error.code === "attempt_not_terminal"
            ? "Solo puedes eliminar partidas que ya han terminado."
            : "No se ha podido eliminar el intento. Recarga la inspección.",
      };
    }
    handlePortalBoundary(error);
  }

  const roomPath = `/salas/${roomSlug}`;
  const adminRoomPath = `/admin/rooms/${roomId}`;
  const listPath = `${adminRoomPath}/attempts/${scheduledChallengeId}`;
  for (const path of [
    adminRoomPath,
    `${adminRoomPath}/measurement`,
    listPath,
    `${listPath}/${attemptId}`,
    roomPath,
    `${roomPath}/ranking`,
    `${roomPath}/introduccion/${scheduledChallengeId}`,
    `${roomPath}/historial`,
    `${roomPath}/historial/${scheduledChallengeId}`,
    `/desafios/${scheduledChallengeId}`,
  ])
    revalidatePath(path);
  redirect(`${listPath}?deleted=1`);
}
