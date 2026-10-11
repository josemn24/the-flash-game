-- Challenge-wide validation: modes, references, points and levels.
-- Keep the existing interface; format rules are delegated through the question facade.
set local check_function_bodies = off;

create function private.validate_flash_editorial_document(document jsonb) returns void
language plpgsql volatile set search_path = '' as $$
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
$$;

alter function private.validate_flash_editorial_document(jsonb) owner to postgres;
revoke all on function private.validate_flash_editorial_document(jsonb)
  from public, anon, authenticated, service_role;
