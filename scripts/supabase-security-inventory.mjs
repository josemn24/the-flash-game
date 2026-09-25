import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const snapshotQuery = `
select jsonb_build_object(
  'relations', (select coalesce(jsonb_agg(jsonb_build_object(
    'name', n.nspname || '.' || c.relname, 'kind', c.relkind,
    'owner', pg_get_userbyid(c.relowner), 'rls', c.relrowsecurity,
    'securityInvoker', coalesce('security_invoker=true' = any(c.reloptions), false),
    'roles', (select jsonb_object_agg(r, jsonb_build_object(
      'table', (select coalesce(jsonb_agg(p order by p), '[]') from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
        where has_table_privilege(r,c.oid,p)),
      'columns', (select coalesce(jsonb_object_agg(attname, perms), '{}') from (
        select a.attname, (select coalesce(jsonb_agg(p order by p), '[]') from unnest(array['SELECT','INSERT','UPDATE','REFERENCES']) p
          where has_column_privilege(r,c.oid,a.attnum,p)) perms
        from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
      ) cp where perms <> '[]'::jsonb)
    )) from unnest(array['anon','authenticated','service_role']) r),
    'unexpectedGrantOption', exists(select 1 from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) x
      where x.grantee<>c.relowner and x.is_grantable) or exists (
      select 1 from pg_attribute a cross join lateral aclexplode(a.attacl) x
      where a.attrelid=c.oid and x.grantee<>c.relowner and x.is_grantable)
  ) order by n.nspname,c.relname), '[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','private') and c.relkind in ('r','p','v','m','S','f')
      and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e')),
  'functions', (select coalesce(jsonb_agg(jsonb_build_object(
    'name', n.nspname||'.'||p.proname, 'arguments', pg_get_function_identity_arguments(p.oid),
    'owner', pg_get_userbyid(p.proowner), 'securityDefiner',p.prosecdef, 'aclExplicit',p.proacl is not null,
    'searchPath',coalesce(p.proconfig @> array['search_path=""'],false),
    'executeRoles',(select coalesce(jsonb_agg(r order by r),'[]') from unnest(array['anon','authenticated','service_role']) r where has_function_privilege(r,p.oid,'EXECUTE')),
    'publicExecute',exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x where x.grantee=0 and x.privilege_type='EXECUTE'),
    'unexpectedGrantOption',exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x where x.grantee<>p.proowner and x.is_grantable)
  ) order by n.nspname,p.proname,p.oid),'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and not exists(select 1 from pg_depend d
      where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e'))
);`;

function verify(actual, expected) {
  assert.deepEqual(
    actual.relations.map((r) => r.name),
    Object.keys(expected.relations).sort(),
    "Unregistered/missing relation",
  );
  for (const relation of actual.relations) {
    const entry = expected.relations[relation.name];
    assert.equal(relation.owner, "postgres", `${relation.name}: owner`);
    assert.equal(relation.kind, entry.kind, `${relation.name}: kind`);
    assert.equal(relation.unexpectedGrantOption, false, `${relation.name}: delegation`);
    if (entry.kind === "r") assert.equal(relation.rls, true, `${relation.name}: RLS`);
    if (entry.kind === "v") {
      assert.equal(relation.securityInvoker, true, `${relation.name}: invoker`);
      assert.ok(entry.boundary, `${relation.name}: documented read boundary`);
    }
    for (const role of ["anon", "authenticated", "service_role"]) {
      const policy = entry[role] ?? {};
      const tablePerms = policy.table ?? [];
      const observed = relation.roles[role];
      assert.deepEqual(observed.table, tablePerms, `${relation.name}/${role}: table ACL`);
      // Table privileges imply privileges on every column. Compare only additions beyond them.
      const extraColumns = Object.fromEntries(
        Object.entries(observed.columns)
          .map(([column, perms]) => [column, perms.filter((p) => !tablePerms.includes(p))])
          .filter(([, perms]) => perms.length),
      );
      assert.deepEqual(extraColumns, policy.columns ?? {}, `${relation.name}/${role}: column ACL`);
    }
  }
  assert.deepEqual(
    actual.functions.map((f) => f.name),
    Object.keys(expected.functions).sort(),
    "Unregistered/missing/overloaded function",
  );
  for (const fn of actual.functions) {
    assert.deepEqual(
      fn,
      {
        ...expected.functions[fn.name],
        name: fn.name,
        owner: "postgres",
        searchPath: true,
        publicExecute: false,
        unexpectedGrantOption: false,
        aclExplicit: true,
      },
      `${fn.name}: function ACL/ownership/search_path`,
    );
  }
}

export async function checkInventory(sql) {
  const expected = JSON.parse(await readFile("supabase/security-inventory.json", "utf8"));
  verify(JSON.parse(await sql(snapshotQuery)), expected);
  // Mutation tests: a harmless new object must still require an explicit inventory decision.
  for (const ddl of [
    "create table public.unreviewed_probe(id uuid); alter table public.unreviewed_probe enable row level security;",
    "create function public.unreviewed_probe() returns integer language sql as 'select 1';",
    "create view public.unreviewed_probe with (security_invoker=true) as select 1 as id;",
  ]) {
    const actual = JSON.parse(await sql(`begin; ${ddl} ${snapshotQuery} rollback;`));
    assert.throws(() => verify(actual, expected), /Unregistered/, "New object must fail inventory");
  }
  const badAcl = JSON.parse(
    await sql(`begin; grant update on public.attempts to service_role; ${snapshotQuery} rollback;`),
  );
  assert.throws(() => verify(badAcl, expected), /ACL/, "Unreviewed DML must fail inventory");
  const publicAcl = JSON.parse(
    await sql(`begin; grant select on public.attempts to public; ${snapshotQuery} rollback;`),
  );
  assert.throws(
    () => verify(publicAcl, expected),
    /ACL/,
    "Inherited PUBLIC grants must fail inventory",
  );
  const columnDelegation = JSON.parse(
    await sql(
      `begin; grant update (display_name) on public.players to authenticated with grant option; ${snapshotQuery} rollback;`,
    ),
  );
  assert.throws(
    () => verify(columnDelegation, expected),
    /delegation/,
    "Column grant options must fail inventory",
  );
}
