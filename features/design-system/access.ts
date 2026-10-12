import { catalogGroups, findCatalogExample } from "./registry";

export function isDesignSystemPath(pathname: string) {
  return ["/design-system", "/demo/flash-pop/ui-kit"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isDesignSystemAvailable(environment: string | undefined) {
  return environment === "development";
}

export function isKnownDesignSystemPath(pathname: string) {
  const path = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (path === "/demo/flash-pop/ui-kit") return true;
  if (catalogGroups.some((group) => group.items.some((item) => item.href === path))) return true;
  const previewPrefix = "/design-system/preview/";
  return (
    path.startsWith(previewPrefix) && Boolean(findCatalogExample(path.slice(previewPrefix.length)))
  );
}
