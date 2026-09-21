import { expect, test } from "@playwright/test";

test.skip(process.env.PWA_E2E !== "1", "PWA checks require the production server.");

test.describe("PWA service worker", () => {
  test("registers with the root scope and exposes the manifest", async ({ page }) => {
    const workerPromise = page.context().waitForEvent("serviceworker");
    await page.goto("/formatos");
    const worker = await workerPromise;
    expect(worker.url()).toBe(new URL("/sw.js", page.url()).toString());
    expect(await page.evaluate(() => "serviceWorker" in navigator)).toBe(true);

    const manifest = await page.request.get("/manifest.webmanifest");
    expect(manifest.ok()).toBe(true);
    expect(manifest.headers()["content-type"]).toContain("application/manifest+json");

    const workerResponse = await page.request.get("/sw.js");
    expect(workerResponse.ok()).toBe(true);
    expect(workerResponse.headers()["content-type"]).toContain("application/javascript");
    expect(workerResponse.headers()["cache-control"]).toContain("no-store");
  });

  test("caches public assets and pages without caching private routes", async ({ page }) => {
    const workerPromise = page.context().waitForEvent("serviceworker");
    await page.goto("/formatos");
    await workerPromise;
    await page.reload();

    const assetStatus = await page.evaluate(async () => {
      const response = await fetch("/icons/the-flash-192.png");
      return response.status;
    });
    expect(assetStatus).toBe(200);

    const cacheSnapshot = await page.evaluate(async () => {
      const names = await caches.keys();
      const entries = await Promise.all(
        names.map(async (name) => {
          const cache = await caches.open(name);
          const requests = await cache.keys();
          return { name, urls: requests.map((request) => new URL(request.url).pathname) };
        }),
      );
      return entries;
    });

    const assets = cacheSnapshot.find((cache) => cache.name === "the-flash-assets-v1");
    const pages = cacheSnapshot.find((cache) => cache.name === "the-flash-pages-v1");
    expect(assets?.urls).toContain("/icons/the-flash-192.png");
    expect(pages?.urls.some((url) => url === "/formatos" || url.startsWith("/formatos/"))).toBe(
      true,
    );

    const cachedPaths = cacheSnapshot.flatMap((cache) => cache.urls);
    expect(cachedPaths.some((url) => url === "/" || url.startsWith("/admin/"))).toBe(false);
    expect(cachedPaths.some((url) => url.startsWith("/salas/") || url.startsWith("/desafios/"))).toBe(
      false,
    );
  });

  test("does not replay competitive POST requests", async ({ page }) => {
    let requestCount = 0;
    await page.route("**/api/competitive/**", async (route) => {
      requestCount += 1;
      await route.fulfill({ status: 418, body: "test" });
    });

    await page.goto("/formatos");
    await page.reload();
    await page.evaluate(async () => {
      await fetch("/api/competitive/attempts/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
    });

    expect(requestCount).toBe(1);
  });
});
