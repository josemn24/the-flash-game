import "server-only";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { validateProfileName } from "@/lib/userProfile";
import { createClient } from "@/lib/supabase/server";
import { resolveAvatarPath } from "@/lib/media/publicAvatar";
import { supabaseMediaStorage } from "@/infrastructure/supabase/mediaStorage";
import {
  abortAvatarAsset,
  confirmAvatarAsset,
  prepareAvatarAsset,
  readAvatarAsset,
} from "@/infrastructure/supabase/mediaAssetCommands";
import { AVATAR_ALLOWED_MIME_TYPES, AVATAR_MAX_BYTES } from "@/lib/media/avatarValidation";
import type { PlayerId } from "@/types/domain";
import type { ViewerProfile } from "@/types/view-models";
import type { ProfileSaveResult } from "@/types/view-models/user-actions";
import type { UserProfile } from "@/types/view-models/user";

type ProvisionedPlayerRow = {
  player_id: string;
  display_name: string;
  avatar_path: string | null;
  status: "active" | "anonymized";
};

function isProvisionedPlayerRow(value: unknown): value is ProvisionedPlayerRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.player_id === "string" &&
    typeof row.display_name === "string" &&
    (row.avatar_path === null || typeof row.avatar_path === "string") &&
    (row.status === "active" || row.status === "anonymized")
  );
}

function toUserProfile(row: ProvisionedPlayerRow): UserProfile {
  return {
    id: row.player_id,
    name: row.display_name,
    avatarSrc: resolveAvatarPath(row.avatar_path),
  };
}

async function getProvisionedCurrentPlayer() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const { data, error } = await supabase.rpc("provision_player");
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !isProvisionedPlayerRow(row) || row.status !== "active") {
    throw new Error("The authenticated Player could not be provisioned.");
  }

  return { supabase, row, authUserId: userData.user.id };
}

export async function getCurrentViewerProfile(): Promise<ViewerProfile | null> {
  const current = await getProvisionedCurrentPlayer();
  if (!current) return null;

  return {
    ...toUserProfile(current.row),
    playerId: current.row.player_id as PlayerId,
  };
}

export async function updateCurrentPlayerName(name: string): Promise<ProfileSaveResult> {
  const trimmedName = name.trim();
  const validationError = validateProfileName(trimmedName);
  if (validationError) {
    return { ok: false, code: "invalid_name", message: validationError };
  }

  const current = await getProvisionedCurrentPlayer();
  if (!current) {
    return {
      ok: false,
      code: "unauthorized",
      message: "Tu sesión ha caducado. Vuelve a iniciar sesión.",
    };
  }

  const { error } = await current.supabase
    .from("players")
    .update({ display_name: trimmedName })
    .eq("id", current.row.player_id);

  if (error) {
    return {
      ok: false,
      code: "save_failed",
      message: "No se ha podido guardar el nombre. Inténtalo de nuevo.",
    };
  }

  // PostgREST's representation response requires relation-level SELECT. The
  // schema intentionally grants only column-level profile reads, so refresh
  // through the narrow Auth-backed RPC instead of widening table privileges.
  const { data: refreshedData, error: refreshedError } =
    await current.supabase.rpc("provision_player");
  const refreshedRow = Array.isArray(refreshedData) ? refreshedData[0] : refreshedData;
  if (refreshedError || !isProvisionedPlayerRow(refreshedRow) || refreshedRow.status !== "active") {
    return {
      ok: false,
      code: "save_failed",
      message: "No se ha podido confirmar el nombre. Inténtalo de nuevo.",
    };
  }

  const profile = toUserProfile(refreshedRow);
  revalidatePath("/");
  return { ok: true, profile };
}

function avatarExtension(mimeType: string) {
  return mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp";
}

