"use server";
import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/server/admin";
import {
  saveRehearsalPolicy,
  getRehearsalPreview,
} from "@/server/production-rehearsal-data-access";
import type { RehearsalRecipe } from "@/types/gameplay/rehearsal";
export type RehearsalActionState = { message?: string; error?: string };
export async function updateRehearsalPolicy(
  _state: RehearsalActionState,
  form: FormData,
): Promise<RehearsalActionState> {
  await requireSuperadmin();
  const text = (key: string) => String(form.get(key) ?? "").trim();
  if (
    text("idempotencyKey").length < 8 ||
    text("idempotencyKey").length > 160 ||
    !text("reason") ||
    text("reason").length > 500 ||
    !["true", "false"].includes(text("enabled"))
  )
    return { error: "Introduce un motivo válido y vuelve a intentarlo." };
  try {
    await saveRehearsalPolicy({
      publicationId: text("publicationId"),
      enabled: text("enabled") === "true",
      expectedUpdatedAt: text("expectedUpdatedAt") || null,
      idempotencyKey: text("idempotencyKey"),
      reason: text("reason"),
    });
    revalidatePath("/admin/challenges/[challengeDefinitionId]", "page");
    revalidatePath("/desafios/[challengeId]", "page");
    return { message: "Disponibilidad de la prueba actualizada." };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message.includes("conflict")
          ? "La configuración cambió. Recarga antes de guardar."
          : "No se pudo actualizar la prueba.",
    };
  }
}
export async function previewRehearsal(
  versionId: string,
  options: { seed?: string; recipe?: RehearsalRecipe },
) {
  await requireSuperadmin();
  if (JSON.stringify(options).length > 32768) throw new Error("invalid_rehearsal_recipe");
  try {
    return { run: await getRehearsalPreview(versionId, options) };
  } catch (error) {
    const messages: Record<string, string> = {
      rehearsal_coverage_missing: "No hay preguntas compatibles para todas las posiciones.",
      invalid_rehearsal_seed:
        "La semilla debe tener entre 1 y 128 letras, cifras, guiones o guiones bajos.",
      rehearsal_recipe_incompatible:
        "La receta no corresponde a esta estructura o versión del generador.",
      rehearsal_question_missing_or_changed:
        "Falta una versión de pregunta de la receta o su huella ha cambiado.",
    };
    return {
      error:
        messages[error instanceof Error ? error.message : ""] ??
        "No se pudo reproducir la receta. Comprueba su contenido.",
    };
  }
}
