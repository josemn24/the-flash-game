import { execFile } from "node:child_process";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const execFileAsync = promisify(execFile);
const workerSource = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
const origin = "https://the-flash.example";
const pageCacheName = "the-flash-pages-v2";
const assetCacheName = "the-flash-assets-v1";

function request(path, { method = "GET", mode = "navigate", headers = {} } = {}) {
  return { url: new URL(path, origin).href, method, mode, headers: new Headers(headers) };
}

function response(body = "public content", { status = 200, type = "basic" } = {}) {
  const result = new Response(body, { status });
  Object.defineProperty(result, "type", { value: type });
  return result;
}

function createWorker() {
  const listeners = new Map();
  const cacheEntries = new Map();
  const fetchRequests = [];
  let fetchImplementation = () => response();
  let claimed = false;
  const cacheStorage = {
    async open(name) {
      if (!cacheEntries.has(name)) cacheEntries.set(name, new Map());
      const entries = cacheEntries.get(name);
      return {
        async match(request) {
          return entries.get(request.url)?.clone();
        },
        async put(request, response) {
          entries.set(request.url, response.clone());
        },
      };
    },
    async keys() {
      return [...cacheEntries.keys()];
    },
    async delete(name) {
      return cacheEntries.delete(name);
    },
  };

  runInNewContext(workerSource, {
    URL,
    self: {
      location: { origin },
      addEventListener: (name, listener) => listeners.set(name, listener),
      clients: {
        async claim() {
          claimed = true;
        },
      },
    },
    caches: cacheStorage,
    async fetch(request) {
      fetchRequests.push(request);
      return fetchImplementation(request);
    },
  });

  return {
    caches: cacheStorage,
    fetchRequests,
    setFetch: (implementation) => (fetchImplementation = implementation),
    hasClaimedClients: () => claimed,
    dispatchFetch(request) {
      let pendingResponse;
      listeners.get("fetch")({
        request,
        respondWith(result) {
          assert.equal(pendingResponse, undefined);
          pendingResponse = Promise.resolve(result);
        },
      });
      return pendingResponse;
    },
    async activate() {
      let pendingActivation;
      listeners.get("activate")({
        waitUntil: (result) => (pendingActivation = result),
      });
      assert.ok(pendingActivation);
      await pendingActivation;
    },
  };
}

test("service worker is valid JavaScript", async () => {
  await execFileAsync(process.execPath, ["--check", "public/sw.js"]);
});

test("caches current public pages, including nested demo and practice routes", async (t) => {
  for (const path of [
    "/formatos",
    "/formatos/eleccion-multiple",
    "/demo/flash-pop",
    "/demo/flash-pop/",
    "/demo/flash-pop/ui-kit",
    "/demo/flash-pop/flash/tabarnia-flash-01",
    "/demo/flash-pop-concepts",
    "/demo/flash-pop-typography",
  ]) {
    await t.test(path, async () => {
      const worker = createWorker();
      const pageRequest = request(path);
      const pendingResponse = worker.dispatchFetch(pageRequest);
      assert.ok(pendingResponse);
      assert.equal((await pendingResponse).status, 200);
      const cache = await worker.caches.open(pageCacheName);
      assert.equal(await (await cache.match(pageRequest)).text(), "public content");
      assert.deepEqual(worker.fetchRequests, [pageRequest]);
    });
  }
});

test("does not intercept historical pages, excluded paths, or lookalike prefixes", () => {
  const worker = createWorker();
  for (const path of [
    "/flash-pop",
    "/flash-pop/ui-kit",
    "/flash-pop-concepts",
    "/flash-pop-typography",
    "/",
    "/manifest.webmanifest",
    "/sw.js",
    "/admin",
    "/admin/users",
    "/api",
    "/api/private.json",
    "/desafios",
    "/desafios/tabarnia-challenge-05",
    "/salas",
    "/salas/private/avatar.png",
    "/demo/flash-pop/desafios",
    "/demo/flash-pop/desafios/tabarnia-challenge-05",
    "/demo/flash-pop/desafios/private.json",
    "/demo/other",
    "/demo/flash-population",
    "/demo/flash-pop-concepts-extra",
    "/demo/flash-pop-typography-extra",
    "/formatos-private",
  ]) {
    assert.equal(worker.dispatchFetch(request(path)), undefined, path);
  }
  assert.equal(worker.fetchRequests.length, 0);
});

