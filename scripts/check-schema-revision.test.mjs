import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

it("rejects an obsolete documented revision even when all code markers agree", () => {
  const root = mkdtempSync(join(tmpdir(), "flash-schema-revision-"));
  const revision = "20261020210000_dynamic_rehearsals";
  const files = {
    [`supabase/migrations/${revision}.sql`]: "-- fixture",
    ".env.example": `EXPECTED_SCHEMA_REVISION=${revision}`,
    "infrastructure/supabase/platform/health.ts": `const canonicalSchemaRevision = "${revision}";`,
    "scripts/verify-pilot.mjs": `({ EXPECTED_SCHEMA_REVISION: process.env.EXPECTED_SCHEMA_REVISION || "${revision}" })`,
    "playwright.config.ts": `({ EXPECTED_SCHEMA_REVISION: process.env.EXPECTED_SCHEMA_REVISION || "${revision}" })`,
    "docs/current/status.md": "Revisión canónica del repositorio: `old_revision`.",
  };
  try {
    for (const [file, content] of Object.entries(files)) {
      const destination = join(root, file);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, content);
    }
    const script = join(root, "scripts/check-schema-revision.mjs");
    copyFileSync(new URL("./check-schema-revision.mjs", import.meta.url), script);
    const obsolete = spawnSync(process.execPath, [script], { encoding: "utf8" });
    expect(obsolete.status).toBe(1);
    expect(obsolete.stderr).toContain(`documentation: old_revision (esperado: ${revision})`);

    writeFileSync(
      join(root, "docs/current/status.md"),
      `Revisión canónica del repositorio: \`${revision}\`.`,
    );
    const aligned = spawnSync(process.execPath, [script], { encoding: "utf8" });
    expect(aligned.status).toBe(0);
    expect(aligned.stdout).toContain(`Schema revision checks OK (${revision})`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
