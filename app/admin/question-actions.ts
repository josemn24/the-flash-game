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
  parseFlashEditorialQuestionJson,
} from "@/lib/editorial/flashDocument";
import { requireSuperadmin } from "@/server/admin";
import {
  archiveSuperadminQuestion,
  createSuperadminQuestionDraft,
  publishSuperadminQuestion,
  updateSuperadminQuestionDraft,
} from "@/server/admin-editorial";
import {
  abortSuperadminQuestionAsset,
  archiveSuperadminQuestionAsset,
  confirmSuperadminQuestionAsset,
  prepareSuperadminQuestionAsset,
  previewSuperadminQuestionAsset,
} from "@/server/question-assets";

export type QuestionActionState = {
  readonly message?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function state(fieldErrors: Record<string, string>): QuestionActionState {
  return { message: "Revisa la pregunta.", fieldErrors };
}

function boundary(error: unknown): never {
  if (error instanceof AuthenticationRequiredError) redirect("/");
  if (error instanceof SuperadminAccessDeniedError) notFound();
  throw error;
}

function message(code: string) {
  switch (code) {
    case "invalid_question_document":
    case "invalid_content":
    case "invalid_public_payload":
    case "invalid_solution_payload":
      return "El JSON no cumple el contrato de pregunta Flash.";
    case "invalid_question_reference":
      return "La referencia de biblioteca no es válida.";
    case "content_not_found":
      return "La versión ya no existe. Recarga el portal.";
    case "content_not_draft":
      return "Solo se pueden editar borradores.";
    case "content_not_published":
      return "Solo se pueden archivar versiones publicadas.";
    case "content_already_published":
      return "La versión ya está publicada.";
    case "content_conflict":
      return "La versión cambió en otra pestaña. Recarga antes de continuar.";
    case "content_slug_conflict":
      return "El slug de la pregunta ya está en uso o no coincide con su definición.";
    case "idempotency_conflict":
      return "Esta operación ya se usó con otros datos. Recarga el editor.";
    default:
      return "No se ha podido guardar la pregunta. Inténtalo de nuevo.";
  }
}

function common(formData: FormData) {
  const idempotencyKey = textValue(formData, "idempotencyKey").trim();
  const reason = textValue(formData, "reason").trim();
  const fieldErrors: Record<string, string> = {};
  if (idempotencyKey.length < 8 || idempotencyKey.length > 160) fieldErrors.form = "Recarga el editor.";
  if (reason.length === 0 || reason.length > 500) fieldErrors.reason = "Introduce un motivo de hasta 500 caracteres.";
  return { idempotencyKey, reason, fieldErrors };
}

function document(formData: FormData, fieldErrors: Record<string, string>) {
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
    return parseFlashEditorialQuestionJson(source);
  } catch (error) {
    fieldErrors.document = error instanceof FlashEditorialValidationError
      ? error.issues[0] ?? "El JSON no cumple el contrato editorial."
      : "El documento no contiene JSON válido.";
    return null;
  }
}

function commandState(error: unknown): QuestionActionState {
  if (error instanceof SuperadminEditorialCommandError) return state({ form: message(error.code) });
  throw error;
}

export async function createQuestionDraft(_state: QuestionActionState, formData: FormData) {
  try {
    await requireSuperadmin();
    const parsed = common(formData);
    const question = document(formData, parsed.fieldErrors);
    const questionDefinitionId = textValue(formData, "questionDefinitionId").trim();
    if (questionDefinitionId && !uuidPattern.test(questionDefinitionId)) parsed.fieldErrors.questionDefinitionId = "Definición inválida.";
    if (!question || Object.keys(parsed.fieldErrors).length > 0) return state(parsed.fieldErrors);
    try {
      const result = await createSuperadminQuestionDraft({
        idempotencyKey: parsed.idempotencyKey,
        ...(questionDefinitionId ? { questionDefinitionId } : {}),
        document: question,
        reason: parsed.reason,
      });
      revalidatePath("/admin");
      revalidatePath("/admin/questions");
      redirect(`/admin/questions/${result.versions[0]?.questionVersionId ?? ""}`);
    } catch (error) {
      return commandState(error);
    }
  } catch (error) {
    if (error instanceof AuthenticationRequiredError || error instanceof SuperadminAccessDeniedError) boundary(error);
    throw error;
  }
}

