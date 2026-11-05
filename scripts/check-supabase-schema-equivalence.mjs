import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { schemaCatalogQuery, catalogDifferences } from "./support/schema-catalog.mjs";

const container = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_the-flash-game";
const args = process.argv.slice(2);
const reference = args.find((arg) => arg.startsWith("--reference-dir="))?.slice(16);
const output =
  args.find((arg) => arg.startsWith("--output="))?.slice(9) ??
  "output/audits/schema-equivalence.json";
assert.ok(
  args.every((arg) => arg.startsWith("--reference-dir=") || arg.startsWith("--output=")),
  "Unknown equivalence argument",
);
const sources = {
  schemas: "supabase/schemas",
  migrations: "supabase/migrations",
  ...(reference ? { reference } : {}),
};
const report = {
  generatedAt: new Date().toISOString(),
  sources: {},
  comparisons: [],
  negativeChecks: [],
  equivalent: false,
};
const docker = (args, input = "") =>
  new Promise((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", container, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "",
      err = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.stderr.on("data", (chunk) => {
      err += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(out.trim()) : reject(new Error(`${err}\n${out}`)),
    );
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
async function capture(directory, name) {
  const database = `flash_equivalence_${randomUUID().replaceAll("-", "")}`;
  const sql = (input) =>
    docker(
      ["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database],
      input,
    );
  let created = false;
  try {
    await docker(["createdb", "-U", "postgres", database]);
    created = true;
    await sql(await readFile("supabase/tests/support/bootstrap.sql", "utf8"));
    const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
    assert.ok(files.length, `${directory} must contain SQL`);
    const contents = await Promise.all(
      files.map((file) => readFile(path.join(directory, file), "utf8")),
    );
    report.sources[name] = files.map((file, index) => ({
      file,
      sha256: createHash("sha256").update(contents[index]).digest("hex"),
    }));
    await sql(`begin;\n${contents.join("\n")}\ncommit;`);
    const catalog = JSON.parse(await sql(schemaCatalogQuery));
    if (name === "schemas") {
      for (const [label, ddl] of [
        [
          "constraint",
          "alter table public.players add constraint equivalence_probe check (display_name <> 'probe')",
        ],
        ["index", "drop index public.memberships_player_status_idx"],
        ["schema-privilege", "grant create on schema public to authenticated"],
        ["policy", "alter policy storage_avatars_public_read on storage.objects using (false)"],
      ]) {
        const mutated = JSON.parse(await sql(`begin; ${ddl}; ${schemaCatalogQuery} rollback;`));
        assert.ok(
          catalogDifferences(catalog, mutated).length,
          `Comparator must detect an altered ${label}`,
        );
        assert.deepEqual(
          JSON.parse(await sql(schemaCatalogQuery)),
          catalog,
          `${label} mutation must roll back`,
        );
        report.negativeChecks.push(label);
      }
    }
    console.log(
      `${name}: captured ${files.length} SQL files and ${catalog.relations.length} relations.`,
    );
    return catalog;
  } finally {
    if (created) await docker(["dropdb", "-U", "postgres", "--force", database]);
  }
}
try {
  const catalogs = {};
  for (const [name, directory] of Object.entries(sources))
    catalogs[name] = await capture(directory, name);
  for (const name of Object.keys(catalogs).filter((name) => name !== "schemas")) {
    const differences = catalogDifferences(catalogs.schemas, catalogs[name]);
    report.comparisons.push({ expected: "schemas", actual: name, differences });
    console.log(`schemas vs ${name}: ${differences.length} catalog differences.`);
  }
  report.equivalent = report.comparisons.every((comparison) => comparison.differences.length === 0);
  assert.ok(report.equivalent, "Schema catalog equivalence failed; inspect the audit report");
} catch (error) {
  report.error = error.message;
  process.exitCode = 1;
  console.error(error.message);
} finally {
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Equivalence report: ${output}`);
}
