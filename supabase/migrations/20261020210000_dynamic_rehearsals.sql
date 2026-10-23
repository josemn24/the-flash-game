-- Upgrade fixed trials to generated sessions. Competitive and audit rows are retained.
alter table private.question_versions add column difficulty text not null default 'medium' check (difficulty in ('easy','medium','hard'));
drop trigger rehearsal_draft_changed on private.challenge_versions;
drop trigger rehearsal_items_changed on private.challenge_items;
drop trigger rehearsal_question_changed on private.question_versions;
drop trigger rehearsal_solution_changed on private.question_version_solutions;
drop function private.read_player_rehearsal(text,uuid), private.read_editorial_rehearsal(uuid), private.set_challenge_rehearsal(jsonb);
drop table private.challenge_rehearsals;
drop function private.rehearsal_source(uuid), private.guard_rehearsal_binding(), private.invalidate_draft_rehearsal();
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

create or replace function private.validate_flash_question_document(document jsonb) returns void
language plpgsql volatile set search_path = '' as $$
declare
  question jsonb;
  question_slug text;
begin
  if document is null or jsonb_typeof(document) is distinct from 'object' or document ? 'points' then
    raise exception 'invalid_question_document' using errcode = '22023';
  end if;
  if document ? 'difficulty' and (jsonb_typeof(document->'difficulty') is distinct from 'string' or document->>'difficulty' not in ('easy','medium','hard')) then
    raise exception 'invalid_content' using errcode = '22023';
  end if;
  document := document - 'difficulty';
  if document->>'type' = 'short-text' then
    perform private.validate_short_text_question_document(document);
    return;
  end if;

  if not document ?& array['slug', 'type', 'payloadSchemaVersion', 'timeLimitMs', 'publicPayload', 'solutionPayload']
    or exists (
      select 1 from jsonb_object_keys(document) key_name
      where key_name <> all(array['slug', 'type', 'payloadSchemaVersion', 'timeLimitMs', 'publicPayload', 'solutionPayload'])
    ) then
    raise exception 'invalid_content' using errcode = '22023';
  end if;

  question := document;
  question_slug := btrim(question->>'slug');
  if jsonb_typeof(question->'slug') is distinct from 'string'
    or char_length(question_slug) not between 1 and 120
    or question->>'type' not in ('multiple-choice', 'estimation', 'heat-map', 'mini-wordle', 'logic-code', 'logic-matrix', 'progressive-clues', 'matching', 'connect-pairs', 'progressive-image', 'queens', 'true-false', 'odd-one-out', 'ordering', 'anagram', 'classification', 'short-text', 'word-search', 'word-hashtag', 'zip', 'escape')
    or (question->>'type' not in ('progressive-image', 'multiple-choice', 'estimation', 'heat-map') and question->'payloadSchemaVersion' <> '1'::jsonb)
    or (question->>'type' in ('progressive-image', 'multiple-choice') and question->'payloadSchemaVersion' not in ('1'::jsonb, '2'::jsonb))
    or (question->>'type' in ('estimation', 'heat-map') and question->'payloadSchemaVersion' <> '2'::jsonb)
    or jsonb_typeof(question->'timeLimitMs') is distinct from 'number'
    or (question->>'timeLimitMs')::numeric <= 0 then
    raise exception 'invalid_content' using errcode = '22023';
  end if;

  if question->>'type' = 'estimation' then
    perform private.validate_estimation_question_document(document);
    return;
  end if;
  if question->>'type' = 'heat-map' then
    perform private.validate_heat_map_question_document(document);
    return;
  end if;
  if question->>'type' = 'mini-wordle' then
    perform private.validate_mini_wordle_question_document(document);
    return;
  end if;
  if question->>'type' = 'logic-code' then
    perform private.validate_logic_code_question_document(document);
    return;
  end if;
  if question->>'type' = 'logic-matrix' then
    perform private.validate_logic_matrix_question_document(document);
    return;
  end if;
  if question->>'type' = 'progressive-clues' then
    perform private.validate_progressive_clues_question_document(document);
    return;
  end if;
  if question->>'type' = 'true-false' then
    perform private.validate_true_false_question_document(document);
    return;
  end if;
  if question->>'type' = 'odd-one-out' then
    perform private.validate_odd_one_out_question_document(document);
    return;
  end if;
  if question->>'type' = 'connect-pairs' then
    perform private.validate_connect_pairs_question_document(document);
    return;
  end if;
  if question->>'type' = 'ordering' then
    perform private.validate_ordering_question_document(document);
    return;
  end if;
  if question->>'type' = 'anagram' then
    perform private.validate_anagram_question_document(document);
    return;
  end if;
  if question->>'type' = 'classification' then
    perform private.validate_classification_question_document(document);
    return;
  end if;
  if question->>'type' = 'matching' then
    perform private.validate_matching_question_document(document);
    return;
  end if;
  if question->>'type' = 'word-search' then
    perform private.validate_word_search_question_document(document);
    return;
  end if;
  if question->>'type' = 'word-hashtag' then
    perform private.validate_word_hashtag_question_document(document);
    return;
  end if;
  if question->>'type' = 'zip' then
    perform private.validate_zip_question_document(document);
    return;
  end if;
  if question->>'type' = 'queens' then
    perform private.validate_queens_question_document(document);
    return;
  end if;
  if question->>'type' = 'escape' then
    perform private.validate_escape_question_document(document);
    return;
  end if;
  if question->>'type' = 'progressive-image' then
    perform private.validate_progressive_image_question_document(document);
    return;
  end if;
  -- Preserve the original residual path, including a JSON null type.
  perform private.validate_multiple_choice_question_document(document);
