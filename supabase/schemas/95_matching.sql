-- Matching public projection and authoritative complete-answer validation.

create function private.matching_public_payload(target_item uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'question', q.public_payload->'question',
    'category', coalesce(q.public_payload->'category', 'null'::jsonb),
    'tags', coalesce(q.public_payload->'tags', '{}'::jsonb),
    'leftItems', coalesce((
      select jsonb_agg(value - 'correctMatchId' order by ordinality)
      from jsonb_array_elements(q.public_payload->'leftItems') with ordinality
    ), '[]'::jsonb),
    'rightItems', coalesce((
      select jsonb_agg(value - 'correctMatchId' order by ordinality)
      from jsonb_array_elements(q.public_payload->'rightItems') with ordinality
    ), '[]'::jsonb)
  )
  from private.challenge_items i
  join private.question_versions q on q.id = i.question_version_id
  where i.id = target_item and q.type = 'matching'
$$;

create function private.matching_answer_valid(
  target_payload jsonb,
  target_answer jsonb,
  require_complete boolean
) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  left_count integer;
  right_count integer;
  pair_count integer;
  distinct_right_count integer;
begin
  if jsonb_typeof(target_answer) is distinct from 'object'
    or jsonb_typeof(target_payload->'leftItems') is distinct from 'array'
    or jsonb_typeof(target_payload->'rightItems') is distinct from 'array' then
    return false;
  end if;

  select count(*)::integer into left_count
  from jsonb_array_elements(target_payload->'leftItems');
  select count(*)::integer into right_count
  from jsonb_array_elements(target_payload->'rightItems');
  select count(*)::integer into pair_count
  from jsonb_each_text(target_answer);

  if left_count <> right_count or pair_count > left_count
    or (require_complete and pair_count <> left_count) then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_each_text(target_answer) answer_pair
    where not exists (
      select 1 from jsonb_array_elements(target_payload->'leftItems') item
      where item->>'id' = answer_pair.key
    )
    or not exists (
      select 1 from jsonb_array_elements(target_payload->'rightItems') item
      where item->>'id' = answer_pair.value
    )
  ) then
    return false;
  end if;

  select count(distinct answer_pair.value)::integer into distinct_right_count
  from jsonb_each_text(target_answer) answer_pair;
  if distinct_right_count <> pair_count then
    return false;
  end if;

  if require_complete and exists (
    select 1
    from jsonb_array_elements(target_payload->'leftItems') item
    where not exists (
      select 1 from jsonb_each_text(target_answer) answer_pair
      where answer_pair.key = item->>'id'
    )
  ) then
    return false;
  end if;

  return true;
end;
$$;

alter function private.matching_public_payload(uuid) owner to postgres;
alter function private.matching_answer_valid(jsonb, jsonb, boolean) owner to postgres;
revoke all on function private.matching_public_payload(uuid),
  private.matching_answer_valid(jsonb, jsonb, boolean)
  from public, anon, authenticated, service_role;
