import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import {
  loadMiniWordleDictionary,
  verifyMiniWordleDictionaries,
} from "../load-mini-wordle-dictionary.mjs";
import { validateRemoteEnvironment, withEnvironmentSql } from "./supabase-environment.mjs";
import {
  ensureBuckets,
  findAuthUserByEmail,
  generatePassword,
  readJsonIfPresent,
  writeJsonSecure,
} from "./supabase-provisioning.mjs";

export const STAGING_BOOTSTRAP_CONFIRMATION = "the-flash-game-staging";
export const STAGING_CREDENTIALS_PATH = path.join(
  "output",
  "staging",
  "bootstrap-credentials.json",
);

export function parseStagingBootstrapArgs(args) {
  const options = { dryRun: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (["--starts-at", "--env-file"].includes(argument)) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Falta el valor de ${argument}.`);
      }
      const key = argument === "--starts-at" ? "startsAt" : "envFile";
      if (options[key]) throw new Error(`${argument} no puede repetirse.`);
      options[key] = value;
      index += 1;
      continue;
    }
    throw new Error(
      `Argumento desconocido: ${argument}. Usa --dry-run, --env-file <ruta> o --starts-at <ISO-8601-con-zona-horaria>.`,
    );
  }
  return options;
}

export function loadStagingBootstrapEnv(options) {
  if (!options.envFile) return;
  try {
    process.loadEnvFile(options.envFile);
  } catch {
    throw new Error("No se pudo cargar el archivo de entorno indicado.");
  }
}

export function validateStagingBootstrapConfig(env = process.env) {
  const { projectRef, supabaseUrl, publishableKey, serviceRoleKey, adminDbUrl } =
    validateRemoteEnvironment("staging", env);
  for (const name of ["STAGING_XESMONA_EMAIL", "STAGING_CHES_EMAIL", "STAGING_BOOTSTRAP_CONFIRM"]) {
    if (!env[name]?.trim()) throw new Error(`${name} es obligatorio.`);
  }
  if (env.STAGING_BOOTSTRAP_CONFIRM !== STAGING_BOOTSTRAP_CONFIRMATION) {
    throw new Error(`STAGING_BOOTSTRAP_CONFIRM debe ser ${STAGING_BOOTSTRAP_CONFIRMATION}.`);
  }

  const emails = {
    xesmona: env.STAGING_XESMONA_EMAIL.trim().toLowerCase(),
    ches: env.STAGING_CHES_EMAIL.trim().toLowerCase(),
  };
  if (emails.xesmona === emails.ches) {
    throw new Error("Xesmona y Ches deben utilizar emails diferentes.");
  }

  return {
    target: "staging",
    projectRef,
    supabaseUrl,
    publishableKey,
    serviceRoleKey,
    adminDbUrl,
    emails,
  };
}

export function buildStagingAuthUserPayload({ definition, email, password, projectRef }) {
  return {
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: definition.displayName },
    app_metadata: {
      staging_bootstrap: { project_ref: projectRef, version: 1 },
    },
  };
}

export function stagingAdminClient(config) {
  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export function stagingUserClient(config) {
  return createClient(config.supabaseUrl, config.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

async function writeCredentialStore(credentialsPath, credentials, writeSecure) {
  credentials.generatedAt = new Date().toISOString();
  await writeSecure(credentialsPath, credentials);
}

async function provisionPlayer(config, definition, account, createUserClient) {
  const client = createUserClient(config);
  const { error: signInError } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (signInError) {
    throw new Error(`No se pudo validar la contraseña de ${definition.key}.`);
  }
  const { data, error } = await client.rpc("provision_player");
  if (error) {
    throw new Error(`No se pudo aprovisionar el Player de ${definition.key}: ${error.message}`);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.player_id) {
    throw new Error(`provision_player no devolvió player_id para ${definition.key}.`);
  }
  return row.player_id;
}

export async function ensureStagingAccounts(
  config,
  definitions,
  { credentialsPath = STAGING_CREDENTIALS_PATH, dependencies = {} } = {},
) {
  const readCredentials = dependencies.readCredentials ?? readJsonIfPresent;
  const writeSecure = dependencies.writeCredentials ?? writeJsonSecure;
  const makeAdminClient = dependencies.adminClient ?? stagingAdminClient;
  const makeUserClient = dependencies.userClient ?? stagingUserClient;
  const findUser = dependencies.findAuthUserByEmail ?? findAuthUserByEmail;
  const createPassword = dependencies.generatePassword ?? generatePassword;
  const save = async (credentials) =>
    writeCredentialStore(credentialsPath, credentials, writeSecure);
  const credentials = (await readCredentials(credentialsPath)) ?? {
    version: 1,
    projectRef: config.projectRef,
    users: {},
  };
  const accounts = {};

  if (
    credentials.version !== 1 ||
    credentials.projectRef !== config.projectRef ||
    !credentials.users ||
    typeof credentials.users !== "object" ||
    Array.isArray(credentials.users)
  ) {
    throw new Error("El registro de credenciales no corresponde a este proyecto de staging.");
  }

  const normalizedEmails = new Set();
  for (const definition of definitions) {
    if (!definition?.key || !definition?.displayName) {
      throw new Error("Cada cuenta de staging necesita key y displayName.");
    }
    const email = (definition.email ?? config.emails?.[definition.key] ?? "").trim().toLowerCase();
    if (!email) throw new Error(`Falta un email de staging para ${definition.key}.`);
    if (normalizedEmails.has(email))
      throw new Error(`El email ${email} se repite en el bootstrap.`);
    normalizedEmails.add(email);

    const admin = makeAdminClient(config);
    const existing = await findUser(admin, email);
    const saved = credentials.users[definition.key];
    if (saved?.email && saved.email.trim().toLowerCase() !== email) {
      throw new Error(`El registro de credenciales de ${definition.key} tiene otro email.`);
    }

    let password = saved?.password;
    let authUserId = existing?.id ?? saved?.authUserId;
    if (existing) {
      const ownedByBootstrap =
        existing.app_metadata?.staging_bootstrap?.project_ref === config.projectRef &&
        existing.app_metadata?.staging_bootstrap?.version === 1;
      if (
        !ownedByBootstrap ||
        !password ||
        (saved.authUserId && saved.authUserId !== existing.id)
      ) {
        throw new Error(
          `La cuenta ${email} ya existe y no se puede reutilizar con seguridad desde el registro local.`,
        );
      }
      authUserId = existing.id;
    } else {
      password ??= createPassword();
      credentials.users[definition.key] = {
        ...saved,
        email,
        password,
        displayName: definition.displayName,
      };
      await save(credentials);
      const { data, error } = await admin.auth.admin.createUser(
        buildStagingAuthUserPayload({
          definition,
          email,
          password,
          projectRef: config.projectRef,
        }),
      );
      if (error || !data.user) {
        throw new Error(
          `No se pudo crear la cuenta ${definition.key}: ${error?.message ?? "respuesta inválida"}`,
        );
      }
      authUserId = data.user.id;
    }

    const account = { key: definition.key, displayName: definition.displayName, email, password };
    if (authUserId) account.authUserId = authUserId;
    credentials.users[definition.key] = { ...saved, ...account };
    await save(credentials);
    account.playerId = await provisionPlayer(config, definition, account, makeUserClient);
    credentials.users[definition.key].playerId = account.playerId;
    await save(credentials);
    accounts[definition.key] = account;
  }

  return { accounts, credentials };
}

export async function ensureStagingFoundation(config, { dependencies = {} } = {}) {
  const ensureStorageBuckets = dependencies.ensureBuckets ?? ensureBuckets;
  const ensureSql = dependencies.withSql ?? withEnvironmentSql;
  const loadDictionary = dependencies.loadDictionary ?? loadMiniWordleDictionary;
  const verifyDictionaries = dependencies.verifyDictionaries ?? verifyMiniWordleDictionaries;
  const createAdminClient = dependencies.adminClient ?? stagingAdminClient;
  await ensureStorageBuckets(createAdminClient(config));
  return ensureSql(config, async (sql) => {
    await loadDictionary({ runSql: sql });
    return verifyDictionaries(sql);
  });
}

export async function withStagingDatabase(config, callback) {
  const client = new Client({
    connectionString: config.adminDbUrl,
    application_name: "the-flash-game-staging-bootstrap",
  });
  await client.connect();
  try {
    await client.query("set statement_timeout = '30000ms'");
    return await callback(client);
  } finally {
    await client.end();
  }
}
