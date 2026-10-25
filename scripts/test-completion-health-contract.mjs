import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function definition(source, name) {
  const start = source.search(
    new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+private\\.${name}\\s*\\(`, "i"),
  );
  assert.ok(start >= 0, `Reference contains ${name}`);
  const rest = source.slice(start);
  const delimiter = /\bas\s+(\$[a-z_]*\$)/i.exec(rest);
  assert.ok(delimiter, `${name} has a dollar-quoted body`);
  const end = rest.indexOf(delimiter[1], delimiter.index + delimiter[0].length);
  assert.ok(end >= 0, `${name} has a body terminator`);
  return rest.slice(0, end + delimiter[1].length) + ";";
}

// Run the actual runtime probe against both new and old function bodies, in a disposable DB.
export async function testCompletionHealthContract(sql) {
  const source = await readFile("infrastructure/supabase/platform/health.ts", "utf8");
  const query = source.match(/select\s+true as database_ok,[\s\S]*?as schema_revision_marker/)?.[0];
  assert.ok(query, "The runtime schema probe must be available");
  assert.equal((await sql(`${query};`)).trim(), "t|t|t", "Health recognizes the current schema");
  assert.equal(
    (await sql(`begin; set local role service_role; ${query}; rollback;`)).trim(),
    "t|t|t",
    "The runtime health role can inspect the private operation contracts without EXECUTE grants",
  );
  const baseline = await readFile("supabase/migrations/20261011180045_initial_schema.sql", "utf8");
  for (const name of ["execute_command", "handle_attempt_command"]) {
    const oldFunction = definition(baseline, name);
    const result = await sql(`begin; ${oldFunction}\n${query}; rollback;`);
    assert.equal(result.trim(), "t|t|f", `Health rejects the old ${name} contract`);
  }
  const previous = await readFile(
    "supabase/migrations/20261014200324_authoritative_completion_score.sql",
    "utf8",
  );
  assert.equal(
    (
      await sql(`begin; ${definition(previous, "handle_attempt_command")} ${query}; rollback;`)
    ).trim(),
    "t|t|f",
    "Health rejects the pre-refactor coordinator even with all new helpers installed",
  );

  const signatures = [
    "start(jsonb,jsonb,uuid,jsonb,boolean)",
    "takeover(jsonb,jsonb,public.attempts,timestamptz)",
    "prepare(public.attempts,private.challenge_versions,timestamptz)",
    "activate(jsonb,public.attempts,timestamptz)",
    "submission(text,jsonb,public.attempts,private.challenge_versions,timestamptz,timestamptz)",
    "evaluation(jsonb,public.attempts,private.challenge_versions)",
    "closure(text,jsonb,public.attempts,public.scheduled_challenges,private.challenge_versions,timestamptz)",
  ];
  for (const signature of signatures) {
    const result = await sql(`begin;
      alter function private.handle_attempt_${signature} rename to missing_handler_probe;
      ${query}; rollback;`);
    assert.equal(result.trim(), "t|t|f", `Health rejects a missing ${signature}`);
  }
  const closureSignature = `private.handle_attempt_${signatures.at(-1)}`;
  const closure = JSON.parse(
    await sql(`select to_json(pg_get_functiondef('${closureSignature}'::regprocedure));`),
  );
  assert.ok(
    closure.includes("sum(answer.points)"),
    "Closure derives its score from accepted answers",
  );
  const incompatible = closure.replace("sum(answer.points)", "max(answer.points)");
  assert.equal(
    (await sql(`begin; ${incompatible}; ${query}; rollback;`)).trim(),
    "t|t|f",
    "Health rejects an incompatible closure implementation",
  );
  for (const signature of [
    "public.record_room_measurement_event(jsonb)",
    "public.get_superadmin_season_measurement(uuid,uuid)",
    "public.get_my_season_rating(uuid)",
    "public.save_my_season_rating(jsonb)",
  ]) {
    const result = await sql(
      `begin; alter function ${signature} rename to missing_measurement_probe; ${query}; rollback;`,
    );
    assert.equal(result.trim(), "t|t|f", `Health rejects a missing ${signature}`);
  }
  assert.equal(
    (
      await sql(`begin;
    alter index private.room_measurement_events_rehearsal_run_idx rename to missing_rehearsal_run_probe;
    ${query}; rollback;`)
    ).trim(),
    "t|t|f",
    "Health rejects the schema before the measurement reliability migration",
  );
  for (const definition of [
    "create index room_measurement_events_rehearsal_run_idx on private.room_measurement_events(measurement_id,player_id,publication_id,type,visit_id) where type in ('rehearsal_started','rehearsal_completed')",
    "create unique index room_measurement_events_rehearsal_run_idx on private.room_measurement_events(measurement_id,player_id,publication_id,type,visit_id)",
  ]) {
    assert.equal(
      (
        await sql(`begin;
      drop index private.room_measurement_events_rehearsal_run_idx;
      ${definition}; ${query}; rollback;`)
      ).trim(),
      "t|t|f",
      "Health requires a unique partial rehearsal index",
    );
  }
  assert.equal(
    (
      await sql(
        `begin; alter table public.seasons disable trigger season_measurement_automatic; ${query}; rollback;`,
      )
    ).trim(),
    "t|t|f",
    "Health rejects disabled automatic measurement",
  );
}
