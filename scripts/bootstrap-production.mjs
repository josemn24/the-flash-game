import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadMiniWordleDictionary,
  verifyMiniWordleDictionaries,
} from "./load-mini-wordle-dictionary.mjs";
import { checkInventory } from "./supabase-security-inventory.mjs";
import { sqlString } from "./support/supabase-local.mjs";
import {
  assertEnvironmentRevision,
  environmentClient,
  loadOperationalEnv,
  parseEnvironmentArgs,
  resolveEnvironment,
  withEnvironmentSql,
} from "./support/supabase-environment.mjs";
import {
  ensureBuckets,
  findAuthUserByEmail,
  generatePassword,
  readJsonIfPresent,
  writeJsonSecure,
} from "./support/supabase-provisioning.mjs";

export function minimumBootstrapEmail(config, env) {
  const email = (
    env.BOOTSTRAP_ADMIN_EMAIL ?? (config.target === "local" ? "superadmin@the-flash.local" : "")
  )
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("BOOTSTRAP_ADMIN_EMAIL debe ser un email válido.");
  if (
    config.target === "production" &&
    env.PRODUCTION_BOOTSTRAP_CONFIRM !== `production:${config.projectRef}`
  )
    throw new Error("PRODUCTION_BOOTSTRAP_CONFIRM debe identificar el proyecto de producción.");
  return email;
}

export function bootstrapRoleSql(playerId, config, revision) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(playerId))
    throw new Error("Player inválido.");
  return `begin;
    set local statement_timeout = '30000ms';
    do $bootstrap$ begin
      if (select count(*) from auth.users) <> 1
        or (select count(*) from public.players) <> 1
        or exists (select 1 from private.platform_role_assignments where player_id <> ${sqlString(playerId)}::uuid)
      then raise exception 'bootstrap_state_mismatch' using errcode = '55000'; end if;
    end $bootstrap$;
    with assigned as (
      insert into private.platform_role_assignments(player_id, role)
      values (${sqlString(playerId)}::uuid, 'superadmin')
      on conflict (player_id) do nothing returning player_id
    ) insert into private.audit_log(actor_player_id, action, entity_type, entity_id, reason, request_id, after_payload)
      select player_id, 'bootstrap_superadmin', 'platform_role_assignment', player_id,
        'Initial administrator for clean environment',
        ${sqlString(`bootstrap:${config.target}:${config.projectRef}`)},
        jsonb_build_object('role', 'superadmin', 'environment', ${sqlString(config.target)}, 'schemaRevision', ${sqlString(revision)})
      from assigned;
    commit;`;
}

export async function verifyMinimumState(sql, playerId) {
  const state = JSON.parse(
    await sql(`select jsonb_build_object(
    'authUsers', (select count(*) from auth.users),
    'players', (select count(*) from public.players),
    'admins', (select count(*) from private.platform_role_assignments),
    'rooms', (select count(*) from public.rooms),
    'seasons', (select count(*) from public.seasons),
    'questions', (select count(*) from private.question_versions),
    'challenges', (select count(*) from private.challenge_versions),
    'attempts', (select count(*) from public.attempts),
    'points', (select count(*) from private.flash_point_entries),
    'assets', (select count(*) from private.media_assets),
    'objects', (select count(*) from storage.objects),
    'adminAudit', (select count(*) from private.audit_log where action = 'bootstrap_superadmin' and actor_player_id = ${sqlString(playerId)}::uuid));`),
  );
  const expected = {
    authUsers: 1,
    players: 1,
    admins: 1,
    rooms: 0,
    seasons: 0,
    questions: 0,
    challenges: 0,
    attempts: 0,
    points: 0,
    assets: 0,
    objects: 0,
    adminAudit: 1,
  };
  for (const [key, value] of Object.entries(expected))
    if (state[key] !== value)
      throw new Error(
        `El bootstrap mínimo no cumple ${key}=${value}; no se debe abrir el entorno.`,
      );
  return state;
}

async function assertNoContent(sql) {
  const populated = await sql(`select exists (
    select 1 from public.rooms union all select 1 from public.seasons
    union all select 1 from private.question_versions union all select 1 from private.challenge_versions
    union all select 1 from public.attempts union all select 1 from private.flash_point_entries
    union all select 1 from private.media_assets union all select 1 from storage.objects);`);
  if (!["f", "false"].includes(populated))
    throw new Error("El bootstrap mínimo requiere un entorno sin contenido ni partidas.");
}

