import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  createFixedAuthAccounts,
  dockerSql,
  localSupabaseConfig,
  resetLocalDatabase,
  writeFixture,
} from "./support/supabase-local.mjs";

const browserUsers = [
  {
    label: "superadmin",
    email: "superadmin@the-flash.local",
    password: "Flash-local-Superadmin-123!",
    displayName: "Superadmin local",
  },
  {
    label: "owner",
    email: "owner@the-flash.local",
    password: "Flash-local-Owner-123!",
    displayName: "Owner local",
  },
  {
    label: "admin",
    email: "admin@the-flash.local",
    password: "Flash-local-Admin-123!",
    displayName: "Admin local",
  },
  {
    label: "member",
    email: "member@the-flash.local",
    password: "Flash-local-Member-123!",
    displayName: "Member local",
  },
  {
    label: "spectator",
    email: "spectator@the-flash.local",
    password: "Flash-local-Spectator-123!",
    displayName: "Spectator local",
  },
  {
    label: "outsider",
    email: "outsider@the-flash.local",
    password: "Flash-local-Outsider-123!",
    displayName: "Outsider local",
  },
];

const browserPlayerLabels = browserUsers.map((user) => user.label);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseBrowserArgs(args) {
  let withHistory = false;
  for (const argument of args) {
    if (argument === "--with-history") {
      withHistory = true;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      throw new Error("Uso: npm run supabase:browser:setup [-- --with-history]");
    }
    throw new Error(
      `Argumento desconocido: ${argument}. Uso: npm run supabase:browser:setup [-- --with-history]`,
    );
  }
  return { withHistory };
}

export function assertLocalBrowserUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch (error) {
    throw new Error(`La URL de Supabase no es válida: ${value}`, { cause: error });
  }
  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error(`El setup de navegador solo admite Supabase local: ${url.origin}`);
  }
}

export function renderSeedSql(source, accounts) {
  for (const label of browserPlayerLabels) {
    const playerId = accounts?.[label]?.playerId;
    if (typeof playerId !== "string" || !uuidPattern.test(playerId)) {
      throw new Error(`El manifiesto de Auth no contiene un player_id válido para ${label}.`);
    }
  }

  const bindings = browserPlayerLabels
    .map((label) => `\\set browser_${label}_player_id '${accounts[label].playerId}'`)
    .join("\n");
  return `${bindings}\n${source.trim()}\n`;
}

function manifest(accounts, withHistory) {
  return {
    roomSlug: "browser-playground",
    isolatedRoomSlug: "browser-isolated",
    openPublicationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    futurePublicationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    closedPublicationId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    withHistory,
    users: Object.fromEntries(
      browserPlayerLabels.map((label) => [
        label,
        {
          email: accounts[label].email,
          password: accounts[label].password,
          playerId: accounts[label].playerId,
        },
      ]),
    ),
  };
}

export async function setupBrowserDataset({ withHistory = false, dependencies = {} } = {}) {
  const loadConfig = dependencies.localSupabaseConfig ?? localSupabaseConfig;
  const reset = dependencies.resetLocalDatabase ?? resetLocalDatabase;
  const createAccounts = dependencies.createFixedAuthAccounts ?? createFixedAuthAccounts;
  const runSql = dependencies.dockerSql ?? dockerSql;
  const saveFixture = dependencies.writeFixture ?? writeFixture;

  const config = await loadConfig({ requireServiceRole: true });
  assertLocalBrowserUrl(config.url);
  await reset();

  const accounts = await createAccounts(browserUsers, config);
  const seed = await readFile("supabase/seed.sql", "utf8");
  await runSql(renderSeedSql(seed, accounts), config.dbContainer);

  if (withHistory) {
    const history = await readFile("supabase/seed-browser-history.sql", "utf8");
    await runSql(renderSeedSql(history, accounts), config.dbContainer);
  }

  const output = manifest(accounts, withHistory);
  await saveFixture("browser", {
    version: 1,
    scenario: "browser",
    generatedAt: new Date().toISOString(),
    users: output.users,
    data: {
      roomSlug: output.roomSlug,
      isolatedRoomSlug: output.isolatedRoomSlug,
      openPublicationId: output.openPublicationId,
      futurePublicationId: output.futurePublicationId,
      closedPublicationId: output.closedPublicationId,
      withHistory: output.withHistory,
    },
  });

  return output;
}

async function main() {
  const { withHistory } = parseBrowserArgs(process.argv.slice(2));
  const output = await setupBrowserDataset({ withHistory });
  console.log("Dataset browser creado en output/fixtures/browser.json.");
  console.log(`Sala principal: /salas/${output.roomSlug}`);
  console.log(`Desafío abierto: /desafios/${output.openPublicationId}?roomId=${output.roomSlug}`);
  console.log("Credenciales locales:");
  for (const user of browserUsers) console.log(`  ${user.label}: ${user.email} / ${user.password}`);
  if (withHistory) console.log("Historial y rankings históricos cargados.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
