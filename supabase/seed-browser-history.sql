-- Resultados históricos opcionales del dataset browser.
-- Solo se ejecuta con --with-history y únicamente en Supabase local.

begin;
set session_replication_role = replica;

insert into public.attempts
  (id, player_id, scheduled_challenge_id, challenge_version_id, attempt_number, kind,
   status, started_at, completed_at, score, client_state_schema_version, lock_version)
values
  ('a1111111-1111-4111-8111-111111111111', :'browser_owner_player_id'::uuid,
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '55555555-5555-4555-8555-555555555555', 1, 'competitive',
    'completed', now() - interval '6 days 23 hours', now() - interval '6 days 22 hours', 100, 1, 1),
  ('a2222222-2222-4222-8222-222222222222', :'browser_admin_player_id'::uuid,
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '55555555-5555-4555-8555-555555555555', 1, 'competitive',
    'completed', now() - interval '6 days 23 hours', now() - interval '6 days 22 hours', 50, 1, 1),
  ('a3333333-3333-4333-8333-333333333333', :'browser_member_player_id'::uuid,
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '55555555-5555-4555-8555-555555555555', 1, 'competitive',
    'completed', now() - interval '6 days 23 hours', now() - interval '6 days 22 hours', 0, 1, 1);

insert into private.answer_receipts
  (id, attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
   presented_at, effective_submitted_at, time_used_ms, timed_out)
values
  ('b1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '55555555-5555-4555-8555-555555555555', '"Lisboa"'::jsonb, now() - interval '6 days 22 hours 59 minutes', now() - interval '6 days 22 hours 59 minutes', now() - interval '6 days 22 hours 59 minutes', 900, false),
  ('b1111111-1111-4111-8111-111111111112', 'a1111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '55555555-5555-4555-8555-555555555555', '"Marte"'::jsonb, now() - interval '6 days 22 hours 58 minutes', now() - interval '6 days 22 hours 58 minutes', now() - interval '6 days 22 hours 58 minutes', 900, false),
  ('b2222222-2222-4222-8222-222222222221', 'a2222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '55555555-5555-4555-8555-555555555555', '"Lisboa"'::jsonb, now() - interval '6 days 22 hours 59 minutes', now() - interval '6 days 22 hours 59 minutes', now() - interval '6 days 22 hours 59 minutes', 1000, false),
  ('b2222222-2222-4222-8222-222222222222', 'a2222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '55555555-5555-4555-8555-555555555555', '"Venus"'::jsonb, now() - interval '6 days 22 hours 58 minutes', now() - interval '6 days 22 hours 58 minutes', now() - interval '6 days 22 hours 58 minutes', 1000, false),
  ('b3333333-3333-4333-8333-333333333331', 'a3333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '55555555-5555-4555-8555-555555555555', '"Oporto"'::jsonb, now() - interval '6 days 22 hours 59 minutes', now() - interval '6 days 22 hours 59 minutes', now() - interval '6 days 22 hours 59 minutes', 1100, false),
  ('b3333333-3333-4333-8333-333333333332', 'a3333333-3333-4333-8333-333333333333', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '55555555-5555-4555-8555-555555555555', '"Venus"'::jsonb, now() - interval '6 days 22 hours 58 minutes', now() - interval '6 days 22 hours 58 minutes', now() - interval '6 days 22 hours 58 minutes', 1100, false);

insert into private.attempt_answers
  (attempt_id, challenge_item_id, challenge_version_id, receipt_id, status, answer,
   result_details, points, presented_at, submitted_at, time_used_ms, idempotency_key)
values
  ('a1111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '55555555-5555-4555-8555-555555555555', 'b1111111-1111-4111-8111-111111111111', 'correct', '"Lisboa"'::jsonb, '{}'::jsonb, 50, now() - interval '6 days 22 hours 59 minutes', now() - interval '6 days 22 hours 59 minutes', 900, 'browser-history-owner-one'),
  ('a1111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '55555555-5555-4555-8555-555555555555', 'b1111111-1111-4111-8111-111111111112', 'correct', '"Marte"'::jsonb, '{}'::jsonb, 50, now() - interval '6 days 22 hours 58 minutes', now() - interval '6 days 22 hours 58 minutes', 900, 'browser-history-owner-two'),
  ('a2222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '55555555-5555-4555-8555-555555555555', 'b2222222-2222-4222-8222-222222222221', 'correct', '"Lisboa"'::jsonb, '{}'::jsonb, 50, now() - interval '6 days 22 hours 59 minutes', now() - interval '6 days 22 hours 59 minutes', 1000, 'browser-history-admin-one'),
  ('a2222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '55555555-5555-4555-8555-555555555555', 'b2222222-2222-4222-8222-222222222222', 'incorrect', '"Venus"'::jsonb, '{}'::jsonb, 0, now() - interval '6 days 22 hours 58 minutes', now() - interval '6 days 22 hours 58 minutes', 1000, 'browser-history-admin-two'),
  ('a3333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '55555555-5555-4555-8555-555555555555', 'b3333333-3333-4333-8333-333333333331', 'incorrect', '"Oporto"'::jsonb, '{}'::jsonb, 0, now() - interval '6 days 22 hours 59 minutes', now() - interval '6 days 22 hours 59 minutes', 1100, 'browser-history-member-one'),
  ('a3333333-3333-4333-8333-333333333333', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '55555555-5555-4555-8555-555555555555', 'b3333333-3333-4333-8333-333333333332', 'incorrect', '"Venus"'::jsonb, '{}'::jsonb, 0, now() - interval '6 days 22 hours 58 minutes', now() - interval '6 days 22 hours 58 minutes', 1100, 'browser-history-member-two');

insert into private.flash_point_entries
  (season_id, player_id, scheduled_challenge_id, attempt_id, entry_type, amount, idempotency_key)
values
  ('33333333-3333-4333-8333-333333333333', :'browser_owner_player_id'::uuid, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'a1111111-1111-4111-8111-111111111111', 'accreditation', 100, 'browser-history-ledger-owner'),
  ('33333333-3333-4333-8333-333333333333', :'browser_admin_player_id'::uuid, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'a2222222-2222-4222-8222-222222222222', 'accreditation', 50, 'browser-history-ledger-admin'),
  ('33333333-3333-4333-8333-333333333333', :'browser_member_player_id'::uuid, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'a3333333-3333-4333-8333-333333333333', 'accreditation', 0, 'browser-history-ledger-member');

set session_replication_role = origin;
commit;
