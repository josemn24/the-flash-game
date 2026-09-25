SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_superadmin_challenge_catalog()
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
            where version_count.challenge_definition_id = definition.id and version_count.mode = 'flash'
          ),
          'status', latest.status,
          'statusCounts', jsonb_build_object(
            'draft', (select count(*) from private.challenge_versions version_count where version_count.challenge_definition_id = definition.id and version_count.mode = 'flash' and version_count.status = 'draft'),
            'published', (select count(*) from private.challenge_versions version_count where version_count.challenge_definition_id = definition.id and version_count.mode = 'flash' and version_count.status = 'published'),
            'archived', (select count(*) from private.challenge_versions version_count where version_count.challenge_definition_id = definition.id and version_count.mode = 'flash' and version_count.status = 'archived')
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
        where version.challenge_definition_id = definition.id and version.mode = 'flash'
        order by version.updated_at desc, version.id
        limit 1
      ) latest on true
    ), '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_challenge_detail(target_challenge_definition_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
                ) order by item.position
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
      where version.challenge_definition_id = definition.id and version.mode = 'flash'
    ), '[]'::jsonb)
  )
  into challenge_payload
  from private.challenge_definitions definition
  where definition.id = target_challenge_definition_id
    and exists (
      select 1
      from private.challenge_versions version
      where version.challenge_definition_id = definition.id and version.mode = 'flash'
    );

  return challenge_payload;
end;
$function$;

ALTER FUNCTION public.get_superadmin_challenge_catalog() OWNER TO postgres;
ALTER FUNCTION public.get_superadmin_challenge_detail(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_superadmin_challenge_catalog() FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.get_superadmin_challenge_detail(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_superadmin_challenge_catalog() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_superadmin_challenge_detail(uuid) TO authenticated;
