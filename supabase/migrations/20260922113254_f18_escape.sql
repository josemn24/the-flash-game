SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.escape_content_valid (
  public_payload   jsonb,
  solution_payload jsonb
)
  RETURNS boolean
  LANGUAGE plpgsql
  IMMUTABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  grid jsonb := public_payload->'grid';
  blocks jsonb := public_payload->'initialBlocks';
  reference jsonb := solution_payload->'referenceSolution';
  ids text[] := '{}';
  kinds text[] := '{}';
  orientations text[] := '{}';
  rows integer[] := '{}';
  columns integer[] := '{}';
  lengths integer[] := '{}';
  occupied integer[] := '{}';
  target_index integer := null;
  exit_row integer;
  block jsonb;
  move jsonb;
  index integer;
  block_index integer;
  step_offset integer;
  position integer;
  cell integer;
  row_value integer;
  column_value integer;
  length_value integer;
  move_from integer;
  move_to integer;
  current_position integer;
  maximum_position integer;
  candidate_row integer;
  candidate_column integer;
  target_id text;
  kind_value text;
  orientation_value text;
  block_id text;
  collision boolean;
  target_column integer;
  optimal_moves integer;
begin
  if jsonb_typeof(public_payload) is distinct from 'object'
    or jsonb_typeof(solution_payload) is distinct from 'object'
    or not public_payload ?& array['question', 'grid', 'initialBlocks']
    or not solution_payload ?& array['referenceSolution', 'optimalMoves']
    or jsonb_typeof(grid) is distinct from 'object'
    or jsonb_typeof(grid->'rows') is distinct from 'number'
    or jsonb_typeof(grid->'columns') is distinct from 'number'
    or jsonb_typeof(grid->'exit') is distinct from 'object'
    or (grid->>'rows')::numeric <> 6
    or (grid->>'columns')::numeric <> 6
    or grid->'exit'->>'side' <> 'right'
    or jsonb_typeof(grid->'exit'->'row') is distinct from 'number'
    or (grid->'exit'->>'row')::numeric <> trunc((grid->'exit'->>'row')::numeric)
    or jsonb_typeof(blocks) is distinct from 'array'
    or jsonb_array_length(blocks) = 0
    or jsonb_typeof(reference) is distinct from 'array'
    or jsonb_typeof(solution_payload->'optimalMoves') is distinct from 'number'
    or (solution_payload->>'optimalMoves')::numeric <> trunc((solution_payload->>'optimalMoves')::numeric)
    or (solution_payload->>'optimalMoves')::integer <= 0 then
    return false;
  end if;

  exit_row := (grid->'exit'->>'row')::integer;
  if exit_row not between 0 and 5
    or jsonb_array_length(reference) <> (solution_payload->>'optimalMoves')::integer then
    return false;
  end if;
  optimal_moves := (solution_payload->>'optimalMoves')::integer;

  for block, index in
    select value, ordinality::integer from jsonb_array_elements(blocks) with ordinality
  loop
    if jsonb_typeof(block) is distinct from 'object'
      or not block ?& array['id', 'kind', 'orientation', 'row', 'column', 'length']
      or exists (select 1 from jsonb_object_keys(block) key_name where key_name <> all(array[
        'id', 'kind', 'orientation', 'row', 'column', 'length', 'label', 'symbol'
      ]))
      or jsonb_typeof(block->'id') is distinct from 'string'
      or btrim(block->>'id') = ''
      or jsonb_typeof(block->'kind') is distinct from 'string'
      or block->>'kind' not in ('target', 'obstacle')
      or jsonb_typeof(block->'orientation') is distinct from 'string'
      or block->>'orientation' not in ('horizontal', 'vertical')
      or jsonb_typeof(block->'row') is distinct from 'number'
      or (block->>'row')::numeric <> trunc((block->>'row')::numeric)
      or jsonb_typeof(block->'column') is distinct from 'number'
      or (block->>'column')::numeric <> trunc((block->>'column')::numeric)
      or jsonb_typeof(block->'length') is distinct from 'number'
      or (block->>'length')::numeric <> trunc((block->>'length')::numeric)
      or (block->>'length')::integer not in (2, 3)
      or (block ? 'label' and (jsonb_typeof(block->'label') is distinct from 'string'
        or char_length(block->>'label') > 500))
      or (block ? 'symbol' and (jsonb_typeof(block->'symbol') is distinct from 'string'
        or char_length(block->>'symbol') > 32)) then
      return false;
    end if;

    block_id := btrim(block->>'id');
    kind_value := block->>'kind';
    orientation_value := block->>'orientation';
    row_value := (block->>'row')::integer;
    column_value := (block->>'column')::integer;
    length_value := (block->>'length')::integer;
    if block_id = any(ids)
      or row_value < 0
      or column_value < 0
      or row_value + (case when orientation_value = 'vertical' then length_value else 1 end) > 6
      or column_value + (case when orientation_value = 'horizontal' then length_value else 1 end) > 6 then
      return false;
    end if;

    ids := ids || block_id;
    kinds := kinds || kind_value;
    orientations := orientations || orientation_value;
    rows := rows || row_value;
    columns := columns || column_value;
    lengths := lengths || length_value;
    if kind_value = 'target' then
      if target_index is not null then return false; end if;
      target_index := index;
      if orientation_value <> 'horizontal' or row_value <> exit_row then return false; end if;
    end if;

    for step_offset in 0..length_value - 1 loop
      cell := (row_value + case when orientation_value = 'vertical' then step_offset else 0 end) * 6
        + column_value + case when orientation_value = 'horizontal' then step_offset else 0 end;
      if cell = any(occupied) then return false; end if;
      occupied := occupied || cell;
    end loop;
  end loop;

  if target_index is null then return false; end if;
  target_column := columns[target_index];
  if target_column = 6 - lengths[target_index] then return false; end if;

  for move in select value from jsonb_array_elements(reference) loop
    if jsonb_typeof(move) is distinct from 'object'
      or not move ?& array['blockId', 'from', 'to']
      or exists (select 1 from jsonb_object_keys(move) key_name where key_name <> all(array['blockId', 'from', 'to']))
      or jsonb_typeof(move->'blockId') is distinct from 'string'
      or jsonb_typeof(move->'from') is distinct from 'number'
      or jsonb_typeof(move->'to') is distinct from 'number'
      or (move->>'from')::numeric <> trunc((move->>'from')::numeric)
      or (move->>'to')::numeric <> trunc((move->>'to')::numeric) then
      return false;
    end if;

    block_id := move->>'blockId';
    block_index := array_position(ids, block_id);
    if block_index is null then return false; end if;
    move_from := (move->>'from')::integer;
    move_to := (move->>'to')::integer;
    current_position := case when orientations[block_index] = 'horizontal'
      then columns[block_index] else rows[block_index] end;
    maximum_position := 6 - lengths[block_index];
    if move_from <> current_position
      or move_to = move_from
      or move_to not between 0 and maximum_position then
      return false;
    end if;

    collision := false;
    for position in least(move_from, move_to)..greatest(move_from, move_to) + lengths[block_index] - 1 loop
      candidate_row := case when orientations[block_index] = 'horizontal' then rows[block_index] else position end;
      candidate_column := case when orientations[block_index] = 'horizontal' then position else columns[block_index] end;
      for index in 1..coalesce(array_length(ids, 1), 0) loop
        if index <> block_index then
          for step_offset in 0..lengths[index] - 1 loop
            cell := (rows[index] + case when orientations[index] = 'vertical' then step_offset else 0 end) * 6
              + columns[index] + case when orientations[index] = 'horizontal' then step_offset else 0 end;
            if cell = candidate_row * 6 + candidate_column then collision := true; end if;
          end loop;
        end if;
      end loop;
    end loop;
    if collision then return false; end if;
    if orientations[block_index] = 'horizontal' then columns[block_index] := move_to;
    else rows[block_index] := move_to;
    end if;
  end loop;

  return rows[target_index] = exit_row and columns[target_index] = 6 - lengths[target_index];
