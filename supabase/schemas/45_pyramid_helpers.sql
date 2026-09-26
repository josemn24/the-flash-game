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
