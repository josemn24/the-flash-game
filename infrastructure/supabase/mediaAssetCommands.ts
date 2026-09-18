import "server-only";

import { Pool, type PoolClient } from "pg";

const poolKey = Symbol.for("the-flash-game.supabase.media-asset-pool");
const globalPool = globalThis as typeof globalThis & { [poolKey]?: Pool };

export type AvatarAssetRecord = {
  assetId: string;
  objectPath: string;
  status: "pending" | "ready" | "archived" | "deleted";
};

export type AvatarCommandResult = {
  assetId: string;
  objectPath: string;
  oldObjectPath: string | null;
  profile: { playerId: string; name: string; avatarPath: string };
};

function getPool() {
  if (!globalPool[poolKey]) {
    const configured = process.env.SUPABASE_DB_URL;
    if (!configured) throw new Error("database_unavailable");
    const url = new URL(configured);
    url.username = "authenticator";
    globalPool[poolKey] = new Pool({ connectionString: url.toString(), max: 3, idleTimeoutMillis: 10_000 });
  }
  return globalPool[poolKey]!;
}

async function transaction<T>(authUserId: string, run: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '5000ms'");
    await client.query("SET LOCAL ROLE service_role");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: authUserId, role: "authenticated", is_anonymous: false }),
    ]);
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error instanceof Error ? error : new Error("database_unavailable");
  } finally {
    client.release();
  }
}

async function call<T>(authUserId: string, name: string, input: object) {
  return transaction(authUserId, async (client) => {
    const result = await client.query<{ result: T }>(`select private.${name}($1::jsonb) as result`, [JSON.stringify(input)]);
    return result.rows[0]?.result as T;
  });
}

export function prepareAvatarAsset(authUserId: string, input: { assetId: string; objectPath: string; mimeType: string; byteSize: number; idempotencyKey: string }) {
  return call<AvatarAssetRecord>(authUserId, "prepare_avatar_upload_command", input);
}

export function readAvatarAsset(authUserId: string, assetId: string) {
  return call<AvatarAssetRecord | null>(authUserId, "read_avatar_upload_asset", { assetId });
}

export function confirmAvatarAsset(authUserId: string, input: object) {
  return call<AvatarCommandResult>(authUserId, "confirm_avatar_upload_command", input);
}

export function abortAvatarAsset(authUserId: string, input: object) {
  return call<AvatarAssetRecord>(authUserId, "abort_avatar_upload_command", input);
}
