-- Internal command helpers; no direct execution by API roles.
set local check_function_bodies = off;

create function private.next_attempt_item(target_attempt uuid) returns uuid
language sql stable set search_path = '' as $$
  select i.id from public.attempts a
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  join private.challenge_items i on i.challenge_version_id = a.challenge_version_id
  where a.id = target_attempt and not exists (
    select 1 from private.attempt_answers aa where aa.attempt_id = a.id and aa.challenge_item_id = i.id
  )
  order by
    case when cv.mode = 'alphabet' and exists (select 1 from private.interaction_intervals x
      where x.attempt_id = a.id and x.challenge_item_id = i.id) then 1 else 0 end,
    case when cv.mode = 'alphabet' and i.position <= coalesce((
      select ci.position from private.interaction_intervals x
      join private.challenge_items ci on ci.id = x.challenge_item_id
      where x.attempt_id = a.id order by x.started_at desc, x.id desc limit 1
    ), 0) then 1 else 0 end,
    i.position limit 1
$$;
alter function private.next_attempt_item(uuid) owner to postgres;
revoke all on function private.next_attempt_item(uuid) from public, anon, authenticated, service_role;
