import { LOCAL_STORAGE_OBJECT_PATH } from "./storageUrlPaths";

/** Serve opaque remote sources and non-raster images without Next's optimizer. */
export function shouldBypassImageOptimization(src: string): boolean {
  return (
    /^https?:\/\//.test(src) ||
    src.startsWith(LOCAL_STORAGE_OBJECT_PATH) ||
    src.startsWith("data:") ||
    src.startsWith("blob:") ||
    src.split("?", 1)[0].endsWith(".svg")
  );
}
