-- word-search: editorial validation and published eligibility are distinct contracts.
-- Helpers declared later in the schema are resolved after the full load.
set local check_function_bodies = off;

create function private.validate_word_search_question_document(document jsonb) returns void
language plpgsql volatile security invoker set search_path = '' as $$
declare
  public_payload jsonb;
  solution_payload jsonb;
  grid_rows integer;
  grid_columns integer;
  target_id text;
  target_word text;
  target_pos jsonb;
  start_cell_i integer;
  end_cell_i integer;
  start_row_i integer;
  start_col_i integer;
  end_row_i integer;
  end_col_i integer;
  row_step_i integer;
  col_step_i integer;
  word_length_i integer;
  path_cell_i integer;
  path_offset_i integer;
  occurrence_count_i integer;
  candidate_word text;
  candidate_segment text;
  target_segment text;
  check_start integer;
  direction_row integer;
  direction_col integer;
  cell_row integer;
  cell_col integer;
  seen_ids text[] := array[]::text[];
  seen_words text[] := array[]::text[];
  seen_segments text[] := array[]::text[];
begin
  public_payload := document->'publicPayload';
  solution_payload := document->'solutionPayload';
  if jsonb_typeof(public_payload) is distinct from 'object'
    or not public_payload ?& array['question', 'grid', 'letters', 'targets']
    or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
      'category', 'tags', 'question', 'grid', 'letters', 'targets'
    ]))
    or private.editorial_has_secret_key(public_payload)
    or jsonb_typeof(public_payload->'question') is distinct from 'string'
    or char_length(btrim(public_payload->>'question')) not between 1 and 2000
    or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
    or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
    or jsonb_typeof(public_payload->'grid') is distinct from 'object'
    or exists (select 1 from jsonb_object_keys(public_payload->'grid') key_name where key_name <> all(array['rows', 'columns']))
    or not public_payload->'grid' ?& array['rows', 'columns']
    or jsonb_typeof(public_payload->'grid'->'rows') is distinct from 'number'
    or jsonb_typeof(public_payload->'grid'->'columns') is distinct from 'number'
    or (public_payload->'grid'->>'rows')::numeric <> trunc((public_payload->'grid'->>'rows')::numeric)
    or (public_payload->'grid'->>'columns')::numeric <> trunc((public_payload->'grid'->>'columns')::numeric)
    or (public_payload->'grid'->>'rows')::integer not between 6 and 10
    or (public_payload->'grid'->>'columns')::integer not between 6 and 10
    or jsonb_typeof(public_payload->'letters') is distinct from 'array'
    or jsonb_array_length(public_payload->'letters') <> (public_payload->'grid'->>'rows')::integer * (public_payload->'grid'->>'columns')::integer
    or exists (select 1 from jsonb_array_elements_text(public_payload->'letters') letter
      where char_length(upper(btrim(letter))) <> 1 or upper(btrim(letter)) !~ '^[A-ZÁÉÍÓÚÜÑ]$')
    or jsonb_typeof(public_payload->'targets') is distinct from 'array'
    or jsonb_array_length(public_payload->'targets') not between 2 and 8
    or exists (select 1 from jsonb_array_elements(public_payload->'targets') item
      where jsonb_typeof(item) is distinct from 'object'
        or not item ?& array['id', 'word']
        or exists (select 1 from jsonb_object_keys(item) key_name where key_name <> all(array['id', 'word']))
        or jsonb_typeof(item->'id') is distinct from 'string'
        or char_length(btrim(item->>'id')) not between 1 and 120
        or jsonb_typeof(item->'word') is distinct from 'string'
        or char_length(btrim(item->>'word')) not between 1 and 120
        or upper(btrim(item->>'word')) !~ '^[A-ZÁÉÍÓÚÜÑ]+$')
    or exists (select 1 from (
      select btrim(item->>'id') value from jsonb_array_elements(public_payload->'targets') item
      group by btrim(item->>'id') having count(*) > 1
    ) duplicate)
    or exists (select 1 from (
      select upper(btrim(item->>'word')) value from jsonb_array_elements(public_payload->'targets') item
      group by upper(btrim(item->>'word')) having count(*) > 1
    ) duplicate) then
    raise exception 'invalid_public_payload' using errcode = '22023';
  end if;
  if jsonb_typeof(solution_payload) is distinct from 'object'
    or not solution_payload ? 'positionsByTargetId'
    or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['positionsByTargetId', 'explanation']))
    or jsonb_typeof(solution_payload->'positionsByTargetId') is distinct from 'object'
    or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string')
    or (select count(*) from jsonb_object_keys(solution_payload->'positionsByTargetId')) <> jsonb_array_length(public_payload->'targets')
    or exists (select 1 from jsonb_array_elements(public_payload->'targets') item
      where not solution_payload->'positionsByTargetId' ? (item->>'id')) then
    raise exception 'invalid_solution_payload' using errcode = '22023';
  end if;

  grid_rows := (public_payload->'grid'->>'rows')::integer;
  grid_columns := (public_payload->'grid'->>'columns')::integer;
  for target_id, target_word in
    select btrim(item->>'id'), upper(btrim(item->>'word'))
    from jsonb_array_elements(public_payload->'targets') item
  loop
    target_pos := solution_payload->'positionsByTargetId'->target_id;
    if jsonb_typeof(target_pos) is distinct from 'object'
      or not target_pos ?& array['startCell', 'endCell']
      or exists (select 1 from jsonb_object_keys(target_pos) key_name where key_name <> all(array['startCell', 'endCell']))
      or jsonb_typeof(target_pos->'startCell') is distinct from 'number'
      or jsonb_typeof(target_pos->'endCell') is distinct from 'number'
      or (target_pos->>'startCell')::numeric <> trunc((target_pos->>'startCell')::numeric)
      or (target_pos->>'endCell')::numeric <> trunc((target_pos->>'endCell')::numeric) then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    start_cell_i := (target_pos->>'startCell')::integer;
    end_cell_i := (target_pos->>'endCell')::integer;
    start_row_i := floor(start_cell_i / grid_columns);
    start_col_i := start_cell_i % grid_columns;
    end_row_i := floor(end_cell_i / grid_columns);
    end_col_i := end_cell_i % grid_columns;
    if start_cell_i not between 0 and grid_rows * grid_columns - 1
      or end_cell_i not between 0 and grid_rows * grid_columns - 1
      or start_cell_i = end_cell_i
      or not (start_row_i = end_row_i or start_col_i = end_col_i or abs(start_row_i - end_row_i) = abs(start_col_i - end_col_i)) then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    word_length_i := char_length(target_word);
    if array_length(seen_ids, 1) is not null and target_id = any(seen_ids)
      or array_length(seen_words, 1) is not null and target_word = any(seen_words) then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    seen_ids := seen_ids || target_id;
    seen_words := seen_words || target_word;
    target_segment := least(start_cell_i, end_cell_i)::text || ':' || greatest(start_cell_i, end_cell_i)::text;
    if array_length(seen_segments, 1) is not null and target_segment = any(seen_segments) then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    seen_segments := seen_segments || target_segment;
    row_step_i := sign(end_row_i - start_row_i);
    col_step_i := sign(end_col_i - start_col_i);
    candidate_word := '';
    for path_offset_i in 0..word_length_i - 1 loop
      path_cell_i := (start_row_i + row_step_i * path_offset_i) * grid_columns + start_col_i + col_step_i * path_offset_i;
      if path_cell_i < 0 or path_cell_i >= grid_rows * grid_columns then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      candidate_word := candidate_word || upper(btrim(public_payload->'letters'->>path_cell_i));
    end loop;
    if candidate_word <> target_word then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;

    occurrence_count_i := 0;
    for check_start in 0..grid_rows * grid_columns - 1 loop
      for direction_row in -1..1 loop
        for direction_col in -1..1 loop
          if direction_row = 0 and direction_col = 0 then continue; end if;
          candidate_word := '';
          candidate_segment := null;
          for path_offset_i in 0..word_length_i - 1 loop
            cell_row := floor(check_start / grid_columns) + direction_row * path_offset_i;
            cell_col := (check_start % grid_columns) + direction_col * path_offset_i;
            if cell_row < 0 or cell_row >= grid_rows or cell_col < 0 or cell_col >= grid_columns then
              candidate_word := null;
              exit;
            end if;
            path_cell_i := cell_row * grid_columns + cell_col;
            candidate_word := candidate_word || upper(btrim(public_payload->'letters'->>path_cell_i));
          end loop;
          if candidate_word = target_word then
            candidate_segment := least(check_start, path_cell_i)::text || ':' || greatest(check_start, path_cell_i)::text;
            occurrence_count_i := occurrence_count_i + 1;
            if candidate_segment = target_segment then
              -- Both directions describe one undirected occurrence.
              occurrence_count_i := occurrence_count_i - 1;
            end if;
          end if;
        end loop;
      end loop;
    end loop;
    if occurrence_count_i <> 0 then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
  end loop;
  return;
