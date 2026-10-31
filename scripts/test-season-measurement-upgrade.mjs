import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { checkInventory } from "./supabase-security-inventory.mjs";

const container = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_the-flash-game";
const database = `flash_season_upgrade_${randomUUID().replaceAll("-", "")}`;
const docker = (args, input = "") =>
  execFileSync("docker", ["exec", "-i", container, ...args], {
    input,
    encoding: "utf8",
    maxBuffer: 30 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });
const sql = async (input) =>
  docker(["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database], input);
let created = false;
try {
  docker(["createdb", "-U", "postgres", database]);
  created = true;
  await sql(readFileSync("supabase/tests/support/bootstrap.sql", "utf8"));
  const files = readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const boundary = files.findIndex((f) => f.endsWith("_remove_product_experiments.sql"));
  assert.ok(boundary > 0);
  await sql(
    `begin;\n${files
      .slice(0, boundary)
      .map((f) => readFileSync(`supabase/migrations/${f}`, "utf8"))
      .join("\n")}\ncommit;`,
  );
  await sql(`begin;
    ${readFileSync("supabase/tests/support/command-fixtures.sql", "utf8")}
    ${readFileSync("supabase/tests/support/season-measurement-fixtures.sql", "utf8")}
    ${readFileSync("supabase/tests/support/experiment-cleanup-fixtures.sql", "utf8")}
    select test_support.as_actor('member');
    select public.record_room_measurement_event(jsonb_build_object('eventId',test_support.id('kept-event'),'visitId',test_support.id('kept-visit'),'roomId','commands-flash','type','room_viewed','occurredAt',clock_timestamp(),'appVersion','before-cleanup'));
    select public.save_my_season_rating(jsonb_build_object('id',test_support.id('kept-rating'),'publicationId',test_support.id('sc-flash'),'seasonId',test_support.id('season-flash'),'value',4));
    commit;`);
  const tables = JSON.parse(
    await sql(`select jsonb_agg(format('%I.%I',n.nspname,c.relname) order by n.nspname,c.relname)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','private') and c.relkind='r' and c.relname !~ '^product_(experiments|experiment_publications|experiment_participants|events|ratings|experiment_journal|measurement_snapshots|measurement_commands)$';`),
  );
  const query = `select jsonb_build_object(${tables.map((t) => `'${t}',(select coalesce(jsonb_agg(${t === "private.room_measurements" ? "to_jsonb(t)-'created_by_player_id'" : "to_jsonb(t)"} order by to_jsonb(t)::text),'[]') from ${t} t)`).join(",")});`;
  const before = JSON.parse(await sql(query));
  await sql(
    `begin;\n${files
      .slice(boundary)
      .map((f) => readFileSync(`supabase/migrations/${f}`, "utf8"))
      .join("\n")}\ncommit;`,
  );
  const upgraded = JSON.parse(await sql(query));
  for (const answer of upgraded["private.attempt_answers"]) {
    assert.equal(answer.review_state, null, "Historical answers receive an empty review snapshot");
    delete answer.review_state;
  }
  assert.deepEqual(
    upgraded,
    before,
    "Preexisting official facts, identities, automatic scopes, capture boundaries, events and ratings remain unchanged",
  );
  await sql(readFileSync("supabase/tests/support/experiment-removal-contract.sql", "utf8"));
  await sql(`begin;
    update public.seasons set status='active' where id=test_support.id('blocked-season');
    do $$declare report jsonb; begin
      perform test_support.as_actor('superadmin');
      report:=public.get_superadmin_season_measurement(test_support.id('room-flash'),test_support.id('season-flash'));
      assert (report->'ratings'->0->>'value')::integer=4,'Only the preserved automatic rating is reported';
      assert (select count(*)=1 from private.room_measurements where season_id=test_support.id('blocked-season')),'Activation keeps one automatic measurement';
    end $$;
    rollback;`);
  await checkInventory(sql);
  console.log(
    `Season cleanup upgrade passed: ${tables.length} current tables preserved, all experimental objects removed, activation independent of studies.`,
  );
} catch (error) {
  console.error(error.stderr?.toString() || error.message);
  process.exitCode = 1;
} finally {
  if (created) docker(["dropdb", "-U", "postgres", "--force", database]);
}