end;
$$;

create or replace function private.validate_flash_editorial_document(document jsonb) returns void
language plpgsql volatile set search_path = '' as $$
declare
  challenge jsonb;
  question jsonb;
  question_slug text;
  trial_format text;
  question_format text;
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
    or challenge->>'mode' not in ('flash', 'alphabet', 'survival', 'narrative', 'pyramid', 'time-trial')
    or challenge->'configSchemaVersion' <> '1'::jsonb
    or jsonb_typeof(challenge->'modeConfig') is distinct from 'object'
    or (challenge->>'mode' in ('alphabet', 'time-trial') and (
      jsonb_typeof(challenge->'globalTimeLimitMs') is distinct from 'number'
      or (challenge->>'globalTimeLimitMs')::numeric <> trunc((challenge->>'globalTimeLimitMs')::numeric)
      or (challenge->>'globalTimeLimitMs')::integer <= 0
    ))
    or (challenge->>'mode' not in ('alphabet', 'time-trial') and challenge ? 'globalTimeLimitMs')
    or (challenge->>'mode' = 'survival' and (
      (select count(*) from jsonb_object_keys(challenge->'modeConfig')) <> 1
      or jsonb_typeof(challenge->'modeConfig'->'lives') is distinct from 'number'
      or (challenge->'modeConfig'->>'lives')::numeric <> trunc((challenge->'modeConfig'->>'lives')::numeric)
      or (challenge->'modeConfig'->>'lives')::integer not between 1 and 20
    ))
    or (challenge->>'mode' in ('pyramid', 'time-trial') and challenge->'modeConfig' <> '{}'::jsonb) then
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

  if challenge->>'mode' = 'time-trial' and (challenge->>'globalTimeLimitMs')::integer % 1000 <> 0 then
    raise exception 'invalid_content' using errcode = '22023';
  end if;
  for question, question_index in
    select value, ordinality::integer
    from jsonb_array_elements(document->'questions') with ordinality
  loop
    if challenge->>'mode' = 'time-trial' then
      if question->>'source' = 'library' then
        select q.type into question_format from private.question_versions q
          where q.id = case when question->>'questionVersionId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then (question->>'questionVersionId')::uuid else null end and q.status = 'published';
      else
        question_format := question->>'type';
      end if;
      if question_format is null or question_format not in ('queens','connect-pairs')
        or (trial_format is not null and trial_format <> question_format) then
        raise exception 'unsupported_question' using errcode = '22023';
      end if;
      trial_format := question_format;
    end if;
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
      if challenge->>'mode' = 'time-trial' and not exists (
        select 1 from private.question_versions q where q.id = (question->>'questionVersionId')::uuid
          and q.status = 'published' and private.is_supported_time_trial_question(q.id)
      ) then raise exception 'unsupported_question' using errcode = '22023'; end if;
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
        where key_name <> all(array['slug', 'type', 'payloadSchemaVersion', 'timeLimitMs', 'points', 'publicPayload', 'solutionPayload', 'modeConfig', 'difficulty'])
      )
      or (challenge->>'mode' = 'pyramid' and not private.is_valid_pyramid_level_config(question->'modeConfig'))
      or (challenge->>'mode' not in ('pyramid', 'narrative') and question ? 'modeConfig') then
      raise exception 'invalid_content' using errcode = '22023';
    end if;

    if challenge->>'mode' = 'time-trial' and question->>'type' not in ('queens','connect-pairs') then
      raise exception 'unsupported_question' using errcode = '22023';
    end if;
    perform private.validate_flash_question_document(question - 'points' - 'modeConfig');
    if challenge->>'mode' = 'time-trial' and question->>'type' = 'connect-pairs'
      and not private.connect_pairs_answer_valid(question->'publicPayload',
        jsonb_build_object('paths',question->'solutionPayload'->'paths')) then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
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
            ) || case when version.mode in ('alphabet','time-trial') then jsonb_build_object('globalTimeLimitMs', version.global_time_limit_ms) else '{}'::jsonb end,
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
        'difficulty', question.difficulty,
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
      where version.challenge_definition_id = definition.id and version.mode in ('flash', 'alphabet', 'survival', 'narrative', 'pyramid', 'time-trial')
    ), '[]'::jsonb)
  )
  into challenge_payload
  from private.challenge_definitions definition
  where definition.id = target_challenge_definition_id
    and exists (
      select 1
      from private.challenge_versions version
      where version.challenge_definition_id = definition.id and version.mode in ('flash', 'alphabet', 'survival', 'narrative', 'pyramid', 'time-trial')
    );

  return challenge_payload;
