-- E04: extend the E03 editorial and publication boundaries for matching.

set local check_function_bodies = off;

create or replace function private.validate_flash_editorial_document(document jsonb) returns void
language plpgsql volatile set search_path = '' as $$
declare
  question jsonb; sanitized_question jsonb; sanitized_questions jsonb := '[]'::jsonb; sanitized_document jsonb;
  public_payload jsonb; solution_payload jsonb; question_index integer; normalized_correct text;
begin
  if jsonb_typeof(document) is distinct from 'object' or jsonb_typeof(document->'questions') is distinct from 'array'
    or not exists (select 1 from jsonb_array_elements(document->'questions') value where value->>'type' in ('progressive-clues','matching')) then
    perform private.validate_flash_editorial_document_base(document); return;
  end if;
  for question, question_index in select value, ordinality::integer from jsonb_array_elements(document->'questions') with ordinality loop
    if question->>'type' in ('progressive-clues','matching') then
      sanitized_question := jsonb_set(question, '{type}', '"multiple-choice"'::jsonb);
      sanitized_question := jsonb_set(sanitized_question, '{publicPayload}', '{"question":"E04","options":["E04","E04-2"]}'::jsonb);
      sanitized_question := jsonb_set(sanitized_question, '{solutionPayload}', '{"correctAnswer":"E04"}'::jsonb);
    else sanitized_question := question; end if;
    sanitized_questions := sanitized_questions || jsonb_build_array(sanitized_question);
  end loop;
  sanitized_document := jsonb_set(document, '{questions}', sanitized_questions);
  perform private.validate_flash_editorial_document_base(sanitized_document);
  for question in select value from jsonb_array_elements(document->'questions') loop
    if question->>'type' = 'progressive-clues' then
      public_payload := question->'publicPayload'; solution_payload := question->'solutionPayload';
      if jsonb_typeof(public_payload) is distinct from 'object' or not public_payload ?& array['question','clues','cluePenalty']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array['category','tags','question','clues','cluePenalty']))
        or private.editorial_has_secret_key(public_payload) or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'clues') is distinct from 'array' or jsonb_array_length(public_payload->'clues') not between 1 and 20
        or jsonb_typeof(public_payload->'cluePenalty') is distinct from 'number' or (public_payload->>'cluePenalty')::numeric <> trunc((public_payload->>'cluePenalty')::numeric)
        or (public_payload->>'cluePenalty')::integer not between 0 and 50
        or exists (select 1 from jsonb_array_elements(public_payload->'clues') clue where jsonb_typeof(clue) is distinct from 'string' or char_length(btrim(clue #>> '{}')) not between 1 and 500) then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object' or not solution_payload ?& array['correctAnswer','acceptedAnswers']
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['correctAnswer','acceptedAnswers','explanation']))
        or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string' or char_length(btrim(solution_payload->>'correctAnswer')) not between 1 and 500
        or jsonb_typeof(solution_payload->'acceptedAnswers') is distinct from 'array' or jsonb_array_length(solution_payload->'acceptedAnswers') not between 1 and 100
        or exists (select 1 from jsonb_array_elements(solution_payload->'acceptedAnswers') answer where jsonb_typeof(answer) is distinct from 'string' or char_length(btrim(answer #>> '{}')) not between 1 and 500)
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      normalized_correct := regexp_replace(lower(translate(btrim(solution_payload->>'correctAnswer'),'ÁÉÍÓÚÜáéíóúü','AEIOUUAEIOUU')), '\s+', '', 'g');
      if exists (select 1 from jsonb_array_elements_text(solution_payload->'acceptedAnswers') answer group by regexp_replace(lower(translate(btrim(answer),'ÁÉÍÓÚÜáéíóúü','AEIOUUAEIOUU')), '\s+', '', 'g') having count(*) > 1)
        or not exists (select 1 from jsonb_array_elements_text(solution_payload->'acceptedAnswers') answer where regexp_replace(lower(translate(btrim(answer),'ÁÉÍÓÚÜáéíóúü','AEIOUUAEIOUU')), '\s+', '', 'g') = normalized_correct) then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
    elsif question->>'type' = 'matching' then
      public_payload := question->'publicPayload'; solution_payload := question->'solutionPayload';
      if jsonb_typeof(public_payload) is distinct from 'object' or not public_payload ?& array['question','leftItems','rightItems']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array['category','tags','question','leftItems','rightItems']))
        or private.editorial_has_secret_key(public_payload) or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'leftItems') is distinct from 'array' or jsonb_typeof(public_payload->'rightItems') is distinct from 'array'
        or jsonb_array_length(public_payload->'leftItems') not between 3 and 6 or jsonb_array_length(public_payload->'rightItems') <> jsonb_array_length(public_payload->'leftItems')
        or (public_payload ? 'category' and (jsonb_typeof(public_payload->'category') is distinct from 'string' or char_length(public_payload->>'category') > 160))
        or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
        or exists (select 1 from jsonb_array_elements(public_payload->'leftItems') item where jsonb_typeof(item) is distinct from 'object' or not item ?& array['id','label'] or exists (select 1 from jsonb_object_keys(item) key_name where key_name <> all(array['id','label','icon','media'])) or jsonb_typeof(item->'id') is distinct from 'string' or char_length(btrim(item->>'id')) not between 1 and 120 or jsonb_typeof(item->'label') is distinct from 'string' or char_length(btrim(item->>'label')) not between 1 and 500 or (item ? 'icon' and (jsonb_typeof(item->'icon') is distinct from 'string' or char_length(item->>'icon') > 32)) or (item ? 'media' and jsonb_typeof(item->'media') not in ('null','object')))
        or exists (select 1 from jsonb_array_elements(public_payload->'rightItems') item where jsonb_typeof(item) is distinct from 'object' or not item ?& array['id','label'] or exists (select 1 from jsonb_object_keys(item) key_name where key_name <> all(array['id','label','icon','media'])) or jsonb_typeof(item->'id') is distinct from 'string' or char_length(btrim(item->>'id')) not between 1 and 120 or jsonb_typeof(item->'label') is distinct from 'string' or char_length(btrim(item->>'label')) not between 1 and 500 or (item ? 'icon' and (jsonb_typeof(item->'icon') is distinct from 'string' or char_length(item->>'icon') > 32)) or (item ? 'media' and jsonb_typeof(item->'media') not in ('null','object')))
        or exists (select 1 from (select item->>'id' as id from jsonb_array_elements(public_payload->'leftItems') item group by item->>'id' having count(*) > 1) duplicate_id)
        or exists (select 1 from (select item->>'id' as id from jsonb_array_elements(public_payload->'rightItems') item group by item->>'id' having count(*) > 1) duplicate_id)
        or exists (select 1 from (select regexp_replace(lower(btrim(item->>'label')), '\s+', ' ', 'g') as label from jsonb_array_elements(public_payload->'leftItems') item group by regexp_replace(lower(btrim(item->>'label')), '\s+', ' ', 'g') having count(*) > 1) duplicate_label)
        or exists (select 1 from (select regexp_replace(lower(btrim(item->>'label')), '\s+', ' ', 'g') as label from jsonb_array_elements(public_payload->'rightItems') item group by regexp_replace(lower(btrim(item->>'label')), '\s+', ' ', 'g') having count(*) > 1) duplicate_label) then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object' or not solution_payload ? 'matches'
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['matches','explanation']))
        or jsonb_typeof(solution_payload->'matches') is distinct from 'object'
        or (select count(*) from jsonb_object_keys(solution_payload->'matches')) <> jsonb_array_length(public_payload->'leftItems')
        or exists (select 1 from jsonb_array_elements(public_payload->'leftItems') item where not (solution_payload->'matches' ? (item->>'id')))
        or exists (select 1 from jsonb_each_text(solution_payload->'matches') match where not exists (select 1 from jsonb_array_elements(public_payload->'rightItems') item where item->>'id' = match.value))
        or (select count(*) from jsonb_each_text(solution_payload->'matches')) <> (select count(distinct value) from jsonb_each_text(solution_payload->'matches'))
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
    end if;
  end loop;