export async function ensureAdministrator(config, email, dependencies) {
  const credentialsPath = path.join(config.artifactDirectory, "bootstrap-credentials.json");
  const previous = await (dependencies.readJson ?? readJsonIfPresent)(credentialsPath);
  if (previous && (previous.projectRef !== config.projectRef || previous.target !== config.target))
    throw new Error("El archivo de credenciales pertenece a otro destino.");
  if (previous?.users?.superadmin?.email && previous.users.superadmin.email !== email)
    throw new Error(
      "El email no coincide con el administrador ya preparado; no se creará otra cuenta.",
    );
  const makeClient = dependencies.environmentClient ?? environmentClient;
  const admin = makeClient(config);
  const existing = await findAuthUserByEmail(admin, email);
  const marker = { environment: config.target, project_ref: config.projectRef, version: 1 };
  let account;
  if (existing) {
    const saved = previous?.users?.superadmin;
    const metadata = existing.app_metadata?.environment_bootstrap;
    if (
      metadata?.environment !== marker.environment ||
      metadata?.project_ref !== marker.project_ref ||
      metadata?.version !== 1 ||
      saved?.authUserId !== existing.id ||
      saved?.email !== email ||
      !saved?.password
    )
      throw new Error(
        "La cuenta ya existe sin credenciales verificables de este bootstrap; no se asignará el rol.",
      );
    account = saved;
  } else {
    const remaining = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (remaining.error || remaining.data.users.length)
      throw new Error("El bootstrap inicial requiere Auth vacío; no se creará otro administrador.");
    const password = generatePassword();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: "Superadmin" },
      app_metadata: { environment_bootstrap: marker },
    });
    if (error || !data.user) throw new Error("No se pudo crear el superadmin.");
    account = { email, password, authUserId: data.user.id };
    await (dependencies.writeJsonSecure ?? writeJsonSecure)(credentialsPath, {
      version: 1,
      target: config.target,
      projectRef: config.projectRef,
      users: { superadmin: account },
    });
  }
  const user = makeClient(config, { user: true });
  const session = await user.auth.signInWithPassword({ email, password: account.password });
  if (session.error || session.data.user?.id !== account.authUserId)
    throw new Error("No se pudo verificar la identidad del superadmin.");
  const player = await user.rpc("provision_player");
  const row = Array.isArray(player.data) ? player.data[0] : player.data;
  if (player.error || !row?.player_id)
    throw new Error("No se pudo aprovisionar el jugador del superadmin.");
  account = { ...account, playerId: row.player_id };
  await (dependencies.writeJsonSecure ?? writeJsonSecure)(credentialsPath, {
    version: 1,
    target: config.target,
    projectRef: config.projectRef,
    users: { superadmin: account },
  });
  return { account, user, credentialsPath };
}

export async function runMinimumBootstrap({
  env = process.env,
  args = [],
  dependencies = {},
} = {}) {
  const options = parseEnvironmentArgs(args, { targets: ["local", "production"] });
  const config = await (dependencies.resolveEnvironment ?? resolveEnvironment)(options.target, env);
  const email = minimumBootstrapEmail(config, env);
  const plan = {
    target: config.target,
    projectRef: config.projectRef,
    email,
    content: "superadmin, diccionarios y buckets; sin salas ni desafíos",
  };
  if (options.dryRun) return { dryRun: true, ...plan };
  const withSql = dependencies.withSql ?? withEnvironmentSql;
  const revision = await withSql(config, async (sql) => {
    await assertNoContent(sql);
    await checkInventory(sql, { mutationTests: false });
    return assertEnvironmentRevision(sql);
  });
  const client = (dependencies.environmentClient ?? environmentClient)(config);
  await ensureBuckets(client, config.buckets);
  const { account, user, credentialsPath } = await ensureAdministrator(config, email, dependencies);
  const verification = await withSql(config, async (sql) => {
    await loadMiniWordleDictionary({ runSql: sql });
    const dictionaries = await verifyMiniWordleDictionaries(sql);
    await sql(bootstrapRoleSql(account.playerId, config, revision));
    return { dictionaries, state: await verifyMinimumState(sql, account.playerId) };
  });
  const portal = await user.rpc("get_superadmin_portal_context");
  if (
    portal.error ||
    portal.data?.operator?.playerId !== account.playerId ||
    portal.data?.rooms?.length !== 0
  )
    throw new Error("El portal del superadmin no devuelve el contexto mínimo esperado.");
  const manifestPath = path.join(config.artifactDirectory, "bootstrap-manifest.json");
  await (dependencies.writeJsonSecure ?? writeJsonSecure)(manifestPath, {
    version: 1,
    ...plan,
    revision,
    generatedAt: new Date().toISOString(),
    authUserId: account.authUserId,
    playerId: account.playerId,
    ...verification,
  });
  return {
    dryRun: false,
    target: config.target,
    projectRef: config.projectRef,
    revision,
    credentialsPath,
    manifestPath,
  };
}

async function main() {
  const options = parseEnvironmentArgs(process.argv.slice(2), { targets: ["local", "production"] });
  loadOperationalEnv(options);
  console.log(JSON.stringify(await runMinimumBootstrap({ args: process.argv.slice(2) }), null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
