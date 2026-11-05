import { describe, expect, it, vi } from "vitest";
import {
  parseArgs,
  runTabarniaBootstrap,
  tabarniaAccountDefinitions,
} from "./bootstrap-staging-tabarnia.mjs";
import { TABARNIA_USERS } from "./seed-tabarnia.mjs";

const projectRef = "staging-ref";
const env = {
  STAGING_PROJECT_REF: projectRef,
  NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-secret",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
  SUPABASE_ADMIN_DB_URL: `postgresql://postgres:database-secret@db.${projectRef}.supabase.co:5432/postgres`,
  STAGING_XESMONA_EMAIL: "xesmona@example.test",
  STAGING_CHES_EMAIL: "ches@example.test",
  STAGING_BOOTSTRAP_CONFIRM: "the-flash-game-staging",
};

describe("Tabarnia staging bootstrap", () => {
  it("accepts the documented env-file, dry-run and start-time options", () => {
    expect(
      parseArgs([
        "--env-file",
        ".env.staging.operations",
        "--dry-run",
        "--starts-at",
        "2030-11-10T19:00:00+01:00",
      ]),
    ).toEqual({
      dryRun: true,
      envFile: ".env.staging.operations",
      startsAt: "2030-11-10T18:00:00.000Z",
    });
    expect(() => parseArgs(["--starts-at", "yesterday"])).toThrow();
    expect(() => parseArgs(["--unknown"])).toThrow(/desconocido/);
  });

  it("defines fourteen staging-only accounts and reuses the shared Xesmona and Ches emails", () => {
    const definitions = tabarniaAccountDefinitions({
      emails: { xesmona: "xesmona@stage.example", ches: "ches@stage.example" },
    });
    expect(definitions).toHaveLength(16);
    expect(definitions.find(({ key }) => key === "xesmona").email).toBe("xesmona@stage.example");
    expect(definitions.find(({ key }) => key === "ches").email).toBe("ches@stage.example");
    const additional = definitions.filter(({ key }) => !["xesmona", "ches"].includes(key));
    expect(additional).toHaveLength(14);
    expect(additional.every(({ email }) => email.endsWith("@example.test"))).toBe(true);
    expect(additional.some(({ email }) => email.includes(".local"))).toBe(false);
    expect(additional.every((definition) => !Object.hasOwn(definition, "password"))).toBe(true);
    expect(TABARNIA_USERS.filter(({ role }) => role !== "superadmin")).toHaveLength(15);
  });

  it("dry-run validates staging without creating clients, accounts, assets or manifests", async () => {
    const sideEffect = vi.fn(() => {
      throw new Error("Unexpected side effect");
    });
    const result = await runTabarniaBootstrap({
      env,
      args: ["--dry-run", "--starts-at", "2030-11-10T19:00:00+01:00"],
      dependencies: {
        ensureFoundation: sideEffect,
        ensureAccounts: sideEffect,
        adminClient: sideEffect,
        prepareSpainAssets: sideEffect,
        writeManifest: sideEffect,
        withDatabase: sideEffect,
      },
    });
    expect(result).toEqual({
      dryRun: true,
      scenario: "tabarnia",
      projectRef,
      memberCount: 15,
      challengeCount: 8,
      seasonStartsAt: "2030-11-10T18:00:00.000Z",
    });
    expect(sideEffect).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("rejects an invalid start time before any provisioning", async () => {
    const sideEffect = vi.fn();
    await expect(
      runTabarniaBootstrap({
        env,
        args: ["--dry-run", "--starts-at", "2020-01-01T00:00:00Z"],
        dependencies: { ensureFoundation: sideEffect },
      }),
    ).rejects.toThrow(/futura/);
    expect(sideEffect).not.toHaveBeenCalled();
  });

  it("rejects project mismatch and missing confirmation before provisioning", async () => {
    const sideEffect = vi.fn();
    for (const overrides of [
      { STAGING_PROJECT_REF: "another-ref" },
      { STAGING_BOOTSTRAP_CONFIRM: "" },
    ]) {
      await expect(
        runTabarniaBootstrap({
          env: { ...env, ...overrides },
          args: ["--dry-run"],
          dependencies: { ensureFoundation: sideEffect },
        }),
      ).rejects.toThrow();
    }
    expect(sideEffect).not.toHaveBeenCalled();
  });
});
