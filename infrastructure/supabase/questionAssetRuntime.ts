import "server-only";

import { readCompetitiveQuestionAsset } from "@/infrastructure/supabase/mediaAssetCommands";
import { supabaseMediaStorage } from "@/infrastructure/supabase/mediaStorage";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function resolveCompetitiveQuestionPayload(input: {
  readonly authUserId: string;
  readonly attemptId: string;
  readonly publicPayload: unknown;
}) {
  if (!isRecord(input.publicPayload) || !isRecord(input.publicPayload.surface)) {
    return input.publicPayload;
  }
  const surface = input.publicPayload.surface;
  if (typeof surface.assetId !== "string") return input.publicPayload;

  const asset = await readCompetitiveQuestionAsset(input.authUserId, {
    attemptId: input.attemptId,
    assetId: surface.assetId,
  });
  const signed = await supabaseMediaStorage.createSignedReadUrl({
    bucket: "question-assets",
    objectPath: asset.objectPath,
    expiresInSeconds: 300,
  });
  const runtimeSurface = { ...surface };
  delete runtimeSurface.assetId;
  return {
    ...input.publicPayload,
    surface: { ...runtimeSurface, src: signed.signedUrl },
  };
}
