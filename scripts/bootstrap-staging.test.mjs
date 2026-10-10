import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { describe, expect, it, vi } from "vitest";
import {
  buildAuthUserPayload,
  bucketMatches,
  generatePassword,
  parseArgs,
  runBootstrap,
  STAGING_BUCKETS,
  validateBootstrapConfig,
  writeJsonSecure,
} from "./bootstrap-staging.mjs";
import {
  buildStagingBetaVipDomainSql,
  stagingBetaVipExpectedContent,
  stagingBetaVipManifest,
} from "./seed-betavip.mjs";

const execFileAsync = promisify(execFile);

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => {
    throw new Error("Unexpected Supabase client creation.");
  }),
}));
vi.mock("pg", () => ({
  Client: vi.fn(() => {
    throw new Error("Unexpected SQL client creation.");
  }),
}));

const projectRef = "staging-ref";
const validEnv = {
  STAGING_PROJECT_REF: projectRef,
  NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-secret",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
  SUPABASE_ADMIN_DB_URL: "postgresql://postgres:secret@db.staging-ref.supabase.co:5432/postgres",
  STAGING_XESMONA_EMAIL: "xesmona@example.test",
  STAGING_CHES_EMAIL: "ches@example.test",
  STAGING_BOOTSTRAP_CONFIRM: "the-flash-game-staging",
};

