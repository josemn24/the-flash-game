"use server";
import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/server/admin";
import {
  getEditorialRehearsal,
  saveRehearsalAssociation,
} from "@/server/production-rehearsal-data-access";

export type RehearsalActionState = { message?: string; error?: string };
export async function associateRehearsal(
  _state: RehearsalActionState,
  form: FormData,
): Promise<RehearsalActionState> {
  await requireSuperadmin();
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const challengeVersionId = text("challengeVersionId");
  const idempotencyKey = text("idempotencyKey");
  const reason = text("reason");
  if (idempotencyKey.length < 8 || idempotencyKey.length > 160 || !reason || reason.length > 500)
    return { error: "Introduce un motivo y vuelve a intentarlo." };
  try {
    const context = await getEditorialRehearsal(challengeVersionId);
    if (!context) return { error: "No se encontró la versión del desafío." };
    const selected = text("rehearsal");
    const choice = context.choices.find(
      (c) => `${c.ref.id}@${c.ref.version}` === selected && c.issues.length === 0,
    );
    if (selected && !choice)
      return { error: "El ensayo seleccionado no existe o no es compatible." };
    await saveRehearsalAssociation({
      challengeVersionId,
      expectedUpdatedAt: text("expectedUpdatedAt"),
      idempotencyKey,
      reason,
      ref: choice?.ref ?? null,
    });
    revalidatePath("/admin/challenges/[challengeDefinitionId]", "page");
    revalidatePath("/desafios/[challengeId]", "page");
    return { message: selected ? "Ensayo asociado." : "Asociación retirada." };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return {
      error: code.includes("frozen")
        ? "La asociación publicada es inmutable. Crea una nueva versión."
        : code.includes("conflict")
          ? "El contenido cambió. Recarga el editor antes de volver a guardar."
          : "No se pudo guardar la asociación. Recarga e inténtalo de nuevo.",
    };
  }
}
