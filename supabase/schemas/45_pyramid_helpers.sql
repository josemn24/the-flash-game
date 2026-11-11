create function private.is_valid_pyramid_level_config(value jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
    jsonb_typeof(value) = 'object'
    and (select count(*) from jsonb_object_keys(value)) = 3
    and jsonb_typeof(value->'levelId') = 'string'
    and char_length(btrim(value->>'levelId')) between 1 and 120
    and jsonb_typeof(value->'label') = 'string'
    and char_length(btrim(value->>'label')) between 1 and 120
    and jsonb_typeof(value->'briefing') = 'object'
    and (select count(*) from jsonb_object_keys(value->'briefing')) = 3
    and jsonb_typeof(value->'briefing'->'title') = 'string'
    and char_length(btrim(value->'briefing'->>'title')) between 1 and 200
    and jsonb_typeof(value->'briefing'->'format') = 'string'
    and char_length(btrim(value->'briefing'->>'format')) between 1 and 120
    and jsonb_typeof(value->'briefing'->'description') = 'string'
    and char_length(btrim(value->'briefing'->>'description')) between 1 and 1000,
    false
  );
$$;

alter function private.is_valid_pyramid_level_config(jsonb) owner to postgres;
revoke all on function private.is_valid_pyramid_level_config(jsonb)
  from public, anon, authenticated, service_role;

create function private.is_valid_pyramid_config(config jsonb, question_types text[]) returns boolean
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(config) = 'object' then not exists (
    select 1 from jsonb_each(config) option
    where option.value <> 'true'::jsonb
      or not coalesce((case option.key
        when 'connectPairsTimeoutPartialCredit' then 'connect-pairs'
        when 'wordSearchTimeoutPartialCredit' then 'word-search'
        when 'queensTimeoutPartialCredit' then 'queens'
        when 'matchingPartialCredit' then 'matching'
        when 'classificationPartialCredit' then 'classification'
        when 'orderingPartialCredit' then 'ordering'
      end) = any(question_types), false)
  ) else false end;
$$;

alter function private.is_valid_pyramid_config(jsonb, text[]) owner to postgres;
revoke all on function private.is_valid_pyramid_config(jsonb, text[])
  from public, anon, authenticated, service_role;

create function private.pyramid_draft_enabled(config jsonb, format text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(config->(case format
    when 'matching' then 'matchingPartialCredit'
    when 'classification' then 'classificationPartialCredit'
    when 'ordering' then 'orderingPartialCredit'
  end) = 'true'::jsonb, false);
$$;

create function private.pyramid_draft_valid(
  format text, payload jsonb, answer jsonb, require_complete boolean
) returns boolean
language plpgsql stable set search_path = '' as $$
begin
  if format = 'ordering' then
    if jsonb_typeof(answer) is distinct from 'array' then return false; end if;
    if jsonb_array_length(answer) <> jsonb_array_length(payload->'items') then return false; end if;
    return (select count(distinct value) = count(*)
      and coalesce(bool_and(jsonb_typeof(value) = 'string' and payload->'items' @> jsonb_build_array(value)), false)
      from jsonb_array_elements(answer));
  end if;
  if jsonb_typeof(answer) is distinct from 'object' then return false; end if;
  if exists (select 1 from jsonb_each(answer) pair where jsonb_typeof(pair.value) <> 'string')
    then return false; end if;
  if format = 'matching' then
    return private.matching_answer_valid(payload, answer, require_complete);
  elsif format = 'classification' then
    return (not require_complete or
      (select count(*) from jsonb_object_keys(answer)) = jsonb_array_length(payload->'items'))
      and not exists (
        select 1 from jsonb_each(answer) pair
        where not (payload->'items' @> jsonb_build_array(jsonb_build_object('label', pair.key)))
          or not (payload->'categories' @> jsonb_build_array(pair.value))
      );
  end if;
  return false;
end;
$$;

alter function private.pyramid_draft_enabled(jsonb, text) owner to postgres;
alter function private.pyramid_draft_valid(text, jsonb, jsonb, boolean) owner to postgres;
revoke all on function private.pyramid_draft_enabled(jsonb, text),
  private.pyramid_draft_valid(text, jsonb, jsonb, boolean) from public, anon, authenticated, service_role;
