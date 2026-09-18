import type { UserProfile } from "./user";

export type ProfileSaveResult =
  | { readonly ok: true; readonly profile: UserProfile }
  | {
      readonly ok: false;
      readonly code: "unauthorized" | "invalid_name" | "save_failed" | "invalid_file" | "storage_unavailable" | "conflict";
      readonly message: string;
    };
