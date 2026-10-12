const ASSET_CACHE = "the-flash-assets-v1";
const PAGE_CACHE = "the-flash-pages-v3";

const CACHE_NAMES = new Set([ASSET_CACHE, PAGE_CACHE]);
const STATIC_PREFIXES = ["/_next/static/", "/icons/", "/dictionaries/", "/visuals/"];
const PUBLIC_PAGE_PREFIXES = [
  "/formatos",
  "/demo/flash-pop",
  "/demo/flash-pop-concepts",
  "/demo/flash-pop-typography",
];
const EXCLUDED_PREFIXES = [
  "/admin",
  "/api",
  "/desafios",
  "/salas",
  "/demo/flash-pop/desafios",
  "/design-system",
  "/demo/flash-pop/ui-kit",
  "/flash-pop/ui-kit",
];
const STATIC_FILE_PATTERN = /\.(?:avif|css|gif|ico|jpeg|jpg|js|json|mjs|png|svg|webp|woff2?)$/i;

function matchesPath(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isExcludedPath(pathname) {
  return (
    pathname === "/" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    EXCLUDED_PREFIXES.some((prefix) => matchesPath(pathname, prefix))
  );
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isExcludedRequest(request) {
  return (
    request.method !== "GET" ||
    request.headers.has("RSC") ||
    request.headers.has("Next-Router-Prefetch") ||
    request.headers.get("Purpose") === "prefetch"
  );
}

function isStaticAssetRequest(request, url) {
  if (isExcludedRequest(request) || !isSameOrigin(url) || isExcludedPath(url.pathname)) {
    return false;
  }

  return (
    STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)) ||
    STATIC_FILE_PATTERN.test(url.pathname)
  );
}

function isPublicNavigationRequest(request, url) {
  if (
    isExcludedRequest(request) ||
    request.mode !== "navigate" ||
    !isSameOrigin(url) ||
    isExcludedPath(url.pathname)
  ) {
    return false;
  }

  return PUBLIC_PAGE_PREFIXES.some((prefix) => matchesPath(url.pathname, prefix));
}

function reportCacheFailure(operation, cacheName, error) {
  console.warn("The Flash cache operation failed.", {
    operation,
    cacheName,
    error,
  });
}

async function openCacheBestEffort(cacheName) {
  try {
    return await caches.open(cacheName);
  } catch (error) {
    reportCacheFailure("open", cacheName, error);
    return null;
  }
}

async function matchCacheBestEffort(cache, request, cacheName) {
  if (!cache) return undefined;

  try {
    return await cache.match(request);
  } catch (error) {
    reportCacheFailure("match", cacheName, error);
    return undefined;
  }
}

async function putCacheBestEffort(cache, request, response, cacheName) {
  if (!cache) return;

  try {
    await cache.put(request, response.clone());
  } catch (error) {
    reportCacheFailure("put", cacheName, error);
  }
}

async function cacheFirst(request) {
  const cache = await openCacheBestEffort(ASSET_CACHE);
  const cached = await matchCacheBestEffort(cache, request, ASSET_CACHE);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    void putCacheBestEffort(cache, request, response, ASSET_CACHE);
  }
  return response;
}

async function networkFirst(request) {
  const cache = await openCacheBestEffort(PAGE_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      void putCacheBestEffort(cache, request, response, PAGE_CACHE);
    }
    return response;
  } catch {
    const cached = await matchCacheBestEffort(cache, request, PAGE_CACHE);
    if (cached) return cached;
    throw new Error("The requested public page is unavailable offline.");
  }
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) => cacheName.startsWith("the-flash-") && !CACHE_NAMES.has(cacheName),
            )
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (isStaticAssetRequest(event.request, url)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  if (isPublicNavigationRequest(event.request, url)) {
    event.respondWith(networkFirst(event.request));
  }
});
