-- S11 — Publish the minimum supported Flash content from the private portal.
-- This boundary uses the existing versioned content model. The browser never receives table DML.

create function private.validate_flash_editorial_document(document jsonb) returns void
language plpgsql volatile set search_path = '' as $$
declare
  challenge jsonb;
  question jsonb;
  public_payload jsonb;
  solution_payload jsonb;
  option jsonb;
  question_slug text;
  seen_slugs text[] := array[]::text[];
  question_index integer;
  option_count integer;
  expected_word_length integer;
  max_attempts integer;
  selected_dictionary_id text;
  solution_word text;
  guess_word text;
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
      where key_name <> all(array['slug', 'title', 'subtitle', 'description', 'mode', 'configSchemaVersion', 'modeConfig'])
    )
    or jsonb_typeof(challenge->'slug') is distinct from 'string'
    or char_length(btrim(challenge->>'slug')) not between 1 and 120
    or jsonb_typeof(challenge->'title') is distinct from 'string'
    or char_length(btrim(challenge->>'title')) not between 1 and 200
    or jsonb_typeof(challenge->'subtitle') is distinct from 'string'
    or char_length(challenge->>'subtitle') > 300
    or jsonb_typeof(challenge->'description') is distinct from 'string'
    or char_length(challenge->>'description') > 2000
    or challenge->>'mode' <> 'flash'
    or challenge->'configSchemaVersion' <> '1'::jsonb
    or jsonb_typeof(challenge->'modeConfig') is distinct from 'object' then
    raise exception 'invalid_content' using errcode = '22023';
  end if;

  if jsonb_typeof(document->'questions') is distinct from 'array'
    or jsonb_array_length(document->'questions') <> 2 then
    raise exception 'incomplete_content' using errcode = '22023';
  end if;

  for question, question_index in
    select value, ordinality::integer
    from jsonb_array_elements(document->'questions') with ordinality
  loop
    if jsonb_typeof(question) is distinct from 'object'
      or not question ?& array['slug', 'type', 'payloadSchemaVersion', 'timeLimitMs', 'points', 'publicPayload', 'solutionPayload']
      or exists (
        select 1 from jsonb_object_keys(question) key_name
        where key_name <> all(array['slug', 'type', 'payloadSchemaVersion', 'timeLimitMs', 'points', 'publicPayload', 'solutionPayload'])
      ) then
      raise exception 'invalid_content' using errcode = '22023';
    end if;

    question_slug := btrim(question->>'slug');
    if jsonb_typeof(question->'slug') is distinct from 'string'
      or char_length(question_slug) not between 1 and 120
      or question->>'type' not in ('multiple-choice', 'mini-wordle')
      or question->'payloadSchemaVersion' <> '1'::jsonb
      or question->'points' <> '50'::jsonb
      or jsonb_typeof(question->'timeLimitMs') is distinct from 'number'
      or (question->>'timeLimitMs')::numeric <= 0
      or question_slug = any(seen_slugs) then
      raise exception 'invalid_content' using errcode = '22023';
    end if;
    seen_slugs := seen_slugs || question_slug;

    public_payload := question->'publicPayload';
    solution_payload := question->'solutionPayload';

    if question->>'type' = 'mini-wordle' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'wordLength', 'maxAttempts']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'hint', 'wordLength', 'maxAttempts'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'wordLength') is distinct from 'number'
        or (public_payload->>'wordLength')::integer not in (4, 5)
        or jsonb_typeof(public_payload->'maxAttempts') is distinct from 'number'
        or (public_payload->>'maxAttempts')::integer not between 1 and 10
        or (public_payload ? 'hint' and jsonb_typeof(public_payload->'hint') not in ('null', 'string'))
        or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
        or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object') then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ?& array['correctAnswer', 'additionalGuesses', 'dictionaryId']
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'correctAnswer', 'additionalGuesses', 'dictionaryId', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
        or jsonb_typeof(solution_payload->'additionalGuesses') is distinct from 'array'
        or jsonb_typeof(solution_payload->'dictionaryId') is distinct from 'string'
        or solution_payload->>'dictionaryId' not in ('es-general-4.v1', 'es-general-5.v1')
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      expected_word_length := (public_payload->>'wordLength')::integer;
      max_attempts := (public_payload->>'maxAttempts')::integer;
      selected_dictionary_id := solution_payload->>'dictionaryId';
      if (expected_word_length = 4 and selected_dictionary_id <> 'es-general-4.v1')
        or (expected_word_length = 5 and selected_dictionary_id <> 'es-general-5.v1')
        or char_length(private.mini_wordle_normalize(solution_payload->>'correctAnswer')) <> expected_word_length
        or private.mini_wordle_normalize(solution_payload->>'correctAnswer') !~ '^[A-ZÑ]+$'
        or jsonb_array_length(solution_payload->'additionalGuesses') > 1000
        or exists (select 1 from jsonb_array_elements(solution_payload->'additionalGuesses') extra
          where jsonb_typeof(extra) is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      solution_word := private.mini_wordle_normalize(solution_payload->>'correctAnswer');
      for guess_word in select value from jsonb_array_elements_text(solution_payload->'additionalGuesses') loop
        if char_length(private.mini_wordle_normalize(guess_word)) <> expected_word_length
          or private.mini_wordle_normalize(guess_word) !~ '^[A-ZÑ]+$'
          or private.mini_wordle_normalize(guess_word) = solution_word
          or (select count(*) from jsonb_array_elements_text(solution_payload->'additionalGuesses') values(value)
              where private.mini_wordle_normalize(value) = private.mini_wordle_normalize(guess_word)) > 1 then
          raise exception 'invalid_solution_payload' using errcode = '22023';
        end if;
      end loop;
      continue;
    end if;

    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ?& array['question', 'options']
      or exists (
        select 1 from jsonb_object_keys(public_payload) key_name
        where key_name <> all(array['category', 'tags', 'question', 'options', 'media', 'promptVisual'])
      )
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or jsonb_typeof(public_payload->'options') is distinct from 'array'
      or jsonb_array_length(public_payload->'options') < 2
      or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
      or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
      or (public_payload ? 'media' and jsonb_typeof(public_payload->'media') not in ('null', 'object'))
      or (public_payload ? 'promptVisual' and jsonb_typeof(public_payload->'promptVisual') not in ('null', 'object')) then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;

    for option in select value from jsonb_array_elements(public_payload->'options') loop
      if jsonb_typeof(option) is distinct from 'string' or char_length(btrim(option #>> '{}')) = 0 then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
    end loop;
    select count(distinct value) into option_count from jsonb_array_elements_text(public_payload->'options');
    if option_count <> jsonb_array_length(public_payload->'options') then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;

    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ? 'correctAnswer'
      or exists (
        select 1 from jsonb_object_keys(solution_payload) key_name
        where key_name <> all(array['correctAnswer', 'explanation'])
      )
      or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
      or char_length(btrim(solution_payload->>'correctAnswer')) = 0
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    if not exists (
      select 1 from jsonb_array_elements_text(public_payload->'options') value
      where value = solution_payload->>'correctAnswer'
    ) then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
  end loop;
end;
$$;

create function private.create_flash_draft_command(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
  key text;
  reason_value text;
  document_value jsonb;
  document_hash text;
  safe_input jsonb;
  cached private.command_requests%rowtype;
  challenge_definition_id uuid := gen_random_uuid();
  challenge_version_id uuid := gen_random_uuid();
  question_definition_id uuid;
  question_version_id uuid;
  item_id uuid;
  question jsonb;
  question_index integer;
  result jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey', 'document', 'reason']
    or exists (select 1 from jsonb_object_keys(input) key_name where key_name <> all(array['idempotencyKey', 'document', 'reason']))
    or input->'idempotencyKey' is null or input->'document' is null or input->'reason' is null then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  key := btrim(input->>'idempotencyKey');
  reason_value := btrim(input->>'reason');
  document_value := input->'document';
  if char_length(key) not between 8 and 160 or char_length(reason_value) not between 1 and 500 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  perform private.validate_flash_editorial_document(document_value);
  document_hash := encode(sha256(convert_to(document_value::text, 'UTF8')), 'hex');
  safe_input := jsonb_build_object('idempotencyKey', key, 'documentHash', document_hash, 'reason', reason_value);
  perform pg_advisory_xact_lock(hashtextextended('superadmin-editorial-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'create_flash_draft' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  begin
    insert into private.challenge_definitions(id, slug, created_by_player_id)
    values (challenge_definition_id, document_value->'challenge'->>'slug', actor);
    insert into private.challenge_versions(
      id, challenge_definition_id, version_number, config_schema_version, status, mode,
      title, subtitle, description, max_score, mode_config, created_by_player_id
    ) values (
      challenge_version_id, challenge_definition_id, 1, 1, 'draft', 'flash',
      document_value->'challenge'->>'title', document_value->'challenge'->>'subtitle',
      document_value->'challenge'->>'description', 100, document_value->'challenge'->'modeConfig', actor
    );
    for question, question_index in
      select value, ordinality::integer
      from jsonb_array_elements(document_value->'questions') with ordinality
    loop
      question_definition_id := gen_random_uuid();
      question_version_id := gen_random_uuid();
      item_id := gen_random_uuid();
      insert into private.question_definitions(id, slug, created_by_player_id)
      values (question_definition_id, question->>'slug', actor);
      insert into private.question_versions(
        id, question_definition_id, version_number, payload_schema_version, status, type,
        time_limit_ms, public_payload, created_by_player_id
      ) values (
        question_version_id, question_definition_id, 1, 1, 'draft', question->>'type',
        (question->>'timeLimitMs')::integer, question->'publicPayload', actor
      );
      insert into private.question_version_solutions(question_version_id, solution_payload)
      values (question_version_id, question->'solutionPayload');
      insert into private.challenge_items(
        id, challenge_version_id, question_version_id, position, points,
        config_schema_version, mode_config
      ) values (item_id, challenge_version_id, question_version_id, question_index, 50, 1, '{}'::jsonb);
    end loop;
  exception when unique_violation then
    raise exception 'content_slug_conflict' using errcode = '23505';
  end;

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
  where version.id = challenge_version_id;
  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload
  ) values (
    actor, 'create_flash_draft', 'challenge_version', challenge_version_id, reason_value, key, null,
    jsonb_build_object('documentHash', document_hash, 'status', 'draft', 'questionCount', 2)
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'create_flash_draft', safe_input, result);
  return result;
end;
$$;

create function private.update_flash_draft_command(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
  key text;
  reason_value text;
  document_value jsonb;
  document_hash text;
  expected_updated_at timestamptz;
  challenge_version_id_value uuid;
  safe_input jsonb;
  cached private.command_requests%rowtype;
  challenge_row private.challenge_versions%rowtype;
  definition_row private.challenge_definitions%rowtype;
  item_row private.challenge_items%rowtype;
  question_row private.question_versions%rowtype;
  question_definition_row private.question_definitions%rowtype;
  question jsonb;
  result jsonb;
  before_payload jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey', 'challengeVersionId', 'expectedUpdatedAt', 'document', 'reason']
    or exists (select 1 from jsonb_object_keys(input) key_name where key_name <> all(array['idempotencyKey', 'challengeVersionId', 'expectedUpdatedAt', 'document', 'reason']))
    or input->'idempotencyKey' is null or input->'challengeVersionId' is null
    or input->'expectedUpdatedAt' is null or input->'document' is null or input->'reason' is null then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  key := btrim(input->>'idempotencyKey');
  reason_value := btrim(input->>'reason');
  document_value := input->'document';
  begin
    challenge_version_id_value := (input->>'challengeVersionId')::uuid;
    expected_updated_at := (input->>'expectedUpdatedAt')::timestamptz;
  exception when others then
    raise exception 'invalid_command' using errcode = '22023';
  end;
  if char_length(key) not between 8 and 160 or char_length(reason_value) not between 1 and 500 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  perform private.validate_flash_editorial_document(document_value);
  document_hash := encode(sha256(convert_to(document_value::text, 'UTF8')), 'hex');
  safe_input := jsonb_build_object(
    'idempotencyKey', key, 'challengeVersionId', challenge_version_id_value,
    'expectedUpdatedAt', expected_updated_at, 'documentHash', document_hash, 'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('superadmin-editorial-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'update_flash_draft' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select * into challenge_row from private.challenge_versions version
  where version.id = challenge_version_id_value for update;
  if not found then raise exception 'content_not_found' using errcode = 'P0002'; end if;
  if challenge_row.status <> 'draft' then raise exception 'content_not_draft' using errcode = '55000'; end if;
  if challenge_row.updated_at <> expected_updated_at then raise exception 'content_conflict' using errcode = '40001'; end if;
  select * into definition_row from private.challenge_definitions definition
  where definition.id = challenge_row.challenge_definition_id for update;

  if (select count(*) from private.challenge_items item where item.challenge_version_id = challenge_version_id_value) <> 2 then
    raise exception 'incomplete_content' using errcode = '22023';
  end if;
  before_payload := jsonb_build_object(
    'challengeDefinitionId', definition_row.id, 'challengeVersionId', challenge_row.id,
    'status', challenge_row.status, 'slug', definition_row.slug, 'title', challenge_row.title,
    'updatedAt', challenge_row.updated_at
  );

  begin
    update private.challenge_definitions
    set slug = document_value->'challenge'->>'slug'
    where id = definition_row.id;
    update private.challenge_versions
    set config_schema_version = 1,
        mode = 'flash',
        title = document_value->'challenge'->>'title',
        subtitle = document_value->'challenge'->>'subtitle',
        description = document_value->'challenge'->>'description',
        global_time_limit_ms = null,
        max_score = 100,
        mode_config = document_value->'challenge'->'modeConfig'
    where id = challenge_version_id_value;
    for item_row in
      select item.* from private.challenge_items item
      where item.challenge_version_id = challenge_version_id_value
      order by item.position for update
    loop
      question := document_value->'questions'->(item_row.position - 1);
      select * into question_row from private.question_versions version
      where version.id = item_row.question_version_id for update;
      select * into question_definition_row from private.question_definitions definition
      where definition.id = question_row.question_definition_id for update;
      if question_row.status <> 'draft' then raise exception 'content_not_draft' using errcode = '55000'; end if;
      update private.question_definitions
      set slug = question->>'slug'
      where id = question_definition_row.id;
      update private.question_versions
      set payload_schema_version = 1,
          type = question->>'type',
          time_limit_ms = (question->>'timeLimitMs')::integer,
          public_payload = question->'publicPayload'
      where id = question_row.id;
      update private.question_version_solutions
      set solution_payload = question->'solutionPayload'
      where question_version_id = question_row.id;
      update private.challenge_items
      set points = 50, config_schema_version = 1, mode_config = '{}'::jsonb
      where id = item_row.id;
    end loop;
  exception when unique_violation then
    raise exception 'content_slug_conflict' using errcode = '23505';
  end;

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
  where version.id = challenge_version_id_value;
  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload
  ) values (
    actor, 'update_flash_draft', 'challenge_version', challenge_version_id_value, reason_value, key,
    before_payload, jsonb_build_object('documentHash', document_hash, 'status', 'draft', 'updatedAt', result->>'updatedAt')
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'update_flash_draft', safe_input, result);
  return result;
end;
$$;

create function private.publish_flash_command(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
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
  if (select count(*) from private.challenge_items item where item.challenge_version_id = challenge_version_id_value) <> 2 then
    raise exception 'incomplete_content' using errcode = '22023';
  end if;
  if (select coalesce(sum(item.points), 0) from private.challenge_items item where item.challenge_version_id = challenge_version_id_value) <> 100 then
    raise exception 'points_total_invalid' using errcode = '22023';
  end if;

  for item_row in
    select item.* from private.challenge_items item
    where item.challenge_version_id = challenge_version_id_value
    order by item.position for update
  loop
    select * into question_row from private.question_versions version
    where version.id = item_row.question_version_id for update;
    if question_row.status <> 'draft' or not exists (
      select 1 from private.question_version_solutions solution
      where solution.question_version_id = question_row.id
    ) then
      raise exception 'incomplete_content' using errcode = '22023';
    end if;
  end loop;

  update private.question_versions version
  set status = 'published'
  where version.id in (
    select item.question_version_id from private.challenge_items item
    where item.challenge_version_id = challenge_version_id_value
  );
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
    jsonb_build_object('status', 'published', 'slug', definition_row.slug, 'questionCount', 2)
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'publish_flash', safe_input, result);
  return result;
end;
$$;

create function private.read_superadmin_editorial_context() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return jsonb_build_object(
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
      join private.challenge_definitions definition on definition.id = version.challenge_definition_id
      where version.mode = 'flash'
    ), '[]'::jsonb)
  );
end;
$$;

create function public.get_superadmin_editorial_context() returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.read_superadmin_editorial_context();
$$;

create function public.create_superadmin_flash_draft(input jsonb) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select private.create_flash_draft_command(input);
$$;

create function public.update_superadmin_flash_draft(input jsonb) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select private.update_flash_draft_command(input);
$$;

create function public.publish_superadmin_flash(input jsonb) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select private.publish_flash_command(input);
$$;

alter function private.editorial_has_secret_key(jsonb) owner to postgres;
alter function private.validate_flash_editorial_document(jsonb) owner to postgres;
alter function private.create_flash_draft_command(jsonb) owner to postgres;
alter function private.update_flash_draft_command(jsonb) owner to postgres;
alter function private.publish_flash_command(jsonb) owner to postgres;
alter function private.read_superadmin_editorial_context() owner to postgres;
alter function public.get_superadmin_editorial_context() owner to postgres;
alter function public.create_superadmin_flash_draft(jsonb) owner to postgres;
alter function public.update_superadmin_flash_draft(jsonb) owner to postgres;
alter function public.publish_superadmin_flash(jsonb) owner to postgres;

revoke all on function private.editorial_has_secret_key(jsonb), private.validate_flash_editorial_document(jsonb),
  private.create_flash_draft_command(jsonb), private.update_flash_draft_command(jsonb),
  private.publish_flash_command(jsonb), private.read_superadmin_editorial_context()
  from public, anon, authenticated, service_role;
revoke all on function public.get_superadmin_editorial_context(),
  public.create_superadmin_flash_draft(jsonb), public.update_superadmin_flash_draft(jsonb),
  public.publish_superadmin_flash(jsonb) from public, anon, service_role;
grant execute on function public.get_superadmin_editorial_context(),
  public.create_superadmin_flash_draft(jsonb), public.update_superadmin_flash_draft(jsonb),
  public.publish_superadmin_flash(jsonb) to authenticated;