end;
$function$;

CREATE OR REPLACE FUNCTION private.recover_attempt (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor(); key text := input->>'idempotencyKey';
  safe_input jsonb := input; cached private.command_requests%rowtype;
  a public.attempts%rowtype; s private.attempt_sessions%rowtype;
  cv private.challenge_versions%rowtype;
  segment private.interaction_intervals%rowtype; unit private.attempt_timing_units%rowtype;
  item private.challenge_items%rowtype; question private.question_versions%rowtype;
  receipt private.answer_receipts%rowtype; instant timestamptz := clock_timestamp();
  expected bigint; presented timestamptz; used_ms bigint; effective timestamptz; result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object' or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array['idempotencyKey','attemptId','lockVersion','sessionToken'])) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'recover' or cached.input <> safe_input) then raise exception 'idempotency_conflict' using errcode = '40001'; end if;
  if cached.result is not null then return cached.result; end if;
  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into s from private.attempt_sessions where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or s.revoked_at is not null then raise exception 'session_revoked' using errcode = '42501'; end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then raise exception 'stale_version' using errcode = '40001'; end if;
  select * into receipt from private.answer_receipts r where r.attempt_id = a.id and not exists (
    select 1 from private.attempt_answers aa where aa.receipt_id = r.id
  ) order by r.received_at limit 1 for update;
  if found then
    result := jsonb_build_object('receiptId', receipt.id, 'recovered', false);
  else
    select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null for update;
    if found then
      select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
      select * into item from private.challenge_items where id = segment.challenge_item_id;
      select * into question from private.question_versions where id = item.question_version_id;
      select * into cv from private.challenge_versions where id = a.challenge_version_id;
      if cv.mode = 'alphabet' and instant < unit.deadline_at then
        update private.interaction_intervals
        set ended_at = greatest(segment.started_at, least(instant, unit.deadline_at)),
            end_reason = 'recovery_interrupted'
        where id = segment.id;
        result := jsonb_build_object('receiptId', null, 'recovered', true,
          'recoveryInterrupted', true, 'challengeItemId', segment.challenge_item_id);
      elsif question.type in ('mini-wordle', 'logic-code', 'logic-matrix', 'progressive-clues', 'matching', 'progressive-image', 'queens', 'word-search', 'zip', 'escape') and instant < unit.deadline_at then
        result := jsonb_build_object('receiptId', null, 'recovered', false, 'preserved', true);
      else
        effective := greatest(segment.started_at, least(instant, unit.deadline_at));
        update private.interaction_intervals set ended_at = effective, end_reason = 'recovery_interrupted' where id = segment.id;
        select min(started_at), coalesce(sum(floor(extract(epoch from (ended_at - started_at)) * 1000)), 0)::bigint
          into presented, used_ms from private.interaction_intervals where attempt_id = a.id and challenge_item_id = segment.challenge_item_id;
        insert into private.answer_receipts(attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
          presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
        values(a.id, segment.challenge_item_id, a.challenge_version_id, null, instant, presented, effective, used_ms,
          instant >= unit.deadline_at, null) returning * into receipt;
        result := jsonb_build_object('receiptId', receipt.id, 'recovered', true);
      end if;
    else
      result := jsonb_build_object('receiptId', null, 'recovered', false);
    end if;
  end if;
  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant where id = a.id returning * into a;
  result := result || jsonb_build_object('attemptId', a.id, 'lockVersion', a.lock_version);
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'recover', 'attempt', a.id, key, jsonb_build_object('lockVersion', expected), result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'recover', safe_input, result);
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
  public_payload jsonb;
  solution_payload jsonb;
  option jsonb;
  question_slug text;
  seen_slugs text[] := array[]::text[];
  question_index integer;
  question_points numeric;
  total_points integer := 0;
  option_count integer;
  seen_question_versions text[] := array[]::text[];
  expected_word_length integer;
  max_attempts integer;
  code_length integer;
  selected_dictionary_id text;
  solution_word text;
  guess_word text;
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
    or challenge->>'mode' not in ('flash', 'alphabet')
    or challenge->'configSchemaVersion' <> '1'::jsonb
    or jsonb_typeof(challenge->'modeConfig') is distinct from 'object'
    or (challenge->>'mode' = 'alphabet' and (
      jsonb_typeof(challenge->'globalTimeLimitMs') is distinct from 'number'
      or (challenge->>'globalTimeLimitMs')::numeric <> trunc((challenge->>'globalTimeLimitMs')::numeric)
      or (challenge->>'globalTimeLimitMs')::integer <= 0
    ))
    or (challenge->>'mode' = 'flash' and challenge ? 'globalTimeLimitMs') then
    raise exception 'invalid_content' using errcode = '22023';
  end if;

  if jsonb_typeof(document->'questions') is distinct from 'array'
    or jsonb_array_length(document->'questions') not between 2 and 20 then
    raise exception 'incomplete_content' using errcode = '22023';
  end if;

  for question, question_index in
    select value, ordinality::integer
    from jsonb_array_elements(document->'questions') with ordinality
  loop
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
      total_points := total_points + (question->>'points')::integer;
      continue;
    end if;
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
      or question->>'type' not in ('multiple-choice', 'estimation', 'heat-map', 'mini-wordle', 'logic-code', 'logic-matrix', 'progressive-clues', 'matching', 'progressive-image', 'queens', 'true-false', 'odd-one-out', 'ordering', 'anagram', 'classification', 'short-text', 'word-search', 'zip', 'escape')
      or (question->>'type' not in ('progressive-image', 'multiple-choice', 'estimation', 'heat-map') and question->'payloadSchemaVersion' <> '1'::jsonb)
      or (question->>'type' in ('progressive-image', 'multiple-choice') and question->'payloadSchemaVersion' not in ('1'::jsonb, '2'::jsonb))
      or (question->>'type' in ('estimation', 'heat-map') and question->'payloadSchemaVersion' <> '2'::jsonb)
      or jsonb_typeof(question->'timeLimitMs') is distinct from 'number'
      or (question->>'timeLimitMs')::numeric <= 0
      or question_slug = any(seen_slugs) then
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

    public_payload := question->'publicPayload';
    solution_payload := question->'solutionPayload';
    seen_ids := array[]::text[];
    seen_words := array[]::text[];
    seen_segments := array[]::text[];

    if question->>'type' = 'estimation' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'min', 'max', 'step', 'initialValue', 'unit', 'media']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'min', 'max', 'step', 'initialValue', 'unit', 'media'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'min') is distinct from 'number'
        or jsonb_typeof(public_payload->'max') is distinct from 'number'
        or jsonb_typeof(public_payload->'step') is distinct from 'number'
        or jsonb_typeof(public_payload->'initialValue') is distinct from 'number'
        or (public_payload->>'min')::numeric >= (public_payload->>'max')::numeric
        or (public_payload->>'step')::numeric <= 0
        or (public_payload->>'initialValue')::numeric < (public_payload->>'min')::numeric
        or (public_payload->>'initialValue')::numeric > (public_payload->>'max')::numeric
        or abs(
          ((public_payload->>'initialValue')::numeric - (public_payload->>'min')::numeric) /
          (public_payload->>'step')::numeric - round(
            ((public_payload->>'initialValue')::numeric - (public_payload->>'min')::numeric) /
            (public_payload->>'step')::numeric
          )
        ) > 0.000000001
        or jsonb_typeof(public_payload->'unit') is distinct from 'string'
        or char_length(btrim(public_payload->>'unit')) not between 1 and 120
        or jsonb_typeof(public_payload->'media') not in ('null', 'object')
        or (jsonb_typeof(public_payload->'media') = 'object' and (
          not public_payload->'media' ?& array['type', 'assetId', 'alt', 'width', 'height']
          or exists (select 1 from jsonb_object_keys(public_payload->'media') key_name where key_name <> all(array[
            'type', 'assetId', 'alt', 'width', 'height', 'fit', 'position'
          ]))
          or public_payload->'media'->>'type' <> 'image'
          or public_payload->'media'->>'assetId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          or not private.is_ready_question_asset((public_payload->'media'->>'assetId')::uuid)
          or jsonb_typeof(public_payload->'media'->'alt') is distinct from 'string'
          or char_length(btrim(public_payload->'media'->>'alt')) not between 1 and 500
          or jsonb_typeof(public_payload->'media'->'width') is distinct from 'number'
          or (public_payload->'media'->>'width')::numeric <> trunc((public_payload->'media'->>'width')::numeric)
          or (public_payload->'media'->>'width')::integer not between 1 and 8192
          or jsonb_typeof(public_payload->'media'->'height') is distinct from 'number'
          or (public_payload->'media'->>'height')::numeric <> trunc((public_payload->'media'->>'height')::numeric)
          or (public_payload->'media'->>'height')::integer not between 1 and 8192
          or (public_payload->'media' ? 'fit' and public_payload->'media'->>'fit' not in ('cover', 'contain'))
          or (public_payload->'media' ? 'position' and (
            jsonb_typeof(public_payload->'media'->'position') is distinct from 'string'
            or char_length(public_payload->'media'->>'position') > 100
          ))
        )) then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ?& array['correctAnswer', 'tolerance']
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'correctAnswer', 'tolerance', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'number'
        or (solution_payload->>'correctAnswer')::numeric < (public_payload->>'min')::numeric
        or (solution_payload->>'correctAnswer')::numeric > (public_payload->>'max')::numeric
        or jsonb_typeof(solution_payload->'tolerance') is distinct from 'number'
        or (solution_payload->>'tolerance')::numeric < 0
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'heat-map' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'surface', 'targetLabel']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'surface', 'targetLabel'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'targetLabel') is distinct from 'string'
        or char_length(btrim(public_payload->>'targetLabel')) not between 1 and 500
        or jsonb_typeof(public_payload->'surface') is distinct from 'object'
        or not public_payload->'surface' ?& array['assetId', 'alt', 'width', 'height']
        or exists (select 1 from jsonb_object_keys(public_payload->'surface') key_name where key_name <> all(array[
          'assetId', 'alt', 'width', 'height', 'fit', 'position'
        ]))
        or public_payload->'surface'->>'assetId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or not private.is_ready_question_asset((public_payload->'surface'->>'assetId')::uuid)
        or jsonb_typeof(public_payload->'surface'->'alt') is distinct from 'string'
        or char_length(btrim(public_payload->'surface'->>'alt')) not between 1 and 500
        or jsonb_typeof(public_payload->'surface'->'width') is distinct from 'number'
        or (public_payload->'surface'->>'width')::numeric <> trunc((public_payload->'surface'->>'width')::numeric)
        or (public_payload->'surface'->>'width')::integer not between 1 and 8192
        or jsonb_typeof(public_payload->'surface'->'height') is distinct from 'number'
        or (public_payload->'surface'->>'height')::numeric <> trunc((public_payload->'surface'->>'height')::numeric)
        or (public_payload->'surface'->>'height')::integer not between 1 and 8192
        or (public_payload->'surface' ? 'fit' and public_payload->'surface'->>'fit' not in ('cover', 'contain'))
        or (public_payload->'surface' ? 'position' and (
          jsonb_typeof(public_payload->'surface'->'position') is distinct from 'string'
          or char_length(public_payload->'surface'->>'position') > 100
        )) then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ?& array['target', 'fullCreditRadius', 'toleranceRadius']
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'target', 'fullCreditRadius', 'toleranceRadius', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'target') is distinct from 'object'
        or not solution_payload->'target' ?& array['x', 'y']
        or exists (select 1 from jsonb_object_keys(solution_payload->'target') key_name where key_name <> all(array['x', 'y']))
        or jsonb_typeof(solution_payload->'target'->'x') is distinct from 'number'
        or (solution_payload->'target'->>'x')::numeric not between 0 and 1
        or jsonb_typeof(solution_payload->'target'->'y') is distinct from 'number'
        or (solution_payload->'target'->>'y')::numeric not between 0 and 1
        or jsonb_typeof(solution_payload->'fullCreditRadius') is distinct from 'number'
        or (solution_payload->>'fullCreditRadius')::numeric < 0
        or jsonb_typeof(solution_payload->'toleranceRadius') is distinct from 'number'
        or (solution_payload->>'toleranceRadius')::numeric <= (solution_payload->>'fullCreditRadius')::numeric
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

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

  if question->>'type' = 'logic-code' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'clues', 'codeLength']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'clues', 'codeLength'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'clues') is distinct from 'array'
        or jsonb_array_length(public_payload->'clues') not between 1 and 20
        or jsonb_typeof(public_payload->'codeLength') is distinct from 'number'
        or (public_payload->>'codeLength')::integer not between 1 and 12
        or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
        or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
        or exists (
          select 1
          from jsonb_array_elements(public_payload->'clues') clue
          where jsonb_typeof(clue) is distinct from 'object'
            or not clue ?& array['code', 'hint']
            or exists (select 1 from jsonb_object_keys(clue) key_name where key_name <> all(array['code', 'hint']))
            or jsonb_typeof(clue->'code') is distinct from 'string'
            or char_length(clue->>'code') <> (public_payload->>'codeLength')::integer
            or clue->>'code' !~ '^[0-9]+$'
            or jsonb_typeof(clue->'hint') is distinct from 'string'
            or char_length(btrim(clue->>'hint')) not between 1 and 500
        )
        or (select count(distinct clue->>'code') from jsonb_array_elements(public_payload->'clues') clue)
           <> jsonb_array_length(public_payload->'clues') then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ? 'correctAnswer'
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'correctAnswer', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
        or char_length(solution_payload->>'correctAnswer') <> (public_payload->>'codeLength')::integer
        or solution_payload->>'correctAnswer' !~ '^[0-9]+$'
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'logic-matrix' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'pieces', 'cells', 'optionIds']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'pieces', 'cells', 'optionIds', 'showPieceLabels'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'pieces') is distinct from 'array'
        or jsonb_array_length(public_payload->'pieces') not between 4 and 20
        or exists (
          select 1 from jsonb_array_elements(public_payload->'pieces') piece
          where jsonb_typeof(piece) is distinct from 'object'
            or not piece ?& array['id', 'symbol', 'label']
            or exists (select 1 from jsonb_object_keys(piece) key_name where key_name <> all(array['id', 'symbol', 'label']))
            or jsonb_typeof(piece->'id') is distinct from 'string'
            or char_length(btrim(piece->>'id')) not between 1 and 120
            or jsonb_typeof(piece->'symbol') is distinct from 'string'
            or char_length(btrim(piece->>'symbol')) not between 1 and 120
            or jsonb_typeof(piece->'label') is distinct from 'string'
            or char_length(btrim(piece->>'label')) not between 1 and 500
        )
        or (select count(*) from jsonb_array_elements(public_payload->'pieces') piece)
          <> (select count(distinct piece->>'id') from jsonb_array_elements(public_payload->'pieces') piece)
        or jsonb_typeof(public_payload->'cells') is distinct from 'array'
        or jsonb_array_length(public_payload->'cells') <> 9
        or (select count(*) from jsonb_array_elements(public_payload->'cells') cell where jsonb_typeof(cell) = 'null') <> 1
        or exists (
          select 1 from jsonb_array_elements(public_payload->'cells') cell
          where jsonb_typeof(cell) not in ('null', 'string')
            or (jsonb_typeof(cell) = 'string' and not exists (
              select 1 from jsonb_array_elements(public_payload->'pieces') piece where piece->>'id' = cell #>> '{}'
            ))
        )
        or jsonb_typeof(public_payload->'optionIds') is distinct from 'array'
        or jsonb_array_length(public_payload->'optionIds') <> 4
        or exists (
          select 1 from jsonb_array_elements(public_payload->'optionIds') option_id
          where jsonb_typeof(option_id) is distinct from 'string'
            or not exists (
              select 1 from jsonb_array_elements(public_payload->'pieces') piece where piece->>'id' = option_id #>> '{}'
            )
        )
        or (select count(*) from jsonb_array_elements_text(public_payload->'optionIds'))
          <> (select count(distinct value) from jsonb_array_elements_text(public_payload->'optionIds') value)
        or (public_payload ? 'showPieceLabels' and jsonb_typeof(public_payload->'showPieceLabels') not in ('null', 'boolean'))
        or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
        or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object') then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ? 'correctOptionId'
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['correctOptionId', 'explanation']))
        or jsonb_typeof(solution_payload->'correctOptionId') is distinct from 'string'
        or not exists (
          select 1 from jsonb_array_elements_text(public_payload->'optionIds') option_id
          where option_id = solution_payload->>'correctOptionId'
        )
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'progressive-clues' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'clues', 'cluePenalty']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'clues', 'cluePenalty'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'clues') is distinct from 'array'
        or jsonb_array_length(public_payload->'clues') not between 1 and 20
        or jsonb_typeof(public_payload->'cluePenalty') is distinct from 'number'
        or (public_payload->>'cluePenalty')::numeric <> trunc((public_payload->>'cluePenalty')::numeric)
        or (public_payload->>'cluePenalty')::integer not between 0 and 50
        or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
        or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
        or exists (
          select 1 from jsonb_array_elements(public_payload->'clues') clue
          where jsonb_typeof(clue) is distinct from 'string'
            or char_length(btrim(clue #>> '{}')) not between 1 and 500
        ) then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ?& array['correctAnswer', 'acceptedAnswers']
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'correctAnswer', 'acceptedAnswers', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
        or char_length(btrim(solution_payload->>'correctAnswer')) not between 1 and 500
        or jsonb_typeof(solution_payload->'acceptedAnswers') is distinct from 'array'
        or jsonb_array_length(solution_payload->'acceptedAnswers') not between 1 and 100
        or exists (
          select 1 from jsonb_array_elements(solution_payload->'acceptedAnswers') answer
          where jsonb_typeof(answer) is distinct from 'string'
            or char_length(btrim(answer #>> '{}')) not between 1 and 500
        )
        or exists (
          select 1
          from jsonb_array_elements_text(solution_payload->'acceptedAnswers') answer
          group by regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g')
          having count(*) > 1
        )
        or not exists (
          select 1 from jsonb_array_elements_text(solution_payload->'acceptedAnswers') answer
          where regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g') =
            regexp_replace(lower(translate(btrim(solution_payload->>'correctAnswer'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g')
        )
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'true-false' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ? 'question'
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
        or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object') then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ? 'correctAnswer'
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'correctAnswer', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'boolean'
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'odd-one-out' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'items']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'items'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'items') is distinct from 'array'
        or jsonb_array_length(public_payload->'items') not between 3 and 8
        or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
        or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
        or exists (
          select 1 from jsonb_array_elements(public_payload->'items') item
          where jsonb_typeof(item) is distinct from 'object'
            or not item ?& array['id', 'label']
            or exists (select 1 from jsonb_object_keys(item) key_name where key_name <> all(array['id', 'label', 'media']))
            or jsonb_typeof(item->'id') is distinct from 'string'
            or char_length(btrim(item->>'id')) not between 1 and 120
            or jsonb_typeof(item->'label') is distinct from 'string'
            or char_length(btrim(item->>'label')) not between 1 and 500
            or (item ? 'media' and jsonb_typeof(item->'media') not in ('null', 'object'))
        )
        or exists (select 1 from (
          select item->>'id' as id from jsonb_array_elements(public_payload->'items') item
          group by item->>'id' having count(*) > 1
        ) duplicate_id) then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ? 'correctAnswer'
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'correctAnswer', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
        or not exists (
          select 1 from jsonb_array_elements(public_payload->'items') item
          where item->>'id' = solution_payload->>'correctAnswer'
        )
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'ordering' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'items']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'items', 'directionLabels'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'items') is distinct from 'array'
        or jsonb_array_length(public_payload->'items') not between 2 and 8
        or exists (
          select 1 from jsonb_array_elements(public_payload->'items') item
          where jsonb_typeof(item) is distinct from 'string'
            or char_length(btrim(item #>> '{}')) not between 1 and 500
        )
        or exists (select 1 from (
          select value from jsonb_array_elements_text(public_payload->'items') group by value having count(*) > 1
        ) duplicate_item)
        or (public_payload ? 'directionLabels' and jsonb_typeof(public_payload->'directionLabels') not in ('null', 'object'))
        or (jsonb_typeof(public_payload->'directionLabels') = 'object' and (
          exists (select 1 from jsonb_object_keys(public_payload->'directionLabels') key_name where key_name not in ('start', 'end'))
          or not (public_payload->'directionLabels' ?& array['start', 'end'])
          or jsonb_typeof(public_payload->'directionLabels'->'start') is distinct from 'string'
          or char_length(btrim(public_payload->'directionLabels'->>'start')) not between 1 and 120
          or jsonb_typeof(public_payload->'directionLabels'->'end') is distinct from 'string'
          or char_length(btrim(public_payload->'directionLabels'->>'end')) not between 1 and 120
        ))
        or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
        or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object') then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ? 'correctOrder'
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'correctOrder', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'correctOrder') is distinct from 'array'
        or jsonb_array_length(solution_payload->'correctOrder') <> jsonb_array_length(public_payload->'items')
        or exists (
          select 1 from jsonb_array_elements(solution_payload->'correctOrder') item
          where jsonb_typeof(item) is distinct from 'string'
        )
        or exists (
          select 1 from jsonb_array_elements_text(solution_payload->'correctOrder') item
          where not exists (select 1 from jsonb_array_elements_text(public_payload->'items') public_item where public_item = item)
        )
        or (select count(*) from jsonb_array_elements_text(solution_payload->'correctOrder')) <> (
          select count(distinct value) from jsonb_array_elements_text(solution_payload->'correctOrder') value
        )
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'anagram' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'tiles']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'tiles', 'hint'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'tiles') is distinct from 'array'
        or jsonb_array_length(public_payload->'tiles') not between 3 and 10
        or exists (
          select 1 from jsonb_array_elements(public_payload->'tiles') tile
          where jsonb_typeof(tile) is distinct from 'object'
            or not tile ?& array['id', 'value']
            or exists (select 1 from jsonb_object_keys(tile) key_name where key_name <> all(array['id', 'value']))
            or jsonb_typeof(tile->'id') is distinct from 'string'
            or char_length(btrim(tile->>'id')) not between 1 and 120
            or jsonb_typeof(tile->'value') is distinct from 'string'
            or char_length(tile->>'value') <> 1
            or char_length(btrim(tile->>'value')) <> 1
        )
        or exists (select 1 from (
          select tile->>'id' as id from jsonb_array_elements(public_payload->'tiles') tile
          group by tile->>'id' having count(*) > 1
        ) duplicate_id)
        or (public_payload ? 'hint' and jsonb_typeof(public_payload->'hint') not in ('null', 'string'))
        or (public_payload ? 'hint' and jsonb_typeof(public_payload->'hint') = 'string' and char_length(public_payload->>'hint') > 500) then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ? 'correctAnswer'
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'correctAnswer', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
        or char_length(btrim(solution_payload->>'correctAnswer')) not between 3 and 120
        or solution_payload->>'correctAnswer' ~ '\s'
        or char_length(solution_payload->>'correctAnswer') <> jsonb_array_length(public_payload->'tiles')
        or (select string_agg(lower(translate(tile->>'value', 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '' order by lower(translate(tile->>'value', 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')))
            from jsonb_array_elements(public_payload->'tiles') tile) <>
          (select string_agg(lower(translate(letter, 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '' order by lower(translate(letter, 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')))
            from regexp_split_to_table(solution_payload->>'correctAnswer', '') letter)
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'classification' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'items', 'categories']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'items', 'categories'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'items') is distinct from 'array'
        or jsonb_array_length(public_payload->'items') not between 2 and 20
        or jsonb_typeof(public_payload->'categories') is distinct from 'array'
        or jsonb_array_length(public_payload->'categories') not between 2 and 8
        or exists (
          select 1 from jsonb_array_elements(public_payload->'items') item
          where jsonb_typeof(item) is distinct from 'object'
            or not item ? 'label'
            or exists (select 1 from jsonb_object_keys(item) key_name where key_name <> 'label')
            or jsonb_typeof(item->'label') is distinct from 'string'
            or char_length(btrim(item->>'label')) not between 1 and 500
        )
        or exists (select 1 from (
          select item->>'label' as label from jsonb_array_elements(public_payload->'items') item
          group by item->>'label' having count(*) > 1
        ) duplicate_label)
        or exists (
          select 1 from jsonb_array_elements(public_payload->'categories') category
          where jsonb_typeof(category) is distinct from 'string'
            or char_length(btrim(category #>> '{}')) not between 1 and 120
        )
        or exists (select 1 from (
          select value from jsonb_array_elements_text(public_payload->'categories') group by value having count(*) > 1
        ) duplicate_category) then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ? 'categoriesByItem'
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'categoriesByItem', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'categoriesByItem') is distinct from 'object'
        or (select count(*) from jsonb_object_keys(solution_payload->'categoriesByItem')) <> jsonb_array_length(public_payload->'items')
        or exists (
          select 1 from jsonb_array_elements(public_payload->'items') item
          where not (solution_payload->'categoriesByItem' ? (item->>'label'))
            or jsonb_typeof(solution_payload->'categoriesByItem'->(item->>'label')) is distinct from 'string'
            or not exists (
              select 1 from jsonb_array_elements_text(public_payload->'categories') category
              where category = solution_payload->'categoriesByItem'->>(item->>'label')
            )
        )
        or exists (
          select 1 from jsonb_object_keys(solution_payload->'categoriesByItem') key_name
          where not exists (select 1 from jsonb_array_elements(public_payload->'items') item where item->>'label' = key_name)
        )
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'matching' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'leftItems', 'rightItems']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'leftItems', 'rightItems'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'leftItems') is distinct from 'array'
        or jsonb_typeof(public_payload->'rightItems') is distinct from 'array'
        or jsonb_array_length(public_payload->'leftItems') not between 3 and 6
        or jsonb_array_length(public_payload->'rightItems') <> jsonb_array_length(public_payload->'leftItems')
        or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
        or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
        or exists (
          select 1 from jsonb_array_elements(public_payload->'leftItems') item
          where jsonb_typeof(item) is distinct from 'object'
            or not item ?& array['id', 'label']
            or exists (select 1 from jsonb_object_keys(item) key_name where key_name <> all(array['id', 'label', 'icon', 'media']))
            or jsonb_typeof(item->'id') is distinct from 'string'
            or char_length(btrim(item->>'id')) not between 1 and 120
            or jsonb_typeof(item->'label') is distinct from 'string'
            or char_length(btrim(item->>'label')) not between 1 and 500
            or (item ? 'icon' and (jsonb_typeof(item->'icon') is distinct from 'string' or char_length(item->>'icon') > 32))
            or (item ? 'media' and jsonb_typeof(item->'media') not in ('null', 'object'))
        )
        or exists (
          select 1 from jsonb_array_elements(public_payload->'rightItems') item
          where jsonb_typeof(item) is distinct from 'object'
            or not item ?& array['id', 'label']
            or exists (select 1 from jsonb_object_keys(item) key_name where key_name <> all(array['id', 'label', 'icon', 'media']))
            or jsonb_typeof(item->'id') is distinct from 'string'
            or char_length(btrim(item->>'id')) not between 1 and 120
            or jsonb_typeof(item->'label') is distinct from 'string'
            or char_length(btrim(item->>'label')) not between 1 and 500
            or (item ? 'icon' and (jsonb_typeof(item->'icon') is distinct from 'string' or char_length(item->>'icon') > 32))
            or (item ? 'media' and jsonb_typeof(item->'media') not in ('null', 'object'))
        )
        or exists (select 1 from (
          select item->>'id' as id from jsonb_array_elements(public_payload->'leftItems') item
          group by item->>'id' having count(*) > 1
        ) duplicate_id)
        or exists (select 1 from (
          select item->>'id' as id from jsonb_array_elements(public_payload->'rightItems') item
          group by item->>'id' having count(*) > 1
        ) duplicate_id)
        or exists (select 1 from (
          select regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') as label
          from jsonb_array_elements(public_payload->'leftItems') item
          group by regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') having count(*) > 1
        ) duplicate)
        or exists (select 1 from (
          select regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') as label
          from jsonb_array_elements(public_payload->'rightItems') item
          group by regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') having count(*) > 1
        ) duplicate) then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ? 'matches'
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['matches', 'explanation']))
        or jsonb_typeof(solution_payload->'matches') is distinct from 'object'
        or (select count(*) from jsonb_object_keys(solution_payload->'matches')) <> jsonb_array_length(public_payload->'leftItems')
        or exists (select 1 from jsonb_array_elements(public_payload->'leftItems') item where not (solution_payload->'matches' ? (item->>'id')))
        or exists (select 1 from jsonb_each_text(solution_payload->'matches') match where not exists (
          select 1 from jsonb_array_elements(public_payload->'rightItems') item where item->>'id' = match.value
        ))
        or (select count(*) from jsonb_each_text(solution_payload->'matches')) <> (select count(distinct value) from jsonb_each_text(solution_payload->'matches'))
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'word-search' then
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
      continue;
    end if;

    if question->>'type' = 'zip' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'grid', 'checkpoints', 'instruction', 'mapNote', 'boardLabel'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
        or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
        or (public_payload ? 'instruction' and (jsonb_typeof(public_payload->'instruction') is distinct from 'string'
          or char_length(btrim(public_payload->>'instruction')) not between 1 and 500))
        or (public_payload ? 'mapNote' and (jsonb_typeof(public_payload->'mapNote') is distinct from 'string'
          or char_length(btrim(public_payload->>'mapNote')) not between 1 and 500))
        or (public_payload ? 'boardLabel' and (jsonb_typeof(public_payload->'boardLabel') is distinct from 'string'
          or char_length(btrim(public_payload->>'boardLabel')) not between 1 and 500))
        or jsonb_typeof(solution_payload) is distinct from 'object'
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['solution', 'explanation']))
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string')
        or not private.zip_content_valid(public_payload, solution_payload) then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'queens' then
      if exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name not in ('category', 'tags', 'question', 'grid', 'regions', 'prefilledQueens'))
        or private.editorial_has_secret_key(public_payload)
        or not private.queens_content_valid(public_payload, solution_payload)
        or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
        or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'escape' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'grid', 'initialBlocks', 'instruction', 'hideInstruction',
          'objectiveLabel', 'hideObjectiveLabel', 'completionMessage', 'boardLabel'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
        or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
        or (public_payload ? 'instruction' and (jsonb_typeof(public_payload->'instruction') is distinct from 'string'
          or char_length(btrim(public_payload->>'instruction')) not between 1 and 500))
        or (public_payload ? 'objectiveLabel' and (jsonb_typeof(public_payload->'objectiveLabel') is distinct from 'string'
          or char_length(btrim(public_payload->>'objectiveLabel')) not between 1 and 500))
        or (public_payload ? 'completionMessage' and (jsonb_typeof(public_payload->'completionMessage') is distinct from 'string'
          or char_length(btrim(public_payload->>'completionMessage')) not between 1 and 500))
        or (public_payload ? 'boardLabel' and (jsonb_typeof(public_payload->'boardLabel') is distinct from 'string'
          or char_length(btrim(public_payload->>'boardLabel')) not between 1 and 500))
        or (public_payload ? 'hideInstruction' and jsonb_typeof(public_payload->'hideInstruction') is distinct from 'boolean')
        or (public_payload ? 'hideObjectiveLabel' and jsonb_typeof(public_payload->'hideObjectiveLabel') is distinct from 'boolean')
        or jsonb_typeof(solution_payload) is distinct from 'object'
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['referenceSolution', 'optimalMoves', 'explanation']))
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string')
        or not private.escape_content_valid(public_payload, solution_payload) then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'progressive-image' then
      if question->>'payloadSchemaVersion' = '2' then
        if jsonb_typeof(public_payload) is distinct from 'object'
          or not public_payload ?& array['question', 'surface', 'revealDurationMs']
          or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
            'category', 'tags', 'question', 'surface', 'revealDurationMs', 'answerLabel', 'answerPlaceholder'
          ]))
          or private.editorial_has_secret_key(public_payload)
          or jsonb_typeof(public_payload->'surface') is distinct from 'object'
          or not public_payload->'surface' ?& array['assetId', 'alt', 'width', 'height']
          or exists (select 1 from jsonb_object_keys(public_payload->'surface') key_name where key_name <> all(array[
            'assetId', 'alt', 'width', 'height', 'fit', 'position'
          ]))
          or public_payload->'surface'->>'assetId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          or not private.is_ready_question_asset((public_payload->'surface'->>'assetId')::uuid)
          or jsonb_typeof(public_payload->'surface'->'alt') is distinct from 'string'
          or char_length(btrim(public_payload->'surface'->>'alt')) not between 1 and 500
          or jsonb_typeof(public_payload->'surface'->'width') is distinct from 'number'
          or (public_payload->'surface'->>'width')::numeric <> trunc((public_payload->'surface'->>'width')::numeric)
          or (public_payload->'surface'->>'width')::integer not between 1 and 8192
          or jsonb_typeof(public_payload->'surface'->'height') is distinct from 'number'
          or (public_payload->'surface'->>'height')::numeric <> trunc((public_payload->'surface'->>'height')::numeric)
          or (public_payload->'surface'->>'height')::integer not between 1 and 8192
          or (public_payload->'surface' ? 'fit' and public_payload->'surface'->>'fit' not in ('cover', 'contain'))
          or (public_payload->'surface' ? 'position' and (jsonb_typeof(public_payload->'surface'->'position') is distinct from 'string'
            or char_length(public_payload->'surface'->>'position') > 100))
          or jsonb_typeof(public_payload->'revealDurationMs') is distinct from 'number'
          or (public_payload->>'revealDurationMs')::numeric <> trunc((public_payload->>'revealDurationMs')::numeric)
          or (public_payload->>'revealDurationMs')::integer <= 0
          or (public_payload->>'revealDurationMs')::integer >= (question->>'timeLimitMs')::numeric
          or (public_payload ? 'answerLabel' and jsonb_typeof(public_payload->'answerLabel') not in ('null', 'string'))
          or (public_payload ? 'answerPlaceholder' and jsonb_typeof(public_payload->'answerPlaceholder') not in ('null', 'string')) then
          raise exception 'invalid_public_payload' using errcode = '22023';
        end if;
      else
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'surface', 'revealDurationMs']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'surface', 'revealDurationMs', 'answerLabel', 'answerPlaceholder'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'surface') is distinct from 'object'
        or not public_payload->'surface' ?& array['src', 'alt', 'width', 'height']
        or exists (select 1 from jsonb_object_keys(public_payload->'surface') key_name where key_name <> all(array[
          'src', 'alt', 'width', 'height', 'fit', 'position'
        ]))
        or jsonb_typeof(public_payload->'surface'->'src') is distinct from 'string'
        or char_length(btrim(public_payload->'surface'->>'src')) not between 10 and 1000
        or left(public_payload->'surface'->>'src', 9) <> '/visuals/'
        or public_payload->'surface'->>'src' ~ '\s'
        or jsonb_typeof(public_payload->'surface'->'alt') is distinct from 'string'
        or char_length(btrim(public_payload->'surface'->>'alt')) not between 1 and 500
        or jsonb_typeof(public_payload->'surface'->'width') is distinct from 'number'
        or (public_payload->'surface'->>'width')::numeric <> trunc((public_payload->'surface'->>'width')::numeric)
        or (public_payload->'surface'->>'width')::integer <= 0
        or jsonb_typeof(public_payload->'surface'->'height') is distinct from 'number'
        or (public_payload->'surface'->>'height')::numeric <> trunc((public_payload->'surface'->>'height')::numeric)
        or (public_payload->'surface'->>'height')::integer <= 0
        or (public_payload->'surface' ? 'fit' and public_payload->'surface'->>'fit' not in ('cover', 'contain'))
        or (public_payload->'surface' ? 'position' and (jsonb_typeof(public_payload->'surface'->'position') is distinct from 'string'
          or char_length(public_payload->'surface'->>'position') > 100))
        or jsonb_typeof(public_payload->'revealDurationMs') is distinct from 'number'
        or (public_payload->>'revealDurationMs')::numeric <> trunc((public_payload->>'revealDurationMs')::numeric)
        or (public_payload->>'revealDurationMs')::integer <= 0
        or (public_payload->>'revealDurationMs')::integer >= (question->>'timeLimitMs')::numeric
        or (public_payload ? 'answerLabel' and jsonb_typeof(public_payload->'answerLabel') not in ('null', 'string'))
        or (public_payload ? 'answerPlaceholder' and jsonb_typeof(public_payload->'answerPlaceholder') not in ('null', 'string')) then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ?& array['correctAnswer', 'acceptedAnswers', 'solutionAlt']
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'correctAnswer', 'acceptedAnswers', 'solutionAlt', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
        or char_length(btrim(solution_payload->>'correctAnswer')) not between 1 and 500
        or jsonb_typeof(solution_payload->'acceptedAnswers') is distinct from 'array'
        or jsonb_array_length(solution_payload->'acceptedAnswers') not between 1 and 100
        or exists (select 1 from jsonb_array_elements(solution_payload->'acceptedAnswers') answer
          where jsonb_typeof(answer) is distinct from 'string'
            or char_length(btrim(answer #>> '{}')) not between 1 and 500)
        or exists (select 1 from jsonb_array_elements_text(solution_payload->'acceptedAnswers') answer
          group by regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g')
          having count(*) > 1)
        or not exists (select 1 from jsonb_array_elements_text(solution_payload->'acceptedAnswers') answer
          where regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g') =
            regexp_replace(lower(translate(btrim(solution_payload->>'correctAnswer'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g'))
        or position(
          regexp_replace(lower(translate(btrim(solution_payload->>'correctAnswer'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g') in
          regexp_replace(lower(translate(btrim(public_payload->'surface'->>'alt'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g')
        ) > 0
        or jsonb_typeof(solution_payload->'solutionAlt') is distinct from 'string'
        or char_length(btrim(solution_payload->>'solutionAlt')) not between 1 and 500
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'short-text' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ? 'question'
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'answerPlaceholder'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or (public_payload ? 'answerPlaceholder' and jsonb_typeof(public_payload->'answerPlaceholder') not in ('null', 'string'))
        or jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ?& array['correctAnswer', 'acceptedAnswers']
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'correctAnswer', 'acceptedAnswers', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
        or char_length(btrim(solution_payload->>'correctAnswer')) not between 1 and 500
        or jsonb_typeof(solution_payload->'acceptedAnswers') is distinct from 'array'
        or jsonb_array_length(solution_payload->'acceptedAnswers') not between 1 and 100
        or exists (select 1 from jsonb_array_elements(solution_payload->'acceptedAnswers') answer
          where jsonb_typeof(answer) is distinct from 'string'
            or char_length(btrim(answer #>> '{}')) not between 1 and 500)
        or not exists (select 1 from jsonb_array_elements_text(solution_payload->'acceptedAnswers') answer
          where regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\\s+', '', 'g') =
            regexp_replace(lower(translate(btrim(solution_payload->>'correctAnswer'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\\s+', '', 'g')) then
        raise exception 'invalid_short_text_payload' using errcode = '22023';
      end if;
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
      or (question->>'type' = 'multiple-choice' and question->>'payloadSchemaVersion' = '1'
        and public_payload ? 'media' and public_payload->'media' ? 'assetId')
      or (question->>'type' = 'multiple-choice' and question->>'payloadSchemaVersion' = '2' and (
        jsonb_typeof(public_payload->'media') is distinct from 'object'
        or not public_payload->'media' ?& array['type', 'assetId', 'alt', 'width', 'height']
        or exists (select 1 from jsonb_object_keys(public_payload->'media') key_name where key_name <> all(array[
          'type', 'assetId', 'alt', 'width', 'height', 'fit', 'position'
        ]))
        or public_payload->'media'->>'type' <> 'image'
        or public_payload->'media'->>'assetId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or not private.is_ready_question_asset((public_payload->'media'->>'assetId')::uuid)
        or jsonb_typeof(public_payload->'media'->'alt') is distinct from 'string'
        or char_length(btrim(public_payload->'media'->>'alt')) not between 1 and 500
        or jsonb_typeof(public_payload->'media'->'width') is distinct from 'number'
        or (public_payload->'media'->>'width')::numeric <> trunc((public_payload->'media'->>'width')::numeric)
        or (public_payload->'media'->>'width')::integer not between 1 and 8192
        or jsonb_typeof(public_payload->'media'->'height') is distinct from 'number'
        or (public_payload->'media'->>'height')::numeric <> trunc((public_payload->'media'->>'height')::numeric)
        or (public_payload->'media'->>'height')::integer not between 1 and 8192
        or (public_payload->'media' ? 'fit' and public_payload->'media'->>'fit' not in ('cover', 'contain'))
        or (public_payload->'media' ? 'position' and (jsonb_typeof(public_payload->'media'->'position') is distinct from 'string'
          or char_length(public_payload->'media'->>'position') > 100))
      ))
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

REVOKE ALL ON FUNCTION "private"."escape_content_valid"(jsonb, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."escape_content_valid"(jsonb, jsonb) TO "postgres";
