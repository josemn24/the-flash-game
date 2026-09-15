import {
  assert,
  createAuthenticatedClient,
  loadScenario,
  localSupabaseConfig,
  parseScenarioArgs,
  readFixture,
} from "./support/supabase-local.mjs";

async function main() {
  const { scenarioId, clean } = parseScenarioArgs(process.argv.slice(2));
  if (clean) throw new Error("--clean solo está disponible para supabase:fixture.");

  const scenario = await loadScenario("integration", scenarioId);
  const fixture = await readFixture(scenarioId);
  const config = await localSupabaseConfig();
  const clients = {};

  for (const [label, account] of Object.entries(fixture.users)) {
    clients[label] = await createAuthenticatedClient(config, account);
  }

  await scenario.run({
    fixture,
    clients,
    config,
    assert: (condition, message) => assert(condition, message, scenario.id),
  });
  console.log(`Integración ${scenario.id}: Auth, PostgREST, RLS y escenario funcional pasaron.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