describe("staging bootstrap", () => {
  it("accepts only an explicit non-local staging target", () => {
    expect(validateBootstrapConfig(validEnv)).toMatchObject({
      projectRef,
      emails: { xesmona: "xesmona@example.test", ches: "ches@example.test" },
    });
    expect(() =>
      validateBootstrapConfig({ ...validEnv, NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321" }),
    ).toThrow(/no coincide/i);
    expect(() =>
      validateBootstrapConfig({ ...validEnv, STAGING_PROJECT_REF: "other-ref" }),
    ).toThrow(/no coincide/i);
    expect(() => validateBootstrapConfig({ ...validEnv, STAGING_BOOTSTRAP_CONFIRM: "" })).toThrow(
      /confirm/i,
    );
    expect(() =>
      validateBootstrapConfig({ ...validEnv, STAGING_CHES_EMAIL: validEnv.STAGING_XESMONA_EMAIL }),
    ).toThrow(/emails diferentes/i);
  });

  it.each([
    "postgresql://postgres:secret@db.staging-ref.supabase.co:5432/postgres",
    "postgresql://postgres.staging-ref:secret@aws-1-eu-west-1.pooler.supabase.com:5432/postgres",
  ])("normalizes the configuration and preserves its fields with %s", (adminDbUrl) => {
    const paddedEnv = Object.fromEntries(
      Object.entries({ ...validEnv, SUPABASE_ADMIN_DB_URL: adminDbUrl }).map(([name, value]) => [
        name,
        name === "STAGING_BOOTSTRAP_CONFIRM" ? value : ` ${value} `,
      ]),
    );
    const result = validateBootstrapConfig({
      ...paddedEnv,
      STAGING_XESMONA_EMAIL: " Xesmona@Example.test ",
      STAGING_CHES_EMAIL: " CHES@Example.test ",
    });
    expect(result).toEqual({
      projectRef,
      supabaseUrl: `https://${projectRef}.supabase.co`,
      publishableKey: validEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      serviceRoleKey: validEnv.SUPABASE_SERVICE_ROLE_KEY,
      adminDbUrl,
      emails: validEnvEmails(),
    });
  });

  it.each(Object.keys(validEnv))("requires %s", (name) => {
    const missingEnv = { ...validEnv };
    delete missingEnv[name];
    expect(() => validateBootstrapConfig(missingEnv)).toThrow();
    expect(() => validateBootstrapConfig({ ...validEnv, [name]: " " })).toThrow();
  });

  it.each([false, true])(
    "rejects invalid configuration before creating clients or changing credentials (dry-run: %s)",
    async (dryRun) => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "staging-validation-"));
      const credentialsPath = path.join(directory, "credentials.json");
      const previous = JSON.stringify({ projectRef: "saved-project", users: {} });
      const invalidOverrides = [
        { STAGING_PROJECT_REF: "other-ref" },
        { NEXT_PUBLIC_SUPABASE_URL: "https://other-ref.supabase.co" },
        { NEXT_PUBLIC_SUPABASE_URL: "http://staging-ref.supabase.co" },
        { NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321" },
        { NEXT_PUBLIC_SUPABASE_URL: "https://127.0.0.1:54321" },
        { NEXT_PUBLIC_SUPABASE_URL: "https://user:secret@staging-ref.supabase.co" },
        { NEXT_PUBLIC_SUPABASE_URL: "https://staging-ref.supabase.co/path" },
        { NEXT_PUBLIC_SUPABASE_URL: "https://staging-ref.supabase.co?query=value" },
        { NEXT_PUBLIC_SUPABASE_URL: "https://staging-ref.supabase.co#fragment" },
        { NEXT_PUBLIC_SUPABASE_URL: "invalid-url" },
        { SUPABASE_ADMIN_DB_URL: "invalid-url" },
        { SUPABASE_ADMIN_DB_URL: "postgresql://postgres:secret@localhost:54322/postgres" },
        {
          SUPABASE_ADMIN_DB_URL:
            "postgresql://postgres:secret@db.other-ref.supabase.co:5432/postgres",
        },
        {
          SUPABASE_ADMIN_DB_URL:
            "postgresql://postgres.other-ref:secret@aws-1-eu-west-1.pooler.supabase.com:5432/postgres",
        },
        {
          SUPABASE_ADMIN_DB_URL:
            "postgresql://postgres.staging-ref:secret@aws-1-eu-west-1.pooler.supabase.com:6543/postgres",
        },
        { STAGING_BOOTSTRAP_CONFIRM: "wrong-confirmation" },
        { STAGING_BOOTSTRAP_CONFIRM: ` ${validEnv.STAGING_BOOTSTRAP_CONFIRM} ` },
        { STAGING_CHES_EMAIL: " XESMONA@Example.test " },
        ...Object.keys(validEnv).map((name) => ({ [name]: "" })),
      ];
      vi.clearAllMocks();
      try {
        await writeFile(credentialsPath, previous);
        for (const overrides of invalidOverrides) {
          await expect(
            runBootstrap({
              env: { ...validEnv, ...overrides },
              args: dryRun ? ["--dry-run"] : [],
              dependencies: { credentialsPath },
            }),
          ).rejects.toThrow();
          expect(createClient).not.toHaveBeenCalled();
          expect(Client).not.toHaveBeenCalled();
          expect(await readFile(credentialsPath, "utf8")).toBe(previous);
          expect(await readdir(directory)).toEqual(["credentials.json"]);
        }
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  );

  it("supports only the documented dry-run argument", async () => {
    expect(parseArgs(["--dry-run"])).toEqual({ dryRun: true });
    expect(parseArgs([])).toEqual({ dryRun: false });
    expect(() => parseArgs(["--force"])).toThrow(/Argumento desconocido/);

    const result = await runBootstrap({ env: validEnv, args: ["--dry-run"] });
    expect(result).toEqual({
      dryRun: true,
      config: { projectRef, emails: validEnvEmails() },
    });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it.each([
    "postgresql://postgres:secret@db.other-ref.supabase.co:5432/postgres",
    "postgresql://postgres.other-ref:secret@aws-1-eu-west-1.pooler.supabase.com:5432/postgres",
    "postgresql://postgres.staging-ref:secret@aws-1-eu-west-1.pooler.supabase.com:6543/postgres",
  ])("rejects a mismatched or runtime database connection before provisioning: %s", (url) => {
    expect(() => validateBootstrapConfig({ ...validEnv, SUPABASE_ADMIN_DB_URL: url })).toThrow(
      /mismo proyecto/,
    );
  });

  it("does not expose secrets in the CLI output", async () => {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ["scripts/bootstrap-staging.mjs", "--dry-run"],
      { env: { ...process.env, ...validEnv } },
    );
    expect(`${stdout}\n${stderr}`).not.toContain("publishable-secret");
    expect(`${stdout}\n${stderr}`).not.toContain("service-role-secret");
    expect(`${stdout}\n${stderr}`).not.toContain("postgresql://postgres:secret");
    expect(stdout).toContain("staging-ref");
  });

  it("generates passwords with sufficient entropy and writes credentials with mode 0600", async () => {
    const first = generatePassword();
    const second = generatePassword();
    expect(first).toHaveLength(36);
    expect(second).not.toBe(first);
    expect(first).toMatch(/[A-Z]/);
    expect(first).toMatch(/[a-z]/);
    expect(first).toMatch(/[0-9]/);
    expect(first).toMatch(/[!]/);

    const directory = await mkdtemp(path.join(os.tmpdir(), "staging-bootstrap-test-"));
    const filePath = path.join(directory, "credentials.json");
    try {
      await writeJsonSecure(filePath, { password: first });
      expect((await stat(filePath)).mode & 0o777).toBe(0o600);
      expect(JSON.parse(await readFile(filePath, "utf8"))).toEqual({ password: first });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("builds the expected Auth payload without changing global Auth settings", () => {
    expect(
      buildAuthUserPayload({
        definition: { displayName: "Xesmona" },
        email: "xesmona@example.test",
        password: "generated-password",
        projectRef,
      }),
    ).toEqual({
      email: "xesmona@example.test",
      password: "generated-password",
      email_confirm: true,
      user_metadata: { display_name: "Xesmona" },
      app_metadata: { staging_bootstrap: { project_ref: projectRef, version: 1 } },
    });
  });

  it("defines compatible storage buckets and rejects incompatible settings", () => {
    expect(STAGING_BUCKETS).toEqual([
      expect.objectContaining({ id: "avatars", public: true, fileSizeLimit: "5MB" }),
      expect.objectContaining({ id: "question-assets", public: false, fileSizeLimit: "50MB" }),
    ]);
    for (const bucket of STAGING_BUCKETS) {
      expect(bucketMatches(bucket, bucket)).toBe(true);
    }
    expect(
      bucketMatches(
        {
          id: "avatars",
          name: "avatars",
          public: true,
          file_size_limit: 5_000_000,
          allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
        },
        STAGING_BUCKETS[0],
      ),
    ).toBe(true);
    expect(
      bucketMatches(
        {
          id: "question-assets",
          name: "question-assets",
          public: false,
          file_size_limit: 50_000_000,
          allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
        },
        STAGING_BUCKETS[1],
      ),
    ).toBe(true);
    expect(bucketMatches({ ...STAGING_BUCKETS[0], public: false }, STAGING_BUCKETS[0])).toBe(false);
    expect(
      bucketMatches({ ...STAGING_BUCKETS[1], allowedMimeTypes: ["image/png"] }, STAGING_BUCKETS[1]),
    ).toBe(false);
  });

  it("contains only the three BetaVIP challenges and canonical content counts", () => {
    const data = stagingBetaVipManifest();
    const content = stagingBetaVipExpectedContent();
    const sql = buildStagingBetaVipDomainSql({
      xesmonaPlayerId: "00000000-0000-4000-8000-000000000001",
      chesPlayerId: "00000000-0000-4000-8000-000000000002",
      cassetteAssetMetadata: { byteSize: 2048, sha256: "a".repeat(64) },
    });

    expect(data).not.toHaveProperty("tabarnia");
    expect(
      data.publications.map(({ title, mode, status, opensAfterHours }) => [
        title,
        mode,
        status,
        opensAfterHours,
      ]),
    ).toEqual([
      ["La vuelta al mundo", "alphabet", "open", 0],
      ["Cumbre lógica II", "pyramid", "scheduled", 24],
      ["Supervivencia: Cultura pop", "survival", "scheduled", 48],
    ]);
    expect(content.survival).toHaveLength(20);
    expect(content.alphabet).toHaveLength(18);
    expect(content.pyramid).toHaveLength(7);
    expect(sql.toLowerCase()).not.toContain("tabarnia");
    expect(sql).not.toContain("Manuel");
    expect(sql).not.toContain("Genís");
    expect(sql).not.toContain("Dark");
    expect(sql).toContain("00000000-0000-4000-8000-000000000001");
    expect(sql).toContain("'owner', 'active'");
    expect(sql).toContain("'superadmin'");
  });

  it("uses deterministic IDs and conflict-safe writes for reruns", () => {
    const input = {
      xesmonaPlayerId: "00000000-0000-4000-8000-000000000001",
      chesPlayerId: "00000000-0000-4000-8000-000000000002",
      cassetteAssetMetadata: { byteSize: 2048, sha256: "a".repeat(64) },
    };
    expect(stagingBetaVipManifest()).toEqual(stagingBetaVipManifest());
    const firstSql = buildStagingBetaVipDomainSql(input);
    const secondSql = buildStagingBetaVipDomainSql(input);
    expect(secondSql).toBe(firstSql);
    expect(firstSql.match(/on conflict/gi)).not.toBeNull();
    expect(firstSql).toContain("on conflict (id) do nothing");
  });
});

function validEnvEmails() {
  return { xesmona: validEnv.STAGING_XESMONA_EMAIL, ches: validEnv.STAGING_CHES_EMAIL };
}
