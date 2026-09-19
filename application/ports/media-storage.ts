export type MediaUploadPreparation = {
  readonly assetId: string;
  readonly objectPath: string;
  readonly signedUploadUrl: string;
  readonly uploadToken: string;
  readonly expiresAt: string;
};

export type MediaUploadInspection = {
  readonly mimeType: "image/jpeg" | "image/png" | "image/webp";
  readonly byteSize: number;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
};

export type MediaBucket = "avatars" | "question-assets";

/** Server-only boundary for objects that have already been registered in SQL. */
export interface MediaStorage {
  prepareUpload(input: {
    readonly assetId: string;
    readonly objectPath: string;
    readonly bucket: MediaBucket;
    readonly mimeType: MediaUploadInspection["mimeType"];
  }): Promise<MediaUploadPreparation>;
  inspectUpload(input: { readonly objectPath: string }): Promise<MediaUploadInspection>;
  deleteObject(input: { readonly bucket: MediaBucket; readonly objectPath: string }): Promise<void>;
  createSignedReadUrl(input: {
    readonly bucket: MediaBucket;
    readonly objectPath: string;
    readonly expiresInSeconds: number;
  }): Promise<{ readonly signedUrl: string; readonly expiresAt: string }>;
  getPublicUrl(objectPath: string): string;
}
