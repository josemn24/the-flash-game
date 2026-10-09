import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const attempt = "test_support.id('audit-function-drift-attempt')";
const common = {
  attemptId: "__ATTEMPT__",
  challengeItemId: "__ITEM__",
  lockVersion: 1,
  sessionToken: "s".repeat(40),
  idempotencyKey: "audit-command",
};
const transfer = {
  attemptId: "__ATTEMPT__",
  scheduledChallengeId: "__SCHEDULE__",
  lockVersion: 1,
  newSessionToken: "t".repeat(40),
  idempotencyKey: "audit-takeover",
};
const inputSql = (input) => `replace(replace(replace(${literal(JSON.stringify(input))},
  '__ATTEMPT__', ${attempt}::text), '__ITEM__', test_support.id('item-flash-1')::text),
  '__SCHEDULE__', test_support.id('sc-flash')::text)::jsonb`;
const call = (command, input) => `select private.${command}(${inputSql(input)})`;
const statement = (command, input) =>
  `format('select private.${command}(%L::jsonb)', ${inputSql(input)}::text)`;
const commands = [
  ["activate_interaction", {}],
  ["recover_attempt", {}],
  ["reveal_progressive_clue", {}],
  ["submit_logic_code_attempt", { code: "1234" }],
  ["submit_mini_wordle_guess", { guess: "CASA" }],
  ["submit_word_hashtag_swap", { fromCell: 0, toCell: 1 }],
  ["submit_word_search_selection", { startCell: 0, endCell: 1 }],
];
const commandInput = (command, extra) => {
  const input = { ...common, ...extra, idempotencyKey: `audit-${command}` };
  if (command === "recover_attempt") delete input.challengeItemId;
  return input;
};

// Temporary observation helpers never escape the disposable database. Errors
// roll back command mutations; successes are rolled back by each outer probe.
const helpers = `
create temporary table original_wrapper_oid as select to_regprocedure('private.take_over_attempt(jsonb)')::oid as oid;
create function pg_temp.observe(statement text) returns jsonb language plpgsql set search_path = '' as $$
declare result jsonb;
begin
  execute statement into result;
  return jsonb_build_object('accepted', true, 'sqlstate', null, 'message', null,
    'resultKeys', case when jsonb_typeof(result) = 'object' then
      (select jsonb_agg(k order by k) from jsonb_object_keys(result) k) end,
    'lockVersion', result->'lockVersion', 'transferred', result->'transferred',
    'abandonedAttempts', result->'abandonedAttempts',
    'value', case when jsonb_typeof(result) <> 'object' then result end);
exception when others then
  return jsonb_build_object('accepted', false, 'sqlstate', sqlstate, 'message', sqlerrm);
end;
$$;
create function pg_temp.audit_state() returns jsonb language sql security definer set search_path = '' as $$
select jsonb_build_object(
  'attempt', (select jsonb_build_object('status', status, 'terminalReason', terminal_reason,
    'lockVersion', lock_version, 'score', score) from public.attempts where id = ${attempt}),
  'sessions', (select jsonb_agg(jsonb_build_object('revoked', revoked_at is not null,
    'reason', revocation_reason) order by revoked_at is not null, coalesce(revocation_reason, ''))
    from private.attempt_sessions where attempt_id = ${attempt}),
  'audit', (select coalesce(jsonb_agg(jsonb_build_object('action', action, 'requestId', request_id,
    'beforeKeys', (select jsonb_agg(k order by k) from jsonb_object_keys(before_payload) k))
    order by action, request_id), '[]') from private.audit_log where entity_id = ${attempt}),
  'pointEntries', (select count(*) from private.flash_point_entries where attempt_id = ${attempt}),
  'wrapperOidPreserved', (select oid = to_regprocedure('private.take_over_attempt(jsonb)')::oid
    from pg_temp.original_wrapper_oid));
$$;
create function pg_temp.probe(statement text) returns jsonb language plpgsql set search_path = '' as $$
declare observation jsonb;
begin
  observation := pg_temp.observe(statement);
  return jsonb_build_object('observation', observation, 'state', pg_temp.audit_state());
end;
$$;
grant execute on function pg_temp.observe(text), pg_temp.probe(text), pg_temp.audit_state() to service_role;
`;
const lastJson = (output) =>
  JSON.parse(
    output
      .trim()
      .split("\n")
      .filter((line) => line.startsWith("{"))
      .at(-1),
  );