export async function updateQuestionDraft(_state: QuestionActionState, formData: FormData) {
  try {
    await requireSuperadmin();
    const parsed = common(formData);
    const questionVersionId = textValue(formData, "questionVersionId").trim();
    const expectedUpdatedAt = textValue(formData, "expectedUpdatedAt").trim();
    const question = document(formData, parsed.fieldErrors);
    if (!uuidPattern.test(questionVersionId)) parsed.fieldErrors.questionVersionId = "Versión inválida.";
    if (!expectedUpdatedAt || Number.isNaN(Date.parse(expectedUpdatedAt))) parsed.fieldErrors.expectedUpdatedAt = "Recarga la versión.";
    if (!question || Object.keys(parsed.fieldErrors).length > 0) return state(parsed.fieldErrors);
    try {
      await updateSuperadminQuestionDraft({ idempotencyKey: parsed.idempotencyKey, questionVersionId, expectedUpdatedAt, document: question, reason: parsed.reason });
      revalidatePath("/admin");
      revalidatePath(`/admin/questions/${questionVersionId}`);
      redirect(`/admin/questions/${questionVersionId}`);
    } catch (error) {
      return commandState(error);
    }
  } catch (error) {
    if (error instanceof AuthenticationRequiredError || error instanceof SuperadminAccessDeniedError) boundary(error);
    throw error;
  }
}

export async function publishQuestion(_state: QuestionActionState, formData: FormData) {
  try {
    await requireSuperadmin();
    const parsed = common(formData);
    const questionVersionId = textValue(formData, "questionVersionId").trim();
    const expectedUpdatedAt = textValue(formData, "expectedUpdatedAt").trim();
    if (!uuidPattern.test(questionVersionId)) parsed.fieldErrors.questionVersionId = "Versión inválida.";
    if (!expectedUpdatedAt || Number.isNaN(Date.parse(expectedUpdatedAt))) parsed.fieldErrors.expectedUpdatedAt = "Recarga la versión.";
    if (Object.keys(parsed.fieldErrors).length > 0) return state(parsed.fieldErrors);
    try {
      await publishSuperadminQuestion({ idempotencyKey: parsed.idempotencyKey, questionVersionId, expectedUpdatedAt, reason: parsed.reason });
      revalidatePath("/admin");
      revalidatePath("/admin/questions");
      revalidatePath(`/admin/questions/${questionVersionId}`);
      redirect(`/admin/questions/${questionVersionId}`);
    } catch (error) {
      return commandState(error);
    }
  } catch (error) {
    if (error instanceof AuthenticationRequiredError || error instanceof SuperadminAccessDeniedError) boundary(error);
    throw error;
  }
}

export async function archiveQuestion(_state: QuestionActionState, formData: FormData) {
  try {
    await requireSuperadmin();
    const parsed = common(formData);
    const questionVersionId = textValue(formData, "questionVersionId").trim();
    const expectedUpdatedAt = textValue(formData, "expectedUpdatedAt").trim();
    if (!uuidPattern.test(questionVersionId)) parsed.fieldErrors.questionVersionId = "Versión inválida.";
    if (!expectedUpdatedAt || Number.isNaN(Date.parse(expectedUpdatedAt))) parsed.fieldErrors.expectedUpdatedAt = "Recarga la versión.";
    if (Object.keys(parsed.fieldErrors).length > 0) return state(parsed.fieldErrors);
    try {
      await archiveSuperadminQuestion({ idempotencyKey: parsed.idempotencyKey, questionVersionId, expectedUpdatedAt, reason: parsed.reason });
      revalidatePath("/admin");
      revalidatePath("/admin/questions");
      revalidatePath(`/admin/questions/${questionVersionId}`);
      redirect(`/admin/questions/${questionVersionId}`);
    } catch (error) {
      return commandState(error);
    }
  } catch (error) {
    if (error instanceof AuthenticationRequiredError || error instanceof SuperadminAccessDeniedError) boundary(error);
    throw error;
  }
}

export async function prepareQuestionAsset(input: {
  readonly mimeType: string;
  readonly byteSize: number;
  readonly idempotencyKey: string;
}) {
  return prepareSuperadminQuestionAsset(input);
}

export async function confirmQuestionAsset(input: { readonly assetId: string; readonly idempotencyKey: string }) {
  return confirmSuperadminQuestionAsset(input);
}

export async function abortQuestionAsset(assetId: string) {
  await abortSuperadminQuestionAsset(assetId);
}

export async function previewQuestionAsset(assetId: string) {
  return previewSuperadminQuestionAsset(assetId);
}

export async function archiveQuestionAsset(input: { readonly assetId: string; readonly idempotencyKey: string; readonly reason: string }) {
  return archiveSuperadminQuestionAsset(input);
}
