import "server-only";
import { Pool } from "pg";
import { getSupabaseDatabaseUrl } from "@/infrastructure/supabase/platform/databaseUrl";
import type {
  RehearsalStore,
  EditorialRehearsalSnapshot,
  RehearsalAssociationInput,
} from "@/application/ports/rehearsals";
import type { RehearsalRef, RehearsalSource } from "@/types/gameplay/rehearsal";

const poolKey = Symbol.for("the-flash-game.rehearsal-pool");
const globals = globalThis as typeof globalThis & { [poolKey]?: Pool };

/** Only verified server identities can use these private, non-PostgREST functions. */
export function rehearsalStoreFor(authUserId: string): RehearsalStore {
  async function call<T>(sql: string, args: unknown[]): Promise<T> {
    const pool = (globals[poolKey] ??= new Pool({
      connectionString: getSupabaseDatabaseUrl(),
      max: 3,
      idleTimeoutMillis: 10000,
    }));
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL statement_timeout = '5000ms'");
      await client.query("SET LOCAL ROLE service_role");
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: authUserId, role: "authenticated", is_anonymous: false }),
      ]);
      const result = await client.query<{ result: T }>(sql, args);
      await client.query("COMMIT");
      return result.rows[0]?.result as T;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
  return {
    readPlayer: (roomKey, publicationId) =>
      call<{ ref: RehearsalRef; source: RehearsalSource } | null>(
        "select private.read_player_rehearsal($1::text, $2::uuid) as result",
        [roomKey, publicationId],
      ),
    readEditorial: (versionId) =>
      call<EditorialRehearsalSnapshot | null>(
        "select private.read_editorial_rehearsal($1::uuid) as result",
        [versionId],
      ),
    async associate(input: RehearsalAssociationInput & { sourceHash: string }) {
      await call("select private.set_challenge_rehearsal($1::jsonb) as result", [
        JSON.stringify(input),
      ]);
    },
  };
}
