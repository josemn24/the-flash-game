import { beforeEach, describe, expect, it, vi } from "vitest";
import { readAvatarAsset, supabaseMediaAssetCommandsFor } from "./mediaAssetCommands";

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
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.local";
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
  it("projects the profile from committed data and the current profile on recovery", async () => {
    client.query.mockImplementation(async (query: string) => {
      if (query.includes("private.confirm_avatar_upload_command"))
        return {
          rows: [
            {
              result: {
                assetId: "asset",
                objectPath: "avatars/player/old.png",
                oldObjectPath: null,
                profile: { playerId: "player", name: "Ana", avatarPath: "avatars/player/old.png" },
              },
            },
          ],
        };
      if (query.includes("private.read_avatar_upload_confirmation"))
        return {
          rows: [
            {
              result: {
                command: {
                  assetId: "asset",
                  objectPath: "avatars/player/old.png",
                  oldObjectPath: null,
                },
                currentProfile: {
                  playerId: "player",
                  name: "Latest",
                  avatarPath: "avatars/player/new.png",
                },
              },
            },
          ],
        };
      return {};
    });
    const commands = supabaseMediaAssetCommandsFor("auth-user");
    const input = { assetId: "asset", idempotencyKey: "confirm-key" };
    expect(
      await commands.confirmAvatar({
        ...input,
        mimeType: "image/png",
        byteSize: 128,
        width: 64,
        height: 64,
        sha256: "a".repeat(64),
      }),
    ).toMatchObject({
      profile: {
        id: "player",
        name: "Ana",
        avatarSrc: "http://supabase.local/storage/v1/object/public/avatars/avatars/player/old.png",
      },
    });
    expect(await commands.readConfirmation(input)).toMatchObject({
      profile: {
        name: "Latest",
        avatarSrc: "http://supabase.local/storage/v1/object/public/avatars/avatars/player/new.png",
      },
    });
    expect(client.query).toHaveBeenCalledWith("COMMIT");
  });

  it("preserves a lost COMMIT error when rollback also fails", async () => {
    const lost = new Error("COMMIT acknowledgment lost");
    client.query.mockImplementation(async (query: string) => {
      if (query === "COMMIT") throw lost;
      if (query === "ROLLBACK") throw new Error("connection closed");
      if (query.includes("private.claim_archived_avatar_cleanup"))
        return { rows: [{ result: { status: "deleted" } }] };
      return {};
    });
    await expect(
      supabaseMediaAssetCommandsFor("auth-user").claimArchivedCleanup({
        objectPath: "avatars/player/old.png",
      }),
    ).rejects.toBe(lost);
    expect(client.release).toHaveBeenCalledOnce();
  });
});
