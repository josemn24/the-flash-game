import type { ViewerProfile } from "@/types/view-models";

export type AvatarAssetRecord = {
  readonly assetId: string;
  readonly objectPath: string;
  readonly status: "pending" | "ready" | "archived" | "deleted";
};

export type AvatarCommandResult = {
  readonly assetId: string;
  readonly objectPath: string;
  readonly oldObjectPath: string | null;
  readonly profile: ViewerProfile;
};

export type AvatarConfirmationInput = {
  readonly assetId: string;
  readonly idempotencyKey: string;
};

export type AvatarInspection = {
  readonly mimeType: "image/jpeg" | "image/png" | "image/webp";
  readonly byteSize: number;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
};

export interface MediaAssetCommands {
  prepareAvatar(input: {
    readonly assetId: string;
    readonly objectPath: string;
    readonly mimeType: string;
    readonly byteSize: number;
    readonly idempotencyKey: string;
  }): Promise<AvatarAssetRecord>;
  readAvatar(assetId: string): Promise<AvatarAssetRecord | null>;
  readConfirmation(input: AvatarConfirmationInput): Promise<AvatarCommandResult | null>;
  confirmAvatar(input: AvatarConfirmationInput & AvatarInspection): Promise<AvatarCommandResult>;
  abortAvatar(input: { readonly assetId: string }): Promise<AvatarAssetRecord>;
  claimArchivedCleanup(input: { readonly objectPath: string }): Promise<AvatarAssetRecord | null>;
}
