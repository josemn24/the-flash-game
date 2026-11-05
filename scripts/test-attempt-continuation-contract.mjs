import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// The caller creates and drops a dedicated database for this committed scenario.
export async function testAttemptContinuationContract(sql) {
  const json = async (input) => JSON.parse((await sql(input)).trim());
  const fixtures = await readFile("supabase/tests/support/command-fixtures.sql", "utf8");
  await sql(`begin; ${fixtures}
    create table test_support.upgrade_saved as select ''::text as label, runtime.* from test_support.runtime where false;
    create function test_support.save_upgrade(target_label text) returns void language sql as $$
      insert into test_support.upgrade_saved select target_label, runtime.* from test_support.runtime
    $$;
    create function test_support.restore_upgrade(target_label text) returns void language sql as $$
      update test_support.runtime r set state = s.state, last_command = s.last_command,
        last_input = s.last_input, last_result = s.last_result
      from test_support.upgrade_saved s where s.label = target_label
    $$;
    select test_support.as_actor('owner');
    select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', test_support.id('sc-flash')));
    do $$ begin for n in 1..2 loop
      perform test_support.run('prepare_interaction');
      perform test_support.run('receive_answer', '{"answer":true}');
      perform test_support.run('record_evaluation', '{"status":"correct","points":50}');
    end loop; end $$;
    select test_support.run('complete_attempt');
    select test_support.save_upgrade('completed');
    select test_support.as_actor('member');
    select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', test_support.id('sc-flash'), 'sessionToken', repeat('m',40)));
    select test_support.run('prepare_interaction');
    select test_support.run('receive_answer', '{"answer":true}');
    select test_support.run('take_over_attempt', jsonb_build_object('newSessionToken', repeat('t',40)));
    select test_support.save_upgrade('pending');
    select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', test_support.id('sc-pyramid'), 'sessionToken', repeat('p',40)));
    select test_support.run('prepare_interaction');
    select test_support.save_upgrade('prepared');
    select test_support.as_actor('member2');
    select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', test_support.id('sc-narrative'), 'sessionToken', repeat('n',40)));
    select test_support.run('prepare_interaction');
    select test_support.save_upgrade('active');
    commit;`);
  const tables =
    await json(`select jsonb_agg(format('%I.%I', n.nspname, c.relname) order by n.nspname,c.relname)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','private') and c.relkind='r';`);
  const snapshot = `select jsonb_build_object(${tables
    .map(
      (table) => `'${table}',
    (select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text), '[]'::jsonb) from ${table} r)`,
    )
    .join(",")});`;
  const beforeData = await json(snapshot);
  // Completed results and the old transfer can be replayed without new audit, sessions or credits.
  const replay = await json(`begin;
    select test_support.as_actor('owner'); select test_support.restore_upgrade('completed');
    select to_json(test_support.repeat_last() = (select last_result from test_support.runtime)); commit;`);
  assert.equal(replay, true, "Completion replays exactly");
  const transferReplay = await json(`begin;
    select test_support.as_actor('member'); select test_support.restore_upgrade('pending');
    select to_json(test_support.repeat_last() = (select last_result from test_support.runtime)); commit;`);
  assert.equal(transferReplay, true, "Transfer replays exactly");
  assert.deepEqual(await json(snapshot), beforeData, "Exact replays have no domain writes");

  await sql(`begin;
    select test_support.as_actor('member'); select test_support.restore_upgrade('pending');
    select test_support.run('record_evaluation', '{"status":"correct","points":50}');
    select test_support.run('prepare_interaction');
    select test_support.run('receive_answer', '{"answer":true}');
    select test_support.run('record_evaluation', '{"status":"correct","points":50}');
    select test_support.run('complete_attempt');
    select test_support.restore_upgrade('prepared');
    select test_support.run('activate_interaction');
    select test_support.run('receive_answer', '{"answer":"B"}');
    select test_support.run('record_evaluation', '{"status":"incorrect","points":0}');
    select test_support.run('complete_attempt');
    select test_support.as_actor('member2'); select test_support.restore_upgrade('active');
    select test_support.run('abandon_attempt');
    commit;`);
  assert.deepEqual(
    await json(`select jsonb_agg(jsonb_build_object('label', s.label,
      'status', a.status, 'score', a.score, 'outcome', a.outcome,
      'activeSessions', (select count(*) from private.attempt_sessions x where x.attempt_id=a.id and revoked_at is null),
      'credits', (select count(*) from private.flash_point_entries e where e.attempt_id=a.id and entry_type='accreditation')) order by s.label)
    from test_support.upgrade_saved s join public.attempts a on a.id=(s.state->>'attemptId')::uuid;`),
    [
      {
        label: "active",
        status: "abandoned",
        score: null,
        outcome: null,
        activeSessions: 0,
        credits: 0,
      },
      {
        label: "completed",
        status: "completed",
        score: 100,
        outcome: null,
        activeSessions: 0,
        credits: 1,
      },
      {
        label: "pending",
        status: "completed",
        score: 100,
        outcome: null,
        activeSessions: 0,
        credits: 1,
      },
      {
        label: "prepared",
        status: "completed",
        score: 0,
        outcome: "failed",
        activeSessions: 0,
        credits: 1,
      },
    ],
    "All recovered attempts continue with the same terminal and scoring contracts",
  );
}
