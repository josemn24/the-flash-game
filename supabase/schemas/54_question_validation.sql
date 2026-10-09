-- Shared question eligibility used by room projections and competitive flows.
-- Later format and mode helpers are resolved after the declarative schema is loaded.
set local check_function_bodies = off;

create function private.is_supported_flash_question(target_question uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  question private.question_versions%rowtype;
  solution jsonb;
begin
  select * into question from private.question_versions where id = target_question;
  if not found or question.status <> 'published' then return false; end if;
  select solution_payload into solution from private.question_version_solutions where question_version_id = question.id;
  if question.type = 'progressive-image' and question.payload_schema_version = 2 then
    return private.is_supported_progressive_image_question(question, solution);
  end if;
  if question.type = 'multiple-choice' and question.payload_schema_version = 2 then
    return private.is_supported_multiple_choice_question(question, solution);
  end if;
  if question.type = 'estimation' and question.payload_schema_version = 2 then
    return private.is_supported_estimation_question(question, solution);
  end if;
  if question.type = 'heat-map' and question.payload_schema_version = 2 then
    return private.is_supported_heat_map_question(question, solution);
  end if;
  if question.type = 'queens' and question.payload_schema_version = 1 then
    return private.is_supported_queens_question(question, solution);
  end if;
  if question.type = 'word-search' and question.payload_schema_version = 1 then
    return private.is_supported_word_search_question(question, solution);
  end if;
  if question.type in (
    'true-false', 'ordering', 'classification', 'logic-matrix',
    'zip', 'escape', 'word-hashtag', 'odd-one-out', 'connect-pairs'
  ) then
    return private.is_supported_competitive_question_extension(target_question);
  end if;
  -- Versions already declared by the competitive capability contract. Publication
  -- continues to require v2; these branches only read existing published v1 content.
  if question.type = 'estimation' and question.payload_schema_version = 1 then
    return private.is_supported_estimation_question(question, solution);
  end if;
  if question.type = 'heat-map' and question.payload_schema_version = 1 then
    return private.is_supported_heat_map_question(question, solution);
  end if;
  if question.type = 'anagram' and question.payload_schema_version = 1 then
    return private.is_supported_anagram_question(question, solution);
  end if;
  if question.payload_schema_version <> 1 then return false; end if;
  if question.type = 'multiple-choice' then
    return private.is_supported_multiple_choice_question(question, solution);
  end if;
  if question.type = 'short-text' then
    return private.is_supported_short_text_question(question, solution);
  end if;
  if question.type = 'logic-code' then
    return private.is_supported_logic_code_question(question, solution);
  end if;
  if question.type = 'progressive-clues' then
    return private.is_supported_progressive_clues_question(question, solution);
  end if;
  if question.type = 'matching' then
    return private.is_supported_matching_question(question, solution);
  end if;
  if question.type = 'progressive-image' then
    return private.is_supported_progressive_image_question(question, solution);
  end if;
  return private.is_supported_mini_wordle_question(question, solution);
exception when others then
  return false;
end;
$$;

-- Shared editorial entry point for one question document.
-- Common envelope and dispatch only; format rules live in 53_question_validation_*.sql.
create function private.validate_flash_question_document(document jsonb) returns void
language plpgsql volatile set search_path = '' as $$
declare
  question jsonb;
  question_slug text;
begin
  if document is null or jsonb_typeof(document) is distinct from 'object' or document ? 'points' then
    raise exception 'invalid_question_document' using errcode = '22023';
  end if;
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

alter function private.validate_flash_question_document(jsonb) owner to postgres;
revoke all on function private.validate_flash_question_document(jsonb)
  from public, anon, authenticated, service_role;
