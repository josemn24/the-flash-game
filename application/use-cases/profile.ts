import { createHash } from "node:crypto";
import type { AuthenticatedActor } from "@/application/ports/actors";
import type {
  AvatarAssetRecord,
  AvatarCommandResult,
  AvatarConfirmationInput,
  MediaAssetCommands,
} from "@/application/ports/media-asset-commands";
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

export type AvatarEvent = "confirmation_pending" | "confirmation_recovered" | "cleanup_failed";

type ProfileUseCaseDependencies = {
  readonly onAvatarEvent?: (event: AvatarEvent, assetId: string) => void;
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
  private readonly onAvatarEvent: NonNullable<ProfileUseCaseDependencies["onAvatarEvent"]>;
  private readonly actor: AuthenticatedActor;
  private readonly currentViewer: ProfileUseCaseDependencies["currentViewer"];
  private readonly profileCommands: ProfileCommands;
  private readonly mediaAssetCommands: MediaAssetCommands;
  private readonly mediaStorage: MediaStorage;
  private readonly assetIdGenerator: NonNullable<ProfileUseCaseDependencies["assetIdGenerator"]>;

  constructor(dependencies: ProfileUseCaseDependencies) {
    this.onAvatarEvent = dependencies.onAvatarEvent ?? (() => undefined);
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
      const prepared = await this.mediaAssetCommands.prepareAvatar({
        assetId,
        objectPath,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        idempotencyKey: input.idempotencyKey,
      });
      if (prepared.status !== "pending") {
        return {
          ok: false,
          code: "conflict",
          message: "La subida ya no está pendiente. Recarga el perfil.",
        };
      }
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

  private observe(event: AvatarEvent, assetId: string) {
    // Observability must never change a confirmed result or authorize cleanup.
    try {
      this.onAvatarEvent(event, assetId);
    } catch {
      /* best effort */
    }
  }

  private async deleteClaimed(asset: AvatarAssetRecord | null) {
    if (!asset || asset.status !== "deleted") return;
    try {
      await this.mediaStorage.deleteObject({ bucket: "avatars", objectPath: asset.objectPath });
    } catch {
      this.observe("cleanup_failed", asset.assetId);
    }
  }

  private async confirmed(result: AvatarCommandResult): Promise<AvatarUploadConfirmationResult> {
    if (result.oldObjectPath) {
      try {
        const claim = await this.mediaAssetCommands.claimArchivedCleanup({
          objectPath: result.oldObjectPath,
        });
        await this.deleteClaimed(claim);
      } catch {
        this.observe("cleanup_failed", result.assetId);
      }
    }
    return { ok: true, profile: result.profile };
  }

  private confirmationError(error: unknown): AvatarUploadConfirmationResult {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("not_authorized")) {
      return { ok: false, code: "unauthorized", message: "Tu sesión ha caducado." };
    }
    if (message.includes("idempotency_conflict")) {
      return {
        ok: false,
        code: "conflict",
        message: "La subida ya tiene otra solicitud asociada. Recarga el perfil.",
      };
    }
    if (
      ["media_asset_not_pending", "media_asset_not_found", "invalid_avatar_upload"].some((code) =>
        message.includes(code),
      )
    ) {
      return {
        ok: false,
        code: "save_failed",
        message: "La subida ya no está disponible. Recarga el perfil.",
      };
    }
    return {
      ok: false,
      code: "confirmation_pending",
      message: "No hemos podido confirmar la imagen",
    };
  }

  async confirmAvatar(input: AvatarConfirmationInput): Promise<AvatarUploadConfirmationResult> {
    if (!this.actor.playerId)
      return { ok: false, code: "unauthorized", message: "Tu sesión ha caducado." };
    try {
      const saved = await this.mediaAssetCommands.readConfirmation(input);
      if (saved) {
        this.observe("confirmation_recovered", input.assetId);
        return this.confirmed(saved);
      }
      const asset = await this.mediaAssetCommands.readAvatar(input.assetId);
      if (!asset || asset.status !== "pending") {
        // A concurrent confirmation may have committed between the two reads.
        const committed = await this.mediaAssetCommands.readConfirmation(input);
        if (committed) return this.confirmed(committed);
        return {
          ok: false,
          code: "save_failed",
          message: "La subida ya no está disponible. Recarga el perfil.",
        };
      }
      let inspection;
      try {
        inspection = await this.mediaStorage.inspectUpload({ objectPath: asset.objectPath });
      } catch (error) {
        if (
          error instanceof Error &&
          ["unsupported_type", "too_large", "dimensions", "corrupt", "empty"].includes(
            error.message,
          )
        ) {
          await this.abortAvatar(input.assetId);
          return {
            ok: false,
            code: "invalid_file",
            message: "El archivo no es un JPEG, PNG o WebP válido de hasta 2048 px.",
          };
        }
        throw error;
      }
      const result = await this.mediaAssetCommands.confirmAvatar({ ...input, ...inspection });
      return this.confirmed(result);
    } catch (error) {
      // COMMIT acknowledgment can be lost. Absence/failure of this read never
      // proves the original transaction rolled back, so it never triggers abort.
      try {
        const committed = await this.mediaAssetCommands.readConfirmation(input);
        if (committed) {
          this.observe("confirmation_recovered", input.assetId);
          return this.confirmed(committed);
        }
      } catch (recoveryError) {
        const result = this.confirmationError(recoveryError);
        if (!result.ok && result.code !== "confirmation_pending") return result;
        this.observe("confirmation_pending", input.assetId);
        return result;
      }
      const result = this.confirmationError(error);
      if (!result.ok && result.code === "confirmation_pending")
        this.observe("confirmation_pending", input.assetId);
      return result;
    }
  }

  async abortAvatar(assetId: string) {
    if (!this.actor.playerId) return;
    try {
      // Only a committed tombstone grants permission to delete object bytes.
      const claimed = await this.mediaAssetCommands.abortAvatar({ assetId });
      await this.deleteClaimed(claimed);
    } catch {
      this.observe("cleanup_failed", assetId);
    }
  }
}
