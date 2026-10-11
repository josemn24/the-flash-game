SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.publish_flash_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  key text;
  reason_value text;
  expected_updated_at timestamptz;
  challenge_version_id_value uuid;
  safe_input jsonb;
  cached private.command_requests%rowtype;
  challenge_row private.challenge_versions%rowtype;
  definition_row private.challenge_definitions%rowtype;
  item_row private.challenge_items%rowtype;
  question_row private.question_versions%rowtype;
  result jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey', 'challengeVersionId', 'expectedUpdatedAt', 'reason']
    or exists (select 1 from jsonb_object_keys(input) key_name where key_name <> all(array['idempotencyKey', 'challengeVersionId', 'expectedUpdatedAt', 'reason']))
    or input->'idempotencyKey' is null or input->'challengeVersionId' is null
    or input->'expectedUpdatedAt' is null or input->'reason' is null then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  key := btrim(input->>'idempotencyKey');
  reason_value := btrim(input->>'reason');
  begin
    challenge_version_id_value := (input->>'challengeVersionId')::uuid;
    expected_updated_at := (input->>'expectedUpdatedAt')::timestamptz;
  exception when others then
    raise exception 'invalid_command' using errcode = '22023';
  end;
  if char_length(key) not between 8 and 160 or char_length(reason_value) not between 1 and 500 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  safe_input := jsonb_build_object(
    'idempotencyKey', key, 'challengeVersionId', challenge_version_id_value,
    'expectedUpdatedAt', expected_updated_at, 'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('superadmin-editorial-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'publish_flash' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select * into challenge_row from private.challenge_versions version
  where version.id = challenge_version_id_value for update;
  if not found then raise exception 'content_not_found' using errcode = 'P0002'; end if;
  if challenge_row.status = 'published' then raise exception 'content_already_published' using errcode = '55000'; end if;
  if challenge_row.status <> 'draft' then raise exception 'content_not_draft' using errcode = '55000'; end if;
  if challenge_row.updated_at <> expected_updated_at then raise exception 'content_conflict' using errcode = '40001'; end if;
  select * into definition_row from private.challenge_definitions definition
  where definition.id = challenge_row.challenge_definition_id for update;
  if (select count(*) from private.challenge_items item where item.challenge_version_id = challenge_version_id_value)
    not between 2 and 20 then
    raise exception 'incomplete_content' using errcode = '22023';
  end if;
  if (select coalesce(sum(item.points), 0) from private.challenge_items item where item.challenge_version_id = challenge_version_id_value) <> 100 then
    raise exception 'points_total_invalid' using errcode = '22023';
  end if;
  if challenge_row.mode = 'survival' and (
    (select count(*) from jsonb_object_keys(challenge_row.mode_config)) <> 1
    or jsonb_typeof(challenge_row.mode_config->'lives') is distinct from 'number'
    or (challenge_row.mode_config->>'lives')::numeric <> trunc((challenge_row.mode_config->>'lives')::numeric)
    or (challenge_row.mode_config->>'lives')::integer not between 1 and (
      select count(*)::integer from private.challenge_items item
      where item.challenge_version_id = challenge_version_id_value
    )
  ) then
    raise exception 'invalid_content' using errcode = '22023';
  end if;
  if challenge_row.mode = 'pyramid' and (
    challenge_row.mode_config <> '{}'::jsonb
    or (select count(*) from private.challenge_items item
      where item.challenge_version_id = challenge_version_id_value) <> 7
    or (select count(distinct item.mode_config->>'levelId') from private.challenge_items item
      where item.challenge_version_id = challenge_version_id_value) <> 7
    or exists (select 1 from private.challenge_items item
      where item.challenge_version_id = challenge_version_id_value
        and (item.position not between 1 and 7
          or not private.is_valid_pyramid_level_config(item.mode_config)))
  ) then
    raise exception 'invalid_content' using errcode = '22023';
  end if;

  for item_row in
    select item.* from private.challenge_items item
    where item.challenge_version_id = challenge_version_id_value
    order by item.position for update
  loop
    select * into question_row from private.question_versions version
    where version.id = item_row.question_version_id for update;
    if question_row.status <> 'published' or not exists (
      select 1 from private.question_version_solutions solution
      where solution.question_version_id = question_row.id
    ) then
      raise exception 'question_not_published' using errcode = '55000';
    end if;
    if challenge_row.mode in ('flash', 'survival', 'narrative', 'pyramid')
      and not private.is_supported_flash_question(question_row.id) then
      raise exception 'unsupported_question' using errcode = '22023';
    end if;
  end loop;
  update private.challenge_versions version
  set status = 'published'
  where version.id = challenge_version_id_value
  returning jsonb_build_object(
    'challengeDefinitionId', definition_row.id,
    'challengeVersionId', version.id,
    'versionNumber', version.version_number,
    'status', version.status,
    'slug', definition_row.slug,
    'title', version.title,
    'subtitle', version.subtitle,
    'description', version.description,
    'mode', version.mode,
    'questionCount', (select count(*) from private.challenge_items item where item.challenge_version_id = version.id),
    'createdAt', version.created_at,
    'updatedAt', version.updated_at,
    'publishedAt', version.published_at,
    'document', null
  ) into result;
  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload
  ) values (
    actor, 'publish_flash', 'challenge_version', challenge_version_id_value, reason_value, key,
    jsonb_build_object('status', 'draft', 'slug', definition_row.slug),
    jsonb_build_object(
      'status', 'published',
      'slug', definition_row.slug,
      'questionCount', (select count(*) from private.challenge_items item where item.challenge_version_id = challenge_version_id_value),
      'maxScore', challenge_row.max_score
    )
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'publish_flash', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.validate_flash_editorial_document (
  document jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  challenge jsonb;
  question jsonb;
  question_slug text;
  seen_slugs text[] := array[]::text[];
  question_index integer;
  question_points numeric;
  total_points integer := 0;
  seen_question_versions text[] := array[]::text[];
  seen_level_ids text[] := array[]::text[];
begin
  if document is null or jsonb_typeof(document) is distinct from 'object'
    or not document ?& array['challenge', 'questions']
    or exists (
      select 1 from jsonb_object_keys(document) key_name
      where key_name <> all(array['challenge', 'questions'])
    ) then
    raise exception 'invalid_content' using errcode = '22023';
  end if;

  challenge := document->'challenge';
  if jsonb_typeof(challenge) is distinct from 'object'
    or not challenge ?& array['slug', 'title', 'subtitle', 'description', 'mode', 'configSchemaVersion', 'modeConfig']
    or exists (
      select 1 from jsonb_object_keys(challenge) key_name
      where key_name <> all(array['slug', 'title', 'subtitle', 'description', 'mode', 'configSchemaVersion', 'modeConfig', 'globalTimeLimitMs'])
    )
    or jsonb_typeof(challenge->'slug') is distinct from 'string'
    or char_length(btrim(challenge->>'slug')) not between 1 and 120
    or jsonb_typeof(challenge->'title') is distinct from 'string'
    or char_length(btrim(challenge->>'title')) not between 1 and 200
    or jsonb_typeof(challenge->'subtitle') is distinct from 'string'
    or char_length(challenge->>'subtitle') > 300
    or jsonb_typeof(challenge->'description') is distinct from 'string'
    or char_length(challenge->>'description') > 2000
    or challenge->>'mode' not in ('flash', 'alphabet', 'survival', 'narrative', 'pyramid')
    or challenge->'configSchemaVersion' <> '1'::jsonb
    or jsonb_typeof(challenge->'modeConfig') is distinct from 'object'
    or (challenge->>'mode' = 'alphabet' and (
      jsonb_typeof(challenge->'globalTimeLimitMs') is distinct from 'number'
      or (challenge->>'globalTimeLimitMs')::numeric <> trunc((challenge->>'globalTimeLimitMs')::numeric)
      or (challenge->>'globalTimeLimitMs')::integer <= 0
    ))
    or (challenge->>'mode' <> 'alphabet' and challenge ? 'globalTimeLimitMs')
    or (challenge->>'mode' = 'survival' and (
      (select count(*) from jsonb_object_keys(challenge->'modeConfig')) <> 1
      or jsonb_typeof(challenge->'modeConfig'->'lives') is distinct from 'number'
      or (challenge->'modeConfig'->>'lives')::numeric <> trunc((challenge->'modeConfig'->>'lives')::numeric)
      or (challenge->'modeConfig'->>'lives')::integer not between 1 and 20
    ))
    or (challenge->>'mode' = 'pyramid' and challenge->'modeConfig' <> '{}'::jsonb) then
    raise exception 'invalid_content' using errcode = '22023';
  end if;

  if jsonb_typeof(document->'questions') is distinct from 'array'
    or (challenge->>'mode' = 'pyramid' and jsonb_array_length(document->'questions') <> 7)
    or (challenge->>'mode' <> 'pyramid' and jsonb_array_length(document->'questions') not between 2 and 20) then
    raise exception 'incomplete_content' using errcode = '22023';
  end if;

  if challenge->>'mode' = 'survival'
    and (challenge->'modeConfig'->>'lives')::integer > jsonb_array_length(document->'questions') then
    raise exception 'invalid_content' using errcode = '22023';
  end if;

  for question, question_index in
    select value, ordinality::integer
    from jsonb_array_elements(document->'questions') with ordinality
  loop
    if challenge->>'mode' = 'pyramid' then
      if not private.is_valid_pyramid_level_config(question->'modeConfig') then
        raise exception 'invalid_content' using errcode = '22023';
      end if;
      if question->'modeConfig'->>'levelId' = any(seen_level_ids) then
        raise exception 'invalid_content' using errcode = '22023';
      end if;
      seen_level_ids := seen_level_ids || (question->'modeConfig'->>'levelId');
    end if;
    if jsonb_typeof(question) = 'object' and question->>'source' = 'library' then
      if exists (
          select 1 from jsonb_object_keys(question) key_name
          where key_name <> all(array['source', 'questionVersionId', 'points', 'modeConfig', 'challengeItemId'])
        )
        or not question ?& array['source', 'questionVersionId', 'points', 'modeConfig']
        or jsonb_typeof(question->'questionVersionId') is distinct from 'string'
        or question->>'questionVersionId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or jsonb_typeof(question->'points') is distinct from 'number'
        or (question->>'points')::numeric <> trunc((question->>'points')::numeric)
        or (question->>'points')::integer <= 0
        or (question->>'points')::integer > 100
        or jsonb_typeof(question->'modeConfig') is distinct from 'object'
        or (question ? 'challengeItemId' and (
          jsonb_typeof(question->'challengeItemId') is distinct from 'string'
          or question->>'challengeItemId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        ))
        or question->>'questionVersionId' = any(seen_question_versions) then
        raise exception 'invalid_question_reference' using errcode = '22023';
      end if;
      seen_question_versions := seen_question_versions || (question->>'questionVersionId');
      if challenge->>'mode' in ('survival', 'pyramid') and not exists (
        select 1 from private.question_versions supported
        where supported.id = (question->>'questionVersionId')::uuid
          and private.is_supported_flash_question(supported.id)
      ) then
        raise exception 'unsupported_question' using errcode = '22023';
      end if;
      total_points := total_points + (question->>'points')::integer;
      continue;
    end if;
    if jsonb_typeof(question) is distinct from 'object'
      or not question ?& array['slug', 'type', 'payloadSchemaVersion', 'timeLimitMs', 'points', 'publicPayload', 'solutionPayload']
      or exists (
        select 1 from jsonb_object_keys(question) key_name
        where key_name <> all(array['slug', 'type', 'payloadSchemaVersion', 'timeLimitMs', 'points', 'publicPayload', 'solutionPayload', 'modeConfig'])
      )
      or (challenge->>'mode' = 'pyramid' and not private.is_valid_pyramid_level_config(question->'modeConfig'))
      or (challenge->>'mode' not in ('pyramid', 'narrative') and question ? 'modeConfig') then
      raise exception 'invalid_content' using errcode = '22023';
    end if;

    perform private.validate_flash_question_document(question - 'points' - 'modeConfig');
    question_slug := btrim(question->>'slug');
    if question_slug = any(seen_slugs) then
      raise exception 'invalid_content' using errcode = '22023';
    end if;
    if jsonb_typeof(question->'points') is distinct from 'number' then
      raise exception 'invalid_content' using errcode = '22023';
    end if;
    question_points := (question->>'points')::numeric;
    if question_points <> trunc(question_points)
      or question_points <= 0
      or question_points > 100 then
      raise exception 'invalid_content' using errcode = '22023';
    end if;
    total_points := total_points + question_points::integer;
    seen_slugs := seen_slugs || question_slug;
  end loop;
  if challenge->>'mode' = 'alphabet' then
    if exists (
      select 1 from jsonb_array_elements(document->'questions') question_row
      where question_row->>'source' <> 'library'
        or jsonb_typeof(question_row->'modeConfig') is distinct from 'object'
        or jsonb_typeof(question_row->'modeConfig'->'letter') is distinct from 'string'
        or char_length(question_row->'modeConfig'->>'letter') = 0
        or char_length(question_row->'modeConfig'->>'letter') > 4
        or question_row->'modeConfig'->>'letter' !~ '^[[:alpha:]]$'
        or not exists (
          select 1 from private.question_versions version
          where version.id = (question_row->>'questionVersionId')::uuid
            and version.status = 'published' and version.type = 'short-text'
        )
    ) then
      raise exception 'invalid_alphabet_item' using errcode = '22023';
    end if;
    if exists (
      select 1 from (
        select lower(question_row->'modeConfig'->>'letter') as letter
        from jsonb_array_elements(document->'questions') question_row
      ) letters group by letter having count(*) > 1
    ) then
      raise exception 'duplicate_alphabet_letter' using errcode = '22023';
    end if;
  end if;
  if total_points <> 100 then
    raise exception 'points_total_invalid' using errcode = '22023';
  end if;
end;
$function$;
