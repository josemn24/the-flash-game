import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  assertResetPreconditions,
  clearAuth,
  clearEnvironmentArtifacts,
  clearStorage,
  runEnvironmentReset,
} from "./reset-supabase-environment.mjs";
import {
  bootstrapRoleSql,
  ensureAdministrator,
  runMinimumBootstrap,
} from "./bootstrap-production.mjs";
import {
  localBucketDefinitions,
  parseEnvironmentArgs,
  resolveEnvironment,
  validateRemoteEnvironment,
} from "./support/supabase-environment.mjs";
import { verifyMiniWordleDictionaries } from "./load-mini-wordle-dictionary.mjs";

const env = {
  STAGING_PROJECT_REF: "staging-ref",
  PRODUCTION_PROJECT_REF: "production-ref",
  NEXT_PUBLIC_SUPABASE_URL: "https://staging-ref.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-secret",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
  SUPABASE_ADMIN_DB_URL:
    "postgresql://postgres:database-secret@db.staging-ref.supabase.co:5432/postgres",
};
const config = { ...validateRemoteEnvironment("staging", env), artifactDirectory: "/unused" };
const uuid = "00000000-0000-4000-8000-000000000001";

function fakeService({ users = [], buckets = [] } = {}) {
  const events = [];
  const remainingUsers = [...users];
  const remainingBuckets = [...buckets];
  return {
    events,
    storage: {
      listBuckets: vi.fn(async () => ({ data: [...remainingBuckets], error: null })),
      emptyBucket: vi.fn(async (id) => {
        events.push(`empty:${id}`);
        return { error: null };
      }),
      deleteBucket: vi.fn(async (id) => {
        events.push(`bucket:${id}`);
        remainingBuckets.splice(
          remainingBuckets.findIndex((b) => b.id === id),
          1,
        );
        return { error: null };
      }),
    },
    auth: {
      admin: {
        listUsers: vi.fn(async ({ page, perPage }) => ({
          data: { users: remainingUsers.slice((page - 1) * perPage, page * perPage) },
          error: null,
        })),
        deleteUser: vi.fn(async (id, soft) => {
          events.push(`user:${id}:${soft}`);
          remainingUsers.splice(
            remainingUsers.findIndex((u) => u.id === id),
            1,
          );
          return { error: null };
        }),
        createUser: vi.fn(async () => ({ data: { user: { id: uuid } }, error: null })),
      },
    },
  };
}

