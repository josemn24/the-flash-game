import { beforeEach, describe, expect, it, vi } from "vitest";

const pgMocks = vi.hoisted(() => ({ Pool: vi.fn() }));
const configMocks = vi.hoisted(() => ({
  getSupabasePublishableKey: vi.fn(() => "publishable-key"),
  getSupabaseUrl: vi.fn(() => "http://supabase.local"),
}));

vi.mock("pg", () => ({ Pool: pgMocks.Pool }));
vi.mock("@/lib/supabase/config", () => configMocks);

const poolKey = Symbol.for("the-flash-game.supabase.health-pool");

describe("readPrivateHealth", () => {
  const client = {
    query: vi.fn(),
    release: vi.fn(),
  };
  const pool = {
    connect: vi.fn().mockResolvedValue(client),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as Record<PropertyKey, unknown>)[poolKey] = undefined;
    process.env.SUPABASE_DB_URL = "postgresql://postgres:postgres@localhost:54322/postgres";
    delete process.env.EXPECTED_SCHEMA_REVISION;
    client.query.mockImplementation(async (query: string) => {
      if (query.includes("schema_revision_marker")) {
        return {
          rows: [{ database_ok: true, schema_ready: true, schema_revision_marker: true }],
        };
      }
      return {};
    });
    pgMocks.Pool.mockImplementation(() => pool);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  it("recognizes the current revision and required capabilities", async () => {
    const { readPrivateHealth } = await import("@/infrastructure/supabase/health");

    await expect(readPrivateHealth()).resolves.toEqual({
      ok: true,
      checks: { auth: true, database: true, schema: true },
    });

    const markerQuery = client.query.mock.calls.find(([query]) => String(query).includes("schema_revision_marker"))?.[0];
    expect(markerQuery).toContain("public.get_superadmin_challenge_catalog()");
    expect(markerQuery).toContain("public.get_superadmin_challenge_detail(uuid)");
    expect(markerQuery).toContain("public.manage_room_member(jsonb)");
    expect(markerQuery).toContain("member_previews jsonb");
  });

  it("rejects an old expected revision", async () => {
    const legacySchemaRevision = ["20260919", "090805_declarative_sync"].join("");
    process.env.EXPECTED_SCHEMA_REVISION = legacySchemaRevision;
    const { readPrivateHealth } = await import("@/infrastructure/supabase/health");

    await expect(readPrivateHealth()).resolves.toMatchObject({
      ok: false,
      checks: { auth: true, database: true, schema: false },
    });
  });

  it("rejects a schema missing a required capability", async () => {
    client.query.mockImplementation(async (query: string) => {
      if (query.includes("schema_revision_marker")) {
        return {
          rows: [{ database_ok: true, schema_ready: true, schema_revision_marker: false }],
        };
      }
      return {};
    });
    const { readPrivateHealth } = await import("@/infrastructure/supabase/health");

    await expect(readPrivateHealth()).resolves.toMatchObject({
      ok: false,
      checks: { auth: true, database: true, schema: false },
    });
  });
});
