"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import {
  AuthenticationRequiredError,
  SuperadminAccessDeniedError,
  SuperadminEditorialCommandError,
} from "@/application/administration/errors";
import {
  FlashEditorialValidationError,
  parseFlashEditorialJson,
} from "@/lib/editorial/flashDocument";
import { requireSuperadmin } from "@/server/admin";
import {
  createSuperadminFlashDraft,
  publishSuperadminFlash,
  updateSuperadminFlashDraft,
} from "@/server/admin-editorial";

export type EditorialActionState = {
  readonly message?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function validationState(fieldErrors: Record<string, string>): EditorialActionState {
  return { message: "Revisa el contenido editorial.", fieldErrors };
}

function handlePortalBoundary(error: unknown): never {
  if (error instanceof AuthenticationRequiredError) redirect("/");
  if (error instanceof SuperadminAccessDeniedError) notFound();
  throw error;
}

function commandMessage(code: string) {
  switch (code) {
    case "invalid_content":
    case "invalid_public_payload":
    case "invalid_solution_payload":
    case "incomplete_content":
      return "El JSON no cumple el contrato Flash mínimo.";
    case "invalid_question_reference":
      return "La referencia de biblioteca no es válida o está duplicada.";
    case "question_not_published":
      return "El desafío solo puede seleccionar versiones de pregunta publicadas.";
    case "unsupported_mode":
    case "unsupported_question_type":
    case "unsupported_schema_version":
      return "Este formato todavía no está soportado por el editor.";
    case "content_not_found":
      return "El contenido ya no existe. Recarga el portal.";
    case "content_not_draft":
      return "Solo se pueden editar borradores.";
    case "content_already_published":
      return "El contenido ya está publicado.";
    case "content_conflict":
      return "El borrador cambió en otra pestaña. Recarga antes de guardar o publicar.";
    case "content_slug_conflict":
      return "El slug del desafío o de una pregunta ya está en uso.";
    case "points_total_invalid":
      return "Las preguntas deben sumar 100 puntos.";
    case "idempotency_conflict":
      return "Esta operación ya se usó con otros datos. Recarga el editor.";
    default:
      return "No se ha podido guardar el contenido. Inténtalo de nuevo.";
  }
}

function parseDocument(formData: FormData, fieldErrors: Record<string, string>) {
  const source = textValue(formData, "document");
  if (source.length === 0) {
    fieldErrors.document = "Introduce el documento JSON.";
    return null;
  }
  if (new TextEncoder().encode(source).byteLength > 256 * 1024) {
    fieldErrors.document = "El documento supera el límite de 256 KiB.";
    return null;
  }
  try {
    return parseFlashEditorialJson(source);
  } catch (error) {
    fieldErrors.document =
      error instanceof FlashEditorialValidationError
        ? (error.issues[0] ?? "El JSON no cumple el contrato editorial.")
        : "El documento no contiene JSON válido.";
    return null;
  }
}

function parseCommon(formData: FormData) {
  const idempotencyKey = textValue(formData, "idempotencyKey").trim();
  const reason = textValue(formData, "reason").trim();
  const fieldErrors: Record<string, string> = {};
  if (idempotencyKey.length < 8 || idempotencyKey.length > 160) {
    fieldErrors.form = "No se pudo preparar la operación. Recarga el editor.";
  }
  if (reason.length === 0 || reason.length > 500) {
    fieldErrors.reason = "Introduce un motivo de hasta 500 caracteres.";
  }
  return { idempotencyKey, reason, fieldErrors };
}

function commandState(error: unknown): EditorialActionState {
  if (error instanceof SuperadminEditorialCommandError) {
    return validationState({ form: commandMessage(error.code) });
  }
  throw error;
}

export async function createFlashDraft(
  _state: EditorialActionState,
  formData: FormData,
): Promise<EditorialActionState> {
  try {
    await requireSuperadmin();
    const parsed = parseCommon(formData);
    const document = parseDocument(formData, parsed.fieldErrors);
    if (!document || Object.keys(parsed.fieldErrors).length > 0) {
      return validationState(parsed.fieldErrors);
    }
    try {
      await createSuperadminFlashDraft({
        idempotencyKey: parsed.idempotencyKey,
        document,
        reason: parsed.reason,
      });
    } catch (error) {
      return commandState(error);
    }
    revalidatePath("/admin");
    redirect("/admin?editorial=saved");
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

export async function updateFlashDraft(
  _state: EditorialActionState,
  formData: FormData,
): Promise<EditorialActionState> {
  try {
    await requireSuperadmin();
    const parsed = parseCommon(formData);
    const challengeVersionId = textValue(formData, "challengeVersionId").trim();
    const expectedUpdatedAt = textValue(formData, "expectedUpdatedAt").trim();
    const document = parseDocument(formData, parsed.fieldErrors);
    if (!uuidPattern.test(challengeVersionId))
      parsed.fieldErrors.challengeVersionId = "Selecciona un borrador válido.";
    if (!expectedUpdatedAt || Number.isNaN(Date.parse(expectedUpdatedAt))) {
      parsed.fieldErrors.expectedUpdatedAt = "El borrador está desactualizado. Recarga el portal.";
    }
    if (!document || Object.keys(parsed.fieldErrors).length > 0) {
      return validationState(parsed.fieldErrors);
    }
    try {
      await updateSuperadminFlashDraft({
        idempotencyKey: parsed.idempotencyKey,
        challengeVersionId,
        expectedUpdatedAt,
        document,
        reason: parsed.reason,
      });
    } catch (error) {
      return commandState(error);
    }
    revalidatePath("/admin");
    redirect("/admin?editorial=saved");
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

export async function publishFlash(
  _state: EditorialActionState,
  formData: FormData,
): Promise<EditorialActionState> {
  try {
    await requireSuperadmin();
    const parsed = parseCommon(formData);
    const challengeVersionId = textValue(formData, "challengeVersionId").trim();
    const expectedUpdatedAt = textValue(formData, "expectedUpdatedAt").trim();
    if (!uuidPattern.test(challengeVersionId))
      parsed.fieldErrors.challengeVersionId = "Selecciona un borrador válido.";
    if (!expectedUpdatedAt || Number.isNaN(Date.parse(expectedUpdatedAt))) {
      parsed.fieldErrors.expectedUpdatedAt = "El borrador está desactualizado. Recarga el portal.";
    }
    if (Object.keys(parsed.fieldErrors).length > 0) return validationState(parsed.fieldErrors);
    try {
      await publishSuperadminFlash({
        idempotencyKey: parsed.idempotencyKey,
        challengeVersionId,
        expectedUpdatedAt,
        reason: parsed.reason,
      });
    } catch (error) {
      return commandState(error);
    }
    revalidatePath("/admin");
    redirect("/admin?editorial=published");
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