end;
$$;
alter function private.validate_flash_editorial_document(jsonb) owner to postgres;
revoke all on function private.validate_flash_editorial_document(jsonb) from public, anon, authenticated, service_role;

create or replace function private.is_supported_flash_question(target_question uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare question private.question_versions%rowtype; solution jsonb;
begin
  select * into question from private.question_versions where id = target_question;
  if not found or question.type <> 'matching' then return private.is_supported_flash_question_base(target_question); end if;
  select solution_payload into solution from private.question_version_solutions where question_version_id = question.id;
  return question.status = 'published' and question.payload_schema_version = 1
    and jsonb_typeof(question.public_payload) = 'object'
    and jsonb_typeof(question.public_payload->'leftItems') = 'array'
    and jsonb_typeof(question.public_payload->'rightItems') = 'array'
    and jsonb_array_length(question.public_payload->'leftItems') between 3 and 6
    and jsonb_array_length(question.public_payload->'rightItems') = jsonb_array_length(question.public_payload->'leftItems')
    and jsonb_typeof(solution) = 'object' and jsonb_typeof(solution->'matches') = 'object'
    and (select count(*) from jsonb_object_keys(solution->'matches')) = jsonb_array_length(question.public_payload->'leftItems')
    and not private.editorial_has_secret_key(question.public_payload)
    and not exists (select 1 from jsonb_array_elements(question.public_payload->'leftItems') item where jsonb_typeof(item->'id') is distinct from 'string' or char_length(btrim(item->>'id')) not between 1 and 120 or jsonb_typeof(item->'label') is distinct from 'string' or char_length(btrim(item->>'label')) not between 1 and 500)
    and not exists (select 1 from jsonb_array_elements(question.public_payload->'rightItems') item where jsonb_typeof(item->'id') is distinct from 'string' or char_length(btrim(item->>'id')) not between 1 and 120 or jsonb_typeof(item->'label') is distinct from 'string' or char_length(btrim(item->>'label')) not between 1 and 500)
    and not exists (select 1 from jsonb_each_text(solution->'matches') match where not exists (select 1 from jsonb_array_elements(question.public_payload->'rightItems') item where item->>'id' = match.value))
    and (select count(*) from jsonb_each_text(solution->'matches')) = (select count(distinct value) from jsonb_each_text(solution->'matches'));
end;
$$;
alter function private.is_supported_flash_question(uuid) owner to postgres;
revoke all on function private.is_supported_flash_question(uuid) from public, anon, authenticated, service_role;