end;
$$;

alter function private.validate_word_search_question_document(jsonb) owner to postgres;
revoke all on function private.validate_word_search_question_document(jsonb)
  from public, anon, authenticated, service_role;

create function private.is_supported_word_search_question(question private.question_versions, solution jsonb) returns boolean
language plpgsql stable security invoker set search_path = '' as $$
begin
  if question.type = 'word-search' and question.payload_schema_version = 1 then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and jsonb_typeof(question.public_payload->'grid') = 'object'
      and (question.public_payload->'grid'->>'rows')::integer between 6 and 10
      and (question.public_payload->'grid'->>'columns')::integer between 6 and 10
      and jsonb_typeof(question.public_payload->'letters') = 'array'
      and jsonb_array_length(question.public_payload->'letters') =
        (question.public_payload->'grid'->>'rows')::integer * (question.public_payload->'grid'->>'columns')::integer
      and jsonb_typeof(question.public_payload->'targets') = 'array'
      and jsonb_array_length(question.public_payload->'targets') between 2 and 8
      and not private.editorial_has_secret_key(question.public_payload)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'positionsByTargetId') = 'object';
  end if;
  return false;
end;
$$;

alter function private.is_supported_word_search_question(private.question_versions, jsonb) owner to postgres;
revoke all on function private.is_supported_word_search_question(private.question_versions, jsonb)
  from public, anon, authenticated, service_role;
