import { beforeEach, describe, expect, it, vi } from "vitest";
import { readAvatarAsset } from "./mediaAssetCommands";

const pgMocks = vi.hoisted(() => ({ Pool: vi.fn() }));
vi.mock("pg", () => ({ Pool: pgMocks.Pool }));

const poolKey = Symbol.for("the-flash-game.supabase.media-asset-pool");

describe("Supabase media asset database connection", () => {
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
      if (query.includes("private.read_avatar_upload_asset")) {
        return { rows: [{ result: null }] };
      }
      return {};
    });
  });

  it("uses the configured URL without replacing its login role", async () => {
    await expect(
      readAvatarAsset("00000000-0000-4000-8000-000000000001", "asset-1"),
    ).resolves.toBeNull();

    expect(pgMocks.Pool).toHaveBeenCalledWith({
      connectionString: configuredUrl,
      max: 3,
      idleTimeoutMillis: 10_000,
    });
    expect(client.query).toHaveBeenCalledWith("SET LOCAL ROLE service_role");
  });
});
