import { rpc, sqlCount } from "../../support/supabase-local.mjs";

const scenario = {
  id: "time-trial",
  async run({ fixture, clients, config, assert }) {
    const input = {
      target_room_slug: fixture.data.room.slug,
      target_publication_id: fixture.data.publicationId,
    };
    const rows = await rpc(clients.alice, "get_my_time_trial_challenge", input);
    assert(rows.length === 2, "Auth y PostgREST entregan los metadatos Queens autorizados");
    assert(
      rows.every((row) => row.question_type === "queens" && row.global_time_limit_ms === 120000),
      "La duración global publicada es consistente",
    );
    assert(
      !JSON.stringify(rows).match(/solution|prefilledQueens|regions/),
      "La introducción no entrega tableros ni soluciones",
    );
    assert(
      (await sqlCount("select count(*) from public.attempts;", config.dbContainer)) === 0,
      "Consultar la introducción no crea intentos",
    );
    const anonymous = await clients.alice.auth.signOut();
    assert(!anonymous.error, "La cuenta puede cerrar sesión");
    const forbidden = await clients.alice.rpc("get_my_time_trial_challenge", input);
    assert(Boolean(forbidden.error), "Los RPC competitivos rechazan consultas anónimas");
  },
};

export default scenario;
