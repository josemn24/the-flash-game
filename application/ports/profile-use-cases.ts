import type { MediaUploadPreparation } from "@/application/ports/media-storage";
import type { ProfileSaveResult } from "@/types/view-models/user-actions";
import type { ViewerProfile } from "@/types/view-models";

export type AvatarUploadPreparationResult =
  | ({ readonly ok: true } & MediaUploadPreparation & { readonly confirmIdempotencyKey: string })
  | {
      readonly ok: false;
      readonly code: "unauthorized" | "invalid_file" | "storage_unavailable" | "conflict";
      readonly message: string;
    };

export type AvatarUploadConfirmationResult =
  | { readonly ok: true; readonly profile: ViewerProfile }
  | {
      readonly ok: false;
      readonly code:
        | "unauthorized"
        | "invalid_file"
        | "storage_unavailable"
        | "save_failed"
        | "conflict"
        | "confirmation_pending";
      readonly message: string;
    };

export interface ProfileUseCases {
  getCurrentViewer(): Promise<ViewerProfile | null>;
  updateName(name: string): Promise<ProfileSaveResult>;
  prepareAvatar(input: {
    readonly mimeType: string;
    readonly byteSize: number;
    readonly idempotencyKey: string;
  }): Promise<AvatarUploadPreparationResult>;
  confirmAvatar(input: {
    readonly assetId: string;
    readonly idempotencyKey: string;
  }): Promise<AvatarUploadConfirmationResult>;
  abortAvatar(assetId: string): Promise<void>;
}
