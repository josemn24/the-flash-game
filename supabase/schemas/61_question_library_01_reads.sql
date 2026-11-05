-- Authorized question library and version history reads.
set local check_function_bodies = off;

create or replace function private.question_version_detail(target_question_version uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
  definition_row private.question_definitions%rowtype;
  result jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select definition.* into definition_row
  from private.question_definitions definition
  join private.question_versions version on version.question_definition_id = definition.id
  where version.id = target_question_version;
  if not found then raise exception 'content_not_found' using errcode = 'P0002'; end if;

  select jsonb_build_object(
    'questionDefinitionId', definition_row.id,
    'slug', definition_row.slug,
    'versions', coalesce(jsonb_agg(
      jsonb_build_object(
        'questionDefinitionId', version.question_definition_id,
        'questionVersionId', version.id,
        'versionNumber', version.version_number,
        'status', version.status,
        'slug', definition_row.slug,
        'type', version.type,
        'question', version.public_payload->>'question',
        'category', version.public_payload->>'category',
        'tags', coalesce(version.public_payload->'tags', '{}'::jsonb),
        'timeLimitMs', version.time_limit_ms,
        'difficulty', version.difficulty,
        'createdAt', version.created_at,
        'updatedAt', version.updated_at,
        'publishedAt', version.published_at,
        'versionCount', (select count(*) from private.question_versions count_version
          where count_version.question_definition_id = version.question_definition_id),
        'usageCount', (select count(*) from private.challenge_items usage
          where usage.question_version_id = version.id),
        'document', private.question_version_document(version.id)
      ) order by version.version_number desc
    ), '[]'::jsonb)
  ) into result
  from private.question_versions version
  where version.question_definition_id = definition_row.id;
  return result;
end;
$$;
alter function private.question_version_detail(uuid) owner to postgres;
revoke all on function private.question_version_detail(uuid) from public, anon, authenticated, service_role;

create or replace function private.read_superadmin_question_library(input jsonb default '{}'::jsonb)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
  page_value integer := greatest(1, least(coalesce((input->>'page')::integer, 1), 10000));
  page_size_value integer := greatest(1, least(coalesce((input->>'pageSize')::integer, 25), 100));
  search_value text := nullif(btrim(input->>'search'), '');
  type_value text := nullif(btrim(input->>'type'), '');
  status_value text := coalesce(nullif(btrim(input->>'status'), ''), 'published');
  tag_value text := nullif(btrim(input->>'tag'), '');
  total_value integer;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or exists (select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['page', 'pageSize', 'search', 'type', 'status', 'tag']))
    or status_value not in ('all', 'draft', 'published', 'archived') then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  with candidates as (
    select version.id, row_number() over (
      partition by version.question_definition_id order by version.version_number desc, version.id desc
    ) as latest_version
    from private.question_versions version
    join private.question_definitions definition on definition.id = version.question_definition_id
    where (status_value = 'all' or version.status = status_value)
      and (type_value is null or version.type = type_value)
      and (search_value is null or definition.slug ilike '%' || search_value || '%'
        or version.public_payload->>'question' ilike '%' || search_value || '%')
      and (tag_value is null or coalesce(version.public_payload->'tags', '{}'::jsonb)::text ilike '%' || tag_value || '%')
  )
  select count(*) into total_value
  from candidates
  where status_value <> 'published' or latest_version = 1;

  return jsonb_build_object(
    'entries', coalesce((
      with candidates as (
        select version.*, definition.slug, row_number() over (
          partition by version.question_definition_id order by version.version_number desc, version.id desc
        ) as latest_version
        from private.question_versions version
        join private.question_definitions definition on definition.id = version.question_definition_id
        where (status_value = 'all' or version.status = status_value)
          and (type_value is null or version.type = type_value)
          and (search_value is null or definition.slug ilike '%' || search_value || '%'
            or version.public_payload->>'question' ilike '%' || search_value || '%')
          and (tag_value is null or coalesce(version.public_payload->'tags', '{}'::jsonb)::text ilike '%' || tag_value || '%')
      ), paged_candidates as (
        select * from candidates candidate
        where status_value <> 'published' or candidate.latest_version = 1
        order by candidate.updated_at desc, candidate.id
        offset (page_value - 1) * page_size_value limit page_size_value
      )
      select jsonb_agg(jsonb_build_object(
        'questionDefinitionId', candidate.question_definition_id,
        'questionVersionId', candidate.id,
        'versionNumber', candidate.version_number,
        'status', candidate.status,
        'slug', candidate.slug,
        'type', candidate.type,
        'question', candidate.public_payload->>'question',
        'category', candidate.public_payload->>'category',
        'tags', coalesce(candidate.public_payload->'tags', '{}'::jsonb),
        'timeLimitMs', candidate.time_limit_ms,
        'difficulty', candidate.difficulty,
        'createdAt', candidate.created_at,
        'updatedAt', candidate.updated_at,
        'publishedAt', candidate.published_at,
        'versionCount', (select count(*) from private.question_versions count_version
          where count_version.question_definition_id = candidate.question_definition_id),
        'usageCount', (select count(*) from private.challenge_items usage
          where usage.question_version_id = candidate.id)
      ) order by candidate.updated_at desc, candidate.id
      ) from paged_candidates candidate
    ), '[]'::jsonb),
    'total', total_value,
    'page', page_value,
    'pageSize', page_size_value
  );
end;
$$;
alter function private.read_superadmin_question_library(jsonb) owner to postgres;
revoke all on function private.read_superadmin_question_library(jsonb) from public, anon, authenticated, service_role;

create or replace function public.get_superadmin_question_library(input jsonb default '{}'::jsonb) returns jsonb
language sql stable security definer set search_path = '' as $$ select private.read_superadmin_question_library(input); $$;
alter function public.get_superadmin_question_library(jsonb) owner to postgres;
revoke all on function public.get_superadmin_question_library(jsonb) from public, anon, service_role;
grant execute on function public.get_superadmin_question_library(jsonb) to authenticated;

create or replace function public.get_superadmin_question_version(question_version_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.question_version_detail(question_version_id);
$$;
alter function public.get_superadmin_question_version(uuid) owner to postgres;
revoke all on function public.get_superadmin_question_version(uuid) from public, anon, service_role;
grant execute on function public.get_superadmin_question_version(uuid) to authenticated;
