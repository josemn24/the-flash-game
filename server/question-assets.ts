import "server-only";

import { createHash } from "node:crypto";
import { AuthenticationRequiredError, SuperadminAccessDeniedError } from "@/application/administration/errors";
import { createClient } from "@/lib/supabase/server";
import { requireSuperadmin } from "@/server/admin";
import {
  abortQuestionAsset,
  archiveQuestionAsset,
  confirmQuestionAsset,
  prepareQuestionAsset,
  readQuestionAssetUpload,
} from "@/infrastructure/supabase/mediaAssetCommands";
import { supabaseMediaStorage } from "@/infrastructure/supabase/mediaStorage";
import {
  QUESTION_ASSET_MAX_BYTES,
  QUESTION_ASSET_MAX_DIMENSION,
  AVATAR_ALLOWED_MIME_TYPES,
} from "@/lib/media/avatarValidation";

const QUESTION_ASSET_MIME_TYPES = AVATAR_ALLOWED_MIME_TYPES;
type QuestionAssetMimeType = (typeof QUESTION_ASSET_MIME_TYPES)[number];

function assetExtension(mimeType: QuestionAssetMimeType) {
  return mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp";
}

function questionAssetId(authUserId: string, idempotencyKey: string) {
  const hex = createHash("sha256").update(`question-asset:${authUserId}:${idempotencyKey}`).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ["8", "9", "a", "b"][parseInt(hex[16], 16) % 4];
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

async function currentAuthUserId() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("unauthorized");
  return data.user.id;
}

export type QuestionAssetUploadPreparation = {
  readonly ok: true;
  readonly assetId: string;
  readonly objectPath: string;
  readonly signedUploadUrl: string;
  readonly uploadToken: string;
  readonly expiresAt: string;
  readonly confirmIdempotencyKey: string;
};

export type QuestionAssetOperationError = {
  readonly ok: false;
  readonly code: "unauthorized" | "invalid_file" | "storage_unavailable" | "conflict";
  readonly message: string;
};

export async function prepareSuperadminQuestionAsset(input: {
  readonly mimeType: string;
  readonly byteSize: number;
  readonly idempotencyKey: string;
}): Promise<QuestionAssetUploadPreparation | QuestionAssetOperationError> {
  if (
    !QUESTION_ASSET_MIME_TYPES.includes(input.mimeType as QuestionAssetMimeType) ||
    !Number.isInteger(input.byteSize) ||
    input.byteSize <= 0 ||
    input.byteSize > QUESTION_ASSET_MAX_BYTES
  ) {
    return { ok: false, code: "invalid_file", message: "Elige un JPEG, PNG o WebP de hasta 50 MiB." };
  }

  try {
    await requireSuperadmin();
    const authUserId = await currentAuthUserId();
    const assetId = questionAssetId(authUserId, input.idempotencyKey);
    const objectPath = `question-assets/${assetId}.${assetExtension(input.mimeType as QuestionAssetMimeType)}`;
    await prepareQuestionAsset(authUserId, {
      assetId,
      objectPath,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      idempotencyKey: input.idempotencyKey,
    });
    const upload = await supabaseMediaStorage.prepareUpload({
      assetId,
      objectPath,
      bucket: "question-assets",
      mimeType: input.mimeType as QuestionAssetMimeType,
    });
    return { ok: true, ...upload, confirmIdempotencyKey: `confirm:${input.idempotencyKey}` };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError || error instanceof SuperadminAccessDeniedError || (error instanceof Error && ["unauthorized", "not_authorized"].includes(error.message))) {
      return { ok: false, code: "unauthorized", message: "No tienes permisos para subir assets." };
    }
    if (error instanceof Error && error.message.includes("idempotency_conflict")) {
      return { ok: false, code: "conflict", message: "Esta subida ya se inició con otros datos." };
    }
    return { ok: false, code: "storage_unavailable", message: "No se ha podido preparar la subida." };
  }
}

export async function confirmSuperadminQuestionAsset(input: {
  readonly assetId: string;
  readonly idempotencyKey: string;
}): Promise<{
  readonly ok: true;
  readonly assetId: string;
  readonly status: "ready";
  readonly width: number;
  readonly height: number;
} | QuestionAssetOperationError> {
  try {
    await requireSuperadmin();
    const authUserId = await currentAuthUserId();
    const asset = await readQuestionAssetUpload(authUserId, input.assetId);
    if (!asset) return { ok: false, code: "invalid_file", message: "El asset no existe." };
    const inspection = await supabaseMediaStorage.inspectUpload({ objectPath: asset.objectPath });
    if (inspection.width > QUESTION_ASSET_MAX_DIMENSION || inspection.height > QUESTION_ASSET_MAX_DIMENSION) {
      throw new Error("invalid_file");
    }
    const confirmed = await confirmQuestionAsset(authUserId, {
      idempotencyKey: input.idempotencyKey,
      assetId: input.assetId,
      ...inspection,
    });
    return { ok: true, assetId: confirmed.assetId, status: "ready", width: inspection.width, height: inspection.height };
  } catch (error) {
    const authUserId = await currentAuthUserId().catch(() => null);
    if (authUserId) {
      const asset = await readQuestionAssetUpload(authUserId, input.assetId).catch(() => null);
      if (asset?.status === "pending") {
        await supabaseMediaStorage.deleteObject({ bucket: "question-assets", objectPath: asset.objectPath }).catch(() => undefined);
        await abortQuestionAsset(authUserId, { assetId: input.assetId }).catch(() => undefined);
      }
    }
    if (error instanceof AuthenticationRequiredError || error instanceof SuperadminAccessDeniedError || (error instanceof Error && ["unauthorized", "not_authorized"].includes(error.message))) {
      return { ok: false, code: "unauthorized", message: "No tienes permisos para confirmar assets." };
    }
    if (error instanceof Error && error.message.includes("idempotency_conflict")) {
      return { ok: false, code: "conflict", message: "Esta confirmación ya se usó con otros datos." };
    }
    return { ok: false, code: "invalid_file", message: "El archivo no es una imagen válida o no se pudo inspeccionar." };
  }
}

export async function abortSuperadminQuestionAsset(assetId: string) {
  await requireSuperadmin();
  const authUserId = await currentAuthUserId();
  const asset = await readQuestionAssetUpload(authUserId, assetId);
  if (!asset) return;
  await supabaseMediaStorage.deleteObject({ bucket: "question-assets", objectPath: asset.objectPath }).catch(() => undefined);
  await abortQuestionAsset(authUserId, { assetId });
}

export async function previewSuperadminQuestionAsset(assetId: string) {
  await requireSuperadmin();
  const authUserId = await currentAuthUserId();
  const asset = await readQuestionAssetUpload(authUserId, assetId);
  if (!asset || !["ready", "archived"].includes(asset.status)) throw new Error("media_asset_not_ready");
  return supabaseMediaStorage.createSignedReadUrl({ bucket: "question-assets", objectPath: asset.objectPath, expiresInSeconds: 300 });
}

export async function archiveSuperadminQuestionAsset(input: { readonly assetId: string; readonly idempotencyKey: string; readonly reason: string }) {
  await requireSuperadmin();
  const authUserId = await currentAuthUserId();
  return archiveQuestionAsset(authUserId, input);
}
