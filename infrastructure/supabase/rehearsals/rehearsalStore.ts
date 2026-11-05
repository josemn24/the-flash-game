import "server-only";
import { Pool } from "pg";
import { getSupabaseDatabaseUrl } from "@/infrastructure/supabase/platform/databaseUrl";
import type {
  RehearsalStore,
  EditorialRehearsalSnapshot,
  RehearsalPolicyInput,
} from "@/application/ports/rehearsals";
import type { RehearsalTemplate } from "@/types/gameplay/rehearsal";
import { publicMechanics } from "@/lib/rehearsals/generator";
type RawTemplate = Omit<RehearsalTemplate, "questions"> & {
  questions: (Omit<RehearsalTemplate["questions"][number], "mechanics"> & {
    publicPayload: Record<string, unknown>;
  })[];
};
function template(raw: RawTemplate): RehearsalTemplate {
  return {
    ...raw,
    questions: raw.questions.map(({ publicPayload, ...slot }) => ({
      ...slot,
      mechanics: publicMechanics(slot.type, publicPayload),
    })),
  };
}

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
    async readPlayer(roomKey, publicationId) {
      const context = await call<{ template: RawTemplate; enabled: boolean } | null>(
        "select private.read_player_rehearsal_template($1::text, $2::uuid) as result",
        [roomKey, publicationId],
      );
      return context ? { ...context, template: template(context.template) } : null;
    },
    async readEditorial(versionId) {
      const context = await call<
        (Omit<EditorialRehearsalSnapshot, "template"> & { template: RawTemplate }) | null
      >("select private.read_editorial_rehearsal_template($1::uuid) as result", [versionId]);
      return context ? { ...context, template: template(context.template) } : null;
    },
    async setPolicy(input: RehearsalPolicyInput) {
      await call("select private.set_rehearsal_publication_policy($1::jsonb) as result", [
        JSON.stringify(input),
      ]);
    },
  };
}
