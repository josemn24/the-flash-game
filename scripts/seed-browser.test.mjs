import { describe, expect, it, vi } from "vitest";
import {
  assertLocalBrowserUrl,
  parseBrowserArgs,
  renderSeedSql,
  setupBrowserDataset,
} from "./seed-browser.mjs";

const account = (playerId) => ({
  playerId,
  email: "local@example.test",
  password: "Password-123!",
});
const accounts = {
  superadmin: account("11111111-1111-4111-8111-111111111111"),
  owner: account("22222222-2222-4222-8222-222222222222"),
  admin: account("33333333-3333-4333-8333-333333333333"),
  member: account("44444444-4444-4444-8444-444444444444"),
  spectator: account("55555555-5555-4555-8555-555555555555"),
  outsider: account("66666666-6666-4666-8666-666666666666"),
};

describe("browser seed runner", () => {
  it("accepts the optional history dataset", () => {
    expect(parseBrowserArgs(["--with-history"])).toEqual({ withHistory: true });
    expect(parseBrowserArgs([])).toEqual({ withHistory: false });
  });

  it("rejects unsupported arguments", () => {
    expect(() => parseBrowserArgs(["--bad"])).toThrow("Argumento desconocido");
  });

  it("rejects a remote Supabase URL", () => {
    expect(() => assertLocalBrowserUrl("https://example.supabase.co")).toThrow(
      "solo admite Supabase local",
    );
    expect(() => assertLocalBrowserUrl("http://127.0.0.1:54321")).not.toThrow();
  });

  it("renders validated player bindings into the seed SQL", () => {
    const rendered = renderSeedSql("select :'browser_owner_player_id'::uuid;", accounts);
    expect(rendered).toContain(
      "\\set browser_owner_player_id '22222222-2222-4222-8222-222222222222'",
    );
    expect(rendered).toContain("select :'browser_owner_player_id'::uuid;");
  });

  it("rejects an incomplete Auth manifest before executing SQL", () => {
    const incomplete = { ...accounts, outsider: undefined };
    expect(() => renderSeedSql("select 1;", incomplete)).toThrow("player_id válido para outsider");
  });

  it("runs the base dataset without history SQL or attempts", async () => {
    const reset = vi.fn();
    const runSql = vi.fn();
    const saveFixture = vi.fn();
    const output = await setupBrowserDataset({
      dependencies: {
        localSupabaseConfig: vi.fn(async () => ({
          url: "http://127.0.0.1:54321",
          dbContainer: "supabase_db_test",
        })),
        resetLocalDatabase: reset,
        createFixedAuthAccounts: vi.fn(async () => accounts),
        dockerSql: runSql,
        writeFixture: saveFixture,
      },
    });

    expect(reset).toHaveBeenCalledOnce();
    expect(runSql).toHaveBeenCalledOnce();
    expect(runSql.mock.calls[0][0]).not.toContain("insert into public.attempts");
    expect(runSql.mock.calls[0][0]).not.toContain("insert into private.answer_receipts");
    expect(output.withHistory).toBe(false);
    expect(Object.keys(output.users)).toEqual([
      "superadmin",
      "owner",
      "admin",
      "member",
      "spectator",
      "outsider",
    ]);
    expect(output.roomSlug).toBe("browser-playground");
    expect(output.openPublicationId).toBe("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    expect(saveFixture).toHaveBeenCalledWith(
      "browser",
      expect.objectContaining({ scenario: "browser", version: 1 }),
    );
  });

  it("adds the independent history SQL only when requested", async () => {
    const runSql = vi.fn();
    const saveFixture = vi.fn();
    const output = await setupBrowserDataset({
      withHistory: true,
      dependencies: {
        localSupabaseConfig: async () => ({
          url: "http://localhost:54321",
          dbContainer: "supabase_db_test",
        }),
        resetLocalDatabase: vi.fn(),
        createFixedAuthAccounts: async () => accounts,
        dockerSql: runSql,
        writeFixture: saveFixture,
      },
    });

    expect(runSql).toHaveBeenCalledTimes(2);
    expect(runSql.mock.calls[1][0]).toContain("insert into public.attempts");
    expect(runSql.mock.calls[1][0]).toContain("insert into private.flash_point_entries");
    expect(output.withHistory).toBe(true);
    expect(saveFixture).toHaveBeenCalledOnce();
  });

  it("stops before SQL when Auth provisioning fails", async () => {
    const runSql = vi.fn();
    const saveFixture = vi.fn();
    await expect(
      setupBrowserDataset({
        dependencies: {
          localSupabaseConfig: async () => ({ url: "http://127.0.0.1:54321" }),
          resetLocalDatabase: vi.fn(),
          createFixedAuthAccounts: async () => {
            throw new Error("No se pudo aprovisionar owner");
          },
          dockerSql: runSql,
          writeFixture: saveFixture,
        },
      }),
    ).rejects.toThrow("No se pudo aprovisionar owner");
    expect(runSql).not.toHaveBeenCalled();
    expect(saveFixture).not.toHaveBeenCalled();
  });

  it("does not write a manifest when SQL fails", async () => {
    const saveFixture = vi.fn();
    await expect(
      setupBrowserDataset({
        dependencies: {
          localSupabaseConfig: async () => ({ url: "http://127.0.0.1:54321" }),
          resetLocalDatabase: vi.fn(),
          createFixedAuthAccounts: async () => accounts,
          dockerSql: async () => {
            throw new Error("SQL seed failed");
          },
          writeFixture: saveFixture,
        },
      }),
    ).rejects.toThrow("SQL seed failed");
    expect(saveFixture).not.toHaveBeenCalled();
  });

  it("surfaces duplicate fixed Auth credentials", async () => {
    await expect(
      setupBrowserDataset({
        dependencies: {
          localSupabaseConfig: async () => ({ url: "http://localhost:54321" }),
          resetLocalDatabase: vi.fn(),
          createFixedAuthAccounts: async () => {
            throw new Error("No se pudo crear la cuenta local de owner");
          },
        },
      }),
    ).rejects.toThrow("No se pudo crear la cuenta local de owner");
  });
});