test("does not intercept POST, RSC, prefetch, or cross-origin requests", () => {
  const worker = createWorker();
  for (const path of ["/demo/flash-pop", "/icons/the-flash-192.png"]) {
    for (const options of [
      { method: "POST" },
      { headers: { RSC: "1" } },
      { headers: { "Next-Router-Prefetch": "1" } },
      { headers: { Purpose: "prefetch" } },
    ]) {
      assert.equal(worker.dispatchFetch(request(path, options)), undefined);
    }
    assert.equal(worker.dispatchFetch(request(`https://another.example${path}`)), undefined);
  }
  assert.equal(worker.dispatchFetch(request("/demo/flash-pop", { mode: "cors" })), undefined);
  assert.equal(worker.fetchRequests.length, 0);
});

test("refreshes cached pages from the network and falls back only when the network fails", async () => {
  const worker = createWorker();
  const pageRequest = request("/demo/flash-pop");
  const cache = await worker.caches.open(pageCacheName);
  await cache.put(pageRequest, response("previous page"));
  worker.setFetch(() => response("updated page"));
  assert.equal(await (await worker.dispatchFetch(pageRequest)).text(), "updated page");
  assert.equal(await (await cache.match(pageRequest)).text(), "updated page");

  worker.setFetch(() => {
    throw new TypeError("offline");
  });
  assert.equal(await (await worker.dispatchFetch(pageRequest)).text(), "updated page");
  assert.equal(worker.fetchRequests.length, 2);
  await assert.rejects(
    worker.dispatchFetch(request("/demo/flash-pop/ui-kit")),
    /The requested public page is unavailable offline/,
  );
});

test("does not cache HTTP errors or non-basic responses, or mask them with a cached page", async (t) => {
  for (const options of [{ status: 404 }, { status: 500 }, { type: "cors" }]) {
    await t.test(JSON.stringify(options), async () => {
      const worker = createWorker();
      const pageRequest = request("/demo/flash-pop");
      const cache = await worker.caches.open(pageCacheName);
      const networkResponse = response("not cacheable", options);
      worker.setFetch(() => networkResponse);
      assert.equal(await worker.dispatchFetch(pageRequest), networkResponse);
      assert.equal(await cache.match(pageRequest), undefined);

      await cache.put(pageRequest, response("previous page"));
      assert.equal(await worker.dispatchFetch(pageRequest), networkResponse);
      assert.equal(await (await cache.match(pageRequest)).text(), "previous page");
    });
  }
});

test("keeps historical image URLs in the asset cache and serves them before the network", async () => {
  const worker = createWorker();
  const imageRequest = request("/flash-pop/concepts/pyramid-soft-diorama.webp", { mode: "cors" });
  worker.setFetch(() => response("image bytes"));
  assert.equal(await (await worker.dispatchFetch(imageRequest)).text(), "image bytes");
  assert.deepEqual(await worker.caches.keys(), [assetCacheName]);

  worker.setFetch(() => {
    throw new TypeError("offline");
  });
  assert.equal(await (await worker.dispatchFetch(imageRequest)).text(), "image bytes");
  assert.equal(worker.fetchRequests.length, 1);
});

test("does not cache failed asset responses", async () => {
  const worker = createWorker();
  const imageRequest = request("/flash-pop/concepts/missing.webp", { mode: "cors" });
  worker.setFetch(() => response("missing image", { status: 404 }));
  assert.equal((await worker.dispatchFetch(imageRequest)).status, 404);
  const cache = await worker.caches.open(assetCacheName);
  assert.equal(await cache.match(imageRequest), undefined);
});

test("activation removes pages v1 while preserving current assets, pages v2, and unrelated caches", async () => {
  const worker = createWorker();
  const oldRequest = request("/flash-pop");
  const imageRequest = request("/flash-pop/concepts/pyramid-soft-diorama.webp");
  const pageRequest = request("/demo/flash-pop");
  await (await worker.caches.open("the-flash-pages-v1")).put(oldRequest, response("old page"));
  await (await worker.caches.open(assetCacheName)).put(imageRequest, response("image bytes"));
  await (await worker.caches.open(pageCacheName)).put(pageRequest, response("current page"));
  await (await worker.caches.open("another-app-v1")).put(oldRequest, response("unrelated"));

  await worker.activate();
  assert.deepEqual(
    (await worker.caches.keys()).sort(),
    [assetCacheName, pageCacheName, "another-app-v1"].sort(),
  );
  assert.equal(
    await (await (await worker.caches.open(assetCacheName)).match(imageRequest)).text(),
    "image bytes",
  );
  assert.equal(
    await (await (await worker.caches.open(pageCacheName)).match(pageRequest)).text(),
    "current page",
  );
  assert.equal(
    await (await (await worker.caches.open("another-app-v1")).match(oldRequest)).text(),
    "unrelated",
  );
  assert.equal(worker.hasClaimedClients(), true);
});
