import { LOCAL_STORAGE_OBJECT_PATH, STORAGE_OBJECT_PATH } from "./storageUrlPaths";

function getLocalStorageOrigin(
  supabaseUrl: string | undefined,
  nodeEnv: string | undefined,
): string | null {
  if (nodeEnv !== "development" || !supabaseUrl) return null;
  const url = new URL(supabaseUrl);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return null;
  return url.origin;
}

/** Only the local development stack is proxied; hosted Storage keeps its URLs. */
export function getLocalStorageRewrite(
  supabaseUrl: string | undefined,
  nodeEnv: string | undefined,
) {
  const origin = getLocalStorageOrigin(supabaseUrl, nodeEnv);
  if (!origin) return null;
  return {
    source: `${LOCAL_STORAGE_OBJECT_PATH}:path*`,
    destination: `${origin}${STORAGE_OBJECT_PATH}:path*`,
  };
}

export function resolveLocalStorageUrl(
  source: string,
  supabaseUrl: string | undefined,
  nodeEnv: string | undefined,
): string {
  const origin = getLocalStorageOrigin(supabaseUrl, nodeEnv);
  if (!origin) return source;
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return source;
  }
  if (url.origin !== origin || !url.pathname.startsWith(STORAGE_OBJECT_PATH)) {
    return source;
  }
  return `${LOCAL_STORAGE_OBJECT_PATH}${url.pathname.slice(STORAGE_OBJECT_PATH.length)}${url.search}${url.hash}`;
}
