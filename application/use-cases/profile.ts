import { createHash } from "node:crypto";
import type { AuthenticatedActor } from "@/application/ports/actors";
import type { MediaAssetCommands } from "@/application/ports/media-asset-commands";
import type { MediaStorage } from "@/application/ports/media-storage";
import type { ProfileCommands } from "@/application/ports/profile-commands";
import type {
  AvatarUploadConfirmationResult,
  AvatarUploadPreparationResult,
  ProfileUseCases,
} from "@/application/ports/profile-use-cases";
import type { ViewerProfile } from "@/types/view-models";
import type { ProfileSaveResult } from "@/types/view-models/user-actions";
import { AVATAR_ALLOWED_MIME_TYPES, AVATAR_MAX_BYTES } from "@/lib/media/avatarValidation";
import { validateProfileName } from "@/lib/userProfile";

type ProfileUseCaseDependencies = {
  readonly actor: AuthenticatedActor;
  readonly currentViewer: { getCurrentViewer(): Promise<ViewerProfile | null> };
  readonly profileCommands: ProfileCommands;
  readonly mediaAssetCommands: MediaAssetCommands;
  readonly mediaStorage: MediaStorage;
  readonly assetIdGenerator?: { generate(authUserId: string, idempotencyKey: string): string };
};

function defaultAssetIdGenerator(authUserId: string, idempotencyKey: string) {
  const bytes = createHash("sha256")
    .update(`${authUserId}:${idempotencyKey}`)
    .digest("hex")
    .slice(0, 32)
    .split("");
  bytes[12] = "5";
  bytes[16] = ["8", "9", "a", "b"][parseInt(bytes[16], 16) % 4];
  return `${bytes.slice(0, 8).join("")}-${bytes.slice(8, 12).join("")}-${bytes.slice(12, 16).join("")}-${bytes.slice(16, 20).join("")}-${bytes.slice(20).join("")}`;
}

function avatarExtension(mimeType: string) {
  return mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp";
}

export class ApplicationProfileUseCases implements ProfileUseCases {
  private readonly actor: AuthenticatedActor;
  private readonly currentViewer: ProfileUseCaseDependencies["currentViewer"];
  private readonly profileCommands: ProfileCommands;
  private readonly mediaAssetCommands: MediaAssetCommands;
  private readonly mediaStorage: MediaStorage;
  private readonly assetIdGenerator: NonNullable<ProfileUseCaseDependencies["assetIdGenerator"]>;

  constructor(dependencies: ProfileUseCaseDependencies) {
    this.actor = dependencies.actor;
    this.currentViewer = dependencies.currentViewer;
    this.profileCommands = dependencies.profileCommands;
    this.mediaAssetCommands = dependencies.mediaAssetCommands;
    this.mediaStorage = dependencies.mediaStorage;
    this.assetIdGenerator = dependencies.assetIdGenerator ?? { generate: defaultAssetIdGenerator };
  }

  getCurrentViewer() {
    return this.currentViewer.getCurrentViewer();
  }

  async updateName(name: string): Promise<ProfileSaveResult> {
    const trimmedName = name.trim();
    const validationError = validateProfileName(trimmedName);
    if (validationError) return { ok: false, code: "invalid_name", message: validationError };
    try {
      const result = await this.profileCommands.updateName({ name: trimmedName });
      return { ok: true, profile: result.profile };
    } catch {
      return {
        ok: false,
        code: "save_failed",
        message: "No se ha podido guardar el nombre. Inténtalo de nuevo.",
      };
    }
  }

