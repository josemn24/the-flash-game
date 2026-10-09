import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { checkInventory } from "./supabase-security-inventory.mjs";
import { testConcurrentCommands } from "./test-supabase-concurrency.mjs";
import { testFormatContracts } from "./test-format-contracts.mjs";

const container = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_the-flash-game";
const sourceDirectory = process.argv.includes("--migrations")
  ? "supabase/migrations"
  : "supabase/schemas";
const database = `flash_schema_check_${randomUUID().replaceAll("-", "")}`;
function docker(args, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", container, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "",
      err = "";
    child.stdout.on("data", (data) => {
      out += data;
    });
    child.stderr.on("data", (data) => {
      err += data;
    });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${err}\n${out}`))));
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}
const sql = (input) =>
  docker(["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database], input);
let created = false;
try {
  await docker(["createdb", "-U", "postgres", database]);
  created = true;
  await sql(await readFile("supabase/tests/support/bootstrap.sql", "utf8"));
  const files = (await readdir(sourceDirectory)).filter((name) => name.endsWith(".sql")).sort();
  const statements = await Promise.all(
    files.map((name) => readFile(`${sourceDirectory}/${name}`, "utf8")),
  );
  await sql(`begin;\n${statements.join("\n")}\ncommit;`);
  await checkInventory(sql);
  console.log(`Loaded ${files.length} files from ${sourceDirectory}; security inventory verified.`);
  for (const file of (await readdir("supabase/tests"))
    .filter((name) => name.endsWith(".test.sql"))
    .sort()) {
    let source = await readFile(`supabase/tests/${file}`, "utf8");
    for (const name of ["command", "pyramid-queens"]) {
      if (source.includes(`-- @${name}-fixtures`)) {
        const fixtures = await readFile(`supabase/tests/support/${name}-fixtures.sql`, "utf8");
        source = source.replace(`-- @${name}-fixtures`, () => fixtures);
      }
    }
    let result;
    try {
      result = await sql(source);
    } catch (error) {
      throw new Error(`${file}:\n${error instanceof Error ? error.message : String(error)}`, {
        cause: error,
      });
    }
    if (/^not ok|^Bail out!|# Looks like you failed/m.test(result) || !/^1\.\.\d+/m.test(result))
      throw new Error(`${file}:\n${result}`);
    console.log(`${file}: ${result.match(/^1\.\.(\d+)/m)?.[1]} checks passed.`);
  }
  await testFormatContracts(sql);
  await testConcurrentCommands(sql);
  console.log("Concurrent command tests passed (independent PostgreSQL connections).");
} finally {
  if (created) await docker(["dropdb", "-U", "postgres", "--force", database]);
}
