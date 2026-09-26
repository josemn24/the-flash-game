import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttemptCommandError, callAttemptCommand } from "./attemptCommands";

const pgMocks = vi.hoisted(() => ({ Pool: vi.fn() }));
vi.mock("pg", () => ({ Pool: pgMocks.Pool }));

const poolKey = Symbol.for("the-flash-game.supabase.attempt-pool");

describe("Supabase attempt database connection", () => {
  const client = { query: vi.fn(), release: vi.fn() };
  const pool = { connect: vi.fn().mockResolvedValue(client) };
  const configuredUrl =
    "postgresql://postgres.bebmthwwyiyobaiertsm:p%40ssword@pooler.example:6543/postgres?sslmode=require";

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as Record<PropertyKey, unknown>)[poolKey] = undefined;
    process.env.SUPABASE_DB_URL = configuredUrl;
    pgMocks.Pool.mockImplementation(() => pool);
    client.query.mockImplementation(async (query: string) => {
      if (query.includes("private.start_attempt")) return { rows: [{ result: { ok: true } }] };
      return {};
    });
  });

  it("preserves the configured pooler URL and elevates only inside the transaction", async () => {
    await expect(
      callAttemptCommand({ authUserId: "00000000-0000-4000-8000-000000000001" }, "start_attempt", {
        scheduledChallengeId: "00000000-0000-4000-8000-000000000002",
      }),
    ).resolves.toEqual({ ok: true });

    expect(pgMocks.Pool).toHaveBeenCalledWith({
      connectionString: configuredUrl,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      application_name: "the-flash-game-web",
    });
    expect(client.query).toHaveBeenCalledWith("SET LOCAL ROLE service_role");
  });

  it.each(["28P01", "28000", "42501"])(
    "classifies PostgreSQL configuration error %s as database_unavailable",
    async (code) => {
      client.query.mockImplementation(async (query: string) => {
        if (query.includes("private.start_attempt")) {
          throw Object.assign(new Error("database configuration failure"), { code });
        }
        return {};
      });

      await expect(
        callAttemptCommand({ authUserId: "00000000-0000-4000-8000-000000000001" }, "start_attempt", {
          scheduledChallengeId: "00000000-0000-4000-8000-000000000002",
        }),
      ).rejects.toMatchObject({
        code: "database_unavailable",
      } satisfies Partial<AttemptCommandError>);
    },
  );
});