export async function auditFunctionBehavior(sql, wrapperDefinition) {
  await sql(`begin;
${await readFile("supabase/tests/support/command-fixtures.sql", "utf8")}
insert into public.attempts(id, player_id, scheduled_challenge_id, challenge_version_id, kind, client_state_schema_version)
values (${attempt}, test_support.id('member'), test_support.id('sc-flash'), test_support.id('cv-flash'), 'competitive', 1);
insert into private.attempt_sessions(attempt_id, session_token_hash)
values (${attempt}, private.secret_hash(repeat('s', 40)));
commit;`);
  const observations = [];
  async function probe(id, expression, setup = "", role = "service_role") {
    const result = lastJson(
      await sql(`begin;
${helpers}
${setup}
select test_support.as_actor('member');
set local role ${role};
select pg_temp.probe(${expression});
rollback;`),
    );
    observations.push({ id, result });
  }
  for (const [command, extra] of commands) {
    for (const reason of ["takeover", "terminal"]) {
      await probe(
        `revoked/${command}/${reason}`,
        statement(command, commandInput(command, extra)),
        `update private.attempt_sessions set revoked_at = clock_timestamp(), revocation_reason = ${literal(reason)} where attempt_id = ${attempt};`,
      );
    }
    await probe(
      `unknown-token/${command}`,
      statement(command, { ...commandInput(command, extra), sessionToken: "z".repeat(40) }),
    );
  }
  await probe(
    "authorize-replay/transferred",
    `format('select to_jsonb(private.authorize_attempt_replay(%L::uuid, %L))',
    ${attempt}::text, private.secret_hash(repeat('s', 40)))`,
    `update private.attempt_sessions set revoked_at = clock_timestamp(), revocation_reason = 'takeover' where attempt_id = ${attempt};`,
    "postgres",
  );
  for (const reason of ["abandon", "inactivity_timeout", "permission_revoked"]) {
    await probe(
      `closure/${reason}`,
      `format('select to_jsonb(private.close_attempt_as_abandoned(%L::uuid, clock_timestamp(), %L, null, %L, %L))',
      ${attempt}::text, ${literal(reason)}, 'audit-close', 'audit closure')`,
      "",
      "postgres",
    );
  }
  await probe(
    "expiration/inactivity",
    statement("expire_stale_attempts", { runId: "audit-inactivity", attemptId: "__ATTEMPT__" }),
    `update public.scheduled_challenges set status = 'closed' where id = test_support.id('sc-flash');
     update public.attempts set last_activity_at = clock_timestamp() - interval '16 minutes',
       lock_version = lock_version + 1 where id = ${attempt};`,
  );
  await probe("takeover/fresh", statement("take_over_attempt", transfer));
  await probe(
    "takeover/cached-after-membership-removal",
    statement("take_over_attempt", transfer),
    `select test_support.as_actor('member'); ${call("take_over_attempt", transfer)};
     update public.room_memberships set status = 'removed', ended_at = clock_timestamp()
       where player_id = test_support.id('member') and room_id = test_support.id('room-flash');`,
  );
  for (const field of ["scheduledChallengeId", "lockVersion", "newSessionToken", "attemptId"]) {
    await probe(
      `takeover/null-${field}`,
      statement("take_over_attempt", { ...transfer, [field]: null }),
    );
  }
  for (const withSchedule of [true, false]) {
    const input = { ...transfer };
    if (!withSchedule) delete input.scheduledChallengeId;
    await probe(
      `dispatcher/${withSchedule ? "with" : "without"}-schedule`,
      `format('select private.execute_command(''takeover'', %L::jsonb)', ${inputSql(input)}::text)`,
      "",
      "postgres",
    );
  }
  await probe(
    "takeover/replace-wrapper-only",
    statement("take_over_attempt", transfer),
    wrapperDefinition,
  );

  // Holder acquires the row before the six commands authorize. It transfers
  // control only after all six are blocked in SELECT ... FOR UPDATE. This
  // reproduces the authorization-to-lock race with real PostgreSQL connections.
  const raceCommands = commands.slice(1);
  const suffix = randomUUID().replaceAll("-", "");
  const holder = `flash_audit_holder_${suffix}`;
  const waiterPrefix = `flash_audit_wait_${suffix}_`;
  const held = sql(`begin;
set local application_name = ${literal(holder)};
select test_support.as_actor('member');
select id from public.attempts where id = ${attempt} for update;
do $$ declare deadline timestamptz := clock_timestamp() + interval '12 seconds';
begin
  loop
    perform pg_stat_clear_snapshot();
    exit when (select count(*) from pg_stat_activity where application_name like ${literal(`${waiterPrefix}%`)} and wait_event_type = 'Lock') = ${raceCommands.length};
    if clock_timestamp() > deadline then raise exception 'audit race barrier timed out'; end if;
    perform pg_sleep(0.025);
  end loop;
end; $$;
set local role service_role;
${call("take_over_attempt", { ...transfer, idempotencyKey: "audit-race-transfer" })};
commit;`);
  held.catch(() => {});
  let ready = false;
  for (let tries = 0; tries < 150; tries++) {
    ready =
      (
        await sql(
          `select exists(select 1 from pg_stat_activity where application_name = ${literal(holder)} and wait_event = 'PgSleep');`,
        )
      ).trim() === "t";
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.ok(ready, "Audit holder never acquired the row lock");
  const waiters = raceCommands.map(([command, extra], index) =>
    sql(`begin;
set local application_name = ${literal(`${waiterPrefix}${index}`)};
${helpers}
select test_support.as_actor('member');
set local role service_role;
select pg_temp.probe(${statement(command, commandInput(command, extra))});
commit;`),
  );
  const outcomes = await Promise.allSettled([held, ...waiters]);
  if (outcomes.some((outcome) => outcome.status === "rejected")) {
    throw new Error(
      `Race probe failed: ${JSON.stringify(
        outcomes.map((outcome, index) => ({
          command: index === 0 ? "takeover holder" : raceCommands[index - 1][0],
          result: outcome.status === "fulfilled" ? lastJson(outcome.value) : String(outcome.reason),
        })),
      )}`,
    );
  }
  for (let i = 0; i < raceCommands.length; i++) {
    observations.push({
      id: `race/${raceCommands[i][0]}`,
      result: lastJson(outcomes[i + 1].value),
    });
  }
  return observations;
}
