import { test, expect } from "@playwright/test";
import { catalogExamples, catalogGroups } from "../features/design-system/registry";

test("production returns uncached 404s for the whole catalogue before authentication", async ({
  page,
  request,
}) => {
  const paths = [
    ...catalogGroups.flatMap((group) => group.items.map((item) => item.href)),
    ...catalogExamples.map((example) => `/design-system/preview/${example.id}`),
    "/design-system/unknown",
    "/demo/flash-pop/ui-kit",
    "/demo/flash-pop/ui-kit/",
  ];
  for (const path of paths) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
    expect(response.headers()["cache-control"], path).toBe("no-store");
    expect(response.headers()["x-robots-tag"], path).toBe("noindex, nofollow");
    expect(await response.text(), path).toBe("Not Found");
  }
  const legacy = await request.get("/flash-pop/ui-kit", { maxRedirects: 0 });
  expect(legacy.status()).toBe(308);
  expect((await request.get("/flash-pop/ui-kit")).status()).toBe(404);
  const rsc = await request.get("/design-system/componentes/botones", { headers: { RSC: "1" } });
  expect(rsc.status()).toBe(404);
  await page.goto("/design-system");
  await page.evaluate(async () => {
    const old = await caches.open("the-flash-pages-v2");
    await old.put("/demo/flash-pop/ui-kit", new Response("Old public UI kit"));
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  expect(await page.evaluate(() => caches.keys())).not.toContain("the-flash-pages-v2");
  for (const path of [
    "/design-system",
    "/design-system/preview/feedback",
    "/demo/flash-pop/ui-kit",
    "/flash-pop/ui-kit",
  ]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    expect(response?.fromServiceWorker()).toBe(false);
  }
  const cached = await page.evaluate(async () =>
    (
      await Promise.all(
        (await caches.keys()).map(async (name) =>
          (await (await caches.open(name)).keys()).map((entry) => new URL(entry.url).pathname),
        ),
      )
    ).flat(),
  );
  expect(
    cached.some(
      (path) =>
        path.startsWith("/design-system") ||
        path.startsWith("/demo/flash-pop/ui-kit") ||
        path === "/flash-pop/ui-kit",
    ),
  ).toBe(false);
});
