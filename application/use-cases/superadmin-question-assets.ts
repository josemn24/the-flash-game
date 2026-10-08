import {
  AuthenticationRequiredError,
  SuperadminAccessDeniedError,
} from "@/application/administration/errors";
import type {
  SuperadminQuestionAssetCommands,
  SuperadminQuestionAssetStorage,
} from "@/application/ports/superadmin-question-assets";
import type { ApplicationSuperadminAccess } from "@/application/use-cases/superadmin";
import {
  AVATAR_ALLOWED_MIME_TYPES,
  QUESTION_ASSET_MAX_BYTES,
  QUESTION_ASSET_MAX_DIMENSION,
} from "@/lib/media/avatarValidation";

const QUESTION_ASSET_MIME_TYPES = AVATAR_ALLOWED_MIME_TYPES;
type QuestionAssetMimeType = (typeof QUESTION_ASSET_MIME_TYPES)[number];

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

type Dependencies = {
  readonly access: ApplicationSuperadminAccess;
  readonly commands: SuperadminQuestionAssetCommands;
  readonly storage: SuperadminQuestionAssetStorage;
  readonly ids: { generate(authUserId: string, idempotencyKey: string): string };
};

function assetExtension(mimeType: QuestionAssetMimeType) {
  return mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp";
}

function isAuthorizationFailure(error: unknown) {
  return (
    error instanceof AuthenticationRequiredError ||
    error instanceof SuperadminAccessDeniedError ||
    (error instanceof Error && ["unauthorized", "not_authorized"].includes(error.message))
  );
}

function isConflict(error: unknown) {
  return error instanceof Error && error.message.includes("idempotency_conflict");
}

export class SuperadminQuestionAssets {
  constructor(private readonly dependencies: Dependencies) {}

  async prepare(input: {
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
      return {
        ok: false,
        code: "invalid_file",
        message: "Elige un JPEG, PNG o WebP de hasta 50 MiB.",
      };
    }

    try {
      const access = await this.dependencies.access.requireAccess();
      const assetId = this.dependencies.ids.generate(access.authUserId, input.idempotencyKey);
      const objectPath = `question-assets/${assetId}.${assetExtension(input.mimeType as QuestionAssetMimeType)}`;
      await this.dependencies.commands.prepare(access.authUserId, {
        assetId,
        objectPath,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        idempotencyKey: input.idempotencyKey,
      });
      const upload = await this.dependencies.storage.prepareUpload({
        assetId,
        objectPath,
        bucket: "question-assets",
        mimeType: input.mimeType as QuestionAssetMimeType,
      });
      return { ok: true, ...upload, confirmIdempotencyKey: `confirm:${input.idempotencyKey}` };
    } catch (error) {
      return this.mapPreparationError(error);
    }
  }

  async confirm(input: { readonly assetId: string; readonly idempotencyKey: string }): Promise<
    | {
        readonly ok: true;
        readonly assetId: string;
        readonly status: "ready";
        readonly width: number;
        readonly height: number;
      }
    | QuestionAssetOperationError
  > {
    let authUserId: string | null = null;
    try {
      const access = await this.dependencies.access.requireAccess();
      authUserId = access.authUserId;
      const asset = await this.dependencies.commands.read(authUserId, input.assetId);
      if (!asset) return { ok: false, code: "invalid_file", message: "El asset no existe." };
      const inspection = await this.dependencies.storage.inspectUpload({
        objectPath: asset.objectPath,
      });
      if (
        inspection.width > QUESTION_ASSET_MAX_DIMENSION ||
        inspection.height > QUESTION_ASSET_MAX_DIMENSION
      ) {
        throw new Error("invalid_file");
      }
      const confirmed = await this.dependencies.commands.confirm(authUserId, {
        idempotencyKey: input.idempotencyKey,
        assetId: input.assetId,
        ...inspection,
      });
      return {
        ok: true,
        assetId: confirmed.assetId,
        status: "ready",
        width: inspection.width,
        height: inspection.height,
      };
    } catch (error) {
      await this.cleanupPending(authUserId, input.assetId);
      if (isAuthorizationFailure(error)) {
        return {
          ok: false,
          code: "unauthorized",
          message: "No tienes permisos para confirmar assets.",
        };
      }
      if (isConflict(error)) {
        return {
          ok: false,
          code: "conflict",
          message: "Esta confirmación ya se usó con otros datos.",
        };
      }
      return {
        ok: false,
        code: "invalid_file",
        message: "El archivo no es una imagen válida o no se pudo inspeccionar.",
      };
    }
  }

  async abort(assetId: string) {
    const access = await this.dependencies.access.requireAccess();
    const asset = await this.dependencies.commands.read(access.authUserId, assetId);
    if (!asset) return;
    await this.dependencies.storage
      .deleteObject({ bucket: "question-assets", objectPath: asset.objectPath })
      .catch(() => undefined);
    await this.dependencies.commands.abort(access.authUserId, { assetId });
  }

  async preview(assetId: string) {
    const access = await this.dependencies.access.requireAccess();
    const asset = await this.dependencies.commands.read(access.authUserId, assetId);
    if (!asset || !["ready", "archived"].includes(asset.status)) {
      throw new Error("media_asset_not_ready");
    }
    return this.dependencies.storage.createSignedReadUrl({
      bucket: "question-assets",
      objectPath: asset.objectPath,
      expiresInSeconds: 300,
    });
  }

  async archive(input: {
    readonly assetId: string;
    readonly idempotencyKey: string;
    readonly reason: string;
  }) {
    const access = await this.dependencies.access.requireAccess();
    return this.dependencies.commands.archive(access.authUserId, input);
  }

  private async cleanupPending(authUserId: string | null, assetId: string) {
    if (!authUserId) return;
    const asset = await this.dependencies.commands.read(authUserId, assetId).catch(() => null);
    if (asset?.status !== "pending") return;
    await this.dependencies.storage
      .deleteObject({ bucket: "question-assets", objectPath: asset.objectPath })
      .catch(() => undefined);
    await this.dependencies.commands.abort(authUserId, { assetId }).catch(() => undefined);
  }

  private mapPreparationError(error: unknown): QuestionAssetOperationError {
    if (isAuthorizationFailure(error)) {
      return { ok: false, code: "unauthorized", message: "No tienes permisos para subir assets." };
    }
    if (isConflict(error)) {
      return { ok: false, code: "conflict", message: "Esta subida ya se inició con otros datos." };
    }
    return {
      ok: false,
      code: "storage_unavailable",
      message: "No se ha podido preparar la subida.",
    };
  }
}
