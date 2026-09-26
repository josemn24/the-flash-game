import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const migrationDirectory = path.join(root, "supabase", "migrations");
const latestMigration = readdirSync(migrationDirectory)
  .filter((file) => /^\d+_.+\.sql$/.test(file))
  .sort()
  .at(-1)
  ?.replace(/\.sql$/, "");

const envExample = readFileSync(path.join(root, ".env.example"), "utf8");
const healthSource = readFileSync(path.join(root, "infrastructure", "supabase", "health.ts"), "utf8");
const pilotSource = readFileSync(path.join(root, "scripts", "verify-pilot.mjs"), "utf8");

function requiredValue(source, pattern, label) {
  const value = source.match(pattern)?.[1];
  if (!value) throw new Error(`No se encontró ${label}.`);
  return value;
}

const values = {
  latestMigration,
  envExample: requiredValue(
    envExample,
    /^EXPECTED_SCHEMA_REVISION=(\S+)$/m,
    "EXPECTED_SCHEMA_REVISION en .env.example",
  ),
  health: requiredValue(
    healthSource,
    /canonicalSchemaRevision\s*=\s*["']([^"']+)["']/,
    "canonicalSchemaRevision en health.ts",
  ),
  verifyPilot: requiredValue(
    pilotSource,
    /EXPECTED_SCHEMA_REVISION:\s*\n\s*process\.env\.EXPECTED_SCHEMA_REVISION\s*\|\|\s*["']([^"']+)["']/,
    "valor por defecto de verify-pilot",
  ),
};

const mismatches = Object.entries(values).filter(([, value]) => value !== latestMigration);
if (mismatches.length > 0) {
  console.error("Divergencia de revisión de esquema:");
  for (const [source, value] of mismatches) {
    console.error(`- ${source}: ${value ?? "ausente"} (esperado: ${latestMigration ?? "ausente"})`);
  }
  process.exitCode = 1;
} else {
  console.log(`Schema revision checks OK (${latestMigration}).`);
}
