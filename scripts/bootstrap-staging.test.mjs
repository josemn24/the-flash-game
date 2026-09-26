import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
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

const projectRef = "staging-ref";
const validEnv = {
  STAGING_PROJECT_REF: projectRef,
  NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-secret",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
  SUPABASE_ADMIN_DB_URL: "postgresql://admin:secret@db.staging-ref.supabase.co:5432/postgres",
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
    ).toThrow(/URL local/i);
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

  it("does not expose secrets in the CLI output", async () => {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ["scripts/bootstrap-staging.mjs", "--dry-run"],
      { env: { ...process.env, ...validEnv } },
    );
    expect(`${stdout}\n${stderr}`).not.toContain("publishable-secret");
    expect(`${stdout}\n${stderr}`).not.toContain("service-role-secret");
    expect(`${stdout}\n${stderr}`).not.toContain("postgresql://admin:secret");
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
      ["Supervivencia: Cultura pop", "survival", "open", 0],
      ["La vuelta al mundo", "alphabet", "scheduled", 24],
      ["Cumbre lógica II", "pyramid", "scheduled", 48],
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
