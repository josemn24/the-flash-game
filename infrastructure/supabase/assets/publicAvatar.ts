import "server-only";

import { getSupabaseUrl } from "@/infrastructure/supabase/config";
import { resolveStorageBrowserUrl } from "./browserStorageUrl";

export function resolveAvatarPath(path: string | null | undefined) {
  if (!path) return undefined;
  // Existing local/legacy paths remain valid. Storage paths are stable object
  // names and are resolved to a public URL only at the server view-model edge.
  if (!path.startsWith("avatars/")) return resolveStorageBrowserUrl(path);
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return resolveStorageBrowserUrl(
    `${getSupabaseUrl().replace(/\/$/, "")}/storage/v1/object/public/avatars/${encodedPath}`,
  );
}
