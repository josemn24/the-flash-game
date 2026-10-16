SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.assert_time_trial_content (
  target_version uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare version private.challenge_versions%rowtype;
begin
  select * into version from private.challenge_versions where id = target_version;
  if version.mode <> 'time-trial' then return; end if;
  if version.config_schema_version <> 1 or version.mode_config <> '{}'::jsonb
    or version.global_time_limit_ms is null or version.global_time_limit_ms <= 0
    or version.global_time_limit_ms % 1000 <> 0
    or (select count(*) from private.challenge_items where challenge_version_id = target_version) not between 2 and 20
    or (select coalesce(sum(points),0) from private.challenge_items where challenge_version_id = target_version) <> 100
    or exists (
      select 1 from private.challenge_items i join private.question_versions q on q.id = i.question_version_id
      where i.challenge_version_id = target_version and (
        i.points <= 0 or i.config_schema_version <> 1 or i.mode_config <> '{}'::jsonb
        or q.type not in ('queens','connect-pairs') or q.payload_schema_version <> 1
        or not private.is_supported_time_trial_question(q.id)
      )
    ) or (select count(distinct q.type) from private.challenge_items i
      join private.question_versions q on q.id = i.question_version_id
      where i.challenge_version_id = target_version) <> 1
    or (select max(position) from private.challenge_items where challenge_version_id = target_version)
      <> (select count(*) from private.challenge_items where challenge_version_id = target_version) then
    raise exception 'invalid_time_trial_content' using errcode = '22023';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION private.connect_pairs_answer_valid (
  public_payload jsonb,
  answer         jsonb
)
  RETURNS boolean
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
declare
  pair jsonb;
  path jsonb;
  entry jsonb;
  pair_id text;
  cell integer;
  previous_cell integer;
  first_cell integer;
  endpoint_a integer;
  endpoint_b integer;
  occupied integer[] := array[]::integer[];
begin
  if jsonb_typeof(public_payload) is distinct from 'object'
    or public_payload->'grid' is distinct from '{"rows":5,"columns":5}'::jsonb
    or public_payload->'requireFullCoverage' is distinct from 'true'::jsonb
    or jsonb_typeof(public_payload->'pairs') is distinct from 'array'
    or jsonb_typeof(answer) is distinct from 'object' then return false; end if;
  if jsonb_array_length(public_payload->'pairs') not between 3 and 5
    or jsonb_typeof(answer->'paths') is distinct from 'object'
    or (select count(*) from jsonb_object_keys(answer)) <> 1 then return false; end if;
  if (select count(*) from jsonb_object_keys(answer->'paths')) <> jsonb_array_length(public_payload->'pairs') then
    return false;
  end if;
  for pair in select value from jsonb_array_elements(public_payload->'pairs') loop
    pair_id := pair->>'id';
    endpoint_a := (pair->'endpoints'->>0)::integer;
    endpoint_b := (pair->'endpoints'->>1)::integer;
    if pair_id is null or endpoint_a is null or endpoint_b is null or endpoint_a = endpoint_b then return false; end if;
    path := answer->'paths'->pair_id;
    if jsonb_typeof(path) is distinct from 'array' then return false; end if;
    if jsonb_array_length(path) not between 2 and 25 then return false; end if;
    previous_cell := null;
    first_cell := null;
    for entry in select value from jsonb_array_elements(path) loop
      if jsonb_typeof(entry) <> 'number' then return false; end if;
      if (entry #>> '{}')::numeric <> trunc((entry #>> '{}')::numeric)
        or (entry #>> '{}')::numeric not between 0 and 24 then return false; end if;
      cell := (entry #>> '{}')::integer;
      if cell = any(occupied) then return false; end if;
      if previous_cell is not null and abs(cell / 5 - previous_cell / 5) + abs(cell % 5 - previous_cell % 5) <> 1 then
        return false;
      end if;
      first_cell := coalesce(first_cell,cell);
      previous_cell := cell;
      occupied := array_append(occupied,cell);
    end loop;
    if not ((first_cell = endpoint_a and previous_cell = endpoint_b)
      or (first_cell = endpoint_b and previous_cell = endpoint_a)) then return false; end if;
  end loop;
  return cardinality(occupied) = 25;
exception when invalid_text_representation or numeric_value_out_of_range then
  return false;
end;
$function$;

CREATE OR REPLACE FUNCTION private.handle_attempt_submission (
  op             text,
  input          jsonb,
  target_attempt public.attempts,
  target_version private.challenge_versions,
  instant        timestamp with time zone,
  received_at    timestamp with time zone
)
  RETURNS TABLE (
    updated_attempt  public.attempts,
    operation_result jsonb,
    clear_progress   boolean
  )
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  a public.attempts%rowtype := target_attempt;
  cv private.challenge_versions%rowtype := target_version;
  received timestamptz := received_at;
  question_type text;
  question_payload jsonb;
  segment private.interaction_intervals%rowtype;
  item private.challenge_items%rowtype;
  unit private.attempt_timing_units%rowtype;
  receipt private.answer_receipts%rowtype;
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  late boolean;
  result jsonb;
begin
  clear_progress := false;
  if cv.mode = 'time-trial' then received := clock_timestamp(); end if;
  select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if cv.mode = 'time-trial' then
    select q.type, q.public_payload into question_type, question_payload
      from private.question_versions q where q.id = item.question_version_id;
    if question_type = 'queens' and (op = 'pass' or received < a.deadline_at) then
      raise exception 'queens_requires_validation_command' using errcode = '22023';
    elsif question_type = 'connect-pairs' then
      if op = 'pass' then raise exception 'pass_unavailable' using errcode = '55000'; end if;
      if received >= a.deadline_at then raise exception 'deadline_reached' using errcode = '55000'; end if;
      if not private.connect_pairs_answer_valid(question_payload, input->'answer') then
        raise exception 'invalid_connect_pairs_answer' using errcode = '22023';
      end if;
    end if;
  end if;
  if op = 'receive' and exists (
    select 1 from private.question_versions q
    where q.id = item.question_version_id and q.type = 'matching'
  ) and (
    (instant < unit.deadline_at and not private.matching_answer_valid(
      (select q.public_payload from private.question_versions q where q.id = item.question_version_id),
      input->'answer',
      true
    ))
    or (instant >= unit.deadline_at and jsonb_typeof(input->'answer') <> 'null'
      and not private.matching_answer_valid(
        (select q.public_payload from private.question_versions q where q.id = item.question_version_id),
        input->'answer',
        false
      ))
  ) then
    raise exception 'invalid_matching_answer' using errcode = '22023';
  end if;
  if op = 'receive' and exists (
    select 1 from private.question_versions q
    where q.id = item.question_version_id and q.type = 'mini-wordle'
  ) and jsonb_typeof(input->'answer') <> 'null' then
    raise exception 'mini_wordle_requires_guess_command' using errcode = '22023';
  end if;
  if op = 'receive' and exists (
    select 1 from private.question_versions q
    where q.id = item.question_version_id and q.type = 'logic-code'
  ) and jsonb_typeof(input->'answer') <> 'null' then
    raise exception 'logic_code_requires_attempt_command' using errcode = '22023';
  end if;
  if op = 'receive' and exists (
    select 1 from private.question_versions q
    where q.id = item.question_version_id and q.type = 'queens'
  ) and jsonb_typeof(input->'answer') <> 'null' then
    raise exception 'queens_requires_placement_command' using errcode = '22023';
  end if;
  if op = 'receive' and exists (
    select 1 from private.question_versions q
    where q.id = item.question_version_id and q.type = 'word-search'
  ) and jsonb_typeof(input->'answer') <> 'null' then
    raise exception 'word_search_requires_selection_command' using errcode = '22023';
  end if;
  if op = 'receive' and exists (
    select 1 from private.question_versions q
    where q.id = item.question_version_id and q.type = 'word-hashtag'
  ) and jsonb_typeof(input->'answer') <> 'null' then
    raise exception 'word_hashtag_requires_swap_command' using errcode = '22023';
  end if;
  -- Entry time is captured before locks/evaluation. A stale request cannot predate presentation.
  if received < segment.started_at then raise exception 'request_predates_presentation' using errcode = '40001'; end if;
  late := received >= unit.deadline_at;
  effective := least(received, unit.deadline_at);
  if op = 'pass' and (cv.mode <> 'alphabet' or late) then raise exception 'pass_unavailable' using errcode = '55000'; end if;
  update private.interaction_intervals set ended_at = effective,
    end_reason = case when op = 'pass' then 'pass' when late then 'timeout' else 'answer' end where id = segment.id;
  if op = 'pass' then result := jsonb_build_object('passed', true);
  else
    select min(started_at), coalesce(sum(floor(extract(epoch from (ended_at - started_at)) * 1000)), 0)::bigint
      into presented, used_ms from private.interaction_intervals where attempt_id = a.id and challenge_item_id = segment.challenge_item_id;
    insert into private.answer_receipts(attempt_id, challenge_item_id, challenge_version_id, answer,
      received_at, presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
    values(a.id, segment.challenge_item_id, a.challenge_version_id,
      case when input->'answer' = 'null'::jsonb and exists (
        select 1 from private.question_versions timeout_question
        where timeout_question.id = item.question_version_id and timeout_question.type = 'word-hashtag'
      ) then coalesce(a.progress_payload->'answer', jsonb_build_object('swaps', '[]'::jsonb))
      else input->'answer' end,
      received, presented,
      effective, used_ms, late, (input->>'clientTimeUsedMs')::bigint) returning * into receipt;
    if input->'answer' = 'null'::jsonb and exists (
      select 1 from private.question_versions timeout_question
      where timeout_question.id = item.question_version_id and timeout_question.type = 'word-hashtag'
    ) then
      clear_progress := true;
    end if;
    result := jsonb_build_object('receiptId', receipt.id, 'timedOut', late, 'timeUsedMs', used_ms,
      'receivedAt', received, 'presentedAt', presented);
  end if;
  updated_attempt := a;
  operation_result := result;
  clear_progress := coalesce(clear_progress, false);
  return next;
end;
$function$;

CREATE OR REPLACE FUNCTION private.is_supported_time_trial_question (
  target_question uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select coalesce((select private.is_supported_flash_question(q.id)
    and q.type in ('queens','connect-pairs') and q.payload_schema_version = 1
    and (q.type = 'queens' or private.connect_pairs_answer_valid(q.public_payload,
      jsonb_build_object('paths',s.solution_payload->'paths')))
    from private.question_versions q join private.question_version_solutions s on s.question_version_id = q.id
    where q.id = target_question),false)
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
        where key_name <> all(array['slug', 'type', 'payloadSchemaVersion', 'timeLimitMs', 'points', 'publicPayload', 'solutionPayload', 'modeConfig'])
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
$function$;

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
        select (count(*) between 2 and 20 and cv.mode in ('flash', 'alphabet', 'survival', 'narrative', 'time-trial')
            or count(*) = 7 and cv.mode = 'pyramid')
          and bool_and(private.is_supported_flash_question(q.id))
          and (cv.mode = 'time-trial' and cv.mode_config = '{}'::jsonb and cv.global_time_limit_ms > 0 and bool_and(private.is_supported_time_trial_question(q.id)) and count(distinct q.type) = 1
            or cv.mode = 'flash' and cv.mode_config = '{}'::jsonb
            or cv.mode = 'alphabet' and cv.mode_config = '{}'::jsonb
              and bool_and(jsonb_typeof(items.mode_config->'letter') = 'string')
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

CREATE OR REPLACE FUNCTION public.get_room_calendar (
  target_room_slug text
)
  RETURNS TABLE (
    room_id             uuid,
    room_slug           text,
    room_title          text,
    time_zone           text,
    membership_role     text,
    season_id           uuid,
    season_title        text,
    season_status       text,
    publication_id      uuid,
    publication_number  integer,
    publication_status  text,
    availability_status text,
    opens_at            timestamp with time zone,
    closes_at           timestamp with time zone,
    challenge_title     text,
    challenge_subtitle  text,
    challenge_mode      text,
    question_count      bigint,
    own_attempt_status  text,
    can_start           boolean,
    can_continue        boolean
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select
    room.id, room.slug, room.title, room.time_zone, membership.role,
    season.id, season.title, season.status,
    schedule.id, schedule.number, schedule.status,
    private.publication_effective_status(
      schedule.status, season.status, season.starts_at, season.ends_at,
      schedule.opens_at, schedule.closes_at, statement_timestamp()
    ),
    schedule.opens_at, schedule.closes_at,
    version.title, version.subtitle, version.mode,
    compatibility.question_count,
    attempt.status,
    membership.role <> 'spectator' and (
      version.mode = 'flash' and version.mode_config = '{}'::jsonb
      or version.mode = 'alphabet' and version.mode_config = '{}'::jsonb
      or version.mode = 'survival'
        and (select count(*) from jsonb_object_keys(version.mode_config)) = 1
        and jsonb_typeof(version.mode_config->'lives') = 'number'
        and (version.mode_config->>'lives')::integer between 1 and compatibility.question_count
      or version.mode = 'time-trial'
        and version.mode_config = '{}'::jsonb
        and version.global_time_limit_ms > 0
      or version.mode = 'pyramid' and version.mode_config = '{}'::jsonb
        and compatibility.question_count = 7
      or version.mode = 'narrative'
        and jsonb_typeof(version.mode_config) = 'object'
        and jsonb_typeof(version.mode_config->'prologue') = 'object'
        and jsonb_typeof(version.mode_config->'beats') = 'array'
    ) and compatibility.is_supported and private.publication_is_effectively_open(
      schedule.status, season.status, season.starts_at, season.ends_at,
      schedule.opens_at, schedule.closes_at, statement_timestamp()
    ),
    coalesce(attempt.status = 'in_progress', false)
  from public.rooms room
  join public.room_memberships membership on membership.room_id = room.id
  join public.seasons season on season.room_id = room.id and season.status in ('active', 'finished')
  join public.scheduled_challenges schedule on schedule.season_id = season.id
  join private.challenge_versions version on version.id = schedule.challenge_version_id
  join lateral (
    select
      count(*)::bigint as question_count,
      (count(*) between 2 and 20 and version.mode in ('flash', 'alphabet', 'survival', 'narrative', 'time-trial')
        or count(*) = 7 and version.mode = 'pyramid')
        and coalesce(bool_and(item.position between 1 and case when version.mode = 'pyramid' then 7 else 20 end), false)
        and coalesce(bool_and(item.points > 0), false)
        and coalesce(bool_and(item.config_schema_version = 1 and (
          version.mode = 'pyramid' and private.is_valid_pyramid_level_config(item.mode_config)
          or version.mode = 'narrative'
            and jsonb_typeof(item.mode_config) = 'object'
            and jsonb_typeof(item.mode_config->'questionSlug') = 'string'
          or version.mode = 'alphabet'
            and jsonb_typeof(item.mode_config->'letter') = 'string'
          or version.mode = 'time-trial'
            and version.mode_config = '{}'::jsonb
            and version.global_time_limit_ms > 0
            and private.is_supported_time_trial_question(question.id)
            and item.mode_config = '{}'::jsonb
          or version.mode not in ('pyramid', 'narrative', 'alphabet', 'time-trial')
            and item.mode_config = '{}'::jsonb
        )), false)
        and (version.mode <> 'pyramid' or count(distinct item.mode_config->>'levelId') = 7)
        and (version.mode <> 'time-trial' or count(distinct question.type) = 1)
        and count(*) filter (where private.is_supported_flash_question(question.id)) = count(*)
        and coalesce(sum(item.points), 0) = 100 as is_supported
    from private.challenge_items item
    join private.question_versions question on question.id = item.question_version_id
    where item.challenge_version_id = version.id
  ) compatibility on true
  left join public.attempts attempt on attempt.scheduled_challenge_id = schedule.id
    and attempt.player_id = private.current_player_id() and attempt.kind = 'competitive'
  where room.slug = target_room_slug
    and room.status = 'active'
    and membership.player_id = private.current_player_id()
    and membership.status = 'active'
    and version.status in ('published', 'archived')
    and version.mode in ('flash', 'alphabet', 'survival', 'narrative', 'pyramid', 'time-trial')
    and version.config_schema_version = 1
    and version.max_score = 100
  order by schedule.number
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
    (select (count(*) between 2 and 20 and version.mode in ('flash', 'alphabet', 'survival', 'narrative', 'time-trial')
          or count(*) = 7 and version.mode = 'pyramid')
        and bool_and(private.is_supported_flash_question(question.id))
        and (version.mode = 'time-trial' and version.mode_config = '{}'::jsonb and version.global_time_limit_ms > 0 and bool_and(private.is_supported_time_trial_question(question.id)) and count(distinct question.type) = 1
        or version.mode = 'flash' and version.mode_config = '{}'::jsonb
          or version.mode = 'alphabet' and version.mode_config = '{}'::jsonb
            and bool_and(jsonb_typeof(item.mode_config->'letter') = 'string')
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

REVOKE ALL ON FUNCTION "private"."connect_pairs_answer_valid"(jsonb, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."connect_pairs_answer_valid"(jsonb, jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."is_supported_time_trial_question"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."is_supported_time_trial_question"(uuid) TO "postgres";

-- Preserve the global duration when reopening an editorial draft.
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
