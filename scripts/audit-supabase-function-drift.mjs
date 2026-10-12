import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { checkInventory } from "./supabase-security-inventory.mjs";
import { auditFunctionBehavior } from "./audit-supabase-function-drift-cases.mjs";
import { assertReconciledCommandBehavior } from "./test-competitive-command-reconciliation.mjs";
import { testCompetitiveCommandRaces } from "./test-competitive-command-races.mjs";

const container = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_the-flash-game";
const output =
  process.argv.find((arg) => arg.startsWith("--output="))?.slice(9) ??
  "output/audits/supabase-function-drift.json";

function docker(args, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", container, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "",
      err = "";
    // Decode across chunk boundaries so accented SQL literals remain intact.
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
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

const catalogQuery = `select jsonb_agg(jsonb_build_object(
  'name', n.nspname || '.' || p.proname, 'identity', pg_get_function_identity_arguments(p.oid),
  'arguments', pg_get_function_arguments(p.oid), 'result', pg_get_function_result(p.oid),
  'language', l.lanname, 'volatility', p.provolatile, 'securityDefiner', p.prosecdef,
  'strict', p.proisstrict, 'leakproof', p.proleakproof, 'parallel', p.proparallel,
  'cost', p.procost, 'rows', p.prorows, 'settings', p.proconfig,
  'owner', pg_get_userbyid(p.proowner), 'acl', p.proacl,
  'definition', pg_get_functiondef(p.oid), 'body', p.prosrc
) order by n.nspname, p.proname, p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname in ('private', 'public') and not exists (
  select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e');`;

// This comparison is deliberately conservative: preserve literals, identifiers,
// case and operators. Only external whitespace and SQL comments are ignored.
function tokens(body) {
  return body
    .match(
      /'(?:''|[^'])*'|"(?:""|[^"])*"|\$([\w]*)\$[\s\S]*?\$\1\$|--[^\n]*|\/\*[\s\S]*?\*\/|\s+|[A-Za-z_][A-Za-z_0-9$]*|./g,
    )
    .filter((token) => !/^\s+$|^--|^\/\*/.test(token));
}

async function capture(source) {
  const database = `flash_function_audit_${randomUUID().replaceAll("-", "")}`;
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
    const files = (await readdir(`supabase/${source}`))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    const statements = await Promise.all(
      files.map((file) => readFile(`supabase/${source}/${file}`, "utf8")),
    );
    await sql(`begin;\n${statements.join("\n")}\ncommit;`);
    await checkInventory(sql);
    const functions = JSON.parse(await sql(catalogQuery));
    const origins = {};
    for (let i = 0; i < files.length; i++) {
      for (const match of statements[i].matchAll(
        /\bcreate\s+(?:or\s+replace\s+)?function\s+"?(private|public)"?\s*\.\s*"?([a-z_]+)"?\s*\(/gi,
      )) {
        origins[`${match[1]}.${match[2]}`] = {
          file: `supabase/${source}/${files[i]}`,
          line: statements[i].slice(0, match.index).split("\n").length,
        };
      }
    }
    console.log(
      `${source}: ${files.length} files, ${functions.length} functions; security inventory passed.`,
    );
    const sqlWrapper = functions.find((fn) => fn.name === "private.take_over_attempt");
    // CREATE OR REPLACE can change language without dropping the function. The
    // same SQL facade is tested in both databases, including the mixed state.
    const wrapperDefinition =
      "create or replace function private.take_over_attempt(input jsonb) returns jsonb\n" +
      "language sql security definer set search_path = '' as $$ select private.execute_command('takeover', input) $$;";
    assert.ok(sqlWrapper, "Missing takeover function");
    const observations = await auditFunctionBehavior(sql, wrapperDefinition);
    if (process.argv.includes("--assert-reconciled")) {
      assertReconciledCommandBehavior(observations);
      await testCompetitiveCommandRaces(sql);
    }
    return { files, functions, origins, observations };
  } finally {
    if (created) await docker(["dropdb", "-U", "postgres", "--force", database]);
  }
}

const migrations = await capture("migrations");
const schemas = await capture("schemas");
const key = (fn) => `${fn.name}(${fn.identity})`;
const migrated = new Map(migrations.functions.map((fn) => [key(fn), fn]));
const declared = new Map(schemas.functions.map((fn) => [key(fn), fn]));
assert.deepEqual([...migrated.keys()], [...declared.keys()], "Function signatures differ");
const differences = [];
for (const [identity, left] of migrated) {
  const right = declared.get(identity);
  const attributes = Object.fromEntries(
    Object.keys(left)
      .filter(
        (name) =>
          !["definition", "body"].includes(name) &&
          JSON.stringify(left[name]) !== JSON.stringify(right[name]),
      )
      .map((name) => [name, { migrations: left[name], schemas: right[name] }]),
  );
  if (left.body !== right.body || Object.keys(attributes).length) {
    differences.push({
      identity,
      kind:
        JSON.stringify(tokens(left.body)) === JSON.stringify(tokens(right.body)) &&
        !Object.keys(attributes).length
          ? "comments-or-whitespace"
          : "executable-or-attributes",
      attributes,
      migrations: { ...migrations.origins[left.name], definition: left.definition },
      schemas: { ...schemas.origins[right.name], definition: right.definition },
    });
  }
}
assert.deepEqual(
  migrations.observations.map((entry) => entry.id),
  schemas.observations.map((entry) => entry.id),
);
const behavior = migrations.observations.map((entry, index) => ({
  id: entry.id,
  equal: JSON.stringify(entry.result) === JSON.stringify(schemas.observations[index].result),
  migrations: entry.result,
  schemas: schemas.observations[index].result,
}));
const report = {
  latestMigration: migrations.files.at(-1)?.replace(/\.sql$/, ""),
  functionCount: migrated.size,
  differences,
  behavior,
};
if (process.argv.includes("--assert-reconciled")) {
  assert.deepEqual(
    differences,
    [],
    "Schemas and migrations must have identical function definitions and attributes",
  );
  assert.ok(
    behavior.every((entry) => entry.equal),
    "Reconciled behavior must match across both paths",
  );
}
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  `${differences.length} definition differences: ${differences.filter((d) => d.kind === "comments-or-whitespace").length} cosmetic.`,
);
console.log(
  `${behavior.length} behavior probes: ${behavior.filter((entry) => !entry.equal).length} differing outcomes.`,
);
console.log(`Audit report: ${path.resolve(output)}`);
