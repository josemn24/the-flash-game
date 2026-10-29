import "server-only";

import { Pool } from "pg";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/infrastructure/supabase/config";
import { getSupabaseDatabaseUrl } from "@/infrastructure/supabase/platform/databaseUrl";

const poolKey = Symbol.for("the-flash-game.supabase.health-pool");
const globalPool = globalThis as typeof globalThis & { [poolKey]?: Pool };
const canonicalSchemaRevision = "20261029184633_preserve_draft_calendar_windows";

function databaseUrl() {
  return getSupabaseDatabaseUrl();
}

function getPool() {
  if (!globalPool[poolKey]) {
    globalPool[poolKey] = new Pool({
      connectionString: databaseUrl(),
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 2_000,
      application_name: "the-flash-game-health",
    });
  }
  return globalPool[poolKey]!;
}

async function checkDatabase() {
  const expected = process.env.EXPECTED_SCHEMA_REVISION ?? canonicalSchemaRevision;
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // The role supplied by the connection URL is elevated only for this
    // transaction, matching the command pool.
    await client.query("SET LOCAL ROLE service_role");
    await client.query("SET statement_timeout = '2000ms'");
    const result = await client.query<{
      database_ok: boolean;
      schema_ready: boolean;
      schema_revision_marker: boolean;
    }>(`
      select
        true as database_ok,
        to_regclass('public.players') is not null as schema_ready,
        to_regprocedure('private.submit_mini_wordle_guess(jsonb)') is not null
          and to_regprocedure('private.submit_logic_code_attempt(jsonb)') is not null
          and to_regprocedure('private.reveal_progressive_clue(jsonb)') is not null
          and to_regprocedure('private.matching_answer_valid(jsonb,jsonb,boolean)') is not null
        and to_regprocedure('private.connect_pairs_answer_valid(jsonb,jsonb)') is not null
        and to_regprocedure('private.is_supported_time_trial_question(uuid)') is not null
        and to_regprocedure('private.submit_queens_placement(jsonb)') is not null
        and to_regprocedure('private.save_queens_draft(jsonb)') is not null
        and to_regprocedure('private.submit_queens_answer(jsonb)') is not null
        and to_regprocedure('private.submit_word_search_selection(jsonb)') is not null
        and pg_get_functiondef(to_regprocedure('private.read_evaluation_context(uuid,text)'))
          like '%jsonb_build_object(''foundWordIds''%'
        and pg_get_functiondef(to_regprocedure('private.submit_word_search_selection(jsonb)'))
          like '%jsonb_build_object(''foundWordIds''%'
        and to_regprocedure('private.zip_content_valid(jsonb,jsonb)') is not null
        and to_regprocedure('private.escape_content_valid(jsonb,jsonb)') is not null
        and to_regprocedure('private.validate_multiple_choice_question_document(jsonb)') is not null
        and to_regprocedure('private.is_supported_multiple_choice_question(private.question_versions,jsonb)') is not null
        and pg_get_functiondef(to_regprocedure('private.validate_flash_question_document(jsonb)'))
          like '%private.validate_multiple_choice_question_document%'
        and pg_get_functiondef(to_regprocedure('private.is_supported_flash_question(uuid)'))
          like '%private.is_supported_multiple_choice_question%'
        and exists (select 1 from pg_proc fn join pg_language lang on lang.oid = fn.prolang
          where fn.oid = to_regprocedure('private.take_over_attempt(jsonb)') and lang.lanname = 'sql')
        and pg_get_functiondef(to_regprocedure('private.execute_command(text,jsonb)'))
          like '%''attemptId'',''scheduledChallengeId'',''lockVersion'',''newSessionToken''%'
        and pg_get_functiondef(to_regprocedure('private.close_attempt_as_abandoned(uuid,timestamptz,text,uuid,text,text)'))
          like '%case when terminal_reason_value = ''permission_revoked''%'
        and pg_get_functiondef(to_regprocedure('private.recover_attempt(jsonb)'))
          like '%private.raise_if_session_transferred%'
        and to_regprocedure('private.read_attempt_context(uuid,text)') is not null
        and to_regprocedure('private.prepare_attempt_session(uuid)') is not null
        and to_regprocedure('private.read_recorded_evaluation(uuid,text)') is not null
        and to_regprocedure('private.read_completed_attempt(uuid)') is not null
        and to_regprocedure('private.read_abandoned_attempt(uuid)') is not null
        and to_regprocedure('public.run_calendar_tick(jsonb)') is not null
        and to_regprocedure('public.expire_stale_attempts(jsonb)') is not null
        and to_regprocedure('private.authorize_attempt_replay(uuid,text)') is not null
        and to_regprocedure('public.get_my_competitive_challenge(text,uuid)') is not null
          and to_regprocedure('private.prepare_interaction(jsonb)') is not null
          and to_regprocedure('public.get_room_member_review(text,uuid,uuid)') is not null
          and to_regprocedure('public.get_superadmin_challenge_catalog()') is not null
          and to_regprocedure('public.get_superadmin_challenge_detail(uuid)') is not null
          and to_regprocedure('public.manage_room_member(jsonb)') is not null
          and to_regprocedure('private.read_avatar_upload_confirmation(jsonb)') is not null
          and to_regprocedure('private.claim_archived_avatar_cleanup(jsonb)') is not null
        and pg_get_function_result(
            to_regprocedure('public.get_room_member_review(text,uuid,uuid)')
          ) like '%has_persisted_answer boolean%'
          and pg_get_function_result(to_regprocedure('public.get_my_room_cards()')) like '%member_previews jsonb%'
        and exists (select 1 from pg_constraint
          where conrelid = to_regclass('public.attempts') and conname = 'attempts_outcome_values_check')
        and exists (select 1 from pg_constraint
          where conrelid = to_regclass('public.attempts') and conname = 'attempts_outcome_status_check')
        and pg_get_functiondef(to_regprocedure('private.guard_attempt()')) like '%invalid_attempt_lifecycle%'
        and pg_get_functiondef(to_regprocedure('private.read_completed_attempt(uuid)')) like '%challengeMode%'
        and substring(pg_get_functiondef(to_regprocedure('private.execute_command(text,jsonb)'))
          from $contract$when 'complete' then(.*?)when 'abandon' then$contract$)
          like '%required := array[''idempotencyKey'',''attemptId'',''lockVersion'',''sessionToken''];%'
        and substring(pg_get_functiondef(to_regprocedure('private.execute_command(text,jsonb)'))
          from $contract$when 'complete' then(.*?)when 'abandon' then$contract$)
          not like '%''score''%'
        and not exists (
          select 1 from (values
            ('private.handle_attempt_start(jsonb,jsonb,uuid,jsonb,boolean)', 'private.handle_attempt_start('),
            ('private.handle_attempt_takeover(jsonb,jsonb,public.attempts,timestamptz)', 'private.handle_attempt_takeover('),
            ('private.handle_attempt_prepare(public.attempts,private.challenge_versions,timestamptz)', 'private.handle_attempt_prepare('),
            ('private.handle_attempt_activate(jsonb,public.attempts,timestamptz)', 'private.handle_attempt_activate('),
            ('private.handle_attempt_submission(text,jsonb,public.attempts,private.challenge_versions,timestamptz,timestamptz)', 'private.handle_attempt_submission('),
            ('private.handle_attempt_evaluation(jsonb,public.attempts,private.challenge_versions)', 'private.handle_attempt_evaluation('),
            ('private.handle_attempt_closure(text,jsonb,public.attempts,public.scheduled_challenges,private.challenge_versions,timestamptz)', 'private.handle_attempt_closure(')
          ) required(signature, delegation)
          where to_regprocedure(required.signature) is null
            or coalesce(strpos(pg_get_functiondef(to_regprocedure('private.handle_attempt_command(text,jsonb,jsonb,uuid,jsonb,timestamptz)')),
              required.delegation), 0) = 0
        )
        and pg_get_functiondef(to_regprocedure('private.handle_attempt_closure(text,jsonb,public.attempts,public.scheduled_challenges,private.challenge_versions,timestamptz)'))
          like '%select coalesce(sum(answer.points), 0)::integer into points%'
        and pg_get_functiondef(to_regprocedure('private.handle_attempt_closure(text,jsonb,public.attempts,public.scheduled_challenges,private.challenge_versions,timestamptz)'))
          not like '%input->>''score''%'
        and pg_get_functiondef(to_regprocedure('private.connect_pairs_answer_valid(jsonb,jsonb)'))
          like '%cell_count%'
        and pg_get_functiondef(to_regprocedure('private.validate_connect_pairs_question_document(jsonb)'))
          like '%board_rows%'
          and to_regprocedure('private.read_player_rehearsal_template(text,uuid)') is not null
          and to_regprocedure('private.set_rehearsal_publication_policy(jsonb)') is not null
          and to_regclass('private.rehearsal_publication_policies') is not null
          and exists (select 1 from information_schema.columns where table_schema='private' and table_name='question_versions' and column_name='difficulty')
          and to_regprocedure('public.record_room_measurement_event(jsonb)') is not null
          and to_regclass('private.room_measurements') is not null
          and to_regclass('private.room_measurement_participants') is not null
          and to_regclass('private.room_measurement_publications') is not null
          and to_regclass('private.room_measurement_events') is not null
          and exists(select 1 from pg_index
            where indexrelid=to_regclass('private.room_measurement_events_rehearsal_run_idx')
              and indisunique and indpred is not null)
          and to_regclass('private.room_measurement_ratings') is not null
          and to_regprocedure('public.get_superadmin_season_measurement(uuid,uuid)') is not null
          and to_regprocedure('public.get_my_season_rating(uuid)') is not null
          and to_regprocedure('public.save_my_season_rating(jsonb)') is not null
          and exists(select 1 from pg_trigger where tgrelid='public.seasons'::regclass and tgname='season_measurement_automatic' and tgenabled<>'D')
          as schema_revision_marker
    `);
    const row = result.rows[0];
    await client.query("COMMIT");
    return {
      ok: Boolean(row?.database_ok && row.schema_ready),
      schemaRevisionOk:
        expected === canonicalSchemaRevision && Boolean(row?.schema_revision_marker),
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function checkAuth() {
  const url = new URL("/auth/v1/health", getSupabaseUrl());
  const response = await fetch(url, {
    headers: { apikey: getSupabasePublishableKey() },
    signal: AbortSignal.timeout(2_000),
    cache: "no-store",
  });
  return response.ok;
}

export async function readPrivateHealth() {
  const checks = await Promise.allSettled([checkAuth(), checkDatabase()]);
  const auth = checks[0].status === "fulfilled" && checks[0].value;
  const database = checks[1].status === "fulfilled" && checks[1].value.ok;
  const schema = checks[1].status === "fulfilled" && checks[1].value.schemaRevisionOk;
  return {
    ok: auth && database && schema,
    checks: { auth, database, schema },
  } as const;
}
