import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const lastJson = (output) =>
  JSON.parse(
    output
      .trim()
      .split("\n")
      .filter((line) => line.startsWith("{"))
      .at(-1),
  );
const id = (label) => `test_support.id(${literal(label)})`;

export async function testCompetitiveCommandRaces(sql) {
  async function fixture(label, mode) {
    const target = id(label);
    await sql(`begin;
insert into public.attempts(id, player_id, scheduled_challenge_id, challenge_version_id,
  kind, client_state_schema_version, last_activity_at)
values (${target}, ${id("member2")}, ${id(`sc-${mode}`)}, ${id(`cv-${mode}`)},
  'competitive', 1, clock_timestamp() - interval '16 minutes');
insert into private.attempt_sessions(attempt_id, session_token_hash)
values (${target}, private.secret_hash(${literal(`initial-session-${label}`.repeat(3))}));
commit;`);
    return target;
  }
  const takeover = (target, mode, key) => ({
    actor: "member2",
    role: "service_role",
    expression: `private.take_over_attempt(jsonb_build_object('attemptId', ${target},
      'scheduledChallengeId', ${id(`sc-${mode}`)}, 'lockVersion', 1,
      'newSessionToken', ${literal(`new-session-${key}`.repeat(3))}, 'idempotencyKey', ${literal(key)}))`,
  });
  const remove = (mode, key) => ({
    actor: "owner",
    role: "authenticated",
    expression: `public.manage_room_member(jsonb_build_object('roomKey', ${literal(`commands-${mode}`)},
      'targetPlayerId', ${id("member2")}, 'action', 'remove', 'idempotencyKey', ${literal(key)}))`,
  });
  const expire = (target, key) => ({
    actor: "member2",
    role: "service_role",
    expression: `private.expire_stale_attempts(jsonb_build_object('attemptId', ${target}, 'runId', ${literal(key)}))`,
  });
  async function invoke(command, marker, hold) {
    return sql(`begin;
set local application_name = ${literal(marker)};
create function pg_temp.observe() returns jsonb language plpgsql as $$
declare result jsonb;
begin
  result := ${command.expression};
  return jsonb_build_object('accepted', true, 'result', result);
exception when others then
  return jsonb_build_object('accepted', false, 'sqlstate', sqlstate, 'message', sqlerrm);
end;
$$;
grant execute on function pg_temp.observe() to service_role, authenticated;
select test_support.as_actor(${literal(command.actor)});
set local role ${command.role};
select pg_temp.observe();
${hold ? "select pg_sleep(1);" : ""}
commit;`);
  }
  async function race(first, second) {
    const marker = `flash_reconciliation_${randomUUID().replaceAll("-", "")}`;
    const leader = invoke(first, marker, true);
    leader.catch(() => {});
    let ready = false;
    for (let tries = 0; tries < 100; tries++) {
      ready =
        (
          await sql(`select exists(select 1 from pg_stat_activity
        where application_name = ${literal(marker)} and wait_event = 'PgSleep');`)
        ).trim() === "t";
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    assert.ok(ready, "First command must finish and retain its locks before the second starts");
    const outcomes = await Promise.allSettled([leader, invoke(second, `${marker}_second`, false)]);
    for (const result of outcomes) if (result.status === "rejected") throw result.reason;
    return outcomes.map((result) => lastJson(result.value));
  }
  async function facts(target) {
    return lastJson(
      await sql(`select jsonb_build_object(
      'status', attempt.status, 'reason', attempt.terminal_reason, 'version', attempt.lock_version,
      'activeSessions', (select count(*) from private.attempt_sessions where attempt_id = ${target} and revoked_at is null),
      'sessionReasons', (select jsonb_agg(revocation_reason order by revocation_reason)
        from private.attempt_sessions where attempt_id = ${target}),
      'points', (select count(*) from private.flash_point_entries where attempt_id = ${target}),
      'auditActions', (select jsonb_agg(action order by action) from private.audit_log where entity_id = ${target})
    ) from public.attempts attempt where id = ${target};`),
    );
  }
  const transferTarget = await fixture("reconciliation-transfer-race", "alphabet");
  const transfers = await race(
    takeover(transferTarget, "alphabet", "reconciliation-transfer-one"),
    takeover(transferTarget, "alphabet", "reconciliation-transfer-two"),
  );
  assert.equal(transfers[0].accepted, true);
  assert.deepEqual(transfers[1], { accepted: false, sqlstate: "40001", message: "stale_version" });
  assert.deepEqual(await facts(transferTarget), {
    status: "in_progress",
    reason: null,
    version: 2,
    activeSessions: 1,
    sessionReasons: ["takeover", null],
    points: 0,
    auditActions: ["takeover_confirmed"],
  });

  for (const permissionFirst of [false, true]) {
    const mode = permissionFirst ? "survival" : "fast";
    const target = await fixture(`reconciliation-close-${mode}`, mode);
    await sql(
      `update public.scheduled_challenges set status = 'closed' where id = ${id(`sc-${mode}`)};`,
    );
    const removal = remove(mode, `reconciliation-remove-${mode}`);
    const expiration = expire(target, `reconciliation-expire-${mode}`);
    const outcomes = await race(
      permissionFirst ? removal : expiration,
      permissionFirst ? expiration : removal,
    );
    assert.ok(outcomes.every((outcome) => outcome.accepted));
    assert.equal(
      outcomes[permissionFirst ? 1 : 0].result.abandonedAttempts,
      permissionFirst ? 0 : 1,
    );
    assert.deepEqual(await facts(target), {
      status: "abandoned",
      reason: permissionFirst ? "permission_revoked" : "inactivity_timeout",
      version: 2,
      activeSessions: 0,
      sessionReasons: [permissionFirst ? "permission_revoked" : "terminal"],
      points: 0,
      auditActions: [permissionFirst ? "close_attempt_permission_revoked" : "expire_stale_attempt"],
    });
  }
  for (const permissionFirst of [false, true]) {
    const mode = permissionFirst ? "pyramid" : "narrative";
    const target = await fixture(`reconciliation-transfer-remove-${mode}`, mode);
    const removal = remove(mode, `reconciliation-transfer-remove-${mode}`);
    const transfer = takeover(target, mode, `reconciliation-transfer-${mode}`);
    const outcomes = await race(
      permissionFirst ? removal : transfer,
      permissionFirst ? transfer : removal,
    );
    assert.equal(outcomes[0].accepted, true);
    if (permissionFirst)
      assert.deepEqual(outcomes[1], {
        accepted: false,
        sqlstate: "42501",
        message: "not_authorized",
      });
    else assert.equal(outcomes[1].accepted, true);
    assert.deepEqual(await facts(target), {
      status: "abandoned",
      reason: "permission_revoked",
      version: permissionFirst ? 2 : 3,
      activeSessions: 0,
      sessionReasons: permissionFirst ? ["permission_revoked"] : ["permission_revoked", "takeover"],
      points: 0,
      auditActions: permissionFirst
        ? ["close_attempt_permission_revoked"]
        : ["close_attempt_permission_revoked", "takeover_confirmed"],
    });
  }
  console.log(
    "Five additional races passed: competing transfers, expiration/permission loss and transfer/permission loss in both orders.",
  );
}
