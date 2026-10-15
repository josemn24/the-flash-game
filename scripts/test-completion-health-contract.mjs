import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Run the actual runtime probe against both new and old function bodies, in a disposable DB.
export async function testCompletionHealthContract(sql) {
  const source = await readFile("infrastructure/supabase/platform/health.ts", "utf8");
  const query = source.match(/select\s+true as database_ok,[\s\S]*?as schema_revision_marker/)?.[0];
  assert.ok(query, "The runtime schema probe must be available");
  assert.equal((await sql(`${query};`)).trim(), "t|t|t", "Health recognizes the current schema");
  const baseline = await readFile("supabase/migrations/20261011180045_initial_schema.sql", "utf8");
  for (const name of ["execute_command", "handle_attempt_command"]) {
    const start = baseline.indexOf(`CREATE OR REPLACE FUNCTION private.${name} (`);
    assert.ok(start >= 0, `Baseline contains ${name}`);
    const end = baseline.indexOf("$function$;", baseline.indexOf("AS $function$", start) + 14);
    assert.ok(end > start, `Baseline body for ${name} has a terminator`);
    const oldFunction = baseline.slice(start, end + "$function$;".length);
    const result = await sql(`begin; ${oldFunction}\n${query}; rollback;`);
    assert.equal(result.trim(), "t|t|f", `Health rejects the old ${name} contract`);
  }
}
