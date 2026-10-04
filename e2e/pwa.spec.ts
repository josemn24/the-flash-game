import { expect, test, type Page } from "@playwright/test";

test.skip(process.env.PWA_E2E !== "1", "PWA checks require the production server.");

const publicPaths = [
  "/formatos",
  "/demo/flash-pop",
  "/demo/flash-pop-concepts",
  "/demo/flash-pop-typography",
  "/demo/flash-pop/ui-kit",
  "/demo/flash-pop/flash/tabarnia-flash-01",
];
const imagePath = "/flash-pop/concepts/pyramid-soft-diorama.webp";
const assetPaths = ["/icons/the-flash-192.png", imagePath];

async function controlWorker(page: Page) {
  await page.goto("/formatos");
  const worker = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return { scope: registration.scope, url: registration.active?.scriptURL };
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  return worker;
}

async function cacheSnapshot(page: Page) {
  return page.evaluate(async () => {
    const names = await caches.keys();
    return Promise.all(
      names.map(async (name) => {
        const cache = await caches.open(name);
        const requests = await cache.keys();
        return { name, urls: requests.map((request) => new URL(request.url).pathname) };
      }),
    );
  });
}

async function expectPublicPage(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
  expect(response?.fromServiceWorker()).toBe(true);
  await expect(page).toHaveURL(new URL(path, page.url()).href);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  if (path.startsWith("/demo/")) {
    await expect(page.locator('[data-surface="demo"]')).toBeVisible();
  }
}

test.describe("PWA service worker", () => {
  test("registers with the root scope and exposes the manifest", async ({ page }) => {
    const worker = await controlWorker(page);
    expect(worker.url).toBe(new URL("/sw.js", page.url()).href);
    expect(worker.scope).toBe(new URL("/", page.url()).href);

    const manifest = await page.request.get("/manifest.webmanifest");
    expect(manifest.ok()).toBe(true);
    expect(manifest.headers()["content-type"]).toContain("application/manifest+json");

    const workerResponse = await page.request.get("/sw.js");
    expect(workerResponse.ok()).toBe(true);
    expect(workerResponse.headers()["content-type"]).toContain("application/javascript");
    expect(workerResponse.headers()["cache-control"]).toContain("no-store");
  });

  test("caches current public pages and assets and loads them offline", async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    await controlWorker(page);
    for (const path of publicPaths) {
      await expectPublicPage(page, path);
    }

    const assetStatuses = await page.evaluate(async (paths) => {
      return Promise.all(paths.map(async (path) => (await fetch(path)).status));
    }, assetPaths);
    expect(assetStatuses).toEqual([200, 200]);

    const snapshot = await cacheSnapshot(page);
    const assets = snapshot.find((cache) => cache.name === "the-flash-assets-v1");
    const pages = snapshot.find((cache) => cache.name === "the-flash-pages-v2");
    expect(assets?.urls).toEqual(expect.arrayContaining(assetPaths));
    expect(pages?.urls).toEqual(expect.arrayContaining(publicPaths));
    expect(snapshot.some((cache) => cache.name === "the-flash-pages-v1")).toBe(false);

    await context.setOffline(true);
    for (const path of publicPaths) {
      await expectPublicPage(page, path);
    }
    const cachedImage = await page.evaluate(async (path) => {
      const response = await fetch(path);
      return { status: response.status, bytes: (await response.arrayBuffer()).byteLength };
    }, imagePath);
    expect(cachedImage.status).toBe(200);
    expect(cachedImage.bytes).toBeGreaterThan(0);
  });

  test("fails offline when a public page has not been visited", async ({ page, context }) => {
    await controlWorker(page);
    const unvisitedPath = "/demo/flash-pop/ui-kit";
    const snapshot = await cacheSnapshot(page);
    expect(snapshot.flatMap((cache) => cache.urls)).not.toContain(unvisitedPath);
    await context.setOffline(true);
    await expect(page.goto(unvisitedPath)).rejects.toThrow();
  });

  test("keeps historical redirects online and excluded routes out of the cache", async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    await controlWorker(page);
    const redirects = [
      ["/flash-pop", "/demo/flash-pop"],
      ["/flash-pop/ui-kit", "/demo/flash-pop/ui-kit"],
      ["/flash-pop/flash/tabarnia-flash-01", "/demo/flash-pop/flash/tabarnia-flash-01"],
      ["/flash-pop-concepts", "/demo/flash-pop-concepts"],
      ["/flash-pop-typography", "/demo/flash-pop-typography"],
    ];
    for (const [previousPath, currentPath] of redirects) {
      const redirect = await page.request.get(previousPath, { maxRedirects: 0 });
      expect(redirect.status()).toBe(308);
      expect(new URL(redirect.headers().location, page.url()).pathname).toBe(currentPath);
      const response = await page.goto(previousPath);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveURL(new URL(currentPath, page.url()).href);
    }

    const excludedPaths = [
      "/",
      "/admin",
      "/salas/pwa-cache-check",
      "/desafios/tabarnia-challenge-05",
      "/demo/flash-pop/desafios/tabarnia-challenge-05",
    ];
    for (const path of excludedPaths) {
      // Isolate streamed client redirects from subsequent navigations and cache inspection.
      const excludedPage = await context.newPage();
      try {
        await excludedPage.goto(new URL(path, page.url()).href);
      } finally {
        await excludedPage.close();
      }
    }
    const apiPath = "/api/internal/health";
    const apiStatus = await page.evaluate(async (path) => (await fetch(path)).status, apiPath);
    expect(apiStatus).toBe(401);
    const snapshot = await cacheSnapshot(page);
    const cachedPaths = snapshot.flatMap((cache) => cache.urls);
    for (const path of [
      apiPath,
      ...excludedPaths,
      ...redirects.map(([previousPath]) => previousPath),
    ]) {
      expect(cachedPaths).not.toContain(path);
    }
    for (const prefix of ["/admin", "/api", "/salas", "/desafios", "/demo/flash-pop/desafios"]) {
      expect(cachedPaths.some((path) => path === prefix || path.startsWith(`${prefix}/`))).toBe(
        false,
      );
    }
  });

  test("does not replay competitive POST requests", async ({ page }) => {
    await controlWorker(page);
    let requestCount = 0;
    await page.route("**/api/competitive/**", async (route) => {
      requestCount += 1;
      await route.fulfill({ status: 418, body: "test" });
    });

    const status = await page.evaluate(async () => {
      const response = await fetch("/api/competitive/attempts/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      return response.status;
    });
    expect(status).toBe(418);
    expect(requestCount).toBe(1);
    const snapshot = await cacheSnapshot(page);
    expect(snapshot.flatMap((cache) => cache.urls)).not.toContain(
      "/api/competitive/attempts/start",
    );
  });
});
