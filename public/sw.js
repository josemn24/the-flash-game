const ASSET_CACHE = "the-flash-assets-v1";
const PAGE_CACHE = "the-flash-pages-v1";

const CACHE_NAMES = new Set([ASSET_CACHE, PAGE_CACHE]);
const STATIC_PREFIXES = ["/_next/static/", "/icons/", "/dictionaries/", "/visuals/"];
const PUBLIC_PAGE_PREFIXES = [
  "/formatos",
  "/flash-pop",
  "/flash-pop-concepts",
  "/flash-pop-typography",
];
const EXCLUDED_PREFIXES = ["/admin", "/api", "/desafios", "/salas"];
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

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(PAGE_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("The requested public page is unavailable offline.");
  }
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith("the-flash-") && !CACHE_NAMES.has(cacheName))
          .map((cacheName) => caches.delete(cacheName)),
      ),
    ).then(() => self.clients.claim()),
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
