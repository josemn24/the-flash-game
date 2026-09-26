-- S11 — Publish the minimum supported Flash content from the private portal.
-- Editorial document validation is shared from 54_question_validation.sql.

set local check_function_bodies = off;



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
      title, subtitle, description, max_score, global_time_limit_ms, mode_config, created_by_player_id
    ) values (
      challenge_version_id, challenge_definition_id, 1, 1, 'draft', document_value->'challenge'->>'mode',
      document_value->'challenge'->>'title', document_value->'challenge'->>'subtitle',
      document_value->'challenge'->>'description', 100,
      (document_value->'challenge'->>'globalTimeLimitMs')::integer,
      document_value->'challenge'->'modeConfig', actor
    );
    for question, question_index in
      select value, ordinality::integer
      from jsonb_array_elements(document_value->'questions') with ordinality
    loop
      item_id := gen_random_uuid();
      if question->>'source' = 'library' then
        question_version_id := (question->>'questionVersionId')::uuid;
        if not exists (
          select 1 from private.question_versions version
          where version.id = question_version_id and version.status = 'published'
        ) then
          raise exception 'question_not_published' using errcode = '55000';
        end if;
      else
        question_definition_id := gen_random_uuid();
        question_version_id := gen_random_uuid();
        insert into private.question_definitions(id, slug, created_by_player_id)
        values (question_definition_id, question->>'slug', actor);
        insert into private.question_versions(
          id, question_definition_id, version_number, payload_schema_version, status, type,
          time_limit_ms, public_payload, created_by_player_id
        ) values (
          question_version_id, question_definition_id, 1, (question->>'payloadSchemaVersion')::integer, 'draft', question->>'type',
          (question->>'timeLimitMs')::integer, question->'publicPayload', actor
        );
        insert into private.question_version_solutions(question_version_id, solution_payload)
        values (question_version_id, question->'solutionPayload');
      end if;
      insert into private.challenge_items(
        id, challenge_version_id, question_version_id, position, points,
        config_schema_version, mode_config
      ) values (item_id, challenge_version_id, question_version_id, question_index,
        (question->>'points')::integer, 1, coalesce(question->'modeConfig', '{}'::jsonb));
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
    jsonb_build_object(
      'documentHash', document_hash,
      'status', 'draft',
      'questionCount', jsonb_array_length(document_value->'questions'),
      'maxScore', (select coalesce(sum((value->>'points')::integer), 0)
        from jsonb_array_elements(document_value->'questions') value)
    )
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
  old_question_definition_id uuid;
  existing_item_count integer;
  desired_item_count integer;
  question_index integer;
  question_definition_id uuid;
  question_version_id uuid;
  item_id uuid;
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

  desired_item_count := jsonb_array_length(document_value->'questions');
  select count(*) into existing_item_count
  from private.challenge_items item
  where item.challenge_version_id = challenge_version_id_value;
  before_payload := jsonb_build_object(
    'challengeDefinitionId', definition_row.id, 'challengeVersionId', challenge_row.id,
    'status', challenge_row.status, 'slug', definition_row.slug, 'title', challenge_row.title,
    'updatedAt', challenge_row.updated_at, 'questionCount', existing_item_count
  );

  begin
    update private.challenge_definitions
    set slug = document_value->'challenge'->>'slug'
    where id = definition_row.id;
    update private.challenge_versions
    set config_schema_version = 1,
        mode = document_value->'challenge'->>'mode',
        title = document_value->'challenge'->>'title',
        subtitle = document_value->'challenge'->>'subtitle',
        description = document_value->'challenge'->>'description',
        global_time_limit_ms = (document_value->'challenge'->>'globalTimeLimitMs')::integer,
        max_score = (select coalesce(sum((value->>'points')::integer), 0)
          from jsonb_array_elements(document_value->'questions') value),
        mode_config = document_value->'challenge'->'modeConfig'
    where id = challenge_version_id_value;

    if existing_item_count > desired_item_count then
      for item_row in
        select item.* from private.challenge_items item
        where item.challenge_version_id = challenge_version_id_value
          and item.position > desired_item_count
        order by item.position desc for update
      loop
        select version.question_definition_id into old_question_definition_id
        from private.question_versions version
        where version.id = item_row.question_version_id;
        delete from private.challenge_items where id = item_row.id;
        delete from private.question_version_solutions solution
        where solution.question_version_id = item_row.question_version_id;
        delete from private.question_versions where id = item_row.question_version_id;
        delete from private.question_definitions
        where id = old_question_definition_id
          and not exists (
            select 1 from private.question_versions version
            where version.question_definition_id = old_question_definition_id
          );
      end loop;
    elsif existing_item_count < desired_item_count then
      for question, question_index in
        select value, ordinality::integer
        from jsonb_array_elements(document_value->'questions') with ordinality
        where ordinality > existing_item_count
      loop
        item_id := gen_random_uuid();
        if question->>'source' = 'library' then
          question_version_id := (question->>'questionVersionId')::uuid;
          if not exists (
            select 1 from private.question_versions version
            where version.id = question_version_id and version.status = 'published'
          ) then
            raise exception 'question_not_published' using errcode = '55000';
          end if;
        else
          question_definition_id := gen_random_uuid();
          question_version_id := gen_random_uuid();
          insert into private.question_definitions(id, slug, created_by_player_id)
          values (question_definition_id, question->>'slug', actor);
          insert into private.question_versions(
            id, question_definition_id, version_number, payload_schema_version, status, type,
            time_limit_ms, public_payload, created_by_player_id
          ) values (
            question_version_id, question_definition_id, 1, (question->>'payloadSchemaVersion')::integer, 'draft', question->>'type',
            (question->>'timeLimitMs')::integer, question->'publicPayload', actor
          );
          insert into private.question_version_solutions(question_version_id, solution_payload)
          values (question_version_id, question->'solutionPayload');
        end if;
        insert into private.challenge_items(
          id, challenge_version_id, question_version_id, position, points,
          config_schema_version, mode_config
        ) values (item_id, challenge_version_id_value, question_version_id, question_index,
          (question->>'points')::integer, 1, coalesce(question->'modeConfig', '{}'::jsonb));
      end loop;
    end if;

    for item_row in
      select item.* from private.challenge_items item
      where item.challenge_version_id = challenge_version_id_value
      order by item.position for update
    loop
      question := coalesce(
        (
          select value from jsonb_array_elements(document_value->'questions') value
          where value->>'challengeItemId' = item_row.id::text
          limit 1
        ),
        document_value->'questions'->(item_row.position - 1)
      );
      if question->>'source' = 'library' then
        question_version_id := (question->>'questionVersionId')::uuid;
        if not exists (
          select 1 from private.question_versions version
          where version.id = question_version_id and version.status = 'published'
        ) then
          raise exception 'question_not_published' using errcode = '55000';
        end if;
        update private.challenge_items
        set question_version_id = (question->>'questionVersionId')::uuid,
            points = (question->>'points')::integer,
            config_schema_version = 1,
            mode_config = coalesce(question->'modeConfig', '{}'::jsonb)
        where id = item_row.id;
      else
        select * into question_row from private.question_versions version
        where version.id = item_row.question_version_id for update;
        select * into question_definition_row from private.question_definitions definition
        where definition.id = question_row.question_definition_id for update;
        if question_row.status <> 'draft' then raise exception 'content_not_draft' using errcode = '55000'; end if;
        update private.question_definitions
        set slug = question->>'slug'
        where id = question_definition_row.id;
        update private.question_versions
        set payload_schema_version = (question->>'payloadSchemaVersion')::integer,
            type = question->>'type',
            time_limit_ms = (question->>'timeLimitMs')::integer,
            public_payload = question->'publicPayload'
        where id = question_row.id;
        update private.question_version_solutions solution
        set solution_payload = question->'solutionPayload'
        where solution.question_version_id = question_row.id;
        update private.challenge_items
        set points = (question->>'points')::integer, config_schema_version = 1,
            mode_config = coalesce(question->'modeConfig', '{}'::jsonb)
        where id = item_row.id;
      end if;
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
    before_payload, jsonb_build_object(
      'documentHash', document_hash,
      'status', 'draft',
      'updatedAt', result->>'updatedAt',
      'questionCount', result->>'questionCount',
      'maxScore', (select max_score from private.challenge_versions where id = challenge_version_id_value)
    )
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
    if challenge_row.mode in ('flash', 'survival', 'pyramid') and (
      not private.is_supported_flash_question(question_row.id)
      or (challenge_row.mode = 'survival' and question_row.type = 'short-text')
    ) then
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
      join private.challenge_definitions definition on definition.id = version.challenge_definition_id
      where version.mode in ('flash', 'survival', 'pyramid')
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
alter function private.create_flash_draft_command(jsonb) owner to postgres;
alter function private.update_flash_draft_command(jsonb) owner to postgres;
alter function private.publish_flash_command(jsonb) owner to postgres;
alter function private.read_superadmin_editorial_context() owner to postgres;
alter function public.get_superadmin_editorial_context() owner to postgres;
alter function public.create_superadmin_flash_draft(jsonb) owner to postgres;
alter function public.update_superadmin_flash_draft(jsonb) owner to postgres;
alter function public.publish_superadmin_flash(jsonb) owner to postgres;

revoke all on function private.editorial_has_secret_key(jsonb),
  private.create_flash_draft_command(jsonb), private.update_flash_draft_command(jsonb),
  private.publish_flash_command(jsonb), private.read_superadmin_editorial_context()
  from public, anon, authenticated, service_role;
revoke all on function public.get_superadmin_editorial_context(),
  public.create_superadmin_flash_draft(jsonb), public.update_superadmin_flash_draft(jsonb),
  public.publish_superadmin_flash(jsonb) from public, anon, service_role;
grant execute on function public.get_superadmin_editorial_context(),
  public.create_superadmin_flash_draft(jsonb), public.update_superadmin_flash_draft(jsonb),
  public.publish_superadmin_flash(jsonb) to authenticated;
