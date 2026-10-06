// Isolated test-only upstream. Server-side fetches really go through this server.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

const appPort = process.env.AUTH_OUTAGE_APP_PORT || "3319";
const upstreamPort = Number(process.env.AUTH_OUTAGE_UPSTREAM_PORT || "54329");
const distDir = ".next/auth-outage";
const savedConfig = await readFile("tsconfig.json", "utf8");
const savedNextEnv = await readFile("next-env.d.ts", "utf8").catch(() => "");
let mode = "healthy";
let authRequests = 0;
const pending = new Set();
const encode = (data) => Buffer.from(JSON.stringify(data)).toString("base64url");
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "outage@example.com",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
function session() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, exp })}.${Buffer.from("synthetic-test-signature").toString("base64url")}`,
    refresh_token: "synthetic-outage-refresh-token",
    expires_at: exp,
    expires_in: 3600,
    token_type: "bearer",
    user,
  };
}
function json(response, value, status = 200) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "x-supabase-api-version": "2024-01-01",
  });
  response.end(JSON.stringify(value));
}
const upstream = createServer(async (request, response) => {
  const path = new URL(request.url, "http://localhost").pathname;
  if (path === "/__test/control") {
    if (request.method === "POST") {
      let body = "";
      for await (const chunk of request) body += chunk;
      const input = JSON.parse(body);
      if (
        !["healthy", "connection", "service", "hang", "invalid", "rate_limit"].includes(input.mode)
      ) {
        return json(response, { error: "invalid mode" }, 400);
      }
      mode = input.mode;
      authRequests = 0;
      for (const previous of pending) previous.destroy();
      pending.clear();
    }
    return json(response, { mode, authRequests });
  }
  if (path.startsWith("/auth/v1/")) {
    authRequests++;
    if (mode === "connection") return request.socket.destroy();
    if (mode === "service") return json(response, {}, 503);
    if (mode === "hang") {
      pending.add(response);
      response.on("close", () => pending.delete(response));
      return;
    }
    if (mode === "invalid")
      return json(
        response,
        { code: "refresh_token_not_found", message: "Invalid refresh token" },
        400,
      );
    if (mode === "rate_limit")
      return json(response, { code: "over_request_rate_limit", message: "Try later" }, 429);
    if (path.endsWith("/token")) return json(response, session());
    if (path.endsWith("/user")) return json(response, user);
    if (path.endsWith("/logout")) {
      response.writeHead(204);
      return response.end();
    }
  }
  if (path === "/rest/v1/rpc/provision_player") {
    return json(response, [
      { player_id: user.id, display_name: "Outage test", avatar_path: null, status: "active" },
    ]);
  }
  if (path === "/rest/v1/rpc/get_my_room_cards") return json(response, []);
  json(response, { error: "unknown test endpoint" }, 404);
});
await new Promise((resolve) => upstream.listen(upstreamPort, "127.0.0.1", resolve));
const next = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", appPort],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      FLASH_NEXT_DIST_DIR: distDir,
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${upstreamPort}`,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-outage-publishable-key",
      FLASH_RUNTIME_SCOPE: "pilot",
      APP_ORIGIN: `http://127.0.0.1:${appPort}`,
    },
  },
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  next.kill("SIGTERM");
  for (const response of pending) response.destroy();
  upstream.closeAllConnections();
  upstream.close();
  // Match the existing isolated E2E runner: remove only Next's generated includes.
  const current = JSON.parse(await readFile("tsconfig.json", "utf8"));
  const original = JSON.parse(savedConfig);
  current.include = current.include.filter(
    (entry) => !entry.startsWith(`${distDir}/`) || original.include.includes(entry),
  );
  await writeFile(
    "tsconfig.json",
    JSON.stringify(current) === JSON.stringify(original)
      ? savedConfig
      : `${JSON.stringify(current, null, 2)}\n`,
  );
  const nextEnv = await readFile("next-env.d.ts", "utf8").catch(() => "");
  const originalImport = savedNextEnv.match(/^import .*routes\.d\.ts.*;$/m)?.[0];
  if (originalImport && nextEnv.includes(`./${distDir}/`)) {
    await writeFile(
      "next-env.d.ts",
      nextEnv.replace(/^import .*routes\.d\.ts.*;$/m, originalImport),
    );
  }
}
process.on("SIGTERM", () => {
  void stop().then(() => process.exit(0));
});
process.on("SIGINT", () => {
  void stop().then(() => process.exit(0));
});
next.on("exit", (code) => {
  if (stopping) return;
  void stop().then(() => process.exit(code ?? 1));
});