  async prepareAvatar(input: {
    mimeType: string;
    byteSize: number;
    idempotencyKey: string;
  }): Promise<AvatarUploadPreparationResult> {
    if (
      !AVATAR_ALLOWED_MIME_TYPES.includes(
        input.mimeType as (typeof AVATAR_ALLOWED_MIME_TYPES)[number],
      ) ||
      !Number.isInteger(input.byteSize) ||
      input.byteSize <= 0 ||
      input.byteSize > AVATAR_MAX_BYTES
    ) {
      return { ok: false, code: "invalid_file", message: "El archivo no es un avatar válido." };
    }
    if (!this.actor.playerId) {
      return { ok: false, code: "unauthorized", message: "Tu sesión ha caducado." };
    }

    const assetId = this.assetIdGenerator.generate(this.actor.authUserId, input.idempotencyKey);
    const objectPath = `avatars/${this.actor.playerId}/${assetId}.${avatarExtension(input.mimeType)}`;
    try {
      await this.mediaAssetCommands.prepareAvatar({
        assetId,
        objectPath,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        idempotencyKey: input.idempotencyKey,
      });
      const upload = await this.mediaStorage.prepareUpload({
        assetId,
        objectPath,
        bucket: "avatars",
        mimeType: input.mimeType as "image/jpeg" | "image/png" | "image/webp",
      });
      return { ok: true, ...upload, confirmIdempotencyKey: `confirm:${input.idempotencyKey}` };
    } catch (error) {
      const isConflict = error instanceof Error && error.message.includes("idempotency_conflict");
      if (!isConflict)
        await this.mediaAssetCommands.abortAvatar({ assetId }).catch(() => undefined);
      return {
        ok: false,
        code: isConflict ? "conflict" : "storage_unavailable",
        message: isConflict
          ? "La subida ya tiene otra solicitud asociada. Reinténtalo con una nueva selección."
          : "No se ha podido preparar la subida. Inténtalo de nuevo.",
      };
    }
  }

  async confirmAvatar(input: {
    assetId: string;
    idempotencyKey: string;
  }): Promise<AvatarUploadConfirmationResult> {
    if (!this.actor.playerId)
      return { ok: false, code: "unauthorized", message: "Tu sesión ha caducado." };
    let asset: Awaited<ReturnType<MediaAssetCommands["readAvatar"]>> = null;
    try {
      asset = await this.mediaAssetCommands.readAvatar(input.assetId);
      if (!asset || asset.status !== "pending") {
        return { ok: false, code: "save_failed", message: "La subida ya no está disponible." };
      }
      const inspection = await this.mediaStorage.inspectUpload({ objectPath: asset.objectPath });
      const result = await this.mediaAssetCommands.confirmAvatar({
        assetId: input.assetId,
        idempotencyKey: input.idempotencyKey,
        ...inspection,
      });
      if (result.oldObjectPath?.startsWith("avatars/")) {
        await this.mediaStorage
          .deleteObject({ bucket: "avatars", objectPath: result.oldObjectPath })
          .catch(() => undefined);
      }
      const profile = await this.currentViewer.getCurrentViewer();
      if (!profile)
        return { ok: false, code: "save_failed", message: "No se ha podido confirmar el perfil." };
      return { ok: true, profile };
    } catch (error) {
      if (asset?.objectPath) {
        await this.mediaStorage
          .deleteObject({ bucket: "avatars", objectPath: asset.objectPath })
          .catch(() => undefined);
      }
      await this.mediaAssetCommands.abortAvatar({ assetId: input.assetId }).catch(() => undefined);
      const isInvalidFile =
        error instanceof Error &&
        ["unsupported_type", "too_large", "dimensions", "corrupt", "empty"].includes(error.message);
      const isConflict = error instanceof Error && error.message.includes("idempotency_conflict");
      return {
        ok: false,
        code: isInvalidFile ? "invalid_file" : isConflict ? "conflict" : "storage_unavailable",
        message: isInvalidFile
          ? "El archivo no es un JPEG, PNG o WebP válido de hasta 2048 px."
          : isConflict
            ? "La subida ya tiene otra solicitud asociada. Reinténtalo con una nueva selección."
            : "No se ha podido confirmar la imagen. Inténtalo de nuevo.",
      };
    }
  }

  async abortAvatar(assetId: string) {
    if (!this.actor.playerId) return;
    const asset = await this.mediaAssetCommands.readAvatar(assetId).catch(() => null);
    if (asset?.objectPath) {
      await this.mediaStorage
        .deleteObject({ bucket: "avatars", objectPath: asset.objectPath })
        .catch(() => undefined);
    }
    await this.mediaAssetCommands.abortAvatar({ assetId }).catch(() => undefined);
  }
}
