-- Superadmin challenge catalog and detail boundaries.

create or replace function public.get_superadmin_challenge_catalog()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
begin
  if actor is null or not exists (
    select 1
    from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'entries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'challengeDefinitionId', definition.id,
          'slug', definition.slug,
          'title', latest.title,
          'subtitle', latest.subtitle,
          'description', latest.description,
          'mode', latest.mode,
          'questionCount', (select count(*) from private.challenge_items item where item.challenge_version_id = latest.id),
          'versionCount', (
            select count(*)
            from private.challenge_versions version_count
            where version_count.challenge_definition_id = definition.id and version_count.mode in ('flash', 'survival', 'pyramid')
          ),
          'status', latest.status,
          'statusCounts', jsonb_build_object(
            'draft', (select count(*) from private.challenge_versions version_count where version_count.challenge_definition_id = definition.id and version_count.mode in ('flash', 'survival', 'pyramid') and version_count.status = 'draft'),
            'published', (select count(*) from private.challenge_versions version_count where version_count.challenge_definition_id = definition.id and version_count.mode in ('flash', 'survival', 'pyramid') and version_count.status = 'published'),
            'archived', (select count(*) from private.challenge_versions version_count where version_count.challenge_definition_id = definition.id and version_count.mode in ('flash', 'survival', 'pyramid') and version_count.status = 'archived')
          ),
          'updatedAt', latest.updated_at,
          'latestVersion', jsonb_build_object(
            'challengeVersionId', latest.id,
            'versionNumber', latest.version_number,
            'status', latest.status,
            'questionCount', (select count(*) from private.challenge_items item where item.challenge_version_id = latest.id),
            'updatedAt', latest.updated_at,
            'publishedAt', latest.published_at
          )
        ) order by latest.updated_at desc, definition.id
      )
      from private.challenge_definitions definition
      join lateral (
        select version.*
        from private.challenge_versions version
        where version.challenge_definition_id = definition.id and version.mode in ('flash', 'survival', 'pyramid')
        order by version.updated_at desc, version.id
        limit 1
      ) latest on true
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_superadmin_challenge_detail(target_challenge_definition_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
  challenge_payload jsonb;
begin
  if actor is null or not exists (
    select 1
    from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'challengeDefinitionId', definition.id,
    'entries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'challengeDefinitionId', definition.id,
          'challengeVersionId', version.id,
          'versionNumber', version.version_number,
          'status', version.status,
          'slug', definition.slug,
          'title', version.title,
          'subtitle', version.subtitle,
          'description', version.description,
          'mode', version.mode,
          'questionCount', (select count(*) from private.challenge_items item where item.challenge_version_id = version.id),
          'createdAt', version.created_at,
          'updatedAt', version.updated_at,
          'publishedAt', version.published_at,
          'document', case when version.status = 'draft' then jsonb_build_object(
            'challenge', jsonb_build_object(
              'slug', definition.slug,
              'title', version.title,
              'subtitle', version.subtitle,
              'description', version.description,
              'mode', version.mode,
              'configSchemaVersion', version.config_schema_version,
              'modeConfig', version.mode_config
            ),
            'questions', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'slug', question_definition.slug,
                  'type', question.type,
                  'payloadSchemaVersion', question.payload_schema_version,
                  'timeLimitMs', question.time_limit_ms,
                  'points', item.points,
                  'publicPayload', question.public_payload,
                  'solutionPayload', solution.solution_payload
                ) || case when version.mode = 'pyramid'
                  then jsonb_build_object('modeConfig', item.mode_config) else '{}'::jsonb end
                order by item.position
              )
              from private.challenge_items item
              join private.question_versions question on question.id = item.question_version_id
              join private.question_definitions question_definition on question_definition.id = question.question_definition_id
              join private.question_version_solutions solution on solution.question_version_id = question.id
              where item.challenge_version_id = version.id
            ), '[]'::jsonb)
          ) else null end
        ) order by version.updated_at desc, version.id
      )
      from private.challenge_versions version
      where version.challenge_definition_id = definition.id and version.mode in ('flash', 'survival', 'pyramid')
    ), '[]'::jsonb)
  )
  into challenge_payload
  from private.challenge_definitions definition
  where definition.id = target_challenge_definition_id
    and exists (
      select 1
      from private.challenge_versions version
      where version.challenge_definition_id = definition.id and version.mode in ('flash', 'survival', 'pyramid')
    );

  return challenge_payload;
end;
$$;

alter function public.get_superadmin_challenge_catalog() owner to postgres;
alter function public.get_superadmin_challenge_detail(uuid) owner to postgres;
revoke all on function public.get_superadmin_challenge_catalog() from public, anon, service_role;
revoke all on function public.get_superadmin_challenge_detail(uuid) from public, anon, service_role;
grant execute on function public.get_superadmin_challenge_catalog() to authenticated;
grant execute on function public.get_superadmin_challenge_detail(uuid) to authenticated;
