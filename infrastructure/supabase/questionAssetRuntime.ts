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
  if (!isRecord(input.publicPayload)) {
    return input.publicPayload;
  }
  const referenceKey = isRecord(input.publicPayload.surface) && typeof input.publicPayload.surface.assetId === "string"
    ? "surface"
    : isRecord(input.publicPayload.media) && typeof input.publicPayload.media.assetId === "string"
      ? "media"
      : null;
  if (!referenceKey) return input.publicPayload;
  const reference = input.publicPayload[referenceKey] as Record<string, unknown>;

  const asset = await readCompetitiveQuestionAsset(input.authUserId, {
    attemptId: input.attemptId,
    assetId: reference.assetId as string,
  });
  const signed = await supabaseMediaStorage.createSignedReadUrl({
    bucket: "question-assets",
    objectPath: asset.objectPath,
    expiresInSeconds: 300,
  });
  const runtimeReference = { ...reference };
  delete runtimeReference.assetId;
  if (referenceKey === "media") {
    runtimeReference.src = signed.signedUrl;
  }
  return {
    ...input.publicPayload,
    [referenceKey]: referenceKey === "media"
      ? runtimeReference
      : { ...runtimeReference, src: signed.signedUrl },
  };
}