function avatarAssetId(authUserId: string, idempotencyKey: string) {
  const hex = createHash("sha256").update(`${authUserId}:${idempotencyKey}`).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ["8", "9", "a", "b"][parseInt(hex[16], 16) % 4];
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

export type AvatarUploadPreparationResult =
  | {
      readonly ok: true;
      readonly assetId: string;
      readonly objectPath: string;
      readonly signedUploadUrl: string;
      readonly uploadToken: string;
      readonly expiresAt: string;
      readonly confirmIdempotencyKey: string;
    }
  | { readonly ok: false; readonly code: "unauthorized" | "invalid_file" | "storage_unavailable" | "conflict"; readonly message: string };

export async function prepareCurrentPlayerAvatar(input: {
  mimeType: string;
  byteSize: number;
  idempotencyKey: string;
}): Promise<AvatarUploadPreparationResult> {
  if (
    !AVATAR_ALLOWED_MIME_TYPES.includes(input.mimeType as (typeof AVATAR_ALLOWED_MIME_TYPES)[number]) ||
    !Number.isInteger(input.byteSize) ||
    input.byteSize <= 0 ||
    input.byteSize > AVATAR_MAX_BYTES
  ) {
    return { ok: false, code: "invalid_file", message: "El archivo no es un avatar válido." };
  }
  const current = await getProvisionedCurrentPlayer();
  if (!current) return { ok: false, code: "unauthorized", message: "Tu sesión ha caducado." };

  const assetId = avatarAssetId(current.authUserId, input.idempotencyKey);
  const objectPath = `avatars/${current.row.player_id}/${assetId}.${avatarExtension(input.mimeType)}`;
  try {
    await prepareAvatarAsset(current.authUserId, {
      assetId,
      objectPath,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      idempotencyKey: input.idempotencyKey,
    });
    const upload = await supabaseMediaStorage.prepareUpload({
      assetId,
      objectPath,
      bucket: "avatars",
      mimeType: input.mimeType as "image/jpeg" | "image/png" | "image/webp",
    });
    return {
      ok: true,
      ...upload,
      confirmIdempotencyKey: `confirm:${input.idempotencyKey}`,
    };
  } catch (error) {
    const isConflict = error instanceof Error && error.message.includes("idempotency_conflict");
    if (!isConflict) await abortAvatarAsset(current.authUserId, { assetId }).catch(() => undefined);
    return {
      ok: false,
      code: isConflict ? "conflict" : "storage_unavailable",
      message: isConflict
        ? "La subida ya tiene otra solicitud asociada. Reinténtalo con una nueva selección."
        : "No se ha podido preparar la subida. Inténtalo de nuevo.",
    };
  }
}

export type AvatarUploadConfirmationResult =
  | { readonly ok: true; readonly profile: UserProfile }
  | {
      readonly ok: false;
      readonly code: "unauthorized" | "invalid_file" | "storage_unavailable" | "save_failed" | "conflict";
      readonly message: string;
    };

export async function confirmCurrentPlayerAvatar(input: {
  assetId: string;
  idempotencyKey: string;
}): Promise<AvatarUploadConfirmationResult> {
  const current = await getProvisionedCurrentPlayer();
  if (!current) return { ok: false, code: "unauthorized", message: "Tu sesión ha caducado." };
  let asset: Awaited<ReturnType<typeof readAvatarAsset>> = null;
  try {
    asset = await readAvatarAsset(current.authUserId, input.assetId);
    if (!asset || asset.status !== "pending") {
      return { ok: false, code: "save_failed", message: "La subida ya no está disponible." };
    }
    const inspection = await supabaseMediaStorage.inspectUpload({ objectPath: asset.objectPath });
    const result = await confirmAvatarAsset(current.authUserId, {
      assetId: input.assetId,
      idempotencyKey: input.idempotencyKey,
      ...inspection,
    });
    if (result.oldObjectPath && result.oldObjectPath.startsWith("avatars/")) {
      await supabaseMediaStorage.deleteObject({ bucket: "avatars", objectPath: result.oldObjectPath }).catch(() => undefined);
    }
    const refreshed = await getProvisionedCurrentPlayer();
    if (!refreshed) return { ok: false, code: "save_failed", message: "No se ha podido confirmar el perfil." };
    revalidatePath("/");
    return { ok: true, profile: toUserProfile(refreshed.row) };
  } catch (error) {
    if (asset?.objectPath) {
      await supabaseMediaStorage.deleteObject({ bucket: "avatars", objectPath: asset.objectPath }).catch(() => undefined);
    }
    await abortAvatarAsset(current.authUserId, { assetId: input.assetId }).catch(() => undefined);
    const message = error instanceof Error && ["unsupported_type", "too_large", "dimensions", "corrupt", "empty"].includes(error.message)
      ? "El archivo no es un JPEG, PNG o WebP válido de hasta 2048 px."
      : "No se ha podido confirmar la imagen. Inténtalo de nuevo.";
    const isConflict = error instanceof Error && error.message.includes("idempotency_conflict");
    return {
      ok: false,
      code: message.startsWith("El archivo") ? "invalid_file" : isConflict ? "conflict" : "storage_unavailable",
      message: isConflict ? "La subida ya tiene otra solicitud asociada. Reinténtalo con una nueva selección." : message,
    };
  }
}

export async function abortCurrentPlayerAvatar(assetId: string) {
  const current = await getProvisionedCurrentPlayer();
  if (!current) return;
  const asset = await readAvatarAsset(current.authUserId, assetId).catch(() => null);
  if (asset?.objectPath) await supabaseMediaStorage.deleteObject({ bucket: "avatars", objectPath: asset.objectPath }).catch(() => undefined);
  await abortAvatarAsset(current.authUserId, { assetId }).catch(() => undefined);
}
