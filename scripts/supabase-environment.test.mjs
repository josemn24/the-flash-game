import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
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
  minimumBootstrapEmail,
  runMinimumBootstrap,
} from "./bootstrap-local.mjs";
import {
  environmentClient,
  loadOperationalEnv,
  localBucketDefinitions,
  parseEnvironmentArgs,
  resetEnvironmentDatabase,
  resolveEnvironment,
  validateRemoteEnvironment,
  withEnvironmentSql,
} from "./support/supabase-environment.mjs";
import { verifyMiniWordleDictionaries } from "./load-mini-wordle-dictionary.mjs";

const env = {
  STAGING_PROJECT_REF: "staging-ref",
  NEXT_PUBLIC_SUPABASE_URL: "https://staging-ref.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-secret",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
  SUPABASE_ADMIN_DB_URL:
    "postgresql://postgres:database-secret@db.staging-ref.supabase.co:5432/postgres",
};
const config = { ...validateRemoteEnvironment("staging", env), artifactDirectory: "/unused" };
const localConfig = { ...config, target: "local", projectRef: "local-stack" };
const uuid = "00000000-0000-4000-8000-000000000001";
const execFileAsync = promisify(execFile);

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
    expect(() => parseEnvironmentArgs(["--target", "staging", "--target", "local"])).toThrow(
      /repetirse/,
    );
    expect(() => parseEnvironmentArgs(["--target", "local", "--force"])).toThrow(/desconocido/);
    expect(() => parseEnvironmentArgs(["--target"])).toThrow(/Falta/);
  });

  it("accepts only local and staging, even if a caller tries to widen the target list", () => {
    for (const target of ["local", "staging"])
      expect(parseEnvironmentArgs(["--target", target]).target).toBe(target);
    expect(() => parseEnvironmentArgs(["--target", "production"])).toThrow(/local\|staging/);
    expect(() =>
      parseEnvironmentArgs(["--target", "production"], { targets: ["production"] }),
    ).toThrow(/local\|staging/);
  });

  it("rejects an unsupported programmatic target before loading env files or opening connections", async () => {
    const blockedConfig = { ...config, target: "production" };
    const callback = vi.fn();
    expect(() =>
      loadOperationalEnv({ target: "production", envFile: "must-not-be-loaded.env" }),
    ).toThrow(/local\|staging/);
    expect(() => validateRemoteEnvironment("production", {})).toThrow(/--target staging/);
    await expect(resolveEnvironment("production", {})).rejects.toThrow(/local\|staging/);
    expect(() => environmentClient(blockedConfig)).toThrow(/local\|staging/);
    await expect(withEnvironmentSql(blockedConfig, callback)).rejects.toThrow(/local\|staging/);
    await expect(resetEnvironmentDatabase(blockedConfig)).rejects.toThrow(/local\|staging/);
    await expect(assertResetPreconditions(blockedConfig, {}, callback)).rejects.toThrow(
      /local\|staging/,
    );
    await expect(clearEnvironmentArtifacts(blockedConfig)).rejects.toThrow(/local\|staging/);
    expect(callback).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "rejects production before resolving a reset or bootstrap (dry-run: %s)",
    async (dryRun) => {
      const effect = vi.fn();
      const args = ["--target", "production", ...(dryRun ? ["--dry-run"] : [])];
      const dependencies = {
        resolveEnvironment: effect,
        environmentClient: effect,
        writeJsonSecure: effect,
        resetDatabase: effect,
        withSql: effect,
      };
      await expect(runEnvironmentReset({ args, env: {}, dependencies })).rejects.toThrow(
        /local\|staging/,
      );
      await expect(runMinimumBootstrap({ args, env: {}, dependencies })).rejects.toThrow(
        /--target local/,
      );
      expect(effect).not.toHaveBeenCalled();
    },
  );

  it.each(
    [
      "reset-supabase-environment.mjs",
      "load-mini-wordle-dictionary.mjs",
      "bootstrap-local.mjs",
    ].flatMap((script) => [false, true].map((dryRun) => [script, dryRun])),
  )(
    "rejects production in the %s CLI before loading operational credentials (dry-run: %s)",
    async (script, dryRun) => {
      await expect(
        execFileAsync(
          process.execPath,
          [
            "--",
            `scripts/${script}`,
            "--target",
            "production",
            ...(dryRun ? ["--dry-run"] : []),
            "--env-file",
            "must-not-be-loaded.env",
          ],
          { env },
        ),
      ).rejects.toMatchObject({
        code: 1,
        stdout: "",
        stderr: expect.stringMatching(/Indica --target (local\|staging|local)\./),
      });
    },
  );

  it("keeps the dictionary CLI local by default and supports an explicit staging dry-run", async () => {
    for (const target of ["local", "staging"]) {
      const args = ["--", "scripts/load-mini-wordle-dictionary.mjs", "--dry-run"];
      if (target === "staging") args.push("--target", target);
      const { stdout } = await execFileAsync(process.execPath, args, {
        env:
          target === "local" ? { ...env, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" } : env,
      });
      expect(JSON.parse(stdout)).toMatchObject({
        target,
        dryRun: true,
        dictionaries: ["es-general-4.v1", "es-general-5.v1"],
      });
      expect(stdout).not.toMatch(/publishable-secret|service-role-secret|database-secret/);
    }
  });

  it("does not load workspace credentials for an isolated local stack", () => {
    const previousWorkdir = process.env.SUPABASE_TEST_WORKDIR;
    const loadEnvFile = vi.spyOn(process, "loadEnvFile").mockImplementation(() => {});
    process.env.SUPABASE_TEST_WORKDIR = "/tmp/isolated-supabase";
    try {
      loadOperationalEnv({ target: "local" });
      expect(loadEnvFile).not.toHaveBeenCalled();
    } finally {
      loadEnvFile.mockRestore();
      if (previousWorkdir === undefined) delete process.env.SUPABASE_TEST_WORKDIR;
      else process.env.SUPABASE_TEST_WORKDIR = previousWorkdir;
    }
  });

  it.each([
    ["API host", { NEXT_PUBLIC_SUPABASE_URL: "https://other-ref.supabase.co" }],
    ["API HTTP", { NEXT_PUBLIC_SUPABASE_URL: "http://staging-ref.supabase.co" }],
    [
      "API embedded password",
      { NEXT_PUBLIC_SUPABASE_URL: "https://user:secret@staging-ref.supabase.co" },
    ],
    [
      "database host",
      {
        SUPABASE_ADMIN_DB_URL:
          "postgresql://postgres:secret@db.other-ref.supabase.co:5432/postgres",
      },
    ],
    [
      "database pooler identity",
      {
        SUPABASE_ADMIN_DB_URL:
          "postgresql://postgres.other-ref:secret@aws-1-eu-west-1.pooler.supabase.com:5432/postgres",
      },
    ],
    [
      "runtime pooler",
      {
        SUPABASE_ADMIN_DB_URL:
          "postgresql://postgres.staging-ref:secret@aws-1-eu-west-1.pooler.supabase.com:6543/postgres",
      },
    ],
    ["local API", { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }],
    [
      "local database",
      { SUPABASE_ADMIN_DB_URL: "postgresql://postgres:secret@localhost:54322/postgres" },
    ],
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
    await expect(assertResetPreconditions(config, valid, async () => "other-ref")).rejects.toThrow(
      /enlazado/,
    );
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
        resolveEnvironment: async () => localConfig,
        environmentClient: create,
      },
    });
    expect(result.email).toBe("superadmin@the-flash.local");
    expect(create).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("requires an explicit local bootstrap target and allows a custom local administrator email", async () => {
    await expect(runMinimumBootstrap({ args: [], env: {} })).rejects.toThrow(/--target local/);
    await expect(runMinimumBootstrap({ args: ["--target", "staging"], env: {} })).rejects.toThrow(
      /--target local/,
    );
    expect(minimumBootstrapEmail(localConfig, {})).toBe("superadmin@the-flash.local");
    expect(
      minimumBootstrapEmail(localConfig, { BOOTSTRAP_ADMIN_EMAIL: " Admin@Example.test " }),
    ).toBe("admin@example.test");
    expect(() => minimumBootstrapEmail(localConfig, { BOOTSTRAP_ADMIN_EMAIL: "invalid" })).toThrow(
      /EMAIL/,
    );
  });

  it("does not promote an existing unmanaged Auth account", async () => {
    const service = fakeService({
      users: [{ id: uuid, email: "admin@example.test", app_metadata: {} }],
    });
    await expect(
      ensureAdministrator(localConfig, "admin@example.test", {
        environmentClient: () => service,
        readJson: async () => null,
      }),
    ).rejects.toThrow(/no se asignará/);
    expect(service.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it.each(["staging", "production"])(
    "rejects a %s administrator bootstrap before reading credentials",
    async (target) => {
      const effect = vi.fn();
      await expect(
        ensureAdministrator({ ...localConfig, target }, "admin@example.test", {
          readJson: effect,
          environmentClient: effect,
          writeJsonSecure: effect,
        }),
      ).rejects.toThrow(/--target local/);
      expect(effect).not.toHaveBeenCalled();
    },
  );

  it("reuses the verified local administrator and password without creating another account", async () => {
    const account = {
      email: "admin@example.test",
      password: "saved-local-password",
      authUserId: uuid,
      playerId: uuid,
    };
    const service = fakeService({
      users: [
        {
          id: uuid,
          email: account.email,
          app_metadata: {
            environment_bootstrap: {
              environment: "local",
              project_ref: localConfig.projectRef,
              version: 1,
            },
          },
        },
      ],
    });
    const user = {
      auth: {
        signInWithPassword: vi.fn(async () => ({ data: { user: { id: uuid } }, error: null })),
      },
      rpc: vi.fn(async () => ({ data: { player_id: uuid }, error: null })),
    };
    const save = vi.fn();
    const result = await ensureAdministrator(localConfig, account.email, {
      readJson: async () => ({
        target: "local",
        projectRef: localConfig.projectRef,
        users: { superadmin: account },
      }),
      environmentClient: (_, options) => (options?.user ? user : service),
      writeJsonSecure: save,
    });
    expect(result.account).toEqual(account);
    expect(service.auth.admin.createUser).not.toHaveBeenCalled();
    expect(user.auth.signInWithPassword).toHaveBeenCalledWith({
      email: account.email,
      password: account.password,
    });
    expect(save).toHaveBeenCalledWith(
      path.join(localConfig.artifactDirectory, "bootstrap-credentials.json"),
      {
        version: 1,
        target: "local",
        projectRef: localConfig.projectRef,
        users: { superadmin: account },
      },
    );
  });

  it("rejects credentials belonging to another project before any Auth call", async () => {
    const makeClient = vi.fn();
    await expect(
      ensureAdministrator(localConfig, "admin@example.test", {
        environmentClient: makeClient,
        readJson: async () => ({ projectRef: "other-ref" }),
      }),
    ).rejects.toThrow(/otro destino/);
    expect(makeClient).not.toHaveBeenCalled();
  });

  it("rejects changing the bootstrap email before creating a second account", async () => {
    const makeClient = vi.fn();
    await expect(
      ensureAdministrator(localConfig, "new@example.test", {
        environmentClient: makeClient,
        readJson: async () => ({
          target: localConfig.target,
          projectRef: localConfig.projectRef,
          users: { superadmin: { email: "existing@example.test" } },
        }),
      }),
    ).rejects.toThrow(/email no coincide/);
    expect(makeClient).not.toHaveBeenCalled();
  });

  it("does not create a new administrator when Auth already contains another account", async () => {
    const service = fakeService({ users: [{ id: uuid, email: "other@example.test" }] });
    await expect(
      ensureAdministrator(localConfig, "new@example.test", {
        environmentClient: () => service,
        readJson: async () => null,
      }),
    ).rejects.toThrow(/Auth vacío/);
    expect(service.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it("prevents invalid player IDs from reaching the role grant", () => {
    expect(() => bootstrapRoleSql("';select 1;--", localConfig, "revision")).toThrow(/Player/);
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
