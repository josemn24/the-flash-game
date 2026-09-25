import {
  createAuthAccounts,
  deterministicUuid,
  fixtureExists,
  fixturePath,
  loadScenario,
  localSupabaseConfig,
  parseScenarioArgs,
  removeFixture,
  resetLocalDatabase,
  sqlString,
  sqlUuid,
  writeFixture,
} from "./support/supabase-local.mjs";
import { dockerSql } from "./support/supabase-local.mjs";

async function main() {
  const { scenarioId, clean } = parseScenarioArgs(process.argv.slice(2));
  const scenario = await loadScenario("fixture", scenarioId);
  const config = await localSupabaseConfig({
    requireServiceRole: !clean || Boolean(scenario.cleanupStorage),
  });
  const stableId = (label) => deterministicUuid(scenario.namespace, label);

  if (clean) {
    if (scenario.cleanupStorage) {
      await scenario.cleanupStorage({ config, stableId });
    }
    if (!(await fixtureExists(scenarioId))) {
      console.log(`No existe ${fixturePath(scenarioId)}; no hay fixture que limpiar.`);
      return;
    }
    await resetLocalDatabase();
    await removeFixture(scenarioId);
    console.log(`Fixture ${scenarioId} eliminado mediante db reset --local.`);
    return;
  }

  if (await fixtureExists(scenarioId)) {
    throw new Error(
      `Ya existe ${fixturePath(scenarioId)}. Ejecuta npm run supabase:fixture -- --scenario ${scenarioId} --clean o npm run supabase:db:reset antes de crear otro fixture.`,
    );
  }

  let storageSeeded = false;
  try {
    const accounts = await createAuthAccounts(scenario, config);
    if (scenario.seedStorageBeforeSql && scenario.seedStorage) {
      await scenario.seedStorage({ config, accounts, stableId });
      storageSeeded = true;
    }
    const scenarioSql = await scenario.buildDomainSql({
      accounts,
      stableId,
      sqlString,
      sqlUuid: (label) => sqlUuid(scenario.namespace, label),
    });
    await dockerSql(scenarioSql, config.dbContainer);
    if (scenario.seedStorage && !scenario.seedStorageBeforeSql) {
      await scenario.seedStorage({ config, accounts, stableId });
      storageSeeded = true;
    }

    const scenarioData = await scenario.manifest({ accounts, stableId });
    const users = Object.fromEntries(
      Object.entries(accounts).map(([label, account]) => [
        label,
        {
          email: account.email,
          password: account.password,
          playerId: account.playerId,
        },
      ]),
    );
    await writeFixture(scenarioId, {
      version: 1,
      scenario: scenario.id,
      namespace: scenario.namespace,
      generatedAt: new Date().toISOString(),
      users,
      data: scenarioData,
    });
    console.log(`Fixture ${scenarioId} creado en ${fixturePath(scenarioId)}.`);
  } catch (error) {
    if (storageSeeded && scenario.cleanupStorage) {
      try {
        await scenario.cleanupStorage({ config, stableId });
      } catch (cleanupError) {
        console.error(`La limpieza compensatoria de Storage falló: ${cleanupError.message}`);
      }
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
