-- Read-only overlay for answer reviews. Gameplay and audit keep the original rows.
create view private.review_attempt_answers with (security_invoker = true) as
select answer.id, answer.attempt_id, answer.challenge_item_id, answer.answer,
  coalesce(regrade.after_status, answer.status) as status,
  coalesce(regrade.after_points, answer.points) as points,
  case when regrade.after_status is not null then regrade.after_details
    else answer.result_details end as result_details,
  answer.review_state, answer.presented_at, answer.submitted_at, answer.time_used_ms
from private.attempt_answers answer
left join lateral (
  select correction.after_status, correction.after_points, correction.after_details
  from private.attempt_answer_regrades correction
  where correction.attempt_id = answer.attempt_id
    and correction.challenge_item_id = answer.challenge_item_id
  order by correction.attempt_lock_version desc
  limit 1
) regrade on true;
alter view private.review_attempt_answers owner to postgres;
revoke all on private.review_attempt_answers from public, anon, authenticated, service_role;

-- The review total follows its per-answer breakdown. Global adjustments are tracked separately.
create function private.review_attempt_score(target_attempt uuid, original_score integer) returns integer
language sql stable set search_path = '' as $$
  select original_score + coalesce(sum(entry.amount), 0)::integer
  from private.flash_point_entries entry
  where entry.attempt_id = target_attempt and entry.entry_type = 'answer_regrade'
$$;
alter function private.review_attempt_score(uuid, integer) owner to postgres;
revoke all on function private.review_attempt_score(uuid, integer) from public, anon, authenticated, service_role;
