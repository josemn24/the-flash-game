import "server-only";
import { cache } from "react";
import { randomUUID } from "node:crypto";
import { logHttpEvent } from "@/server/observability";
import { rehearsalServices } from "@/server/composition/rehearsals";
import type { RehearsalAssociationInput } from "@/application/ports/rehearsals";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const getPlayerRehearsal = cache(async (roomKey: string, publicationId: string) => {
  if (!roomKey || !uuid.test(publicationId)) return null;
  try {
    return (await (await rehearsalServices())?.getPlayerRehearsal(roomKey, publicationId)) ?? null;
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    logHttpEvent({
      requestId: randomUUID(),
      route: `/desafios/${publicationId}/prueba`,
      operation: "read_rehearsal",
      status: 503,
      result: "error",
      errorCode: ["rehearsal_incompatible", "rehearsal_catalog_missing"].includes(code)
        ? code
        : "rehearsal_load_failed",
    });
    throw error;
  }
});
export const getRehearsalAvailability = cache(async (roomKey: string, publicationId: string) => {
  try {
    const rehearsal = await getPlayerRehearsal(roomKey, publicationId);
    return rehearsal
      ? {
          canRehearse: true as const,
          href: `/desafios/${encodeURIComponent(publicationId)}/prueba?roomId=${encodeURIComponent(roomKey)}`,
        }
      : undefined;
  } catch {
    return undefined;
  }
});
export const getEditorialRehearsal = cache(async (versionId: string) => {
  if (!uuid.test(versionId)) return null;
  return (await rehearsalServices())?.getEditorial(versionId) ?? null;
});
export async function saveRehearsalAssociation(input: RehearsalAssociationInput) {
  if (!uuid.test(input.challengeVersionId)) throw new Error("invalid_command");
  const service = await rehearsalServices();
  if (!service) throw new Error("not_authorized");
  await service.associate(input);
}

export async function getRehearsalPreview(id: string, version: number) {
  return (await import("@/server/composition/rehearsals")).rehearsalPreview(id, version);
}