end;
$$;

create or replace function private.create_flash_draft_command(input jsonb) returns jsonb
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
          time_limit_ms, public_payload, created_by_player_id, difficulty
        ) values (
          question_version_id, question_definition_id, 1, (question->>'payloadSchemaVersion')::integer, 'draft', question->>'type',
          (question->>'timeLimitMs')::integer, question->'publicPayload', actor, coalesce(question->>'difficulty','medium')
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

create or replace function private.update_flash_draft_command(input jsonb) returns jsonb
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
            time_limit_ms, public_payload, created_by_player_id, difficulty
          ) values (
            question_version_id, question_definition_id, 1, (question->>'payloadSchemaVersion')::integer, 'draft', question->>'type',
            (question->>'timeLimitMs')::integer, question->'publicPayload', actor, coalesce(question->>'difficulty','medium')
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
            public_payload = question->'publicPayload',
            difficulty = coalesce(question->>'difficulty','medium')
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

create or replace function private.read_superadmin_editorial_context() returns jsonb
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
            ) || case when version.mode in ('alphabet','time-trial') then jsonb_build_object('globalTimeLimitMs', version.global_time_limit_ms) else '{}'::jsonb end,
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
        'difficulty', question.difficulty,
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
      where version.mode in ('flash', 'alphabet', 'survival', 'pyramid', 'time-trial')
    ), '[]'::jsonb)
  );
end;
$$;

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

