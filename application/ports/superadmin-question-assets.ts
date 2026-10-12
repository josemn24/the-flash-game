import type { MediaStorage, MediaUploadInspection } from "@/application/ports/media-storage";

export type QuestionAssetStatus = "pending" | "ready" | "archived" | "deleted";

export type SuperadminQuestionAssetRecord = {
  readonly assetId: string;
  readonly objectPath: string;
  readonly status: QuestionAssetStatus;
};

export type SuperadminQuestionAssetCommands = {
  prepare(
    authUserId: string,
    input: {
      readonly assetId: string;
      readonly objectPath: string;
      readonly mimeType: string;
      readonly byteSize: number;
      readonly idempotencyKey: string;
    },
  ): Promise<SuperadminQuestionAssetRecord>;
  read(authUserId: string, assetId: string): Promise<SuperadminQuestionAssetRecord | null>;
  confirm(
    authUserId: string,
    input: Record<string, unknown>,
  ): Promise<SuperadminQuestionAssetRecord>;
  abort(
    authUserId: string,
    input: { readonly assetId: string },
  ): Promise<SuperadminQuestionAssetRecord>;
  archive(
    authUserId: string,
    input: { readonly assetId: string; readonly idempotencyKey: string; readonly reason: string },
  ): Promise<SuperadminQuestionAssetRecord>;
};

export type SuperadminQuestionAssetStorage = Pick<
  MediaStorage,
  "prepareUpload" | "inspectUpload" | "deleteObject" | "createSignedReadUrl"
>;

export type QuestionAssetIdGenerator = {
  generate(authUserId: string, idempotencyKey: string): string;
};

export type { MediaUploadInspection };
