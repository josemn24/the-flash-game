import "server-only";

import { resolveLocalStorageUrl } from "@/lib/media/localStorageProxy";

export function resolveStorageBrowserUrl(source: string): string {
  return resolveLocalStorageUrl(source, process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NODE_ENV);
}
