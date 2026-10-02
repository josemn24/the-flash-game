import { isDeepStrictEqual } from "node:util";
import { createClient } from "@supabase/supabase-js";
import {
  assert,
  createAuthenticatedClient,
  dockerSql,
  localSupabaseConfig,
  parseScenarioArgs,
  readFixture,
  rpc,
} from "./support/supabase-local.mjs";

const modes = ["flash", "alphabet", "survival", "pyramid", "narrative"];
const { scenarioId } = parseScenarioArgs(process.argv.slice(2));
const fixture = await readFixture(scenarioId);
const config = await localSupabaseConfig();
const { stdout } = await dockerSql(
  `select coalesce(jsonb_agg(jsonb_build_object(
  'target_room_slug', room.slug, 'target_publication_id', publication.id)), '[]'::jsonb)
  from public.scheduled_challenges publication join public.seasons season on season.id = publication.season_id
  join public.rooms room on room.id = season.room_id;`,
  config.dbContainer,
);
const publications = JSON.parse(stdout.trim());
assert(publications.length > 0, "El fixture contiene publicaciones competitivas", scenarioId);
async function readCommon(client, args) {
  const { data, error } = await client.rpc("get_my_competitive_challenge", args);
  if (error) throw new Error(`RPC común falló: ${error.message}`);
  return data;
}
for (const args of publications) {
  for (const account of Object.values(fixture.users)) {
    const client = await createAuthenticatedClient(config, account);
    const originals = [];
    for (const mode of modes) {
      const rows = await rpc(client, `get_my_${mode}_challenge`, args);
      if (rows.length) originals.push({ mode, rows });
    }
    assert(originals.length <= 1, "Una publicación solo proyecta un modo", scenarioId);
    const common = await readCommon(client, args);
    assert(
      isDeepStrictEqual(common, originals[0] ?? null),
      "El RPC común conserva exactamente la proyección autorizada",
      scenarioId,
    );
    const missing = await readCommon(client, {
      ...args,
      target_room_slug: "missing-projection-room",
    });
    assert(missing === null, "Una sala incorrecta no revela el modo", scenarioId);
  }
  const anon = createClient(config.url, config.publishableKey, { auth: { persistSession: false } });
  const denied = await anon.rpc("get_my_competitive_challenge", args);
  assert(Boolean(denied.error), "anon no ejecuta el RPC común", scenarioId);
}
console.log(
  `Proyección ${scenarioId}: paridad PostgREST por usuario, ausencia y permisos aprobados.`,
);
