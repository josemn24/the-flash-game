import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const shutdown = new AbortController();
const onSignal = () => shutdown.abort(new Error("Prueba de transporte interrumpida."));
process.once("SIGINT", onSignal);
process.once("SIGTERM", onSignal);

async function inspectRequest(request, response) {
  const hash = createHash("sha256");
  let byteSize = 0;
  // A truncated proxy body can leave Content-Length unsatisfied. Fail promptly.
  const timeout = setTimeout(() => request.destroy(new Error("Subida incompleta.")), 15_000);
  try {
    for await (const chunk of request) {
      byteSize += chunk.length;
      hash.update(chunk);
    }
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        method: request.method,
        url: request.url,
        complete: request.complete,
        byteSize,
        sha256: hash.digest("hex"),
      }),
    );
  } catch {
    response.destroy();
  } finally {
    clearTimeout(timeout);
  }
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  return server.address().port;
}

async function closeServer(server) {
  const closed = new Promise((resolve) => server.close(resolve));
  server.closeAllConnections();
  await closed;
}

async function prepareApp(directory) {
  // Copy the actual config and its pure dependencies, without application secrets.
  for (const file of [
    "next.config.ts",
    "lib/config/allowedDevOrigins.ts",
    "lib/media/localStorageProxy.ts",
    "lib/media/storageUrlPaths.ts",
    "lib/media/uploadLimits.ts",
  ]) {
    const target = path.join(directory, file);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(projectRoot, file), target);
  }
  await symlink(
    path.join(projectRoot, "node_modules"),
    path.join(directory, "node_modules"),
    "junction",
  );
  await writeFile(path.join(directory, "package.json"), '{"private":true}\n');
  await mkdir(path.join(directory, "app"));
  await writeFile(
    path.join(directory, "app/layout.js"),
    'export default function Layout({children}) { return <html lang="en"><body>{children}</body></html>; }\n',
  );
  await writeFile(
    path.join(directory, "app/page.js"),
    "export default function Page() { return <p>Storage proxy test</p>; }\n",
  );
}

async function waitForApp(url, child, signal) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error("Next.js terminó antes de estar disponible.");
    }
    try {
      const response = await fetch(url, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(2_000)]),
      });
      await response.arrayBuffer();
      if (response.ok) return;
    } catch {
      signal.throwIfAborted();
    }
    await delay(250, undefined, { signal });
  }
  throw new Error("Next.js no arrancó en 120 segundos.");
}

function signalChild(child, signal) {
  if (!child?.pid) return;
  try {
    if (process.platform === "win32") child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

async function stopChild(child, closed) {
  if (!child) return;
  signalChild(child, "SIGTERM");
  if (!(await Promise.race([closed.then(() => true), delay(5_000).then(() => false)]))) {
    signalChild(child, "SIGKILL");
    await closed;
  }
}

const upstream = createServer(inspectRequest);
let appDirectory, nextProcess, nextClosed;
let nextLogs = "";
try {
  appDirectory = await mkdtemp(path.join(os.tmpdir(), "flash-storage-proxy-"));
  await prepareApp(appDirectory);
  shutdown.signal.throwIfAborted();
  const storagePort = await listen(upstream);
  const portReservation = createServer();
  const appPort = await listen(portReservation);
  await closeServer(portReservation);
  const appOrigin = `http://127.0.0.1:${appPort}`;
  nextProcess = spawn(
    process.execPath,
    [
      path.join(projectRoot, "node_modules/next/dist/bin/next"),
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(appPort),
    ],
    {
      cwd: appDirectory,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        NODE_ENV: "development",
        NEXT_TELEMETRY_DISABLED: "1",
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${storagePort}`,
        FLASH_DEV_ALLOWED_ORIGINS: "",
        FLASH_NEXT_DIST_DIR: ".next",
      },
    },
  );
  nextClosed = new Promise((resolve) => nextProcess.once("close", resolve));
  nextProcess.once("error", (error) => shutdown.abort(error));
  for (const stream of [nextProcess.stdout, nextProcess.stderr]) {
    stream.on("data", (chunk) => {
      nextLogs = `${nextLogs}${chunk}`.slice(-8_000);
    });
  }
  await waitForApp(appOrigin, nextProcess, shutdown.signal);

  for (const [label, byteSize] of [
    ["1 KiB", 1024],
    ["11 MiB", 11 * 1024 * 1024],
    ["50 MiB", 50 * 1024 * 1024],
  ]) {
    const body = Buffer.alloc(byteSize).fill(Buffer.from("storage-proxy-integrity-test"));
    const objectPath = "upload/sign/question-assets/folder%20name/image%23%2B.png";
    const query = "token=test%2Bsignature%2Fvalue%3D&cacheControl=3600";
    const response = await fetch(
      `${appOrigin}/__local-supabase/storage/v1/object/${objectPath}?${query}`,
      {
        method: "PUT",
        headers: { "Content-Type": "image/png", "Cache-Control": "max-age=3600" },
        body,
        signal: AbortSignal.any([shutdown.signal, AbortSignal.timeout(30_000)]),
      },
    );
    assert.equal(response.status, 200, `HTTP de la subida de ${label}`);
    const received = await response.json();
    assert.equal(received.complete, true, `Cuerpo completo de ${label}`);
    assert.equal(received.method, "PUT");
    assert.equal(received.url, `/storage/v1/object/${objectPath}?${query}`);
    assert.equal(received.byteSize, byteSize, `Longitud de ${label}`);
    assert.equal(
      received.sha256,
      createHash("sha256").update(body).digest("hex"),
      `SHA-256 de ${label}`,
    );
    console.log(`✓ ${label}: longitud, SHA-256, ruta codificada y token conservados.`);
  }
} catch (error) {
  console.error(error);
  if (nextLogs) console.error(nextLogs);
  process.exitCode = 1;
} finally {
  try {
    await stopChild(nextProcess, nextClosed);
  } finally {
    await closeServer(upstream);
    if (appDirectory) await rm(appDirectory, { recursive: true, force: true });
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
  }
}
