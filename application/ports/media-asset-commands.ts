export type AvatarAssetRecord = {
  readonly assetId: string;
  readonly objectPath: string;
  readonly status: "pending" | "ready" | "archived" | "deleted";
};

export type AvatarCommandResult = {
  readonly assetId: string;
  readonly objectPath: string;
  readonly oldObjectPath: string | null;
  readonly profile: {
    readonly playerId: string;
    readonly name: string;
    readonly avatarPath: string;
  };
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
  confirmAvatar(input: Record<string, unknown>): Promise<AvatarCommandResult>;
  abortAvatar(input: { readonly assetId: string }): Promise<AvatarAssetRecord>;
}
