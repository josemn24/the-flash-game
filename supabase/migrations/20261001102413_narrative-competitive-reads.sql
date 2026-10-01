SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.archive_challenge_version_command (
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
  challenge_version_id_value uuid;
  expected_updated_at timestamptz;
  safe_input jsonb;
  cached private.command_requests%rowtype;
  version_row private.challenge_versions%rowtype;
  definition_row private.challenge_definitions%rowtype;
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
    or exists (
      select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey', 'challengeVersionId', 'expectedUpdatedAt', 'reason'])
    )
    or exists (
      select 1 from unnest(array['idempotencyKey', 'challengeVersionId', 'expectedUpdatedAt', 'reason']) key_name
      where input->key_name is null or input->key_name = 'null'::jsonb
    ) then
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
    'idempotencyKey', key,
    'challengeVersionId', challenge_version_id_value,
    'expectedUpdatedAt', expected_updated_at,
    'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('superadmin-editorial-archive:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'archive_challenge_version' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select * into version_row
  from private.challenge_versions version
  where version.id = challenge_version_id_value
  for update;
  if not found then
    raise exception 'content_not_found' using errcode = 'P0002';
  end if;
  if version_row.mode not in ('flash', 'survival', 'narrative', 'pyramid') then
    raise exception 'unsupported_mode' using errcode = '22023';
  end if;
  if version_row.status <> 'published' then
    raise exception 'content_not_published' using errcode = '55000';
  end if;
  if version_row.updated_at <> expected_updated_at then
    raise exception 'content_conflict' using errcode = '40001';
  end if;
  select * into definition_row
  from private.challenge_definitions definition
  where definition.id = version_row.challenge_definition_id;

  update private.challenge_versions version
  set status = 'archived'
  where version.id = version_row.id;

  select jsonb_build_object(
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
    'document', null
  ) into result
  from private.challenge_definitions definition
  join private.challenge_versions version on version.challenge_definition_id = definition.id
  where version.id = version_row.id;

  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload
  ) values (
    actor, 'archive_challenge_version', 'challenge_version', version_row.id, reason_value, key,
    jsonb_build_object('status', 'published', 'versionNumber', version_row.version_number),
    jsonb_build_object('status', 'archived', 'versionNumber', version_row.version_number)
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'archive_challenge_version', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.create_challenge_revision_command (
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
  source_challenge_version_id uuid;
  target_challenge_version_id uuid := gen_random_uuid();
  safe_input jsonb;
  cached private.command_requests%rowtype;
  source_row private.challenge_versions%rowtype;
  definition_row private.challenge_definitions%rowtype;
  next_version integer;
  result jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey', 'sourceChallengeVersionId', 'reason']
    or exists (
      select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey', 'sourceChallengeVersionId', 'reason'])
    )
    or exists (
      select 1 from unnest(array['idempotencyKey', 'sourceChallengeVersionId', 'reason']) key_name
      where input->key_name is null or input->key_name = 'null'::jsonb
    ) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  key := btrim(input->>'idempotencyKey');
  reason_value := btrim(input->>'reason');
  begin
    source_challenge_version_id := (input->>'sourceChallengeVersionId')::uuid;
  exception when others then
    raise exception 'invalid_command' using errcode = '22023';
  end;
  if char_length(key) not between 8 and 160 or char_length(reason_value) not between 1 and 500 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  safe_input := jsonb_build_object(
    'idempotencyKey', key,
    'sourceChallengeVersionId', source_challenge_version_id,
    'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('superadmin-editorial-revision:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'create_challenge_revision' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select * into source_row
  from private.challenge_versions version
  where version.id = source_challenge_version_id
  for update;
  if not found then
    raise exception 'content_not_found' using errcode = 'P0002';
  end if;
  if source_row.status not in ('published', 'archived') then
    raise exception 'content_not_published' using errcode = '55000';
  end if;
  if source_row.mode not in ('flash', 'survival', 'narrative', 'pyramid') then
    raise exception 'unsupported_mode' using errcode = '22023';
  end if;

  -- The definition row serializes version-number allocation for all branches
  -- of the same challenge. The source row is already locked above, so an
  -- archive/publish race cannot change the graph being copied.
  select * into definition_row
  from private.challenge_definitions definition
  where definition.id = source_row.challenge_definition_id
  for update;
  if not found then
    raise exception 'content_not_found' using errcode = 'P0002';
  end if;
  select coalesce(max(version.version_number), 0) + 1 into next_version
  from private.challenge_versions version
  where version.challenge_definition_id = definition_row.id;

  insert into private.challenge_versions(
    id, challenge_definition_id, version_number, config_schema_version, status, mode,
    title, subtitle, description, global_time_limit_ms, max_score, mode_config,
    created_by_player_id
  ) values (
    target_challenge_version_id, definition_row.id, next_version, source_row.config_schema_version,
    'draft', source_row.mode, source_row.title, source_row.subtitle, source_row.description,
    source_row.global_time_limit_ms, source_row.max_score, source_row.mode_config, actor
  );

  insert into private.challenge_items(
    id, challenge_version_id, question_version_id, position, points,
    config_schema_version, mode_config
  )
  select
    gen_random_uuid(), target_challenge_version_id, item.question_version_id, item.position,
    item.points, item.config_schema_version, item.mode_config
  from private.challenge_items item
  where item.challenge_version_id = source_row.id
  order by item.position;

  select jsonb_build_object(
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
    'document', null
  ) into result
  from private.challenge_definitions definition
  join private.challenge_versions version on version.challenge_definition_id = definition.id
  where version.id = target_challenge_version_id;

  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload
  ) values (
    actor, 'create_challenge_revision', 'challenge_version', target_challenge_version_id,
    reason_value, key,
    jsonb_build_object(
      'sourceChallengeVersionId', source_row.id,
      'sourceVersionNumber', source_row.version_number,
      'sourceStatus', source_row.status
    ),
    jsonb_build_object(
      'challengeDefinitionId', definition_row.id,
      'challengeVersionId', target_challenge_version_id,
      'versionNumber', next_version,
      'status', 'draft',
      'questionCount', (select count(*) from private.challenge_items item where item.challenge_version_id = target_challenge_version_id)
    )
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'create_challenge_revision', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.read_evaluation_context (
  target_receipt uuid,
  session_token  text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare actor uuid := private.command_actor(); result jsonb;
begin
  select jsonb_build_object(
    'receiptId', r.id, 'answer', case when q.type = 'queens' then private.queens_answer(r.attempt_id, r.challenge_item_id) when q.type = 'word-search' then jsonb_build_object('foundWordIds', coalesce((
      select jsonb_agg(to_jsonb(e.matched_target_id) order by e.sequence)
      from private.word_search_selection_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id and e.correct
    ), '[]'::jsonb)) else r.answer end, 'receivedAt', r.received_at,
    'timeUsedMs', r.time_used_ms, 'timedOut', r.timed_out,
    'questionVersionId', q.id, 'questionType', q.type, 'payloadSchemaVersion', q.payload_schema_version,
    'publicPayload', q.public_payload,
    'submittedCodes', case when q.type = 'logic-code' then coalesce((
      select jsonb_agg(e.code order by e.sequence)
      from private.logic_code_attempt_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id
    ), '[]'::jsonb) else null end,
    'progressiveCluesRevealed', case when q.type = 'progressive-clues' then coalesce((
      select max(e.clue_index)::integer
      from private.progressive_clue_reveal_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id
    ), 1) else null end,
    'progressiveClueAvailablePoints', case when q.type = 'progressive-clues' then coalesce((
      select e.available_points
      from private.progressive_clue_reveal_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id
      order by e.clue_index desc
      limit 1
    ), i.points) else null end,
    'incorrectAttempts', case when q.type = 'logic-code' then coalesce((
      select count(*)::integer
      from private.logic_code_attempt_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id and not e.correct
    ), 0) when q.type = 'queens' then coalesce((
      select count(*)::integer
      from private.queens_validation_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id and not e.correct
    ), 0) + coalesce((
      select count(*)::integer
      from private.queens_placement_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id and e.penalty_applied
    ), 0) when q.type = 'word-search' then coalesce((
      select count(*)::integer from private.word_search_selection_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id and not e.correct
    ), 0) else null end,
    'solutionPayload', qs.solution_payload, 'timeLimitMs', q.time_limit_ms,
    'itemPoints', i.points, 'itemConfigSchemaVersion', i.config_schema_version,
    'itemConfig', i.mode_config, 'mode', cv.mode,
    'modeConfigSchemaVersion', cv.config_schema_version, 'modeConfig', cv.mode_config)
  into result from private.answer_receipts r
  join public.attempts a on a.id = r.attempt_id
  join private.attempt_sessions s on s.attempt_id = a.id
  join public.scheduled_challenges sc on sc.id = a.scheduled_challenge_id
  join public.seasons season on season.id = sc.season_id
  join public.rooms room on room.id = season.room_id
  join public.room_memberships m on m.room_id = room.id and m.player_id = actor
  join private.challenge_items i on i.id = r.challenge_item_id
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  join private.question_versions q on q.id = i.question_version_id
  join private.question_version_solutions qs on qs.question_version_id = q.id
  where r.id = target_receipt and a.player_id = actor and a.status = 'in_progress'
    and a.kind = 'competitive' and sc.status <> 'cancelled' and room.status = 'active'
    and m.status = 'active' and m.role in ('owner', 'admin', 'member')
    and s.revoked_at is null and s.session_token_hash = private.secret_hash(session_token)
    and not exists (select 1 from private.platform_role_assignments where player_id = actor);
  if result is null then raise exception 'not_authorized' using errcode = '42501'; end if;
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
          and supported.type <> 'short-text'
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

    if challenge->>'mode' = 'survival' and question->>'type' = 'short-text' then
      raise exception 'unsupported_question' using errcode = '22023';
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
  elsif exists (
    select 1
    from jsonb_array_elements(document->'questions') question_row
    where question_row->>'type' = 'short-text'
      or (question_row->>'source' = 'library' and exists (
        select 1 from private.question_versions version
        where version.id = (question_row->>'questionVersionId')::uuid
          and version.type = 'short-text'
      ))
  ) then
    raise exception 'short_text_requires_alphabet' using errcode = '22023';
  end if;
  if total_points <> 100 then
    raise exception 'points_total_invalid' using errcode = '22023';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_narrative_challenge (
  target_room_slug      text,
  target_publication_id uuid
)
  RETURNS TABLE (
    room_id                  uuid,
    room_slug                text,
    room_title               text,
    publication_id           uuid,
    publication_status       text,
    publication_opens_at     timestamp with time zone,
    publication_closes_at    timestamp with time zone,
    challenge_id             uuid,
    challenge_slug           text,
    challenge_version_id     uuid,
    challenge_title          text,
    challenge_subtitle       text,
    challenge_description    text,
    challenge_mode           text,
    challenge_max_score      integer,
    challenge_mode_config    jsonb,
    question_count           bigint,
    own_attempt_id           uuid,
    own_attempt_status       text,
    own_attempt_score        integer,
    own_attempt_started_at   timestamp with time zone,
    own_attempt_completed_at timestamp with time zone,
    own_attempt_deadline_at  timestamp with time zone,
    own_attempt_lock_version bigint,
    challenge_item_id        uuid,
    item_position            integer,
    item_mode_config         jsonb,
    question_version_id      uuid,
    question_slug            text,
    question_type            text,
    payload_schema_version   integer,
    time_limit_ms            integer,
    item_points              integer
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with viewer as (
    select private.current_player_id() as player_id
  ), authorized_publication as (
    select
      room.id as room_id,
      room.slug as room_slug,
      room.title as room_title,
      schedule.id as publication_id,
      schedule.status as publication_status,
      schedule.opens_at as publication_opens_at,
      schedule.closes_at as publication_closes_at,
      definition.id as challenge_id,
      definition.slug as challenge_slug,
      version.id as challenge_version_id,
      version.title as challenge_title,
      version.subtitle as challenge_subtitle,
      version.description as challenge_description,
      version.mode as challenge_mode,
      version.max_score as challenge_max_score,
      version.mode_config as challenge_mode_config,
      attempt.id as own_attempt_id,
      attempt.status as own_attempt_status,
      attempt.score as own_attempt_score,
      attempt.started_at as own_attempt_started_at,
      attempt.completed_at as own_attempt_completed_at,
      attempt.deadline_at as own_attempt_deadline_at,
      attempt.lock_version as own_attempt_lock_version
    from public.rooms room
    join public.room_memberships membership on membership.room_id = room.id
    join public.seasons season on season.room_id = room.id and season.status in ('active', 'finished')
    join public.scheduled_challenges schedule on schedule.season_id = season.id
    join private.challenge_versions version on version.id = schedule.challenge_version_id
    join private.challenge_definitions definition on definition.id = version.challenge_definition_id
    cross join viewer
    left join public.attempts attempt on attempt.scheduled_challenge_id = schedule.id
      and attempt.player_id = viewer.player_id and attempt.kind = 'competitive'
    where room.slug = target_room_slug
      and schedule.id = target_publication_id
      and room.status = 'active'
      and membership.player_id = viewer.player_id
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'member')
      and (
        private.publication_is_effectively_open(
          schedule.status, season.status, season.starts_at, season.ends_at,
          schedule.opens_at, schedule.closes_at, statement_timestamp()
        )
        or attempt.id is not null
      )
      and version.status in ('published', 'archived')
      and version.mode = 'narrative'
      and jsonb_typeof(version.mode_config->'prologue') = 'object'
      and jsonb_typeof(version.mode_config->'beats') = 'array'
  )
  select
    publication.room_id,
    publication.room_slug,
    publication.room_title,
    publication.publication_id,
    publication.publication_status,
    publication.publication_opens_at,
    publication.publication_closes_at,
    publication.challenge_id,
    publication.challenge_slug,
    publication.challenge_version_id,
    publication.challenge_title,
    publication.challenge_subtitle,
    publication.challenge_description,
    publication.challenge_mode,
    publication.challenge_max_score,
    publication.challenge_mode_config,
    count(item.id) over (partition by publication.challenge_version_id),
    publication.own_attempt_id,
    publication.own_attempt_status,
    publication.own_attempt_score,
    publication.own_attempt_started_at,
    publication.own_attempt_completed_at,
    publication.own_attempt_deadline_at,
    publication.own_attempt_lock_version,
    item.id,
    item.position,
    item.mode_config,
    question.id,
    definition.slug,
    question.type,
    question.payload_schema_version,
    question.time_limit_ms,
    item.points
  from authorized_publication publication
  join private.challenge_items item on item.challenge_version_id = publication.challenge_version_id
  join private.question_versions question on question.id = item.question_version_id
  join private.question_definitions definition on definition.id = question.question_definition_id
  where question.status = 'published'
  order by item.position
$function$;

REVOKE ALL ON FUNCTION "public"."get_my_narrative_challenge"(text, uuid) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.get_my_narrative_result (
  target_attempt_id uuid
)
  RETURNS TABLE (
    attempt_id             uuid,
    scheduled_challenge_id uuid,
    challenge_item_id      uuid,
    item_position          integer,
    question_version_id    uuid,
    question_type          text,
    payload_schema_version integer,
    public_payload         jsonb,
    solution_payload       jsonb,
    answer                 jsonb,
    answer_status          text,
    points                 integer,
    result_details         jsonb,
    presented_at           timestamp with time zone,
    submitted_at           timestamp with time zone,
    time_used_ms           bigint,
    attempt_status         text,
    attempt_score          integer,
    attempt_started_at     timestamp with time zone,
    attempt_completed_at   timestamp with time zone,
    attempt_lock_version   bigint,
    challenge_title        text,
    challenge_subtitle     text,
    challenge_description  text,
    challenge_max_score    integer
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select
    attempt.id,
    attempt.scheduled_challenge_id,
    item.id,
    item.position,
    question.id,
    question.type,
    question.payload_schema_version,
    question.public_payload,
    solution.solution_payload,
    answer.answer,
    answer.status,
    coalesce(answer.points, 0),
    answer.result_details,
    answer.presented_at,
    answer.submitted_at,
    coalesce(answer.time_used_ms, 0),
    attempt.status,
    attempt.score,
    attempt.started_at,
    attempt.completed_at,
    attempt.lock_version,
    version.title,
    version.subtitle,
    version.description,
    version.max_score
  from public.attempts attempt
  join public.scheduled_challenges schedule on schedule.id = attempt.scheduled_challenge_id
  join public.seasons season on season.id = schedule.season_id
  join public.rooms room on room.id = season.room_id
  join public.room_memberships membership on membership.room_id = room.id
  join private.challenge_versions version on version.id = attempt.challenge_version_id
  join private.challenge_items item on item.challenge_version_id = version.id
  join private.question_versions question on question.id = item.question_version_id
  join private.question_version_solutions solution on solution.question_version_id = question.id
  left join private.attempt_answers answer
    on answer.attempt_id = attempt.id and answer.challenge_item_id = item.id
  where attempt.id = target_attempt_id
    and attempt.player_id = private.current_player_id()
    and attempt.kind = 'competitive'
    and attempt.status = 'completed'
    and version.mode = 'narrative'
    and room.status = 'active'
    and membership.player_id = private.current_player_id()
    and membership.status = 'active'
    and membership.role in ('owner', 'admin', 'member')
  order by item.position
$function$;

REVOKE ALL ON FUNCTION "public"."get_my_narrative_result"(uuid) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.get_my_room_cards()
  RETURNS TABLE (
    room_id              uuid,
    room_slug            text,
    room_title           text,
    room_description     text,
    membership_role      text,
    season_id            uuid,
    season_title         text,
    season_status        text,
    season_starts_at     timestamp with time zone,
    season_ends_at       timestamp with time zone,
    publication_id       uuid,
    publication_status   text,
    opens_at             timestamp with time zone,
    closes_at            timestamp with time zone,
    challenge_title      text,
    challenge_subtitle   text,
    challenge_mode       text,
    challenge_max_score  integer,
    question_count       bigint,
    competitive_playable boolean,
    member_count         bigint,
    member_previews      jsonb,
    current_flash_points bigint,
    current_position     bigint
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with current_player as (
    select private.current_player_id() as player_id
  ), accessible_rooms as (
    select r.id, r.slug, r.title, r.description, m.role
    from public.rooms r
    join public.room_memberships m on m.room_id = r.id
    cross join current_player viewer
    where m.player_id = viewer.player_id
      and m.status = 'active'
      and r.status = 'active'
  )
  select
    r.id,
    r.slug,
    r.title,
    r.description,
    r.role,
    season.id,
    season.title,
    season.status,
    season.starts_at,
    season.ends_at,
    publication.id,
    publication.status,
    publication.opens_at,
    publication.closes_at,
    publication.challenge_title,
    publication.challenge_subtitle,
    publication.challenge_mode,
    publication.challenge_max_score,
    publication.question_count,
    publication.competitive_playable,
    (select count(*)::bigint
       from public.room_memberships active_members
      where active_members.room_id = r.id and active_members.status = 'active'),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'name', p.display_name,
          'avatarPath', p.avatar_path,
          'role', active_members.role
        ) order by active_members.joined_at, p.id
      )
      from public.room_memberships active_members
      join public.players p on p.id = active_members.player_id
      where active_members.room_id = r.id
        and active_members.status = 'active'
        and p.status = 'active'
    ), '[]'::jsonb),
    coalesce((
      select sum(entries.amount)::bigint
      from private.flash_point_entries entries
      where entries.player_id = (select player_id from current_player)
        and entries.season_id = season.id
    ), 0::bigint),
    (
      select ranking."position"
      from public.get_season_ranking(season.id) ranking
      where ranking.player_id = (select player_id from current_player)
    )
  from accessible_rooms r
  left join lateral (
    select s.id, s.title, s.status, s.starts_at, s.ends_at
    from public.seasons s
    where s.room_id = r.id
      and s.status = 'active'
    order by s.starts_at desc, s.id
    limit 1
  ) season on true
  left join lateral (
    select
      sc.id,
      sc.status,
      sc.opens_at,
      sc.closes_at,
      cv.title as challenge_title,
      cv.subtitle as challenge_subtitle,
      cv.mode as challenge_mode,
      cv.max_score as challenge_max_score,
      (
        select count(*)::bigint
        from private.challenge_items items
        where items.challenge_version_id = cv.id
      ) as question_count,
      (
        select (count(*) between 2 and 20 and cv.mode in ('flash', 'survival', 'narrative')
            or count(*) = 7 and cv.mode = 'pyramid')
          and bool_and(private.is_supported_flash_question(q.id))
          and (cv.mode = 'flash' and cv.mode_config = '{}'::jsonb
            or cv.mode = 'survival'
              and jsonb_typeof(cv.mode_config->'lives') = 'number'
              and (cv.mode_config->>'lives')::integer between 1 and count(*)
              and (select count(*) from jsonb_object_keys(cv.mode_config)) = 1
            or cv.mode = 'pyramid' and cv.mode_config = '{}'::jsonb
              and bool_and(private.is_valid_pyramid_level_config(items.mode_config))
              and count(distinct items.mode_config->>'levelId') = 7
            or cv.mode = 'narrative'
              and jsonb_typeof(cv.mode_config->'prologue') = 'object'
              and jsonb_typeof(cv.mode_config->'beats') = 'array')
        from private.challenge_items items
        join private.question_versions q on q.id = items.question_version_id
        where items.challenge_version_id = cv.id
      ) as competitive_playable
    from public.scheduled_challenges sc
    join private.challenge_versions cv on cv.id = sc.challenge_version_id
    where sc.season_id = season.id
      and private.publication_is_effectively_open(
        sc.status, season.status, season.starts_at, season.ends_at,
        sc.opens_at, sc.closes_at, statement_timestamp()
      )
      and cv.status in ('published', 'archived')
    order by sc.number
    limit 1
  ) publication on true
  order by r.title, r.id
$function$;

CREATE OR REPLACE FUNCTION public.get_room_history (
  target_room_slug      text,
  target_publication_id uuid DEFAULT NULL::uuid
)
  RETURNS TABLE (
    room_id               uuid,
    room_slug             text,
    room_title            text,
    viewer_role           text,
    season_id             uuid,
    season_title          text,
    publication_id        uuid,
    publication_number    integer,
    publication_status    text,
    publication_opens_at  timestamp with time zone,
    publication_closes_at timestamp with time zone,
    challenge_id          uuid,
    challenge_slug        text,
    challenge_version_id  uuid,
    challenge_title       text,
    challenge_subtitle    text,
    challenge_description text,
    challenge_mode        text,
    challenge_max_score   integer,
    question_count        bigint,
    played_at             timestamp with time zone,
    player_count          bigint,
    player_id             uuid,
    display_name          text,
    avatar_path           text,
    flash_points          bigint,
    duration_ms           bigint,
    started_at            timestamp with time zone,
    "position"            bigint
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with viewer as (
    select p.id as player_id, m.role as viewer_role
    from public.rooms r
    join public.room_memberships m on m.room_id = r.id
    join public.players p on p.id = private.current_player_id()
      and p.id = m.player_id
    where r.slug = target_room_slug
      and r.status = 'active'
      and m.status = 'active'
  ), eligible_publications as (
    select
      r.id as room_id,
      r.slug as room_slug,
      r.title as room_title,
      v.viewer_role,
      s.id as season_id,
      s.title as season_title,
      sc.id as publication_id,
      sc.number as publication_number,
      sc.status as publication_status,
      sc.opens_at as publication_opens_at,
      sc.closes_at as publication_closes_at,
      cd.id as challenge_id,
      cd.slug as challenge_slug,
      cv.id as challenge_version_id,
      cv.title as challenge_title,
      cv.subtitle as challenge_subtitle,
      cv.description as challenge_description,
      cv.mode as challenge_mode,
      cv.max_score as challenge_max_score,
      (select count(*)::bigint
         from private.challenge_items i
        where i.challenge_version_id = cv.id) as question_count,
      coalesce((
        select max(a.completed_at)
        from public.attempts a
        where a.scheduled_challenge_id = sc.id
          and a.kind = 'competitive'
          and a.status in ('completed', 'abandoned')
      ), sc.closes_at) as played_at,
      coalesce((
        select count(distinct a.player_id)::bigint
        from public.attempts a
        where a.scheduled_challenge_id = sc.id
          and a.kind = 'competitive'
          and a.status in ('completed', 'abandoned')
      ), 0::bigint) as player_count
    from public.rooms r
    join public.seasons s on s.room_id = r.id and s.status <> 'draft'
    join public.scheduled_challenges sc on sc.season_id = s.id
    join private.challenge_versions cv on cv.id = sc.challenge_version_id
    join private.challenge_definitions cd on cd.id = cv.challenge_definition_id
    cross join viewer v
    where r.slug = target_room_slug
      and sc.id = coalesce(target_publication_id, sc.id)
      and sc.status = 'closed'
      and cv.mode in ('flash', 'survival', 'pyramid')
      and cv.status in ('published', 'archived')
      and not exists (
        select 1 from public.attempts in_progress
        where in_progress.scheduled_challenge_id = sc.id
          and in_progress.status = 'in_progress'
      )
  ), ranked_results as (
    select
      e.scheduled_challenge_id as publication_id,
      e.player_id,
      p.display_name,
      p.avatar_path,
      e.flash_points,
      e.duration_ms,
      e.started_at,
      rank() over (
        partition by e.scheduled_challenge_id
        order by e.flash_points desc, e.duration_ms, e.started_at
      ) as "position"
    from private.effective_results e
    join eligible_publications h on h.publication_id = e.scheduled_challenge_id
    join public.players p on p.id = e.player_id
  )
  select
    h.room_id, h.room_slug, h.room_title, h.viewer_role,
    h.season_id, h.season_title, h.publication_id, h.publication_number,
    h.publication_status, h.publication_opens_at, h.publication_closes_at,
    h.challenge_id, h.challenge_slug, h.challenge_version_id, h.challenge_title,
    h.challenge_subtitle, h.challenge_description, h.challenge_mode,
    h.challenge_max_score, h.question_count, h.played_at, h.player_count,
    r.player_id, r.display_name, r.avatar_path, r.flash_points, r.duration_ms,
    r.started_at, r."position"
  from eligible_publications h
  left join ranked_results r on r.publication_id = h.publication_id
  order by h.played_at desc, h.publication_number desc, h.publication_id,
    r."position" nulls last, r.player_id
$function$;

CREATE OR REPLACE FUNCTION public.get_room_introduction (
  target_room_slug      text,
  target_publication_id uuid
)
  RETURNS TABLE (
    room_id              uuid,
    room_slug            text,
    room_title           text,
    membership_role      text,
    publication_id       uuid,
    publication_status   text,
    opens_at             timestamp with time zone,
    closes_at            timestamp with time zone,
    challenge_title      text,
    challenge_subtitle   text,
    challenge_mode       text,
    challenge_max_score  integer,
    question_count       bigint,
    competitive_playable boolean,
    availability_status  text,
    can_start            boolean
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select
    room.id,
    room.slug,
    room.title,
    membership.role,
    schedule.id,
    schedule.status,
    schedule.opens_at,
    schedule.closes_at,
    version.title,
    version.subtitle,
    version.mode,
    version.max_score,
    (select count(*)::bigint from private.challenge_items item where item.challenge_version_id = version.id),
    (select (count(*) between 2 and 20 and version.mode in ('flash', 'survival', 'narrative')
          or count(*) = 7 and version.mode = 'pyramid')
        and bool_and(private.is_supported_flash_question(question.id))
        and (version.mode = 'flash' and version.mode_config = '{}'::jsonb
          or version.mode = 'survival'
            and jsonb_typeof(version.mode_config->'lives') = 'number'
            and (version.mode_config->>'lives')::integer between 1 and count(*)
            and (select count(*) from jsonb_object_keys(version.mode_config)) = 1
          or version.mode = 'pyramid' and version.mode_config = '{}'::jsonb
            and bool_and(private.is_valid_pyramid_level_config(item.mode_config))
            and count(distinct item.mode_config->>'levelId') = 7
          or version.mode = 'narrative'
            and jsonb_typeof(version.mode_config->'prologue') = 'object'
            and jsonb_typeof(version.mode_config->'beats') = 'array')
       from private.challenge_items item
       join private.question_versions question on question.id = item.question_version_id
      where item.challenge_version_id = version.id),
    private.publication_effective_status(
      schedule.status, season.status, season.starts_at, season.ends_at,
      schedule.opens_at, schedule.closes_at, statement_timestamp()
    ),
    membership.role <> 'spectator' and private.publication_is_effectively_open(
      schedule.status, season.status, season.starts_at, season.ends_at,
      schedule.opens_at, schedule.closes_at, statement_timestamp()
    )
  from public.rooms room
  join public.room_memberships membership on membership.room_id = room.id
  join public.seasons season on season.room_id = room.id and season.status in ('active', 'finished')
  join public.scheduled_challenges schedule on schedule.season_id = season.id
  join private.challenge_versions version on version.id = schedule.challenge_version_id
  where room.slug = target_room_slug
    and schedule.id = target_publication_id
    and room.status = 'active'
    and membership.player_id = private.current_player_id()
    and membership.status = 'active'
    and version.status in ('published', 'archived')
  order by season.starts_at desc, schedule.number
$function$;

CREATE OR REPLACE FUNCTION public.get_room_member_review (
  target_room_slug      text,
  target_publication_id uuid,
  target_player_id      uuid
)
  RETURNS TABLE (
    room_id                uuid,
    room_slug              text,
    room_title             text,
    viewer_role            text,
    season_id              uuid,
    season_title           text,
    publication_id         uuid,
    publication_status     text,
    publication_closes_at  timestamp with time zone,
    challenge_id           uuid,
    challenge_slug         text,
    challenge_version_id   uuid,
    challenge_title        text,
    challenge_subtitle     text,
    challenge_description  text,
    challenge_mode         text,
    challenge_max_score    integer,
    question_count         bigint,
    initial_lives          integer,
    player_id              uuid,
    display_name           text,
    avatar_path            text,
    attempt_id             uuid,
    attempt_status         text,
    attempt_score          integer,
    attempt_outcome        text,
    attempt_started_at     timestamp with time zone,
    attempt_completed_at   timestamp with time zone,
    attempt_duration_ms    bigint,
    attempt_lock_version   bigint,
    challenge_item_id      uuid,
    item_position          integer,
    question_version_id    uuid,
    question_type          text,
    payload_schema_version integer,
    time_limit_ms          integer,
    public_payload         jsonb,
    solution_payload       jsonb,
    answer                 jsonb,
    answer_status          text,
    points                 integer,
    result_details         jsonb,
    presented_at           timestamp with time zone,
    submitted_at           timestamp with time zone,
    time_used_ms           bigint,
    item_points            integer,
    has_persisted_answer   boolean,
    level_id               text,
    level_label            text,
    briefing_title         text,
    briefing_format        text,
    briefing_description   text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with viewer as (
    select p.id as player_id, m.role as viewer_role, r.id as room_id
    from public.rooms r
    join public.room_memberships m on m.room_id = r.id
    join public.players p on p.id = private.current_player_id()
      and p.id = m.player_id
    where r.slug = target_room_slug
      and r.status = 'active'
      and m.status = 'active'
  ), authorized_attempt as (
    select
      r.id as room_id,
      r.slug as room_slug,
      r.title as room_title,
      v.viewer_role,
      s.id as season_id,
      s.title as season_title,
      sc.id as publication_id,
      sc.status as publication_status,
      sc.closes_at as publication_closes_at,
      cd.id as challenge_id,
      cd.slug as challenge_slug,
      cv.id as challenge_version_id,
      cv.title as challenge_title,
      cv.subtitle as challenge_subtitle,
      cv.description as challenge_description,
      cv.mode as challenge_mode,
      cv.max_score as challenge_max_score,
      (select count(*)::bigint from private.challenge_items item
        where item.challenge_version_id = cv.id) as question_count,
      case when cv.mode = 'survival' then (cv.mode_config->>'lives')::integer end as initial_lives,
      a.id as attempt_id,
      a.status as attempt_status,
      a.score as attempt_score,
      a.outcome as attempt_outcome,
      a.started_at as attempt_started_at,
      a.completed_at as attempt_completed_at,
      (extract(epoch from (coalesce(a.completed_at, a.started_at) - a.started_at)) * 1000)::bigint
        as attempt_duration_ms,
      a.lock_version as attempt_lock_version,
      v.player_id as viewer_player_id
    from viewer v
    join public.rooms r on r.id = v.room_id
    join public.seasons s on s.room_id = r.id and s.status <> 'draft'
    join public.scheduled_challenges sc on sc.id = target_publication_id
      and sc.season_id = s.id
    join private.challenge_versions cv on cv.id = sc.challenge_version_id
    join private.challenge_definitions cd on cd.id = cv.challenge_definition_id
    join public.attempts a on a.scheduled_challenge_id = sc.id
      and a.player_id = target_player_id
      and a.kind = 'competitive'
      and a.status in ('completed', 'abandoned')
    where cv.mode in ('flash', 'survival', 'pyramid')
      and v.viewer_role in ('owner', 'admin', 'member')
      and cv.status in ('published', 'archived')
      and exists (
        select 1 from public.room_memberships historical_membership
        where historical_membership.room_id = r.id
          and historical_membership.player_id = target_player_id
      )
      and (
        (
          target_player_id = v.player_id
          and sc.status in ('open', 'closed')
        )
        or (
          target_player_id <> v.player_id
          and v.viewer_role in ('owner', 'admin', 'member')
          and sc.status = 'closed'
          and not exists (
            select 1 from public.attempts in_progress
            where in_progress.scheduled_challenge_id = sc.id
              and in_progress.status = 'in_progress'
          )
        )
      )
  )
  select
    a.room_id, a.room_slug, a.room_title, a.viewer_role,
    a.season_id, a.season_title, a.publication_id, a.publication_status,
    a.publication_closes_at,
    a.challenge_id, a.challenge_slug, a.challenge_version_id, a.challenge_title,
    a.challenge_subtitle, a.challenge_description, a.challenge_mode,
    a.challenge_max_score, a.question_count, a.initial_lives, target_player_id,
    p.display_name, p.avatar_path,
    a.attempt_id, a.attempt_status, a.attempt_score, a.attempt_outcome,
    a.attempt_started_at, a.attempt_completed_at, a.attempt_duration_ms,
    a.attempt_lock_version, i.id, i.position,
    q.id, q.type, q.payload_schema_version, q.time_limit_ms,
    case when a.challenge_mode = 'pyramid' and aa.id is null then null else q.public_payload end,
    case when a.challenge_mode = 'pyramid' and aa.id is null then null else qs.solution_payload end,
    aa.answer, aa.status, aa.points, aa.result_details, aa.presented_at,
    aa.submitted_at, aa.time_used_ms, i.points, aa.id is not null,
    case when a.challenge_mode = 'pyramid' then i.mode_config->>'levelId' end,
    case when a.challenge_mode = 'pyramid' then i.mode_config->>'label' end,
    case when a.challenge_mode = 'pyramid' then i.mode_config->'briefing'->>'title' end,
    case when a.challenge_mode = 'pyramid' then i.mode_config->'briefing'->>'format' end,
    case when a.challenge_mode = 'pyramid' then i.mode_config->'briefing'->>'description' end
  from authorized_attempt a
  join public.players p on p.id = target_player_id
  join private.challenge_items i on i.challenge_version_id = a.challenge_version_id
  join private.question_versions q on q.id = i.question_version_id
  join private.question_version_solutions qs on qs.question_version_id = q.id
  left join private.attempt_answers aa on aa.attempt_id = a.attempt_id
    and aa.challenge_item_id = i.id
  where a.challenge_mode <> 'survival' or aa.id is not null
  order by i.position
$function$;

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
            where version_count.challenge_definition_id = definition.id and version_count.mode in ('flash', 'survival', 'narrative', 'pyramid')
          ),
          'status', latest.status,
          'statusCounts', jsonb_build_object(
            'draft', (select count(*) from private.challenge_versions version_count where version_count.challenge_definition_id = definition.id and version_count.mode in ('flash', 'survival', 'narrative', 'pyramid') and version_count.status = 'draft'),
            'published', (select count(*) from private.challenge_versions version_count where version_count.challenge_definition_id = definition.id and version_count.mode in ('flash', 'survival', 'narrative', 'pyramid') and version_count.status = 'published'),
            'archived', (select count(*) from private.challenge_versions version_count where version_count.challenge_definition_id = definition.id and version_count.mode in ('flash', 'survival', 'narrative', 'pyramid') and version_count.status = 'archived')
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
        where version.challenge_definition_id = definition.id and version.mode in ('flash', 'survival', 'narrative', 'pyramid')
        order by version.updated_at desc, version.id
        limit 1
      ) latest on true
    ), '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_challenge_detail (
  target_challenge_definition_id uuid
)
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
                case when question.status <> 'draft' then jsonb_build_object(
                  'source', 'library',
                  'questionVersionId', question.id,
                  'points', item.points,
                  'modeConfig', item.mode_config,
                  'challengeItemId', item.id
                ) else jsonb_build_object(
                  'slug', question_definition.slug,
                  'type', question.type,
                  'payloadSchemaVersion', question.payload_schema_version,
                  'timeLimitMs', question.time_limit_ms,
                  'points', item.points,
                  'publicPayload', question.public_payload,
                  'solutionPayload', solution.solution_payload
                ) || case when version.mode = 'pyramid'
                  then jsonb_build_object('modeConfig', item.mode_config) else '{}'::jsonb end end
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
      where version.challenge_definition_id = definition.id and version.mode in ('flash', 'survival', 'narrative', 'pyramid')
    ), '[]'::jsonb)
  )
  into challenge_payload
  from private.challenge_definitions definition
  where definition.id = target_challenge_definition_id
    and exists (
      select 1
      from private.challenge_versions version
      where version.challenge_definition_id = definition.id and version.mode in ('flash', 'survival', 'narrative', 'pyramid')
    );

  return challenge_payload;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_challenge_version_comparison (
  from_challenge_version_id uuid,
  to_challenge_version_id   uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  from_definition_id uuid;
  to_definition_id uuid;
  from_mode text;
  to_mode text;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if from_challenge_version_id is null or to_challenge_version_id is null then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  select version.challenge_definition_id, version.mode
    into from_definition_id, from_mode
  from private.challenge_versions version
  where version.id = from_challenge_version_id;
  if not found then
    raise exception 'content_not_found' using errcode = 'P0002';
  end if;
  select version.challenge_definition_id, version.mode
    into to_definition_id, to_mode
  from private.challenge_versions version
  where version.id = to_challenge_version_id;
  if not found then
    raise exception 'content_not_found' using errcode = 'P0002';
  end if;
  if from_definition_id <> to_definition_id then
    raise exception 'invalid_comparison' using errcode = '22023';
  end if;
  if from_mode not in ('flash', 'survival', 'narrative', 'pyramid') or to_mode not in ('flash', 'survival', 'narrative', 'pyramid') then
    raise exception 'unsupported_mode' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'challengeDefinitionId', from_definition_id,
    'from', private.superadmin_challenge_version_snapshot(from_challenge_version_id),
    'to', private.superadmin_challenge_version_snapshot(to_challenge_version_id)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_dashboard_context()
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  operator_payload jsonb;
begin
  if actor is null or not exists (
    select 1
    from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'playerId', player.id,
    'displayName', player.display_name
  )
  into operator_payload
  from public.players player
  where player.id = actor and player.status = 'active';

  if operator_payload is null then
    raise exception 'player_unavailable' using errcode = '55000';
  end if;

  return jsonb_build_object(
    'operator', operator_payload,
    'metrics', jsonb_build_object(
      'activeRooms', (
        select count(*)
        from public.rooms room
        where room.status = 'active'
      ),
      'activeSeasons', (
        select count(*)
        from public.seasons season
        join public.rooms room on room.id = season.room_id
        where room.status = 'active' and season.status = 'active'
      ),
      'pendingSeasons', (
        select count(*)
        from public.seasons season
        join public.rooms room on room.id = season.room_id
        where room.status = 'active' and season.status in ('draft', 'scheduled')
      ),
      'editorialDrafts', (
        select count(*)
        from private.challenge_versions version
        where version.mode in ('flash', 'survival', 'narrative', 'pyramid') and version.status = 'draft'
      ),
      'upcomingChallenges', (
        select count(*)
        from public.scheduled_challenges schedule
        join public.seasons season on season.id = schedule.season_id
        join public.rooms room on room.id = season.room_id
        join private.challenge_versions version on version.id = schedule.challenge_version_id
        where room.status = 'active'
          and season.status = 'active'
          and version.mode in ('flash', 'survival', 'narrative', 'pyramid')
          and version.status in ('published', 'archived')
          and schedule.status in ('scheduled', 'open')
          and schedule.closes_at >= now()
      )
    ),
    'rooms', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'roomId', room.id,
          'slug', room.slug,
          'title', room.title,
          'timeZone', room.time_zone,
          'seasonCount', (
            select count(*)
            from public.seasons season_count
            where season_count.room_id = room.id
          ),
          'activeSeason', (
            select jsonb_build_object(
              'title', season.title,
              'startsAt', season.starts_at,
              'endsAt', season.ends_at
            )
            from public.seasons season
            where season.room_id = room.id and season.status = 'active'
            order by season.starts_at desc, season.id
            limit 1
          )
        ) order by room.title, room.id
      )
      from public.rooms room
      where room.status = 'active'
    ), '[]'::jsonb),
    'upcomingChallenges', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'scheduledChallengeId', upcoming.scheduled_challenge_id,
          'roomId', upcoming.room_id,
          'roomTitle', upcoming.room_title,
          'seasonId', upcoming.season_id,
          'seasonTitle', upcoming.season_title,
          'challengeVersionId', upcoming.challenge_version_id,
          'challengeTitle', upcoming.challenge_title,
          'number', upcoming.challenge_number,
          'status', upcoming.challenge_status,
          'opensAt', upcoming.opens_at,
          'closesAt', upcoming.closes_at,
          'timeZone', upcoming.time_zone
        ) order by upcoming.opens_at, upcoming.scheduled_challenge_id
      )
      from (
        select
          schedule.id as scheduled_challenge_id,
          room.id as room_id,
          room.title as room_title,
          season.id as season_id,
          season.title as season_title,
          version.id as challenge_version_id,
          version.title as challenge_title,
          schedule.number as challenge_number,
          schedule.status as challenge_status,
          schedule.opens_at,
          schedule.closes_at,
          room.time_zone
        from public.scheduled_challenges schedule
        join public.seasons season on season.id = schedule.season_id
        join public.rooms room on room.id = season.room_id
        join private.challenge_versions version on version.id = schedule.challenge_version_id
        where room.status = 'active'
          and season.status = 'active'
          and version.mode in ('flash', 'survival', 'narrative', 'pyramid')
          and version.status in ('published', 'archived')
          and schedule.status in ('scheduled', 'open')
          and schedule.closes_at >= now()
        order by schedule.opens_at, schedule.id
        limit 5
      ) upcoming
    ), '[]'::jsonb)
  );
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_my_narrative_challenge"(text, uuid) TO "authenticated", "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_my_narrative_result"(uuid) TO "authenticated", "postgres";
