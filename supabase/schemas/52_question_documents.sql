-- Shared private question documents, also used by competitive validation.
set local check_function_bodies = off;

create or replace function private.question_version_document(target_question_version uuid)
returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'slug', definition.slug,
    'type', version.type,
    'payloadSchemaVersion', version.payload_schema_version,
    'timeLimitMs', version.time_limit_ms,
        'difficulty', version.difficulty,
    'publicPayload', version.public_payload,
    'solutionPayload', solution.solution_payload
  )
  from private.question_versions version
  join private.question_definitions definition on definition.id = version.question_definition_id
  join private.question_version_solutions solution on solution.question_version_id = version.id
  where version.id = target_question_version;
$$;
alter function private.question_version_document(uuid) owner to postgres;
revoke all on function private.question_version_document(uuid) from public, anon, authenticated, service_role;
