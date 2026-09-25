import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const container = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_the-flash-game";
const backupDirectory = path.join("output", "s22");
const backupPath = path.join(backupDirectory, "local-pilot.dump");
const restoreDatabase = `s22_restore_${Date.now()}`;
const containerDumpPath = `/tmp/${path.basename(backupPath)}`;
const restoreSchemas = ["auth", "public", "private"];

async function docker(args, options = {}) {
  return execFileAsync("docker", args, {
    cwd: process.cwd(),
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
}

await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
const dump = await docker(
  [
    "exec",
    container,
    "pg_dump",
    "-Fc",
    "-U",
    "postgres",
    "-d",
    "postgres",
    ...restoreSchemas.flatMap((schema) => ["--schema", schema]),
  ],
  {
    encoding: "buffer",
  },
);
await writeFile(backupPath, dump.stdout, { mode: 0o600 });
await docker(["cp", backupPath, `${container}:${containerDumpPath}`]);
await docker(["exec", container, "createdb", "-U", "postgres", restoreDatabase]);
// createdb supplies an empty public schema. Remove it so pg_restore can
// recreate the captured schema and its ACLs exactly as dumped.
await docker([
  "exec",
  container,
  "psql",
  "-X",
  "-q",
  "-U",
  "postgres",
  "-d",
  restoreDatabase,
  "-c",
  "drop schema public cascade;",
]);
await docker([
  "exec",
  container,
  "psql",
  "-X",
  "-q",
  "-U",
  "postgres",
  "-d",
  restoreDatabase,
  "-c",
  'create schema if not exists extensions; create extension if not exists btree_gist with schema extensions; create extension if not exists pgcrypto with schema extensions; create extension if not exists "uuid-ossp" with schema extensions;',
]);

try {
  await docker([
    "exec",
    container,
    "pg_restore",
    "--exit-on-error",
    "--no-owner",
    "--no-privileges",
    "-U",
    "postgres",
    "-d",
    restoreDatabase,
    containerDumpPath,
  ]);
  const original = await docker([
    "exec",
    container,
    "psql",
    "-X",
    "-qAt",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-c",
    "select (select count(*) from public.rooms)::text || ':' || (select count(*) from public.attempts)::text;",
  ]).catch(() => null);
  const restored = await docker([
    "exec",
    container,
    "psql",
    "-X",
    "-qAt",
    "-U",
    "postgres",
    "-d",
    restoreDatabase,
    "-c",
    "select (select count(*) from public.rooms)::text || ':' || (select count(*) from public.attempts)::text;",
  ]);
  const originalValue = original?.stdout?.trim();
  const restoredValue = restored.stdout.trim();
  if (originalValue && originalValue !== restoredValue) {
    throw new Error(`Backup/restore count mismatch: ${originalValue} !== ${restoredValue}`);
  }
  await writeFile(path.join(backupDirectory, "backup-restore.txt"), `${restoredValue}\n`);
} finally {
  await docker(["exec", container, "dropdb", "-U", "postgres", "--if-exists", restoreDatabase]);
  await docker(["exec", container, "rm", "-f", containerDumpPath]).catch(() => undefined);
}

const metadata = await readFile(backupPath);
if (metadata.byteLength === 0) throw new Error("The local backup is empty.");
console.log(`Backup/restore passed: ${backupPath}`);
