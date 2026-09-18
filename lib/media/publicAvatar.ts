import "server-only";

import { supabaseMediaStorage } from "@/infrastructure/supabase/mediaStorage";

export function resolveAvatarPath(path: string | null | undefined) {
  if (!path) return undefined;
  // Existing local/legacy paths remain valid. Storage paths are stable object
  // names and are resolved to a public URL only at the server view-model edge.
  return path.startsWith("avatars/") ? supabaseMediaStorage.getPublicUrl(path) : path;
}