create or replace function private.create_question_draft_command(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
  key text;
  reason_value text;
  document_value jsonb;
  definition_id uuid;
  version_id uuid := gen_random_uuid();
  next_version integer;
  safe_input jsonb;
  cached private.command_requests%rowtype;
  result jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey', 'document', 'reason']
    or exists (select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey', 'questionDefinitionId', 'document', 'reason'])) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  key := btrim(input->>'idempotencyKey');
  reason_value := btrim(input->>'reason');
  document_value := input->'document';
  if char_length(key) not between 8 and 160 or char_length(reason_value) not between 1 and 500 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  perform private.validate_flash_question_document(document_value);
  safe_input := jsonb_build_object(
    'idempotencyKey', key,
    'questionDefinitionId', input->'questionDefinitionId',
    'documentHash', encode(sha256(convert_to(document_value::text, 'UTF8')), 'hex'),
    'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('question-library:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'create_question_draft' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  if input ? 'questionDefinitionId' and input->>'questionDefinitionId' is not null then
    definition_id := (input->>'questionDefinitionId')::uuid;
    perform 1 from private.question_definitions where id = definition_id for update;
    if not found then raise exception 'content_not_found' using errcode = 'P0002'; end if;
    if (select slug from private.question_definitions where id = definition_id) <> document_value->>'slug' then
      raise exception 'content_slug_conflict' using errcode = '23505';
    end if;
    select coalesce(max(version_number), 0) + 1 into next_version
    from private.question_versions where question_definition_id = definition_id;
  else
    definition_id := gen_random_uuid();
    next_version := 1;
    insert into private.question_definitions(id, slug, created_by_player_id)
    values (definition_id, document_value->>'slug', actor);
  end if;

  insert into private.question_versions(
    id, question_definition_id, version_number, payload_schema_version, status,
    type, time_limit_ms, public_payload, created_by_player_id, difficulty
  ) values (
    version_id, definition_id, next_version, (document_value->>'payloadSchemaVersion')::integer, 'draft',
    document_value->>'type', (document_value->>'timeLimitMs')::integer,
    document_value->'publicPayload', actor, coalesce(document_value->>'difficulty','medium')
  );
  insert into private.question_version_solutions(question_version_id, solution_payload)
  values (version_id, document_value->'solutionPayload');
  result := private.question_version_detail(version_id);
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, reason, request_id,
    after_payload) values (actor, 'create_question_draft', 'question_version', version_id, reason_value, key, result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'create_question_draft', safe_input, result);
  return result;
exception when unique_violation then
  raise exception 'content_slug_conflict' using errcode = '23505';
end;
$$;

create or replace function private.update_question_draft_command(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
  key text := btrim(input->>'idempotencyKey');
  reason_value text := btrim(input->>'reason');
  version_id uuid := (input->>'questionVersionId')::uuid;
  expected_updated_at timestamptz := (input->>'expectedUpdatedAt')::timestamptz;
  document_value jsonb := input->'document';
  cached private.command_requests%rowtype;
  version_row private.question_versions%rowtype;
  definition_row private.question_definitions%rowtype;
  safe_input jsonb;
  result jsonb;
begin
  if actor is null or not exists (select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey', 'questionVersionId', 'expectedUpdatedAt', 'document', 'reason']
    or exists (select 1 from jsonb_object_keys(input) key_name where key_name <> all(array[
      'idempotencyKey', 'questionVersionId', 'expectedUpdatedAt', 'document', 'reason'])) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  if char_length(key) not between 8 and 160 or char_length(reason_value) not between 1 and 500 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  perform private.validate_flash_question_document(document_value);
  safe_input := jsonb_build_object('idempotencyKey', key, 'questionVersionId', version_id,
    'expectedUpdatedAt', expected_updated_at,
    'documentHash', encode(sha256(convert_to(document_value::text, 'UTF8')), 'hex'), 'reason', reason_value);
  perform pg_advisory_xact_lock(hashtextextended('question-library:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'update_question_draft' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;
  select * into version_row from private.question_versions version where version.id = version_id for update;
  if not found then raise exception 'content_not_found' using errcode = 'P0002'; end if;
  if version_row.status <> 'draft' then raise exception 'content_not_draft' using errcode = '55000'; end if;
  if version_row.updated_at <> expected_updated_at then raise exception 'content_conflict' using errcode = '40001'; end if;
  select * into definition_row from private.question_definitions definition
  where definition.id = version_row.question_definition_id for update;
  if definition_row.slug <> document_value->>'slug' then raise exception 'content_slug_conflict' using errcode = '23505'; end if;
  update private.question_versions set type = document_value->>'type',
    payload_schema_version = (document_value->>'payloadSchemaVersion')::integer,
    time_limit_ms = (document_value->>'timeLimitMs')::integer,
    public_payload = document_value->'publicPayload', difficulty = coalesce(document_value->>'difficulty','medium')
  where id = version_id;
  update private.question_version_solutions set solution_payload = document_value->'solutionPayload'
  where question_version_id = version_id;
  result := private.question_version_detail(version_id);
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload) values (actor, 'update_question_draft', 'question_version', version_id,
    reason_value, key, jsonb_build_object('updatedAt', version_row.updated_at), result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'update_question_draft', safe_input, result);
  return result;
end;
$$;

create or replace function private.superadmin_challenge_version_snapshot(target_challenge_version_id uuid)
returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'challengeVersionId', version.id,
    'versionNumber', version.version_number,
    'status', version.status,
    'slug', definition.slug,
    'title', version.title,
    'subtitle', version.subtitle,
    'description', version.description,
    'mode', version.mode,
    'configSchemaVersion', version.config_schema_version,
    'modeConfig', version.mode_config,
    'globalTimeLimitMs', version.global_time_limit_ms,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'challengeItemId', item.id,
          'position', item.position,
          'questionVersionId', question.id,
          'questionDefinitionId', question.question_definition_id,
          'questionVersionNumber', question.version_number,
          'questionStatus', question.status,
          'slug', question_definition.slug,
          'type', question.type,
          'payloadSchemaVersion', question.payload_schema_version,
          'timeLimitMs', question.time_limit_ms,
        'difficulty', question.difficulty,
          'points', item.points,
          'modeConfig', item.mode_config,
          'publicPayload', question.public_payload
        ) order by item.position
      )
      from private.challenge_items item
      join private.question_versions question on question.id = item.question_version_id
      join private.question_definitions question_definition on question_definition.id = question.question_definition_id
      where item.challenge_version_id = version.id
    ), '[]'::jsonb)
  )
  from private.challenge_versions version
  join private.challenge_definitions definition on definition.id = version.challenge_definition_id
  where version.id = target_challenge_version_id;