describe("clean Supabase installation", () => {
  it("preserves the local CLI binary bucket limits without changing remote API limits", async () => {
    const buckets = localBucketDefinitions(await readFile("supabase/config.toml", "utf8"));
    expect(buckets.map(({ id, fileSizeLimit }) => [id, fileSizeLimit])).toEqual([
      ["avatars", 5242880],
      ["question-assets", 52428800],
    ]);
  });
  it("requires an explicit target and rejects unsupported or repeated arguments", () => {
    expect(() => parseEnvironmentArgs([])).toThrow(/--target/);
    expect(() => parseEnvironmentArgs(["--target", "production", "--target", "local"])).toThrow(
      /repetirse/,
    );
    expect(() => parseEnvironmentArgs(["--target", "local", "--force"])).toThrow(/desconocido/);
    expect(() => parseEnvironmentArgs(["--target"])).toThrow(/Falta/);
  });

  it.each([
    ["API host", { NEXT_PUBLIC_SUPABASE_URL: "https://production-ref.supabase.co" }],
    ["API HTTP", { NEXT_PUBLIC_SUPABASE_URL: "http://staging-ref.supabase.co" }],
    [
      "API embedded password",
      { NEXT_PUBLIC_SUPABASE_URL: "https://user:secret@staging-ref.supabase.co" },
    ],
    [
      "database host",
      {
        SUPABASE_ADMIN_DB_URL:
          "postgresql://postgres:secret@db.production-ref.supabase.co:5432/postgres",
      },
    ],
    [
      "database pooler identity",
      {
        SUPABASE_ADMIN_DB_URL:
          "postgresql://postgres.production-ref:secret@aws-1-eu-west-1.pooler.supabase.com:5432/postgres",
      },
    ],
    [
      "runtime pooler",
      {
        SUPABASE_ADMIN_DB_URL:
          "postgresql://postgres.staging-ref:secret@aws-1-eu-west-1.pooler.supabase.com:6543/postgres",
      },
    ],
    ["shared project", { PRODUCTION_PROJECT_REF: "staging-ref" }],
  ])("rejects a mismatched %s before creating clients", (_, overrides) => {
    expect(() => validateRemoteEnvironment("staging", { ...env, ...overrides })).toThrow();
  });

  it("accepts the administrative Session pooler with the correct project username", () => {
    expect(
      validateRemoteEnvironment("staging", {
        ...env,
        SUPABASE_ADMIN_DB_URL:
          "postgresql://postgres.staging-ref:secret@aws-1-eu-west-1.pooler.supabase.com:5432/postgres",
      }).projectRef,
    ).toBe("staging-ref");
  });

  it("rejects a remote URL and another container when local is selected", async () => {
    await expect(resolveEnvironment("local", env)).rejects.toThrow(/stack local/);
    await expect(
      resolveEnvironment("local", {
        ...env,
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_DB_CONTAINER: "supabase_db_other",
      }),
    ).rejects.toThrow(/stack local/);
  });

  it("does not create clients or write journals during a reset dry-run", async () => {
    const create = vi.fn(() => {
      throw new Error("must not run");
    });
    const save = vi.fn();
    const result = await runEnvironmentReset({
      env,
      args: ["--target", "staging", "--dry-run"],
      dependencies: {
        resolveEnvironment: async () => config,
        environmentClient: create,
        writeJsonSecure: save,
      },
    });
    expect(create).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(result.dryRun).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(
      /publishable-secret|service-role-secret|database-secret/,
    );
  });

  it("checks confirmation, paused writes and CLI binding before deletion", async () => {
    const valid = { SUPABASE_RESET_CONFIRM: "staging:staging-ref", FLASH_WRITES_PAUSED: "true" };
    await expect(assertResetPreconditions(config, {}, async () => "staging-ref")).rejects.toThrow(
      /CONFIRM/,
    );
    await expect(
      assertResetPreconditions(
        config,
        { ...valid, FLASH_WRITES_PAUSED: "false" },
        async () => "staging-ref",
      ),
    ).rejects.toThrow(/calendario/);
    await expect(
      assertResetPreconditions(config, valid, async () => "production-ref"),
    ).rejects.toThrow(/enlazado/);
    await expect(
      assertResetPreconditions(config, valid, async () => "staging-ref\n"),
    ).resolves.toBeUndefined();
  });

  it("removes physical objects via Storage before deleting buckets", async () => {
    const service = fakeService({ buckets: [{ id: "avatars" }, { id: "question-assets" }] });
    expect(await clearStorage(service)).toBe(2);
    expect(service.events).toEqual([
      "empty:avatars",
      "bucket:avatars",
      "empty:question-assets",
      "bucket:question-assets",
    ]);
  });

  it("deletes more than one Auth page without skipping users", async () => {
    const service = fakeService({
      users: Array.from({ length: 1005 }, (_, id) => ({ id: String(id) })),
    });
    expect(await clearAuth(service)).toBe(1005);
    expect(service.auth.admin.deleteUser).toHaveBeenCalledTimes(1005);
    expect(service.auth.admin.listUsers.mock.calls.every(([options]) => options.page === 1)).toBe(
      true,
    );
    expect(service.auth.admin.deleteUser.mock.calls.every(([, soft]) => soft === false)).toBe(true);
  });

  it("stops instead of looping when Auth returns an already deleted user", async () => {
    const service = fakeService();
    service.auth.admin.listUsers.mockResolvedValue({
      data: { users: [{ id: "stuck" }] },
      error: null,
    });
    await expect(clearAuth(service)).rejects.toThrow(/sigue devolviendo/);
  });

  it.each(["storage", "auth"])(
    "stops before PostgreSQL when %s fails and saves completed phases",
    async (phase) => {
      const service = fakeService({ buckets: [{ id: "avatars" }], users: [{ id: uuid }] });
      if (phase === "storage") service.storage.emptyBucket.mockResolvedValue({ error: {} });
      else service.auth.admin.deleteUser.mockResolvedValue({ error: {} });
      const reset = vi.fn();
      const journals = [];
      await expect(
        runEnvironmentReset({
          args: ["--target", "staging"],
          dependencies: {
            resolveEnvironment: async () => config,
            assertPreconditions: async () => {},
            environmentClient: () => service,
            resetDatabase: reset,
            writeJsonSecure: async (_, journal) => journals.push(structuredClone(journal)),
          },
        }),
      ).rejects.toThrow(/interrumpido/);
      expect(reset).not.toHaveBeenCalled();
      if (phase === "storage") expect(service.auth.admin.listUsers).not.toHaveBeenCalled();
      expect(journals.at(-1).status).toBe("failed");
      expect(journals.at(-1).completedSteps).toEqual(phase === "storage" ? [] : ["storage"]);
    },
  );

  it("retires only the old bootstrap artifacts, keeping reset evidence", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "flash-environment-artifacts-"));
    try {
      for (const name of [
        "bootstrap-credentials.json",
        "bootstrap-manifest.json",
        "reset-manifest.json",
      ])
        await writeFile(path.join(directory, name), "{}");
      await clearEnvironmentArtifacts({ target: "staging", artifactDirectory: directory });
      await expect(
        readFile(path.join(directory, "bootstrap-credentials.json")),
      ).rejects.toMatchObject({ code: "ENOENT" });
      expect(await readFile(path.join(directory, "reset-manifest.json"), "utf8")).toBe("{}");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("does not provision users in a minimum bootstrap dry-run", async () => {
    const create = vi.fn();
    const result = await runMinimumBootstrap({
      args: ["--target", "local", "--dry-run"],
      dependencies: {
        resolveEnvironment: async () => ({ ...config, target: "local" }),
        environmentClient: create,
      },
    });
    expect(result.email).toBe("superadmin@the-flash.local");
    expect(create).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("requires an explicit production email and project confirmation", async () => {
    const dependencies = {
      resolveEnvironment: async () => ({
        ...config,
        target: "production",
        projectRef: "production-ref",
      }),
    };
    await expect(
      runMinimumBootstrap({ args: ["--target", "production", "--dry-run"], env: {}, dependencies }),
    ).rejects.toThrow(/EMAIL/);
    await expect(
      runMinimumBootstrap({
        args: ["--target", "production", "--dry-run"],
        env: { BOOTSTRAP_ADMIN_EMAIL: "admin@example.test" },
        dependencies,
      }),
    ).rejects.toThrow(/CONFIRM/);
  });

  it("does not promote an existing unmanaged Auth account", async () => {
    const service = fakeService({
      users: [{ id: uuid, email: "admin@example.test", app_metadata: {} }],
    });
    await expect(
      ensureAdministrator(config, "admin@example.test", {
        environmentClient: () => service,
        readJson: async () => null,
      }),
    ).rejects.toThrow(/no se asignará/);
    expect(service.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it("rejects credentials belonging to another project before any Auth call", async () => {
    const makeClient = vi.fn();
    await expect(
      ensureAdministrator(config, "admin@example.test", {
        environmentClient: makeClient,
        readJson: async () => ({ projectRef: "production-ref" }),
      }),
    ).rejects.toThrow(/otro destino/);
    expect(makeClient).not.toHaveBeenCalled();
  });

  it("rejects changing the bootstrap email before creating a second account", async () => {
    const makeClient = vi.fn();
    await expect(
      ensureAdministrator(config, "new@example.test", {
        environmentClient: makeClient,
        readJson: async () => ({
          target: config.target,
          projectRef: config.projectRef,
          users: { superadmin: { email: "existing@example.test" } },
        }),
      }),
    ).rejects.toThrow(/email no coincide/);
    expect(makeClient).not.toHaveBeenCalled();
  });

  it("does not create a new administrator when Auth already contains another account", async () => {
    const service = fakeService({ users: [{ id: uuid, email: "other@example.test" }] });
    await expect(
      ensureAdministrator(config, "new@example.test", {
        environmentClient: () => service,
        readJson: async () => null,
      }),
    ).rejects.toThrow(/Auth vacío/);
    expect(service.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it("prevents invalid player IDs from reaching the role grant", () => {
    expect(() => bootstrapRoleSql("';select 1;--", config, "revision")).toThrow(/Player/);
  });

  it("validates dictionary counts without relying on JSON object key order", async () => {
    const expected = await Promise.all(
      [4, 5].map(async (length) => {
        const payload = JSON.parse(
          await readFile(`public/dictionaries/es-general-${length}.v1.json`, "utf8"),
        );
        return { count: new Set(payload.words).size, length, id: `${payload.id}.v1` };
      }),
    );
    await expect(
      verifyMiniWordleDictionaries(async () => JSON.stringify(expected)),
    ).resolves.toHaveLength(2);
    expected[0].count++;
    await expect(
      verifyMiniWordleDictionaries(async () => JSON.stringify(expected)),
    ).rejects.toThrow(/canónicos/);
  });
});
