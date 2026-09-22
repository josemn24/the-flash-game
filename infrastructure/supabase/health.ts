import "server-only";

import { Pool } from "pg";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/config";

const poolKey = Symbol.for("the-flash-game.supabase.health-pool");
const globalPool = globalThis as typeof globalThis & { [poolKey]?: Pool };
const canonicalSchemaRevision = "20260922103932_declarative_sync";

function databaseUrl() {
  const configured = process.env.SUPABASE_DB_URL;
  if (!configured) throw new Error("SUPABASE_DB_URL is missing");
  const url = new URL(configured);
  url.username = "authenticator";
  return url.toString();
}

function getPool() {
  if (!globalPool[poolKey]) {
    globalPool[poolKey] = new Pool({
      connectionString: databaseUrl(),
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 2_000,
      application_name: "the-flash-game-health",
    });
  }
  return globalPool[poolKey]!;
}

async function checkDatabase() {
  const expected = process.env.EXPECTED_SCHEMA_REVISION ?? canonicalSchemaRevision;
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // The authenticator role is intentionally used for the connection. The
    // read is elevated only for this transaction, matching the command pool
    // and avoiding a postgres-owner credential in the application.
    await client.query("SET LOCAL ROLE service_role");
    await client.query("SET statement_timeout = '2000ms'");
    const result = await client.query<{
      database_ok: boolean;
      schema_ready: boolean;
      schema_revision_marker: boolean;
    }>(`
      select
        true as database_ok,
        to_regclass('public.players') is not null as schema_ready,
        to_regprocedure('private.submit_mini_wordle_guess(jsonb)') is not null
          and to_regprocedure('private.submit_logic_code_attempt(jsonb)') is not null
          and to_regprocedure('private.reveal_progressive_clue(jsonb)') is not null
          and to_regprocedure('private.submit_matching_pair(jsonb)') is not null
        and to_regprocedure('private.submit_queens_placement(jsonb)') is not null
        and to_regprocedure('private.zip_content_valid(jsonb,jsonb)') is not null
          and to_regprocedure('private.prepare_interaction(jsonb)') is not null
          and to_regprocedure('public.get_flash_member_review(text,uuid,uuid)') is not null
          and to_regprocedure('public.get_superadmin_challenge_catalog()') is not null
          and to_regprocedure('public.get_superadmin_challenge_detail(uuid)') is not null
          and to_regprocedure('public.manage_room_member(jsonb)') is not null
          and pg_get_function_result(
            to_regprocedure('public.get_flash_member_review(text,uuid,uuid)')
          ) like '%item_points integer%'
          and pg_get_function_result(to_regprocedure('public.get_my_room_cards()')) like '%member_previews jsonb%'
          as schema_revision_marker
    `);
    const row = result.rows[0];
    await client.query("COMMIT");
    return {
      ok: Boolean(row?.database_ok && row.schema_ready),
      schemaRevisionOk: expected === canonicalSchemaRevision && Boolean(row?.schema_revision_marker),
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function checkAuth() {
  const url = new URL("/auth/v1/health", getSupabaseUrl());
  const response = await fetch(url, {
    headers: { apikey: getSupabasePublishableKey() },
    signal: AbortSignal.timeout(2_000),
    cache: "no-store",
  });
  return response.ok;
}

export async function readPrivateHealth() {
  const checks = await Promise.allSettled([checkAuth(), checkDatabase()]);
  const auth = checks[0].status === "fulfilled" && checks[0].value;
  const database = checks[1].status === "fulfilled" && checks[1].value.ok;
  const schema = checks[1].status === "fulfilled" && checks[1].value.schemaRevisionOk;
  return {
    ok: auth && database && schema,
    checks: { auth, database, schema },
  } as const;
}
