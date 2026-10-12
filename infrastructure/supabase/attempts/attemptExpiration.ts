import "server-only";

import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { getSupabaseDatabaseUrl } from "@/infrastructure/supabase/platform/databaseUrl";

export type AttemptExpirationResult = {
  readonly runId: string;
  readonly evaluatedAt: string;
  readonly abandonedAttempts: number;
};

export interface AttemptExpirationQueries {
  expireStaleAttemptsForRoom(roomSlug: string): Promise<AttemptExpirationResult>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isExpirationResult(value: unknown): value is AttemptExpirationResult {
  return (
    isRecord(value) &&
    typeof value.runId === "string" &&
    typeof value.evaluatedAt === "string" &&
    !Number.isNaN(Date.parse(value.evaluatedAt)) &&
    typeof value.abandonedAttempts === "number" &&
    Number.isSafeInteger(value.abandonedAttempts) &&
    value.abandonedAttempts >= 0
  );
}

function databaseUrl() {
  try {
    return getSupabaseDatabaseUrl();
  } catch (error) {
    throw new Error("database_unavailable", { cause: error });
  }
}

const poolKey = Symbol.for("the-flash-game.attempt-expiration-pool");
const globalPool = globalThis as typeof globalThis & { [poolKey]?: Pool };

function getPool() {
  if (!globalPool[poolKey]) {
    globalPool[poolKey] = new Pool({
      connectionString: databaseUrl(),
      max: 2,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      application_name: "the-flash-game-attempt-expiration",
    });
  }
  return globalPool[poolKey]!;
}

async function runExpiration(input: object): Promise<AttemptExpirationResult> {
  let client: PoolClient | undefined;
  try {
    client = await getPool().connect();
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '5000ms'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '10000ms'");
    await client.query("SET LOCAL ROLE service_role");
    const result = await client.query<{ result: unknown }>(
      "select private.expire_stale_attempts($1::jsonb) as result",
      [JSON.stringify(input)],
    );
    await client.query("COMMIT");
    if (!isExpirationResult(result.rows[0]?.result)) {
      throw new Error("invalid_response");
    }
    return result.rows[0].result;
  } catch (error) {
    try {
      await client?.query("ROLLBACK");
    } catch {
      // Preserve the original database error.
    }
    throw error;
  } finally {
    client?.release();
  }
}

export class SupabaseAttemptExpiration implements AttemptExpirationQueries {
  expireStaleAttemptsForRoom(roomSlug: string) {
    return runExpiration({ runId: `history-${randomUUID()}`, roomSlug });
  }
}

export const supabaseAttemptExpiration = new SupabaseAttemptExpiration();
