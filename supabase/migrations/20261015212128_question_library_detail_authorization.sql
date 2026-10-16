begin;

SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.question_version_detail (
  target_question_version uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

commit;
