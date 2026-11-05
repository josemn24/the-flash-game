// Catalogs are compared by object/column name, never by database-local OIDs or table attnum.
// PostgreSQL renders expressions and constraints; function bodies remain byte-for-byte comparable.
const acl = (expression, owner, kind) => `(select coalesce(jsonb_agg(jsonb_build_object(
  'grantor',pg_get_userbyid(a.grantor),'grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
  'privilege',a.privilege_type,'grantable',a.is_grantable)
  order by a.grantor::regrole::text,a.grantee::regrole::text,a.privilege_type,a.is_grantable),'[]'::jsonb)
  from aclexplode(${owner ? `coalesce(${expression},acldefault('${kind}',${owner}))` : expression}) a)`;
const own = (catalog, alias) =>
  `not exists(select 1 from pg_depend d where d.classid='${catalog}'::regclass and d.objid=${alias}.oid and d.deptype='e')`;

export const schemaCatalogQuery = `
select jsonb_build_object(
 'schemas',(select coalesce(jsonb_agg(jsonb_build_object('name',n.nspname,'owner',pg_get_userbyid(n.nspowner),
   -- Equivalent explicit/inherited grants have the same effective privileges.
   'acl',(select jsonb_agg(jsonb_build_object('role',r.rolname,
     'usage',has_schema_privilege(r.oid,n.oid,'USAGE'),'create',has_schema_privilege(r.oid,n.oid,'CREATE'),
     'usageGrant',has_schema_privilege(r.oid,n.oid,'USAGE WITH GRANT OPTION'),
     'createGrant',has_schema_privilege(r.oid,n.oid,'CREATE WITH GRANT OPTION')) order by r.rolname) from pg_roles r),
   'publicAcl',(select coalesce(jsonb_agg(jsonb_build_object('privilege',a.privilege_type,'grantable',a.is_grantable)
     order by a.privilege_type),'[]') from aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a where a.grantee=0)) order by n.nspname),'[]')
   from pg_namespace n where n.nspname in ('public','private','extensions')),
 'extensions',(select coalesce(jsonb_agg(jsonb_build_object('name',e.extname,'schema',n.nspname,'version',e.extversion,
   'owner',pg_get_userbyid(e.extowner),'relocatable',e.extrelocatable) order by e.extname),'[]')
   from pg_extension e join pg_namespace n on n.oid=e.extnamespace),
 'relations',(select coalesce(jsonb_agg(jsonb_build_object('name',n.nspname||'.'||c.relname,'kind',c.relkind,
   'owner',pg_get_userbyid(c.relowner),'acl',${acl("c.relacl", "c.relowner", "r")},
   'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'persistence',c.relpersistence,
   'replicaIdentity',c.relreplident,'options',(select coalesce(jsonb_agg(o order by o),'[]') from unnest(c.reloptions) o),
   'partitionKey',pg_get_partkeydef(c.oid),'partitionBound',pg_get_expr(c.relpartbound,c.oid),
   'view',case when c.relkind in ('v','m') then pg_get_viewdef(c.oid,false) end,
   'columns',(select coalesce(jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
     'notNull',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,
     'default',pg_get_expr(ad.adbin,ad.adrelid),'collation',cn.nspname||'.'||co.collname,
     'acl',${acl("a.attacl")}) order by case when c.relkind in ('v','m') then a.attnum else 0 end,a.attname),'[]')
     from pg_attribute a left join pg_attrdef ad on ad.adrelid=a.attrelid and ad.adnum=a.attnum
     left join pg_collation co on co.oid=a.attcollation left join pg_namespace cn on cn.oid=co.collnamespace
     where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)) order by n.nspname,c.relname),'[]')
   from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname in ('public','private') and c.relkind in ('r','p','v','m','S','f') and ${own("pg_class", "c")}),
 'constraints',(select coalesce(jsonb_agg(jsonb_build_object('table',n.nspname||'.'||c.relname,'name',k.conname,
   'kind',k.contype,'definition',pg_get_constraintdef(k.oid,false),'validated',k.convalidated,
   'deferrable',k.condeferrable,'initiallyDeferred',k.condeferred) order by n.nspname,c.relname,k.conname),'[]')
   from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
   where n.nspname in ('public','private') and ${own("pg_constraint", "k")}),
 'indexes',(select coalesce(jsonb_agg(jsonb_build_object('table',n.nspname||'.'||t.relname,'name',c.relname,
   'definition',pg_get_indexdef(i.indexrelid),'valid',i.indisvalid,'ready',i.indisready,
   'clustered',i.indisclustered,'replicaIdentity',i.indisreplident) order by n.nspname,t.relname,c.relname),'[]')
   from pg_index i join pg_class c on c.oid=i.indexrelid join pg_class t on t.oid=i.indrelid
   join pg_namespace n on n.oid=t.relnamespace where n.nspname in ('public','private') and ${own("pg_class", "c")}),
 'functions',(select coalesce(jsonb_agg(jsonb_build_object('name',n.nspname||'.'||p.proname,
   'identity',pg_get_function_identity_arguments(p.oid),'arguments',pg_get_function_arguments(p.oid),
   'result',pg_get_function_result(p.oid),'kind',p.prokind,'language',l.lanname,'body',p.prosrc,
   'owner',pg_get_userbyid(p.proowner),'acl',${acl("p.proacl", "p.proowner", "f")},
   'volatility',p.provolatile,'strict',p.proisstrict,'securityDefiner',p.prosecdef,'leakproof',p.proleakproof,
   'parallel',p.proparallel,'cost',p.procost,'rows',p.prorows,
   'settings',(select coalesce(jsonb_agg(o order by o),'[]') from unnest(p.proconfig) o))
   order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'[]')
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
   where n.nspname in ('public','private') and ${own("pg_proc", "p")}),
 'triggers',(select coalesce(jsonb_agg(jsonb_build_object('table',n.nspname||'.'||c.relname,'name',t.tgname,
   'definition',pg_get_triggerdef(t.oid,false),'enabled',t.tgenabled) order by n.nspname,c.relname,t.tgname),'[]')
   from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
   where n.nspname in ('public','private','auth','storage') and not t.tgisinternal and ${own("pg_trigger", "t")}),
 'policies',(select coalesce(jsonb_agg(jsonb_build_object('table',n.nspname||'.'||c.relname,'name',p.polname,
   'command',p.polcmd,'permissive',p.polpermissive,'using',pg_get_expr(p.polqual,p.polrelid),
   'check',pg_get_expr(p.polwithcheck,p.polrelid),
   'roles',(select jsonb_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end
     order by case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end) from unnest(p.polroles) r))
   order by n.nspname,c.relname,p.polname),'[]')
   from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace
   where n.nspname in ('public','private','auth','storage')),
 'defaultPrivileges',(select coalesce(jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),
   'schema',coalesce(n.nspname,''),'kind',d.defaclobjtype,'acl',${acl("d.defaclacl")})
   order by pg_get_userbyid(d.defaclrole),coalesce(n.nspname,''),d.defaclobjtype),'[]')
   from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace
   where d.defaclnamespace=0 or n.nspname in ('public','private','extensions')),
 'types',(select coalesce(jsonb_agg(jsonb_build_object('name',n.nspname||'.'||t.typname,'kind',t.typtype,
   'owner',pg_get_userbyid(t.typowner),'acl',${acl("t.typacl", "t.typowner", "T")},
   'base',format_type(t.typbasetype,t.typtypmod),'notNull',t.typnotnull,'default',t.typdefault,
   'enum',(select coalesce(jsonb_agg(e.enumlabel order by e.enumsortorder),'[]') from pg_enum e where e.enumtypid=t.oid))
   order by n.nspname,t.typname),'[]') from pg_type t join pg_namespace n on n.oid=t.typnamespace
   where n.nspname in ('public','private') and t.typrelid=0 and t.typelem=0 and ${own("pg_type", "t")})
);`;

export function catalogDifferences(left, right, prefix = "") {
  if (JSON.stringify(left) === JSON.stringify(right)) return [];
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object")
    return [{ path: prefix, expected: left, actual: right }];
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].flatMap((key) =>
    catalogDifferences(left[key], right[key], prefix ? `${prefix}.${key}` : key),
  );
}