$$;

-- Generation is repository-backed. PostgreSQL authorizes templates and publication policy only.
create table private.rehearsal_publication_policies (
  scheduled_challenge_id uuid primary key references public.scheduled_challenges(id) on delete cascade,
  enabled boolean not null default true,
  updated_by_player_id uuid not null references public.players(id),
  updated_at timestamptz not null default statement_timestamp()
);
alter table private.rehearsal_publication_policies enable row level security;
revoke all on private.rehearsal_publication_policies from public, anon, authenticated, service_role;

create function private.rehearsal_template(version_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('challengeVersionId',v.id,'title',v.title,'mode',v.mode,
    'globalTimeLimitMs',v.global_time_limit_ms,'modeConfig',v.mode_config,'questions',coalesce((
      select jsonb_agg(jsonb_build_object('type',q.type,'payloadSchemaVersion',q.payload_schema_version,
        'difficulty',q.difficulty,'timeLimitMs',q.time_limit_ms,'points',i.points,
        'modeConfig',i.mode_config,'publicPayload',q.public_payload) order by i.position)
      from private.challenge_items i join private.question_versions q on q.id=i.question_version_id
      where i.challenge_version_id=v.id),'[]'::jsonb))
  from private.challenge_versions v where v.id=version_id
    and v.mode in ('flash','survival','pyramid','alphabet','time-trial')
$$;

create function private.read_player_rehearsal_template(room_slug text, publication_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  select jsonb_build_object('template',private.rehearsal_template(v.id),'enabled',coalesce(policy.enabled,true)) into result
  from public.scheduled_challenges p join public.seasons season on season.id=p.season_id
  join public.rooms room on room.id=season.room_id
  join public.room_memberships m on m.room_id=room.id
  join private.challenge_versions v on v.id=p.challenge_version_id
  left join private.rehearsal_publication_policies policy on policy.scheduled_challenge_id=p.id
  where room.slug=room_slug and p.id=publication_id and room.status='active'
    and m.player_id=private.current_player_id() and m.status='active' and m.role<>'spectator'
    and v.mode in ('flash','survival','pyramid','alphabet','time-trial') and v.status in ('published','archived')
    and private.publication_effective_status(p.status,season.status,season.starts_at,season.ends_at,p.opens_at,p.closes_at,statement_timestamp()) in ('upcoming','available')
    and not exists(select 1 from public.attempts a where a.scheduled_challenge_id=p.id and a.player_id=m.player_id and a.kind='competitive');
  return result;
end $$;

create function private.read_editorial_rehearsal_template(version_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists(select 1 from private.platform_role_assignments where player_id=private.current_player_id() and role='superadmin') then
    raise exception 'not_authorized' using errcode='42501';
  end if;
  select jsonb_build_object('template',private.rehearsal_template(v.id),'status',v.status,
    'publications',coalesce((select jsonb_agg(jsonb_build_object('publicationId',p.id,'label',room.title||' · '||season.title||' · #'||p.number,'enabled',coalesce(policy.enabled,true),'updatedAt',policy.updated_at) order by p.id)
      from public.scheduled_challenges p join public.seasons season on season.id=p.season_id join public.rooms room on room.id=season.room_id left join private.rehearsal_publication_policies policy on policy.scheduled_challenge_id=p.id
      where p.challenge_version_id=v.id),'[]'::jsonb)) into result
  from private.challenge_versions v where v.id=version_id and v.mode in ('flash','survival','pyramid','alphabet','time-trial');
  return result;
end $$;

create function private.set_rehearsal_publication_policy(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid:=private.current_player_id(); key text:=input->>'idempotencyKey';
  cached private.command_requests%rowtype; current_policy private.rehearsal_publication_policies%rowtype;
  publication_id uuid; result jsonb;
begin
  if actor is null or not exists(select 1 from private.platform_role_assignments where player_id=actor and role='superadmin') then raise exception 'not_authorized' using errcode='42501'; end if;
  if jsonb_typeof(input) is distinct from 'object' or not input ?& array['publicationId','enabled','expectedUpdatedAt','idempotencyKey','reason']
    or jsonb_typeof(input->'enabled') is distinct from 'boolean'
    or jsonb_typeof(input->'reason') is distinct from 'string'
    or char_length(btrim(input->>'reason')) not between 1 and 500
    or key is null or char_length(key) not between 8 and 160 then raise exception 'invalid_command' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('rehearsal-policy:'||actor||':'||key,0));
  select * into cached from private.command_requests where actor_id=actor and idempotency_key=key;
  if found then
    if cached.operation<>'set_rehearsal_publication_policy' or cached.input<>input then raise exception 'idempotency_conflict' using errcode='40001'; end if;
    return cached.result;
  end if;
  publication_id:=(input->>'publicationId')::uuid;
  perform 1 from public.scheduled_challenges where id=publication_id for update;
  if not found then raise exception 'content_not_found' using errcode='P0002'; end if;
  select * into current_policy from private.rehearsal_publication_policies where scheduled_challenge_id=publication_id;
  if current_policy.updated_at is distinct from (input->>'expectedUpdatedAt')::timestamptz then raise exception 'content_conflict' using errcode='40001'; end if;
  insert into private.rehearsal_publication_policies(scheduled_challenge_id,enabled,updated_by_player_id,updated_at)
    values(publication_id,(input->>'enabled')::boolean,actor,clock_timestamp())
    on conflict(scheduled_challenge_id) do update set enabled=excluded.enabled,updated_by_player_id=actor,updated_at=excluded.updated_at;
  result:=jsonb_build_object('publicationId',publication_id,'enabled',input->'enabled');
  insert into private.audit_log(actor_player_id,action,entity_type,entity_id,reason,request_id,before_payload,after_payload)
    values(actor,'set_rehearsal_publication_policy','scheduled_challenge',publication_id,input->>'reason',key,to_jsonb(current_policy),result);
  insert into private.command_requests(actor_id,idempotency_key,operation,input,result) values(actor,key,'set_rehearsal_publication_policy',input,result);
  return result;
end $$;
revoke all on function private.rehearsal_template(uuid), private.read_player_rehearsal_template(text,uuid),
  private.read_editorial_rehearsal_template(uuid),private.set_rehearsal_publication_policy(jsonb) from public,anon,authenticated,service_role;
grant execute on function private.read_player_rehearsal_template(text,uuid),private.read_editorial_rehearsal_template(uuid),private.set_rehearsal_publication_policy(jsonb) to service_role;
