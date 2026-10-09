import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

export const questionValidationMigration = "20261009180205_question_validation_by_format.sql";

export const functionsQuery = `select coalesce(jsonb_object_agg(n.nspname || '.' || p.proname || '(' ||
  pg_get_function_identity_arguments(p.oid) || ')', jsonb_build_object(
    'oid', p.oid, 'definition', pg_get_functiondef(p.oid),
    'owner', pg_get_userbyid(p.proowner), 'acl', p.proacl,
    'arguments', pg_get_function_identity_arguments(p.oid),
    'result', pg_get_function_result(p.oid), 'volatility', p.provolatile,
    'securityDefiner', p.prosecdef, 'config', p.proconfig,
    'language', (select lanname from pg_language where oid = p.prolang),
    'strict', p.proisstrict, 'leakproof', p.proleakproof, 'parallel', p.proparallel,
    'cost', p.procost, 'rows', p.prorows)), '{}')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private') and not exists (
  select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e');`;

// Snapshot every domain table, including empty ones, without relying on primary keys.
const rowsQuery = `select pg_temp.domain_rows();`;
export const snapshotFunction = `create function pg_temp.domain_rows() returns jsonb language plpgsql as $$
declare relation record; rows jsonb; snapshot jsonb := '{}';
begin
  for relation in select n.nspname, c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private') and c.relkind in ('r', 'p')
      and not exists (select 1 from pg_depend d where d.classid = 'pg_class'::regclass
        and d.objid = c.oid and d.deptype = 'e')
  loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), ''[]''::jsonb) from %I.%I t',
      relation.nspname, relation.relname) into rows;
    snapshot := snapshot || jsonb_build_object(relation.nspname || '.' || relation.relname, rows);
  end loop;
  return snapshot;
end;
$$;`;

export async function testQuestionValidationUpgrade(sql, migration) {
  const fixtures = await readFile("supabase/tests/support/command-fixtures.sql", "utf8");
  // Commit real command outcomes before applying the incremental migration. Keep
  // a completed attempt with answers/results/ledger and a second active attempt.
  await sql(`begin;
${fixtures}
select test_support.as_actor('owner');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', test_support.id('sc-flash')));
select test_support.run('prepare_interaction');
select test_support.run('receive_answer', '{"answer":true}');
select test_support.run('record_evaluation', '{"status":"correct","points":50}');
select test_support.run('prepare_interaction');
select test_support.run('receive_answer', '{"answer":false}');
select test_support.run('record_evaluation', '{"status":"incorrect","points":0}');
select test_support.run('complete_attempt', '{"score":50}');
reset role;
select test_support.as_actor('member');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', test_support.id('sc-flash'), 'sessionToken', repeat('m', 40)));
select test_support.run('prepare_interaction');
commit;`);
  // pg_temp lasts only for one psql connection, so create the function alongside each query.
  const beforeRows = JSON.parse(await sql(`${snapshotFunction}\n${rowsQuery}`));
  for (const name of [
    "private.question_versions",
    "private.challenge_versions",
    "public.attempts",
    "private.attempt_answers",
    "private.answer_receipts",
    "private.flash_point_entries",
  ])
    assert.ok(beforeRows[name]?.length, `${name}: populated upgrade fixture required`);
  assert.ok(beforeRows["public.attempts"].some((row) => row.status === "completed"));
  assert.ok(beforeRows["public.attempts"].some((row) => row.status === "in_progress"));
  const beforeFunctions = JSON.parse(await sql(functionsQuery));
  await sql(`begin;\n${migration}\ncommit;`);
  assert.deepEqual(
    JSON.parse(await sql(`${snapshotFunction}\n${rowsQuery}`)),
    beforeRows,
    "The migration must preserve every domain table and row",
  );
  const afterFunctions = JSON.parse(await sql(functionsQuery));
  const replaced = new Set([
    "private.is_supported_flash_question(target_question uuid)",
    "private.validate_flash_question_document(document jsonb)",
  ]);
  for (const [name, previous] of Object.entries(beforeFunctions)) {
    assert.ok(afterFunctions[name], `${name}: existing functions must not be removed`);
    const { definition: previousDefinition, ...previousAttributes } = previous;
    const { definition: nextDefinition, ...nextAttributes } = afterFunctions[name];
    assert.deepEqual(nextAttributes, previousAttributes, `${name}: signature/OID/attributes/ACL`);
    if (!replaced.has(name))
      assert.equal(nextDefinition, previousDefinition, `${name}: unrelated function changed`);
  }
  const added = Object.entries(afterFunctions).filter(([name]) => !beforeFunctions[name]);
  assert.equal(added.length, 33, "Only the 33 per-format helpers may be added");
  for (const [name, fn] of added) {
    assert.match(name, /^private\.(validate_.+_question_document|is_supported_.+_question)\(/);
    assert.equal(fn.owner, "postgres", `${name}: owner`);
    assert.equal(fn.securityDefiner, false, `${name}: invoker`);
    assert.equal(
      fn.volatility,
      name.startsWith("private.is_supported_") ? "s" : "v",
      `${name}: volatility`,
    );
    assert.deepEqual(fn.config, ['search_path=""'], `${name}: search_path`);
    assert.deepEqual(
      fn.acl,
      ["postgres=X/postgres"],
      `${name}: application roles must have no EXECUTE`,
    );
  }
  console.log(
    `Incremental upgrade preserved all ${Object.keys(beforeRows).length} domain tables, existing functions and public signatures; 33 private helpers verified.`,
  );
}
